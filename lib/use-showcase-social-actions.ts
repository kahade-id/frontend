/** Shared social actions: account-scoped state, item-wide mutation lock, gesture-safe sharing. */
import { useCallback, useEffect, useRef, useState } from "react"
import { router, useGlobalSearchParams, usePathname } from "expo-router"

import { api, isApiError, userMessage } from "@/lib/api"
import {
  getShowcaseDetail,
  likeShowcase,
  unlikeShowcase,
  type ShowcaseSocialItem,
} from "@/lib/api/showcase"
import { useHasSession, useSessionRevision } from "@/lib/guest-gate"
import { getSessionRevision } from "@/lib/api/session"
import { acquireShowcaseMutation, showcaseMutationPending } from "@/lib/showcase-state"
import { ROUTES } from "@/lib/routes"
import { shareShowcaseById } from "@/lib/showcase-social"
import {
  loadShowcaseBookmarks,
  clearShowcaseLikeOverride,
  getShowcaseLikeOverride,
  setShowcaseLikeState,
  setShowcaseSavedPending,
  toggleShowcaseSaved,
  useShowcaseLikeOverride,
  useShowcaseSaved,
  useShowcaseSavedPending,
} from "@/lib/showcase-social-prefs"
import { useToast } from "@/components/ui/toast"

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
}

export function useShowcaseSocialActions(item: ShowcaseSocialItem): ShowcaseSocialActions {
  const toast = useToast()
  const hasSession = useHasSession()
  const sessionRevision = useSessionRevision()
  const override = useShowcaseLikeOverride(item.id)
  const saved = useShowcaseSaved(item.id)
  const savedPending = useShowcaseSavedPending(item.id)
  const [likePending, setLikePending] = useState(false)
  /** S-01: satu toggle ditahan saat request suka sebelumnya masih berjalan. */
  const queuedLike = useRef(false)
  const runLikeRef = useRef<() => void>(() => {})
  useEffect(() => {
    const revision = getSessionRevision()
    if (hasSession) void api.users.getMeCached().then((me) => {
      if (revision === getSessionRevision()) return loadShowcaseBookmarks(me.id)
    }).catch(() => {})
  }, [hasSession, sessionRevision])
  const previousItem = useRef(item)
  useEffect(() => {
    if (previousItem.current !== item && !showcaseMutationPending(`${getSessionRevision()}:like:${item.id}`)) clearShowcaseLikeOverride(item.id)
    previousItem.current = item
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
  const toggleSave = useCallback(() => {
    if (!hasSession) {
      requireLogin()
      return
    }
    const revision = getSessionRevision()
    const wanted = !saved
    setShowcaseSavedPending(item.id, wanted)
    void (async () => {
      try {
        const me = await api.users.getMeCached()
        if (revision !== getSessionRevision()) return
        await loadShowcaseBookmarks(me.id)
        if (revision !== getSessionRevision()) return
        toggleShowcaseSaved(item.id)
      } catch (error) {
        // C-01: userMessage(ApiError) meneruskan pesan batas 25 apa adanya.
        toast.show({ title: "Gagal menyimpan karya", description: userMessage(error), tone: "danger" })
      } finally {
        setShowcaseSavedPending(item.id, null)
      }
    })()
  }, [hasSession, requireLogin, item.id, saved, toast])

  const share = useCallback(() => {
    void (async () => {
      try {
        // Share boleh tamu (endpoint auth:none) — konversi corong publik.
        const { outcome } = await shareShowcaseById(item.id, item)
        if (outcome === "copied") {
          toast.show({ title: "Tautan disalin ke papan klip", tone: "success", duration: 2500 })
        } else if (outcome === "unavailable") {
          toast.show({ title: "Share tidak tersedia di perangkat ini", tone: "info" })
        }
      } catch (err) {
        toast.show({
          title: "Gagal menyiapkan share",
          description: isApiError(err) ? userMessage(err) : undefined,
          tone: "danger",
        })
      }
    })()
  }, [item, toast])

  return {
    liked,
    likeCount,
    saved,
    hasSession,
    likePending,
    savedPending,
    requireLogin,
    toggleLike,
    toggleSave,
    share,
  }
}

type ShowcaseLikeStateSnapshot = { isLiked: boolean; likeCount: number }
