import { ShowcaseSavedCollection } from "@/components/ui/showcase-saved-collection"
/**
 * Screen — Profil Disimpan (GET /v1/users/saved).
 *
 * "Saved" = daftar pribadi pengguna untuk dilihat lagi — berbeda dari
 * "Favorit" (dukung publik dengan counter). Toggle-nya ada di profil
 * pengguna (ikon BookmarkSimple); dari sini bisa hapus simpanan (DELETE
 * /v1/users/{username}/saved) dan kembali ke profil.
 *
 * Meta respons (total/page/limit) di top-level — adapter sudah menormalkan,
 * jadi layar cukup useApiQuery satu halaman pertama (daftar pribadi, kecil).
 */
import { memo, useCallback, useState } from "react"
import { BookmarkSimple } from "phosphor-react-native"
import { router } from "expo-router"
import { translate } from "@/lib/i18n/translate"
import { useLanguage } from "@/lib/i18n"

import { api, userMessage } from "@/lib/api"
import type { SavedProfileEntry } from "@/lib/api/users"
import { formatNumber } from "@/lib/format"
import { ROUTES } from "@/lib/routes"
import { useApiQuery } from "@/lib/use-api-query"

import { DataScreen } from "@/components/ui/data-screen"
import { Button } from "@/components/ui/button"
import { IconButton } from "@/components/ui/icon-button"
import { SectionHeader } from "@/components/ui/section"
import { UserListItem } from "@/components/ui/user-list-item"
import { useToast } from "@/components/ui/toast"

type SavedProfileRowProps = {
  entry: SavedProfileEntry
  stat: string | undefined
  busy: boolean
  divider: boolean
  onOpenProfile: (username: string) => void
  onUnsave: (entry: SavedProfileEntry) => void
}

// FE-065 (audit 2026-09-29): baris di-memo — `action` (IconButton unsave)
// dibuat di dalam render baris sendiri, bukan inline di `.map` induk.
// `useLanguage()` agar label aksesibilitas ikut berganti bahasa
// (pola ShowcaseFeedItem); UserListItem sendiri sudah di-memo (FE-014).
const SavedProfileRow = memo(function SavedProfileRow({
  entry,
  stat,
  busy,
  divider,
  onOpenProfile,
  onUnsave,
}: SavedProfileRowProps) {
  useLanguage()
  const { user } = entry
  return (
    <UserListItem
      name={user.fullName ?? user.username}
      username={user.username}
      avatar={{ source: user.avatarUrl || undefined }}
      verified={user.kycStatus === "APPROVED"}
      stat={stat}
      divider={divider}
      onPress={() => onOpenProfile(user.username)}
      action={
        <IconButton
          icon={BookmarkSimple}
          variant="ghost"
          size="sm"
          accessibilityLabel={translate("Hapus {x} dari tersimpan", { x: user.fullName ?? user.username })}
          loading={busy}
          onPress={() => void onUnsave(entry)}
        />
      }
    />
  )
})

export default function SavedProfilesScreen() {
  const toast = useToast()
  const query = useApiQuery("saved-profiles", (signal) =>
    api.users.getSavedProfiles({ limit: 50 }, signal),
  )
  const items = query.data?.data ?? []
  const [unsavingId, setUnsavingId] = useState<string | null>(null)
  // FE-065: destruktur setter stabil untuk useCallback di bawah.
  const { setData: setSavedData } = query

  // FE-065: useCallback — memakai setData fungsional sehingga tidak bergantung
  // pada data (identitas stabil antar render).
  const handleUnsave = useCallback(
    async (entry: SavedProfileEntry) => {
      setUnsavingId(entry.user.userId)
      try {
        await api.users.unsaveProfile(entry.user.username)
        setSavedData((prev) =>
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
    },
    [setSavedData, toast.show],
  )

  // FE-065: handler navigasi stabil per-id untuk baris yang di-memo.
  const openProfile = useCallback((username: string) => {
    router.push(ROUTES.userProfile(username))
  }, [])

  return (
    <DataScreen
      title="Disimpan"
      state={query}
      loadingMessage="Memuat profil tersimpan…"
      contentClassName="gap-1"
      // UI-F009 (audit UI/UX 2026-09-27): empty state + CTA — sebelumnya daftar
      // kosong hanya menampilkan header "Profil tersimpan" (Favorit punya).
      empty={
        items.length === 0 && {
          icon: BookmarkSimple,
          title: "Belum ada profil tersimpan",
          description: "Simpan profil penjual dari halaman profil mereka untuk dilihat lagi nanti.",
          action: (
            <Button variant="secondary" fullWidth={false} onPress={() => router.push(ROUTES.showcase)}>
              Jelajahi etalase
            </Button>
          ),
        }
      }
      // J-01 (audit 2026-09-23): section karya tersimpan punya query sendiri —
      // tidak boleh ikut hilang saat query PROFIL tersimpan loading/error.
      persistent={<ShowcaseSavedCollection />}
    >
      <SectionHeader title="Profil tersimpan" />
      {items.map((entry, i) => (
        <SavedProfileRow
          key={entry.user.userId}
          entry={entry}
          stat={
            entry.user.stats
              ? `${formatNumber(entry.user.stats.totalOrdersCompleted)} transaksi · ${entry.user.stats.averageRating}`
              : undefined
          }
          busy={unsavingId === entry.user.userId}
          divider={i < items.length - 1}
          onOpenProfile={openProfile}
          onUnsave={handleUnsave}
        />
      ))}
    </DataScreen>
  )
}
