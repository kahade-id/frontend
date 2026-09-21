/**
 * Kahade — <ProfileRatingsTab>: isi tab "Ulasan" di profil publik user.
 *
 * Diekstrak dari app/user/[username].tsx (G-11: god component hanya boleh
 * menyusut). Perilaku TIDAK berubah: chip filter (Semua/Positif/Netral/
 * Negatif), list <RatingReviewCard> dengan balasan penjual, dan empty state
 * yang sama persis — hanya lokasi kodenya yang pindah.
 */
import { View } from "react-native"
import { Star } from "phosphor-react-native"

import type { PublicRatingFilter, Rating } from "@/lib/api/ratings"

import { Chip } from "@/components/ui/chip"
import { EmptyState } from "@/components/ui/empty-state"
import { ListLoading } from "@/components/ui/paginated-list"
import { RatingReviewCard, type RatingPerson } from "@/components/ui/rating-review-card"

export const RATING_FILTERS: { value: PublicRatingFilter; label: string }[] = [
  { value: "all", label: "Semua" },
  { value: "positive", label: "Positif" },
  { value: "neutral", label: "Netral" },
  { value: "negative", label: "Negatif" },
]

export type ProfileRatingsTabProps = {
  ratings: Rating[]
  loading: boolean
  filter: PublicRatingFilter
  onFilterChange: (filter: PublicRatingFilter) => void
  /** Username profil (tanpa @) — nama balasan penjual & copy empty state. */
  handle: string
}

export function ProfileRatingsTab({
  ratings,
  loading,
  filter,
  onFilterChange,
  handle,
}: ProfileRatingsTabProps) {
  return (
    <View className="px-5 pt-4 gap-4">
      <View className="flex-row flex-wrap gap-2">
        {RATING_FILTERS.map((f) => (
          <Chip key={f.value} selected={filter === f.value} onPress={() => onFilterChange(f.value)}>
            {f.label}
          </Chip>
        ))}
      </View>

      {loading ? (
        <ListLoading />
      ) : ratings.length === 0 ? (
        <EmptyState
          icon={Star}
          title="Belum ada ulasan"
          description={`Ulasan transaksi dengan @${handle} akan muncul di sini.`}
        />
      ) : (
        ratings.map((r) => {
          const reviewer: RatingPerson = {
            name: r.authorUsername ?? "Pengguna",
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
        })
      )}
    </View>
  )
}
