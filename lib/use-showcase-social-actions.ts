/** Shared social actions: account-scoped state, item-wide mutation lock, gesture-safe sharing. */
import { useCallback, useEffect, useRef } from "react"
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
  toggleShowcaseSaved,
  useShowcaseLikeOverride,
  useShowcaseSaved,
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
   */
  const toggleLike = useCallback(() => {
    if (!hasSession) {
      requireLogin()
      return
    }
    const revision = getSessionRevision()
    const release = acquireShowcaseMutation(`${revision}:like:${item.id}`)
    if (!release) return
    const previous: ShowcaseLikeStateSnapshot = {
      isLiked: getShowcaseLikeOverride(item.id)?.isLiked ?? liked,
      likeCount: getShowcaseLikeOverride(item.id)?.likeCount ?? likeCount,
    }
    const next = !previous.isLiked
    setShowcaseLikeState(item.id, {
      isLiked: next,
      likeCount: Math.max(0, previous.likeCount + (next ? 1 : -1)),
    })
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
      }
    })()
  }, [hasSession, requireLogin, liked, likeCount, item.id, toast])

  const toggleSave = useCallback(() => {
    if (!hasSession) {
      requireLogin()
      return
    }
    const revision = getSessionRevision()
    void api.users.getMeCached().then(async (me) => {
      if (revision !== getSessionRevision()) return
      await loadShowcaseBookmarks(me.id)
      if (revision !== getSessionRevision()) return
      toggleShowcaseSaved(item.id)
    }).catch((error) => toast.show({ title: "Gagal menyimpan karya", description: userMessage(error), tone: "danger" }))
    // C-01: userMessage(ApiError) meneruskan pesan batas 25 apa adanya.
  }, [hasSession, requireLogin, item.id, toast])

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

  return { liked, likeCount, saved, hasSession, requireLogin, toggleLike, toggleSave, share }
}

type ShowcaseLikeStateSnapshot = { isLiked: boolean; likeCount: number }
