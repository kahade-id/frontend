/** Follow state/action for the showcase detail ⋮ menu only — no inline button. */
import { useCallback, useState } from "react"
import { router } from "expo-router"

import { useToast } from "@/components/ui/toast"
import { isApiError, userMessage } from "@/lib/api/errors"
import * as apiUsers from "@/lib/api/users"
import { fetchFollowStatus, setFollowStatus, useFollowStatus } from "@/lib/follow-status"
import { translate } from "@/lib/i18n"
import { ROUTES } from "@/lib/routes"
import { acquireShowcaseMutation } from "@/lib/showcase-state"
import { useHasSession } from "@/lib/guest-gate"

export function useShowcaseAuthorFollow(username: string, onChanged?: (following: boolean) => void) {
  const toast = useToast()
  const hasSession = useHasSession()
  const { following, loading: statusLoading } = useFollowStatus(username)
  const [busy, setBusy] = useState(false)

  const handleToggle = useCallback(
    async (next: boolean) => {
      if (!username || busy) return
      // P3: tamu diarahkan login dulu — jangan tembak endpoint lalu 401.
      if (!hasSession) {
        router.push(ROUTES.loginRequired("/showcase"))
        return
      }
      // SH-F-004: kunci sinkron per-username — guard boolean state balapan
      // antar dua tap cepat.
      const release = acquireShowcaseMutation(`followbtn:${username}`)
      if (!release) return
      // Status final mungkin belum selesai dimuat → muat dulu (cached),
      // bukan menebak dari label tombol. Pakai niat pemanggil hanya bila
      // backend belum pernah memberi status.
      const current = await fetchFollowStatus(username)
      const target = current == null ? next : !current
      const prev = current
      setFollowStatus(username, target)
      setBusy(true)
      try {
        if (target) await apiUsers.followUser(username)
        else await apiUsers.unfollowUser(username)
        onChanged?.(target)
      } catch (err) {
        setFollowStatus(username, prev)
        toast.show({
          title: target ? translate("Gagal mengikuti") : translate("Gagal berhenti mengikuti"),
          description: isApiError(err) ? userMessage(err) : undefined,
          tone: "danger",
        })
      } finally {
        release()
        setBusy(false)
      }
    },
    [username, busy, hasSession, onChanged, toast],
  )

  return {
    following: following === true,
    loading: busy || statusLoading,
    onToggle: (next: boolean) => void handleToggle(next),
  }
}
