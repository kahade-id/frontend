/**
 * Kahade — useShowcaseSocialActions: SATU implementasi aksi sosial kartu
 * etalase (suka, simpan, bagikan) untuk tiga layar (feed, tab Etalase
 * profil, detail). Audit yang diperbaiki di sini:
 *
 *   - A-05/C-06: tamu yang menekan aksi ber-auth diarahkan ke layar ajakan
 *     login (ROUTES.loginRequired), bukan memanen 401 + toast generik.
 *   - A-06/A-07/C-05: state suka & simpan hidup di store bersama
 *     (`lib/showcase-social-prefs.ts`) — menekan ♥ di feed langsung terlihat
 *     di detail, dan sebaliknya; nilai suka yang disimpan adalah nilai
 *     FINAL server, jadi layar lain selalu sinkron.
 *   - I-04: share memakai `shareShowcaseById` (fallback salin tautan saat
 *     WebShare tidak tersedia), lengkap dengan toast hasil yang benar.
 *
 * Kontrak: panggil SEKALI per kartu/detail. Handler yang dikembalikan sudah
 * memakai useCallback; `likeBusy` menjaga double-tap per item.
 */
import { useCallback, useRef } from "react"
import { router } from "expo-router"

import { isApiError, userMessage } from "@/lib/api"
import {
  likeShowcase,
  unlikeShowcase,
  type ShowcaseSocialItem,
} from "@/lib/api/showcase"
import { useHasSession } from "@/lib/guest-gate"
import { ROUTES } from "@/lib/routes"
import { shareShowcaseById } from "@/lib/showcase-social"
import {
  setShowcaseLikeState,
  toggleShowcaseSaved,
  useShowcaseLikeOverride,
  useShowcaseSaved,
} from "@/lib/showcase-social-prefs"
import { useToast } from "@/components/ui/toast"

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
  const override = useShowcaseLikeOverride(item.id)
  const saved = useShowcaseSaved(item.id)
  /** Guard per item: dua request suka berbarengan. */
  const likeBusy = useRef(false)

  const liked = override?.isLiked ?? item.isLiked === true
  const likeCount = override?.likeCount ?? item.likeCount

  const requireLogin = useCallback(() => {
    router.push(ROUTES.loginRequired())
  }, [])

  /**
   * Suka/batal suka. Optimistis ke store (semua layar ikut berubah), lalu
   * disinkronkan dengan nilai FINAL dari server `{liked, likeCount}`.
   */
  const toggleLike = useCallback(() => {
    if (!hasSession) {
      requireLogin()
      return
    }
    if (likeBusy.current) return
    const previous: ShowcaseLikeStateSnapshot = {
      isLiked: liked,
      likeCount,
    }
    const next = !previous.isLiked
    likeBusy.current = true
    setShowcaseLikeState(item.id, {
      isLiked: next,
      likeCount: Math.max(0, previous.likeCount + (next ? 1 : -1)),
    })
    void (async () => {
      try {
        const res = next ? await likeShowcase(item.id) : await unlikeShowcase(item.id)
        setShowcaseLikeState(item.id, { isLiked: res.liked, likeCount: res.likeCount })
      } catch (err) {
        setShowcaseLikeState(item.id, previous)
        // SHOWCASE_ALREADY_LIKED (race) bukan error pengguna — cukup sinkronkan.
        const isRace = isApiError(err) && err.backendCode === "SHOWCASE_ALREADY_LIKED"
        if (!isRace) {
          toast.show({
            title: "Gagal memperbarui suka",
            description: userMessage(err),
            tone: "danger",
          })
        }
      } finally {
        likeBusy.current = false
      }
    })()
  }, [hasSession, requireLogin, liked, likeCount, item.id, toast])

  const toggleSave = useCallback(() => {
    if (!hasSession) {
      requireLogin()
      return
    }
    toggleShowcaseSaved(item.id)
  }, [hasSession, requireLogin, item.id])

  const share = useCallback(() => {
    void (async () => {
      try {
        // Share boleh tamu (endpoint auth:none) — konversi corong publik.
        const { outcome } = await shareShowcaseById(item.id)
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
  }, [item.id, toast])

  return { liked, likeCount, saved, hasSession, requireLogin, toggleLike, toggleSave, share }
}

type ShowcaseLikeStateSnapshot = { isLiked: boolean; likeCount: number }
