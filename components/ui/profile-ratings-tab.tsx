/**
 * Kahade — <ProfileRatingsTab>: isi tab "Ulasan" di profil publik user.
 *
 * Diekstrak dari app/user/[username].tsx (G-11: god component hanya boleh
 * menyusut). Perilaku TIDAK berubah: chip filter (Semua/Positif/Netral/
 * Negatif), list <RatingReviewCard> dengan balasan penjual, dan empty state
 * yang sama persis — hanya lokasi kodenya yang pindah.
 */
import { router } from "expo-router"
import { View } from "react-native"
import { Star } from "phosphor-react-native"

import type { PublicRatingFilter, Rating } from "@/lib/api/ratings"
import { ROUTES } from "@/lib/routes"

import { Button } from "@/components/ui/button"
import { Chip } from "@/components/ui/chip"
import { EmptyState } from "@/components/ui/empty-state"
import { ListLoading } from "@/components/ui/paginated-list"
import { RatingDistributionBars } from "@/components/ui/rating-distribution"
import { RatingReviewCard, type RatingPerson } from "@/components/ui/rating-review-card"
import { Text } from "@/components/ui/text"
import { useMemo } from "react"
import { translate } from "@/lib/i18n/translate"
import { useLanguage } from "@/lib/i18n"

/** i18n: label filter mengikuti bahasa aktif (dulu konstanta modul). */
function useRatingFilters(): { value: PublicRatingFilter; label: string }[] {
  const language = useLanguage()
  return useMemo(
    () => [
      { value: "all", label: translate("Semua") },
      { value: "positive", label: translate("Positif") },
      { value: "neutral", label: translate("Netral") },
      { value: "negative", label: translate("Negatif") },
    ],
    [language],
  )
}

/**
 * Item 70 (mega-batch 2026-09-28): urutan ulasan di profil publik —
 * Terbaru (urutan server, createdAt desc) atau Rating tertinggi (stars desc).
 * Sort murni di klien atas halaman yang sudah dimuat (backend tidak
 * menyediakan parameter sort di endpoint ini).
 */
export type ProfileRatingSort = "newest" | "top"

function useRatingSorts(): { value: ProfileRatingSort; label: string }[] {
  const language = useLanguage()
  return useMemo(
    () => [
      { value: "newest", label: translate("Terbaru") },
      { value: "top", label: translate("Rating tertinggi") },
    ],
    [language],
  )
}

/**
 * Terapkan urutan ke daftar yang sudah dimuat. "Terbaru" = urutan server
 * (createdAt desc, tiebreak id — stabil, jangan diacak ulang). "Rating
 * tertinggi" = stars desc, lalu createdAt desc sebagai tiebreak.
 */
export function sortProfileRatings(ratings: readonly Rating[], sort: ProfileRatingSort): Rating[] {
  if (sort !== "top") return [...ratings]
  return [...ratings].sort((a, b) => {
    if (b.stars !== a.stars) return b.stars - a.stars
    return String(b.createdAt).localeCompare(String(a.createdAt))
  })
}

export type ProfileRatingsTabProps = {
  ratings: Rating[]
  loading: boolean
  filter: PublicRatingFilter
  onFilterChange: (filter: PublicRatingFilter) => void
  /** Item 70: urutan tampilan ulasan (dikendalikan pemanggil). */
  sort: ProfileRatingSort
  onSortChange: (sort: ProfileRatingSort) => void
  /** Username profil (tanpa @) — nama balasan penjual & copy empty state. */
  handle: string
  /** Apakah ini profil milik pengguna sendiri */
  isSelf?: boolean
}

export function ProfileRatingsTab({
  ratings,
  loading,
  filter,
  onFilterChange,
  sort,
  onSortChange,
  handle,
  isSelf = false,
}: ProfileRatingsTabProps) {
  const ratingFilters = useRatingFilters()
  const ratingSorts = useRatingSorts()
  const sorted = useMemo(() => sortProfileRatings(ratings, sort), [ratings, sort])
  return (
    <View className="px-5 pt-4 gap-4">
      {/*
       * Item 74c (keputusan batch-19 #4, mega-batch 2026-09-28): distribusi
       * rating 1–5 TAMPIL di profil publik. <RatingDistributionBars> membaca
       * ringkasannya sendiri dari GET /v1/users/:username/ratings dan
       * menyembunyikan diri bila kontrak tak terpenuhi (fail closed).
       */}
      <RatingDistributionBars username={handle} />
      <View className="flex-row flex-wrap gap-2">
        {ratingFilters.map((f) => (
          <Chip key={f.value} selected={filter === f.value} onPress={() => onFilterChange(f.value)}>
            {f.label}
          </Chip>
        ))}
      </View>
      {/* Item 70: pilihan urutan ulasan. */}
      <View className="flex-row flex-wrap items-center gap-2">
        <Text variant="caption" tone="secondary">
          {translate("Urutkan:")}
        </Text>
        {ratingSorts.map((s) => (
          <Chip
            key={s.value}
            selected={sort === s.value}
            accessibilityState={{ selected: sort === s.value }}
            onPress={() => onSortChange(s.value)}
          >
            {s.label}
          </Chip>
        ))}
      </View>

      {loading ? (
        <ListLoading />
      ) : ratings.length === 0 ? (
        isSelf ? (
          <EmptyState
            icon={Star}
            title={translate("Belum ada ulasan")}
            description={translate("Ulasan transaksi Anda akan muncul di sini.")}
          />
        ) : (
          <EmptyState
            icon={Star}
            title={translate("Belum ada ulasan")}
            description={translate("Ulasan transaksi dengan @{x} akan muncul di sini.", { x: handle })}
          />
        )
      ) : (
        <>
          {sorted.map((r) => {
          const reviewer: RatingPerson = {
            name: r.authorUsername ?? translate("Pengguna"),
            avatar: r.authorAvatarUrl ? { uri: r.authorAvatarUrl } : undefined,
          }
          return (
            <RatingReviewCard
              key={r.id}
              stars={r.stars}
              comment={r.comment ?? undefined}
              reviewer={reviewer}
              date={r.createdAt}
              orderId={r.orderId}
              reply={
                r.reply
                  ? {
                      id: `reply-${r.id}`,
                      content: r.reply,
                      by: { name: `@${handle}` },
                      role: "seller",
                      date: r.createdAt,
                    }
                  : undefined
              }
            />
            )
          })}
          {/* UI-P011: tab hanya menampilkan 20 item pertama — tautan ke daftar
              penuh agar konten tidak terlihat terpotong. */}
          <Button
            size="sm"
            variant="ghost"
            fullWidth={false}
            onPress={() => router.push(ROUTES.userRatings(handle))}
          >
            {translate("Lihat semua ulasan")}
          </Button>
        </>
      )}
    </View>
  )
}
