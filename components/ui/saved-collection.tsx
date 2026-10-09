/**
 * Kahade — <SavedCollection>: isi tab "Tersimpan" di Kelola Etalase.
 *
 * Sidebar 2026-10-05: pindahan app/saved.tsx (rute /saved kini hanya
 * redirect ke sini). Dua koleksi pribadi: profil tersimpan
 * (GET /v1/users/saved) + karya tersimpan (<ShowcaseSavedCollection>,
 * query mandiri — tidak ikut hilang saat query profil loading/error).
 *
 * Bukan <DataScreen>: komponen ini dirender di dalam tab Kelola Etalase
 * (sudah punya <Screen> + <Header> sendiri) — ia hanya menyediakan scroller
 * + status (pola isi <DataScreen>, tanpa header ganda).
 */
import { memo, useCallback, useState } from "react"
import { BookmarkSimple } from "phosphor-react-native"
import { router } from "expo-router"
import { View } from "react-native"
import { translate } from "@/lib/i18n/translate"
import { useLanguage } from "@/lib/i18n"

import { api } from "@/lib/api"
import type { SavedProfileEntry } from "@/lib/api/users"
import { formatNumber } from "@/lib/format"
import { showMutationError } from "@/lib/mutation-toast"
import { ROUTES } from "@/lib/routes"
import { useApiQuery } from "@/lib/use-api-query"

import { Button } from "@/components/ui/button"
import { Crossfade } from "@/components/ui/fade-in"
import { DataScroll } from "@/components/ui/data-screen"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { IconButton } from "@/components/ui/icon-button"
import { LoadingScreen } from "@/components/ui/loading-screen"
import { SectionHeader } from "@/components/ui/section"
import { ShowcaseSavedCollection } from "@/components/ui/showcase-saved-collection"
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
// `useLanguage()` agar label aksesibilitas ikut berganti bahasa;
// UserListItem sendiri sudah di-memo (FE-014).
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

export function SavedCollection() {
  const toast = useToast()
  const query = useApiQuery(
    "saved-profiles",
    (signal) => api.users.getSavedProfiles({ limit: 50 }, signal),
    true,
    // P1a (2026-10-03): revalidasi saat kembali ke layar — daftar bisa berubah
    // dari layar lain (unsave dari profil/detail).
    { refreshOnFocus: true },
  )
  const items = query.data?.data ?? []
  const [unsavingId, setUnsavingId] = useState<string | null>(null)
  // FE-065: destruktur fungsi stabil untuk useCallback di bawah.
  const { setData: setSavedData, refresh: refreshSaved } = query

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
        toast.show({ title: translate("Profil dihapus dari tersimpan"), tone: "success", duration: 2500 })
      } catch (err) {
        // Klasifikasi toast: error mutasi non-blokir via showMutationError.
        if (showMutationError(toast.show, {
          failTitle: translate("Gagal menghapus simpanan"),
          uncertainHint: translate("Periksa kembali daftar tersimpan"),
          err,
          scope: "saved:unsave",
        })) {
          void refreshSaved()
        }
      } finally {
        setUnsavingId(null)
      }
    },
    [setSavedData, refreshSaved, toast.show],
  )

  // FE-065: handler navigasi stabil per-id untuk baris yang di-memo.
  const openProfile = useCallback((username: string) => {
    router.push(ROUTES.userProfile(username))
  }, [])

  const { loading, refreshing = false, error, refresh, reload } = query
  const content = error ? (
    <ErrorState
      title={translate("Gagal memuat profil tersimpan")}
      description={error}
      onRetry={() => void reload()}
    />
  ) : items.length === 0 ? (
    // UI-F009: empty state + CTA.
    <EmptyState
      icon={BookmarkSimple}
      title={translate("Belum ada profil tersimpan")}
      description={translate("Simpan profil penjual dari halaman profil mereka untuk dilihat lagi nanti.")}
      action={
        <Button variant="secondary" fullWidth={false} onPress={() => router.push(ROUTES.showcase)}>
          {translate("Jelajahi etalase")}
        </Button>
      }
    />
  ) : (
    <View className="gap-1">
      <SectionHeader title={translate("Profil tersimpan")} />
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
    </View>
  )

  return (
    <DataScroll onRefresh={refresh} refreshing={refreshing} enabled={!loading}>
      {/* J-01: karya tersimpan punya query sendiri — tidak ikut hilang saat
          query PROFIL tersimpan loading/error. */}
      <ShowcaseSavedCollection />
      <Crossfade loading={loading} skeleton={<LoadingScreen message={translate("Memuat profil tersimpan…")} />}>
        {content}
      </Crossfade>
    </DataScroll>
  )
}
