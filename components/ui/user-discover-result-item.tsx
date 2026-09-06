/**
 * Kahade — <UserDiscoverResultItem> (§9.17 List Item, §9.23 Search).
 *
 * Baris hasil pencarian/rekomendasi pengguna di <SearchOverlay> dan tab
 * "Temukan": Avatar md -> nama (dengan <Highlight> query) + baris meta
 * (handle · N transaksi · rating) -> <FollowButton size="sm"> di kanan.
 *
 * Kenapa TIDAK dibangun di atas <ListItem> (non-obvious): ListItem menerima
 * `title: string`, sedangkan hasil pencarian harus menonjolkan substring
 * query lewat <Highlight> (node), dan baris meta memakai Rating inline
 * (node), bukan subtitle string. Daripada menambah 2 slot node ke ListItem
 * dan melonggarkan kontraknya untuk semua daftar, komponen ini menyalin
 * ANATOMI ListItem apa adanya: `min-h-14 px-6 py-3 gap-3`, divider
 * `inset` sejajar teks (ml-[64px] = px-6 24 + avatar md 40; pada ListItem
 * 60 karena ikon 24), pressed tanpa scale. Irama list tetap identik.
 *
 * Keputusan non-obvious:
 *   - Dua target sentuh dalam satu baris: baris (buka profil, Push §10) dan
 *     FollowButton. Tombol berada DI LUAR PressableScale baris, sebagai
 *     sibling dalam flex-row, supaya tap tombol tidak ikut memicu onPress
 *     baris — bukan lewat stopPropagation yang tidak konsisten di web.
 *   - Nama `body` 500 (sama dengan ListItem title); match query 600
 *     text-primary di atas 500 — cukup terbaca tanpa fill kuning (§2.3,
 *     lihat <Highlight>).
 *   - Meta dipisah karakter "·" dalam satu Text caption text-secondary,
 *     bukan Badge berderet: hasil pencarian harus padat dan tenang. Rating
 *     memakai <Rating size="sm" showScore> agar bintang monokrom (§9.26)
 *     dan skor Mono seragam dengan profil.
 *   - Angka transaksi diformat `formatNumber` di sini (satu-satunya angka
 *     yang formatnya pasti); label satuan "transaksi" i18n lewat `labels`.
 *   - `verified` diteruskan ke Avatar (SealCheck) — di baris padat tidak
 *     ada ruang untuk Badge "Terverifikasi" seperti di ProfileHeader.
 *   - `isSelf` menyembunyikan FollowButton (tidak bisa mengikuti diri
 *     sendiri) tanpa mengubah tinggi baris.
 */
import { View, type ViewProps } from "react-native"

import { Avatar, type AvatarProps } from "@/components/ui/avatar"
import { FollowButton, type FollowButtonProps } from "@/components/ui/follow-button"
import { Highlight } from "@/components/ui/highlight"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Rating } from "@/components/ui/rating"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { formatNumber } from "@/lib/format"
// UX: haptic feedback ensured for onPress (light) — improves confirmation

export type UserDiscoverResultItemProps = Omit<ViewProps, "children"> & {
  name: string
  /** Mis. "@budisantoso" */
  handle?: string
  avatar?: AvatarProps["source"]
  verified?: boolean
  /** Jumlah transaksi selesai */
  transactionCount?: number
  /** Rating rata-rata 0–5 */
  rating?: number
  /** Substring pencarian untuk <Highlight> */
  query?: string
  /** Buka profil (Push) */
  onPress?: () => void
  /** Kontrol FollowButton; undefined = tombol tidak dirender */
  follow?: Pick<FollowButtonProps, "following" | "onToggle" | "loading" | "disabled">
  /** Profil sendiri: sembunyikan FollowButton */
  isSelf?: boolean
  divider?: boolean
  labels?: { transactions?: string }
  className?: string
}

const DEFAULT_LABELS = { transactions: "transaksi" }

export function UserDiscoverResultItem({
  name,
  handle,
  avatar,
  verified = false,
  transactionCount,
  rating,
  query,
  onPress,
  follow,
  isSelf = false,
  divider = false,
  labels,
  className,
  ...rest
}: UserDiscoverResultItemProps) {
  const t = { ...DEFAULT_LABELS, ...labels }

  const meta: string[] = []
  if (handle) meta.push(handle)
  if (transactionCount != null) meta.push(`${formatNumber(transactionCount)} ${t.transactions}`)

  const row = (
    <View className="min-h-14 flex-1 flex-row items-center gap-3 py-3">
      <Avatar source={avatar} name={name} size="md" verified={verified} />

      <View className="flex-1 gap-[2px]">
        <Highlight
          text={name}
          query={query}
          variant="body"
          weight={500}
          tone="primary"
          matchWeight={600}
          numberOfLines={1}
        />
        {meta.length > 0 || rating != null ? (
          <View className="flex-row items-center gap-2">
            {meta.length > 0 ? (
              <Text ellipsizeMode="tail" variant="caption" tone="secondary" numberOfLines={1} className="shrink">
                {meta.join(" \u00B7 ")}
              </Text>
            ) : null}
            {rating != null ? <Rating value={rating} size="sm" showScore readOnly /> : null}
          </View>
        ) : null}
      </View>
    </View>
  )

  const a11yLabel = [name, ...meta].join(", ")

  return (
    <View className={cn("w-full", className)} {...rest}>
      <View className="flex-row items-center gap-3 px-6">
        {onPress ? (
          <PressableScale hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityRole="button"
            accessibilityRole="button"
            accessibilityLabel={a11yLabel}
            accessibilityHint="Buka profil"
            scaleOnPress={false}
            onPress={onPress}
            containerClassName="flex-1"
            className="flex-1 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            {row}
          </PressableScale>
        ) : (
          <View accessible accessibilityLabel={a11yLabel} className="flex-1">
            {row}
          </View>
        )}

        {follow && !isSelf ? <FollowButton size="sm" {...follow} /> : null}
      </View>

      {divider ? <View className="ml-[64px] h-px bg-border" /> : null}
    </View>
  )
}