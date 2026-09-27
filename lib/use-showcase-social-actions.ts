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
import { acquireShowcaseMutation, showcaseMutationPending } from "@/lib/showcase-state"
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
  const [likePending, setLikePending] = useState(false)
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
  /** S-01: satu toggle ditahan saat request suka sebelumnya masih berjalan. */
  const queuedLike = useRef(false)
  const runLikeRef = useRef<() => void>(() => {})
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
   * S-01 (audit 2026-09-24): nilai dibaca ULANG dari store saat eksekusi
   * (bukan dari closure), sehingga tap kedua saat request pertama masih
   * berjalan tidak diabaikan — ia dieksekusi setelah request pertama selesai
   * dan hasil akhirnya = keinginan terakhir pengguna.
   */
  const runLike = useCallback(() => {
    const revision = getSessionRevision()
    const release = acquireShowcaseMutation(`${revision}:like:${item.id}`)
    if (!release) {
      // Masih ada request untuk item ini (kartu ini atau kartu lain yang
      // menampilkan item yang sama) — tahan satu toggle, jangan buang diam-diam.
      queuedLike.current = true
      return
    }
    const current = getShowcaseLikeOverride(item.id) ?? {
      isLiked: item.isLiked === true,
      likeCount: item.likeCount,
    }
    const previous: ShowcaseLikeStateSnapshot = {
      isLiked: current.isLiked,
      likeCount: current.likeCount,
    }
    const next = !previous.isLiked
    setShowcaseLikeState(item.id, {
      isLiked: next,
      likeCount: Math.max(0, previous.likeCount + (next ? 1 : -1)),
    })
    setLikePending(true)
    void (async () => {
      try {
        // K-04: fallback = nilai optimistis — respons tanpa `likeCount`
        // tidak menampilkan "0 Suka".
        const optimisticCount = Math.max(0, previous.likeCount + (next ? 1 : -1))
        const res = next
          ? await likeShowcase(item.id, optimisticCount)
          : await unlikeShowcase(item.id, optimisticCount)
        if (revision !== getSessionRevision()) return
        setShowcaseLikeState(item.id, { isLiked: res.liked, likeCount: res.likeCount })
      } catch (err) {
        if (revision !== getSessionRevision()) return
        setShowcaseLikeState(item.id, previous)
        // SHOWCASE_ALREADY_LIKED (race) bukan error pengguna — cukup sinkronkan.
        const isRace = isApiError(err) && err.backendCode === "SHOWCASE_ALREADY_LIKED"
        if (isRace) {
          try {
            const fresh = await getShowcaseDetail(item.id)
            if (revision === getSessionRevision()) setShowcaseLikeState(item.id, {
              isLiked: fresh.isLiked === true, likeCount: fresh.likeCount,
            })
          } catch {
            if (revision === getSessionRevision()) clearShowcaseLikeOverride(item.id)
            toast.show({ title: "Gagal memperbarui suka", tone: "danger" })
          }
        } else {
          toast.show({
            title: "Gagal memperbarui suka",
            description: userMessage(err),
            tone: "danger",
          })
        }
      } finally {
        release()
        if (queuedLike.current) {
          // S-01: eksekusi toggle yang ditahan — state dibaca ulang di runLike.
          queuedLike.current = false
          runLikeRef.current()
        } else {
          setLikePending(false)
        }
      }
    })()
  }, [item.id, item.isLiked, item.likeCount, toast])

  /** Versi terbaru `runLike` untuk eksekusi tertunda di dalam finally. */
  useEffect(() => {
    runLikeRef.current = runLike
  }, [runLike])

  const toggleLike = useCallback(() => {
    if (!hasSession) {
      requireLogin()
      return
    }
    // Sudah ada request berjalan → antre satu toggle (S-01), bukan drop senyap.
    if (showcaseMutationPending(`${getSessionRevision()}:like:${item.id}`)) {
      queuedLike.current = true
      return
    }
    runLike()
  }, [hasSession, requireLogin, runLike, item.id])

  /**
   * Simpan/batal simpan.
   *
   * S-02 (audit 2026-09-24): override optimistis dipasang SEKARANG — label
   * berubah seketika, tidak lagi menunggu `getMeCached()` →
   * `loadShowcaseBookmarks()`. Commit ke store tetap terjadi SETELAH hidrasi
   * (supaya penulisan lokal tidak ditimpa pembacaan storage), dan override
   * dilepas saat commit selesai/gagal.
   */
  /**
   * Simpan/batal simpan — kontrak final Tim A #4 (2026-09-28).
   *
   * Server (`POST/DELETE /v1/showcase/:id/save`) adalah source of truth;
   * store lokal hanya di-commit sebagai cache koleksi "Tersimpan".
   * Optimistis: pending + hitungan langsung berubah; rollback bila gagal.
   * 409 `SHOWCASE_ALREADY_SAVED` / 404 `SHOWCASE_NOT_SAVED` = idempoten,
   * diperlakukan sebagai sukses (keadaan akhir sudah sesuai keinginan).
   */
  const toggleSave = useCallback(() => {
    if (!hasSession) {
      requireLogin()
      return
    }
    // Rapid-toggle guard: abaikan ketukan kedua selama request masih jalan,
    // agar POST/DELETE save tidak balapan dan count tidak salah.
    if (savedPending) return
    const revision = getSessionRevision()
    const wanted = !saved
    const optimisticCount = Math.max(0, saveCount + (wanted ? 1 : -1))
    setShowcaseSavedPending(item.id, wanted)
    setSaveCountOverride(optimisticCount)
    void (async () => {
      try {
        const res = wanted
          ? await saveShowcase(item.id, optimisticCount)
          : await unsaveShowcase(item.id, optimisticCount)
        if (revision !== getSessionRevision()) return
        setShowcaseSavedState(item.id, res.saved)
        setSaveCountOverride(res.saveCount)
      } catch (error) {
        if (revision !== getSessionRevision()) return
        const backendCode = isApiError(error) ? error.backendCode : undefined
        const idempotent =
          (wanted && backendCode === "SHOWCASE_ALREADY_SAVED") ||
          (!wanted && backendCode === "SHOWCASE_NOT_SAVED")
        if (idempotent) {
          // Keadaan akhir sudah sesuai — commit tanpa toast error.
          setShowcaseSavedState(item.id, wanted)
        } else {
          setSaveCountOverride(null)
          toast.show({
            title: translate("Gagal menyimpan karya"),
            description: userMessage(error),
            tone: "danger",
          })
        }
      } finally {
        setShowcaseSavedPending(item.id, null)
      }
    })()
  }, [hasSession, requireLogin, item.id, saved, saveCount, savedPending, toast])

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
