/** Shared social actions: account-scoped state, item-wide mutation lock, gesture-safe sharing. */
import { useCallback, useEffect, useRef, useState } from "react"
import { router, useGlobalSearchParams, usePathname } from "expo-router"

import { api, isApiError, userMessage } from "@/lib/api"
import {
  getShowcaseDetail,
  likeShowcase,
  saveShowcase,
  unlikeShowcase,
  unsaveShowcase,
  type ShowcaseSocialItem,
} from "@/lib/api/showcase"
import { useHasSession, useSessionRevision } from "@/lib/guest-gate"
import { getSessionRevision } from "@/lib/api/session"
import {
  acquireShowcaseMutation,
  peekWantedToggle,
  setWantedToggle,
  showcaseMutationPending,
  takeWantedToggle,
  useShowcaseMutationPending,
} from "@/lib/showcase-state"
import { ROUTES } from "@/lib/routes"
import { shouldClearLikeOverride, type ServerLikeState } from "@/lib/showcase-social"
import {
  loadShowcaseBookmarks,
  clearShowcaseLikeOverride,
  getShowcaseLikeOverride,
  setShowcaseLikeState,
  setShowcaseSavedPending,
  setShowcaseSavedState,
  useShowcaseLikeOverride,
  useShowcaseSaved,
  useShowcaseSavedPending,
} from "@/lib/showcase-social-prefs"
import { useToast } from "@/components/ui/toast"
import { translate } from "@/lib/i18n/translate"
import { optimisticToggleState } from "@/lib/showcase-social"

/**
 * C-03 (audit 2026-09-23): tujuan kembali setelah login = LAYAR SAAT INI
 * (dengan param-nya), bukan selalu halaman detail. Tamu yang menekan ♥ di
 * feed/profil setelah login harus mendarat lagi di posisi itu.
 */
export function useLoginNextPath(fallback: string): () => string {
  const pathname = usePathname()
  const params = useGlobalSearchParams()
  return useCallback(() => {
    const query = Object.entries(params)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join("&")
    const at = pathname && pathname !== "/" ? pathname : fallback
    return query ? `${at}?${query}` : at
  }, [pathname, params, fallback])
}

export type ShowcaseSocialActions = {
  /** Nilai efektif (override store bila ada, kalau tidak nilai item). */
  liked: boolean
  likeCount: number
  saved: boolean
  /**
   * Kontrak final Tim A #4 (2026-09-28): jumlah penyimpan dari server
   * (`saveCount`), dengan override optimistis sesi ini bila ada.
   */
  saveCount: number
  hasSession: boolean
  /**
   * S-01/S-02 (audit 2026-09-24): request suka/simpan sedang berjalan. UI
   * memakainya untuk state "sedang diproses" — bukan lagi diam tanpa umpan
   * balik; tap kedua saat suka berjalan kini DIANTRE (lihat `toggleLike`).
   */
  likePending: boolean
  savedPending: boolean
  /** Tampilkan ajakan login (dipakai juga komposer komentar & tombol lapor). */
  requireLogin: () => void
  toggleLike: () => void
  toggleSave: () => void
  share: () => void
  shareSheetVisible: boolean
  setShareSheetVisible: (v: boolean) => void
}

