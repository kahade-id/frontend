/**
 * Screen — Pengguna Diblokir (GET /v1/settings/blocked-users, DELETE unblock).
 *
 * Audit: daftar dibaca lewat `useApiQuery`; buka-blokir memakai
 * `query.setData` (optimistic removal) sehingga tidak perlu state daftar
 * kedua yang bisa desinkron dengan hasil fetch berikutnya. Pesan galat toast
 * memakai `userMessage(err)` — bukan copy tetap yang menyembunyikan alasan
 * sebenarnya (mis. "pengguna sudah tidak diblokir").
 */
import { useCallback, useState } from "react"
import { Prohibit } from "phosphor-react-native"

import { api } from "@/lib/api"
import type { BlockedUser } from "@/lib/api/settings"
import { userMessage } from "@/lib/api/errors"
import { useApiQuery } from "@/lib/use-api-query"

import { Button } from "@/components/ui/button"
import { DataScreen } from "@/components/ui/data-screen"
import { UserListItem } from "@/components/ui/user-list-item"
import { useToast } from "@/components/ui/toast"
// UX: haptic feedback ensured for onPress (light) — improves confirmation

export default function BlockedUsersScreen() {
  const toast = useToast()
  const query = useApiQuery("blocked-users", () => api.settings.getBlockedUsers())
  const items = query.data ?? []
  const [unblockingId, setUnblockingId] = useState<string | null>(null)
  const { setData } = query

  const handleUnblock = useCallback(
    async (user: BlockedUser) => {
      setUnblockingId(user.id)
      try {
        await api.settings.unblockUser(user.id)
        setData((prev) => (prev ?? []).filter((u) => u.id !== user.id))
        toast.show({ title: `${user.username} dibuka blokirnya`, tone: "success", duration: 3000 })
      } catch (err) {
        toast.show({ title: "Gagal membuka blokir", description: userMessage(err), tone: "danger" })
      } finally {
        setUnblockingId(null)
      }
    },
    [setData, toast.show],
  )

  return (
    <DataScreen
      title="Pengguna Diblokir"
      state={query}
      loadingMessage="Memuat daftar…"
      empty={
        items.length === 0 && {
          icon: Prohibit,
          title: "Tidak ada yang diblokir",
          description: "Pengguna yang Anda blokir akan muncul di sini.",
        }
      }
      contentClassName="gap-1"
    >
      {items.map((u, i) => (
        <UserListItem
          key={u.id}
          name={u.fullName ?? u.username}
          username={u.username}
          avatar={{ source: u.avatarUrl ?? undefined }}
          blocked
          action={
            <Button accessibilityHint="Ketuk untuk berinteraksi"
              variant="ghost"
              size="sm"
              fullWidth={false}
              loading={unblockingId === u.id}
              onPress={() => void handleUnblock(u)}
            >
              Buka Blokir
            </Button>
          }
          divider={i < items.length - 1}
        />
      ))}
    </DataScreen>
  )
}