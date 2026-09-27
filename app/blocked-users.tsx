/**
 * Screen — Pengguna Diblokir (GET /v1/settings/blocked-users, DELETE unblock).
 *
 * Audit: daftar dibaca lewat `useApiQuery`; buka-blokir memakai
 * `query.setData` (optimistic removal) sehingga tidak perlu state daftar
 * kedua yang bisa desinkron dengan hasil fetch berikutnya. Pesan galat toast
 * memakai `userMessage(err)` — bukan copy tetap yang menyembunyikan alasan
 * sebenarnya (mis. "pengguna sudah tidak diblokir").
 */
import { useCallback, useRef, useState } from "react"
import { Prohibit } from "phosphor-react-native"

import { api } from "@/lib/api"
import type { BlockedUser } from "@/lib/api/settings"
import { userMessage } from "@/lib/api/errors"
import { useApiQuery } from "@/lib/use-api-query"
import { formatDate } from "@/lib/format"

import { Button } from "@/components/ui/button"
import { DataScreen } from "@/components/ui/data-screen"
import { Dialog } from "@/components/ui/modal"
import { UserListItem } from "@/components/ui/user-list-item"
import { useToast } from "@/components/ui/toast"
import { translate, useLanguage } from "@/lib/i18n"

export default function BlockedUsersScreen() {
  const toast = useToast()
  // i18n: label mengikuti bahasa aktif.
  useLanguage()
  const query = useApiQuery("blocked-users", (signal) => api.settings.getBlockedUsers(signal))
  const items = query.data ?? []
  const [unblockingId, setUnblockingId] = useState<string | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<BlockedUser | null>(null)
  const { setData } = query

  // UI-P009: kunci in-flight sinkron — guard state async `unblockingId`
  // balapan antar dua tap cepat pada tombol konfirmasi dialog.
  const unblockingRef = useRef(false)
  const handleUnblock = useCallback(
    async (user: BlockedUser) => {
      if (unblockingRef.current) return
      unblockingRef.current = true
      setUnblockingId(user.id)
      try {
        await api.settings.unblockUser(user.id)
        setData((prev) => (prev ?? []).filter((u) => u.id !== user.id))
        setConfirmTarget(null)
        toast.show({
          title: translate("@{x} dibuka blokirnya", { x: user.username }),
          tone: "success",
          duration: 3000,
        })
      } catch (err) {
        toast.show({ title: translate("Gagal membuka blokir"), description: userMessage(err), tone: "danger" })
      } finally {
        unblockingRef.current = false
        setUnblockingId(null)
      }
    },
    [setData, toast.show],
  )

  return (
    <>
      <DataScreen
        title={translate("Pengguna Diblokir")}
        state={query}
        loadingMessage={translate("Memuat daftar…")}
        empty={
          items.length === 0 && {
            icon: Prohibit,
            title: translate("Tidak ada yang diblokir"),
            description: translate("Pengguna yang Anda blokir akan muncul di sini."),
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
            // FE-IMP-3 #98 — tanggal diblokir per baris (caption di bawah handle).
            stat={u.blockedAt ? translate("Diblokir {x}", { x: formatDate(u.blockedAt) }) : undefined}
            action={
              <Button
                variant="ghost"
                size="sm"
                fullWidth={false}
                loading={unblockingId === u.id}
                onPress={() => setConfirmTarget(u)}
              >
                {translate("Buka blokir")}
              </Button>
            }
            divider={i < items.length - 1}
          />
        ))}
      </DataScreen>

      <Dialog
        title={confirmTarget ? translate("Buka blokir @{x}?", { x: confirmTarget.username }) : "Buka blokir?"}
        description={translate("Pengguna ini akan dapat melihat profil Anda dan memulai percakapan kembali.")}
        visible={confirmTarget !== null}
        loading={unblockingId !== null}
        confirmLabel={translate("Buka blokir")}
        cancelLabel={translate("Batal")}
        onConfirm={() => confirmTarget && void handleUnblock(confirmTarget)}
        onCancel={() => setConfirmTarget(null)}
        onRequestClose={() => setConfirmTarget(null)}
      />
    </>
  )
}