export function useShowcaseSocialActions(item: ShowcaseSocialItem): ShowcaseSocialActions {
  const toast = useToast()
  const hasSession = useHasSession()
  const sessionRevision = useSessionRevision()
  const override = useShowcaseLikeOverride(item.id)
  const saved = useShowcaseSaved(item.id)
  const savedPending = useShowcaseSavedPending(item.id)
  // SO-02: "sedang diproses" dari kunci global — bukan state per instance.
  const likePending = useShowcaseMutationPending(`${sessionRevision}:like:${item.id}`)
  /**
   * Kontrak final Tim A #4 (2026-09-28): override jumlah simpan sesi ini.
   * null = ikut `item.saveCount` dari server. Direset tiap ganti item.
   */
  const [saveCountOverride, setSaveCountOverride] = useState<number | null>(null)
  useEffect(() => {
    setSaveCountOverride(null)
  }, [item.id])
  const saveCount = saveCountOverride ?? item.saveCount ?? 0
  /**
   * Seed status simpan dari `isSaved` server — server adalah source of truth
   * (kontrak #4); store lokal hanya cache koleksi "Tersimpan". Dijalankan
   * SETELAH hidrasi bookmark lokal supaya tidak ditimpa data storage lama.
   * Payload tanpa `isSaved` (kontrak lama) tidak di-seed — nilai lokal tetap.
   */
  useEffect(() => {
    if (!hasSession || item.isSaved === undefined) return
    const isSaved = item.isSaved
    const id = item.id
    let alive = true
    void (async () => {
      try {
        const me = await api.users.getMeCached()
        if (!alive || getSessionRevision() !== sessionRevision) return
        await loadShowcaseBookmarks(me.id)
        if (!alive || getSessionRevision() !== sessionRevision) return
        setShowcaseSavedState(id, isSaved)
      } catch {
        // Hidrasi gagal — tombol tetap pakai nilai lokal, tidak merusak.
      }
    })()
    return () => {
      alive = false
    }
  }, [item.id, item.isSaved, hasSession, sessionRevision])
  /**
   * SO-01/SO-02 (audit etalase 2026-10-10): toggle yang datang saat request
   * masih berjalan TIDAK lagi berupa flag boolean per instance — tampilan
   * berubah seketika dan TUJUAN terakhir disimpan global per item
   * (`setWantedToggle`), sehingga instance mana pun (kartu feed atau detail)
   * yang menyelesaikan request mengeksekusinya. Dulu: tiga tap beruntun
   * berakhir di arah yang salah, tap kedua tanpa umpan balik, dan flag
   * tersangkut di instance lain → toggle liar belakangan.
   */
  const performLikeRef = useRef<(previous: ShowcaseLikeStateSnapshot, next: boolean) => void>(() => {})
  const performSaveRef = useRef<(previousSaved: boolean, previousCount: number, next: boolean) => void>(() => {})
  useEffect(() => {
    const revision = getSessionRevision()
    if (hasSession) void api.users.getMeCached().then((me) => {
      if (revision === getSessionRevision()) return loadShowcaseBookmarks(me.id)
    }).catch(() => {})
  }, [hasSession, sessionRevision])
  /**
   * SH-F-001 (audit 2026-09-27): override like optimistis JANGAN dibuang
   * berdasar identitas objek. `mergeById` (load-more) dan ledger komentar
   * membuat objek baru untuk data yang SAMA — clear-by-identity memadamkan
   * hati yang baru dikonfirmasi server. Sebagai gantinya: simpan snapshot
   * nilai SERVER per item; override hanya dibuang bila nilai server
   * definitif BERUBAH (lihat `shouldClearLikeOverride`).
   */
  const likeServerSnapshots = useRef(new Map<string, ServerLikeState>())
  const likeSnapshotRevision = useRef(getSessionRevision())
  useEffect(() => {
    const revision = getSessionRevision()
    if (likeSnapshotRevision.current !== revision) {
      // Ganti sesi = semua override sudah dibuang store; snapshot ikut reset.
      likeSnapshotRevision.current = revision
      likeServerSnapshots.current.clear()
    }
    const nextServer: ServerLikeState = {
      isLiked: item.isLiked === true,
      likeCount: item.likeCount,
    }
    const prevServer = likeServerSnapshots.current.get(item.id)
    likeServerSnapshots.current.set(item.id, nextServer)
    if (
      shouldClearLikeOverride(
        prevServer,
        nextServer,
        showcaseMutationPending(`${revision}:like:${item.id}`),
      )
    ) {
      clearShowcaseLikeOverride(item.id)
    }
  }, [item])

  const liked = override?.isLiked ?? item.isLiked === true
  const likeCount = override?.likeCount ?? item.likeCount

  // C-03: kembali ke layar asal (bukan selalu /showcase/{id}).
  const nextPath = useLoginNextPath(`/showcase/${encodeURIComponent(item.id)}`)
  const requireLogin = useCallback(() => {
    router.push(ROUTES.loginRequired(nextPath()))
  }, [nextPath])

  /**
   * Suka/batal suka. Optimistis ke store (semua layar ikut berubah), lalu
   * disinkronkan dengan nilai FINAL dari server `{liked, likeCount}`.
   * C-02 (audit 2026-09-23): TIDAK memanggil markShowcaseFeedDirty — satu
   * tap tidak boleh memicu refetch feed (A-01: halaman 2..N ter-reset).
   *
   * `performLike(previous, next)`: SATU request menuju `next`; `previous` =
   * snapshot server untuk rollback (tampilan optimistis sudah dipasang
   * pemanggil). Setelah selesai, tujuan yang diantre (SO-01) yang berbeda
   * dari state server dieksekusi sebagai request lanjutan — tepat satu.
   */
  const performLike = useCallback((previous: ShowcaseLikeStateSnapshot, next: boolean) => {
    const revision = getSessionRevision()
    const key = `${revision}:like:${item.id}`
    const release = acquireShowcaseMutation(key)
    if (!release) {
      // Pemanggil sudah memeriksa lock; bila kalah balapan, jangan dibuang.
      setWantedToggle(key, next)
      return
    }
    void (async () => {
      /** State server yang berlaku setelah request ini (basis antrean lanjutan). */
      let settled: ShowcaseLikeStateSnapshot = previous
      try {
        // K-04: fallback = nilai optimistis — respons tanpa `likeCount`
        // tidak menampilkan "0 Suka".
        const optimisticCount = Math.max(0, previous.likeCount + (next ? 1 : -1))
        const res = next
          ? await likeShowcase(item.id, optimisticCount)
          : await unlikeShowcase(item.id, optimisticCount)
        if (revision !== getSessionRevision()) return
        settled = { isLiked: res.liked, likeCount: res.likeCount }
        // Tap yang masih mengantre sudah mengubah tampilan — jangan ditimpa.
        if (peekWantedToggle(key) == null) setShowcaseLikeState(item.id, settled)
      } catch (err) {
        if (revision !== getSessionRevision()) return
        // SHOWCASE_ALREADY_LIKED (race) bukan error pengguna — cukup sinkronkan.
        const isRace = isApiError(err) && err.backendCode === "SHOWCASE_ALREADY_LIKED"
        if (isRace) {
          try {
            const fresh = await getShowcaseDetail(item.id)
            if (revision !== getSessionRevision()) return
            settled = { isLiked: fresh.isLiked === true, likeCount: fresh.likeCount }
            if (peekWantedToggle(key) == null) setShowcaseLikeState(item.id, settled)
          } catch {
            // D1-009: sinkronisasi ulang ikut gagal -> batalkan juga toggle
            // yang tertahan (alasan sama seperti di bawah).
            takeWantedToggle(key)
            if (revision === getSessionRevision()) clearShowcaseLikeOverride(item.id)
            toast.show({ title: translate("Gagal memperbarui suka"), tone: "danger" })
          }
        } else {
          // D1-009 (perf 2026-09-29): request GAGAL -> batalkan toggle yang
          // tertahan, lalu rollback ke snapshot `previous`. Toggle tertahan
          // dibuat RELATIF terhadap state optimistis yang kini di-rollback;
          // mengeksekusinya akan membalik ke arah yang SALAH.
          takeWantedToggle(key)
          setShowcaseLikeState(item.id, previous)
          toast.show({
            title: translate("Gagal memperbarui suka"),
            description: userMessage(err),
            tone: "danger",
          })
        }
      } finally {
        release()
        const wanted = takeWantedToggle(key)
        if (wanted != null && revision === getSessionRevision()) {
          if (wanted !== settled.isLiked) {
            // Tampilan sudah = `wanted`; luruskan hitungannya ke basis server
            // lalu kirim request lanjutan (hanya SATU, apa pun jumlah tap).
            setShowcaseLikeState(item.id, {
              isLiked: wanted,
              likeCount: Math.max(0, settled.likeCount + (wanted ? 1 : -1)),
            })
            performLikeRef.current(settled, wanted)
          } else {
            setShowcaseLikeState(item.id, settled)
          }
        }
      }
    })()
  }, [item.id, toast])

  /** Versi terbaru `performLike` untuk eksekusi tertunda di dalam finally. */
  useEffect(() => {
    performLikeRef.current = performLike
  }, [performLike])

  const toggleLike = useCallback(() => {
    if (!hasSession) {
      requireLogin()
      return
    }
    const key = `${getSessionRevision()}:like:${item.id}`
    const current = getShowcaseLikeOverride(item.id) ?? {
      isLiked: item.isLiked === true,
      likeCount: item.likeCount,
    }
    // C13: transisi optimistis murni — rollback = snapshot `current`.
    const optimistic = optimisticToggleState({ active: current.isLiked, count: current.likeCount })
    setShowcaseLikeState(item.id, { isLiked: optimistic.active, likeCount: optimistic.count })
    if (showcaseMutationPending(key)) {
      // SO-01: request masih berjalan (kartu ini atau kartu lain) — tampilan
      // sudah berubah di atas; simpan TUJUAN terakhir, bukan hitungan tap.
      setWantedToggle(key, optimistic.active)
      return
    }
    performLike({ isLiked: current.isLiked, likeCount: current.likeCount }, optimistic.active)
  }, [hasSession, requireLogin, performLike, item.id, item.isLiked, item.likeCount])

  /**
   * Simpan/batal simpan — kontrak final Tim A #4 (2026-09-28).
   *
   * Server (`POST/DELETE /v1/showcase/:id/save`) adalah source of truth;
   * store lokal hanya di-commit sebagai cache koleksi "Tersimpan".
   * Optimistis: pending + hitungan langsung berubah; rollback bila gagal.
   * 409 `SHOWCASE_ALREADY_SAVED` / 404 `SHOWCASE_NOT_SAVED` = idempoten,
   * diperlakukan sebagai sukses (keadaan akhir sudah sesuai keinginan).
   * SO-01/SO-02: tap saat request berjalan mengubah tampilan seketika dan
   * mengantre TUJUAN terakhir secara global (pola sama dengan performLike).
   */
  const performSave = useCallback((previousSaved: boolean, previousCount: number, next: boolean) => {
    const revision = getSessionRevision()
    const key = `${revision}:save:${item.id}`
    setShowcaseSavedPending(item.id, next)
    void (async () => {
      let settledSaved = previousSaved
      let settledCount = previousCount
      try {
        const optimisticCount = Math.max(0, previousCount + (next ? 1 : -1))
        const res = next
          ? await saveShowcase(item.id, optimisticCount)
          : await unsaveShowcase(item.id, optimisticCount)
        if (revision !== getSessionRevision()) return
        settledSaved = res.saved
        settledCount = res.saveCount
        if (peekWantedToggle(key) == null) {
          setShowcaseSavedState(item.id, res.saved)
          setSaveCountOverride(res.saveCount)
        }
      } catch (error) {
        if (revision !== getSessionRevision()) return
        const backendCode = isApiError(error) ? error.backendCode : undefined
        const idempotent =
          (next && backendCode === "SHOWCASE_ALREADY_SAVED") ||
          (!next && backendCode === "SHOWCASE_NOT_SAVED")
        if (idempotent) {
          // Keadaan akhir sudah sesuai — commit tanpa toast error.
          settledSaved = next
          settledCount = Math.max(0, previousCount + (next ? 1 : -1))
          if (peekWantedToggle(key) == null) setShowcaseSavedState(item.id, next)
        } else {
          // P2-04: request GAGAL → batalkan toggle yang tertahan (dibuat
          // relatif terhadap state optimistis yang kini di-rollback).
          takeWantedToggle(key)
          setSaveCountOverride(null)
          toast.show({
            title: translate("Gagal menyimpan karya"),
            description: userMessage(error),
            tone: "danger",
          })
        }
      } finally {
        setShowcaseSavedPending(item.id, null)
        const wanted = takeWantedToggle(key)
        if (wanted != null && revision === getSessionRevision()) {
          if (wanted !== settledSaved) {
            setSaveCountOverride(Math.max(0, settledCount + (wanted ? 1 : -1)))
            performSaveRef.current(settledSaved, settledCount, wanted)
          } else {
            setShowcaseSavedState(item.id, settledSaved)
            setSaveCountOverride(settledCount)
          }
        }
      }
    })()
  }, [item.id, toast])

  /** Versi terbaru `performSave` untuk eksekusi tertunda di dalam finally. */
  useEffect(() => {
    performSaveRef.current = performSave
  }, [performSave])

  const toggleSave = useCallback(() => {
    if (!hasSession) {
      requireLogin()
      return
    }
    const key = `${getSessionRevision()}:save:${item.id}`
    // C13: transisi optimistis murni — `saved` sudah memuat nilai pending.
    const optimistic = optimisticToggleState({ active: saved, count: saveCount })
    if (savedPending) {
      // SO-01: tampilan berubah seketika; tujuan terakhir diantre global.
      setShowcaseSavedPending(item.id, optimistic.active)
      setSaveCountOverride(optimistic.count)
      setWantedToggle(key, optimistic.active)
      return
    }
    setSaveCountOverride(optimistic.count)
    performSave(saved, saveCount, optimistic.active)
  }, [hasSession, requireLogin, savedPending, saved, saveCount, performSave, item.id])

  const [shareSheetVisible, setShareSheetVisible] = useState(false)
  const share = useCallback(() => setShareSheetVisible(true), [])

  return {
    liked,
    likeCount,
    saved,
    saveCount,
    hasSession,
    likePending,
    savedPending,
    requireLogin,
    toggleLike,
    toggleSave,
    share,
    shareSheetVisible,
    setShareSheetVisible,
  }
}

type ShowcaseLikeStateSnapshot = { isLiked: boolean; likeCount: number }
