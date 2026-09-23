import { ShowcaseSavedCollection } from "@/components/ui/showcase-saved-collection"
/**
 * Screen — Profil Tersimpan (GET /v1/users/saved).
 *
 * "Saved" = daftar pribadi pengguna untuk dilihat lagi — berbeda dari
 * "Favorit" (dukung publik dengan counter). Toggle-nya ada di profil
 * pengguna (ikon Bookmark); dari sini bisa hapus simpanan (DELETE
 * /v1/users/{username}/saved) dan kembali ke profil.
 *
 * Meta respons (total/page/limit) di top-level — adapter sudah menormalkan,
 * jadi layar cukup useApiQuery satu halaman pertama (daftar pribadi, kecil).
 */
import { useState } from "react"
import { Bookmark } from "phosphor-react-native"
import { router } from "expo-router"
import { translate } from "@/lib/i18n/translate"

import { api, userMessage } from "@/lib/api"
import type { SavedProfileEntry } from "@/lib/api/users"
import { formatNumber } from "@/lib/format"
import { ROUTES } from "@/lib/routes"
import { useApiQuery } from "@/lib/use-api-query"

import { DataScreen } from "@/components/ui/data-screen"
import { IconButton } from "@/components/ui/icon-button"
import { SectionHeader } from "@/components/ui/section"
import { UserListItem } from "@/components/ui/user-list-item"
import { useToast } from "@/components/ui/toast"

export default function SavedProfilesScreen() {
  const toast = useToast()
  const query = useApiQuery("saved-profiles", (signal) =>
    api.users.getSavedProfiles({ limit: 50 }, signal),
  )
  const items = query.data?.data ?? []
  const [unsavingId, setUnsavingId] = useState<string | null>(null)

  const handleUnsave = async (entry: SavedProfileEntry) => {
    setUnsavingId(entry.user.userId)
    try {
      await api.users.unsaveProfile(entry.user.username)
      query.setData((prev) =>
        prev ? { ...prev, data: prev.data.filter((e) => e.user.userId !== entry.user.userId) } : prev,
      )
      toast.show({ title: "Profil dihapus dari tersimpan", tone: "success", duration: 2500 })
    } catch (err) {
      toast.show({
        title: "Gagal menghapus simpanan",
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setUnsavingId(null)
    }
  }

  return (
    <DataScreen
      title="Tersimpan"
      state={query}
      loadingMessage="Memuat profil tersimpan…"
      contentClassName="gap-1"
      // J-01 (audit 2026-09-23): section karya tersimpan punya query sendiri —
      // tidak boleh ikut hilang saat query PROFIL tersimpan loading/error.
      persistent={<ShowcaseSavedCollection />}
    >
      <SectionHeader title="Profil tersimpan" />
      {items.map((entry, i) => (
        <UserListItem
          key={entry.user.userId}
          name={entry.user.fullName ?? entry.user.username}
          username={entry.user.username}
          avatar={{ source: entry.user.avatarUrl || undefined }}
          verified={entry.user.kycStatus === "APPROVED"}
          stat={
            entry.user.stats
              ? `${formatNumber(entry.user.stats.totalOrdersCompleted)} transaksi · ${entry.user.stats.averageRating}`
              : undefined
          }
          divider={i < items.length - 1}
          onPress={() => router.push(ROUTES.userProfile(entry.user.username))}
          action={
            <IconButton
              icon={Bookmark}
              variant="ghost"
              size="sm"
              accessibilityLabel={translate("Hapus {x} dari tersimpan", { x: entry.user.fullName ?? entry.user.username })}
              loading={unsavingId === entry.user.userId}
              onPress={() => void handleUnsave(entry)}
            />
          }
        />
      ))}
    </DataScreen>
  )
}
