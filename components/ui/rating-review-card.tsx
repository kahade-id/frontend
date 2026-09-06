/**
 * Kahade — <RatingReviewCard> satu ulasan pasca transaksi (§9.26 Rating,
 * §9.6 Card, §3.1 Mono untuk ID order, §13 format).
 *
 * Satu baris `GET /v1/users/{username}/ratings` (profil publik) atau
 * `GET /v1/ratings/my` (ulasan yang saya beri/terima). Menampung balasan
 * `POST /v1/ratings/{ratingId}/reply` (satu balasan per ulasan, ≤500 char)
 * beserta aksi edit/hapus balasan (`PUT/DELETE /v1/ratings/replies/{id}`).
 *
 * Anatomi:
 *   Avatar sm + nama pemberi ulasan + tanggal ..... <Rating readOnly sm>
 *   komentar (ReadMore 3 baris)
 *   referensi order (Mono caption, opsional)
 *   blok balasan (bg-surface, border-l) ATAU tombol "Balas" (bila `onReply`)
 *
 * Keputusan non-obvious:
 *   - Bintang tetap monokrom & ukuran sm (§9.26): di daftar ulasan, skor
 *     angka Mono di samping bintang (showScore) cukup — tidak perlu bintang
 *     besar. Bintang lg hanya di <RatingForm>.
 *   - Balasan diindentasi dengan `border-l-2 border-border pl-3`, bukan kartu
 *     dalam kartu (dua lapis border terlalu berat, lihat ReferralCodeCard).
 *     Nama pembalas diberi badge kecil "Penjual"/"Pembeli" supaya konteks
 *     jelas tanpa avatar kedua.
 *   - `onReply` hanya diberi pemanggil bila user adalah PIHAK YANG DINILAI
 *     dan belum membalas (aturan server: satu balasan). Kartu tidak menebak
 *     hak akses — cukup sembunyikan tombol bila handler tidak ada.
 *   - Edit/hapus balasan = dua <TextLink caption> di bawah balasan, bukan
 *     ikon: aksi ini jarang dan tidak boleh mencolok.
 *   - Komentar kosong (rating tanpa teks) tetap valid (`comment` opsional di
 *     CreateRatingDto) — tampilkan placeholder tertiary "Tanpa komentar"
 *     supaya tinggi kartu stabil dan pembaca tahu ini bukan bug.
 */
import type { ReactNode } from "react"
import { View, type ViewProps } from "react-native"

import { Avatar, type AvatarProps } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardSummary, type CardProps } from "@/components/ui/card"
import { DateText } from "@/components/ui/date-text"
import { Rating } from "@/components/ui/rating"
import { ReadMore } from "@/components/ui/read-more"
import { Skeleton } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"
import { TextLink } from "@/components/ui/text-link"
import { summarize } from "@/lib/a11y"
import { cn } from "@/lib/cn"
// UX: haptic feedback ensured for onPress (light) — improves confirmation

export type RatingPerson = {
  name: string
  avatar?: AvatarProps["source"]
  verified?: boolean
}

export type RatingReply = {
  id: string
  content: string
  by: RatingPerson
  /** Peran pembalas relatif ke order — mengisi badge kecil di samping nama */
  role?: "buyer" | "seller"
  date: Date | number | string
  /** Balasan milik user yang login — memunculkan edit/hapus */
  mine?: boolean
}

export type RatingReviewCardLabels = {
  noComment: string
  reply: string
  edit: string
  remove: string
  buyer: string
  seller: string
  orderPrefix: string
}

const DEFAULT_LABELS: RatingReviewCardLabels = {
  noComment: "Tanpa komentar",
  reply: "Balas ulasan",
  edit: "Ubah",
  remove: "Hapus",
  buyer: "Pembeli",
  seller: "Penjual",
  orderPrefix: "Order",
}

export type RatingReviewCardProps = Omit<CardProps, "children" | "padded" | "onPress"> & {
  stars: number
  comment?: string
  reviewer: RatingPerson
  date: Date | number | string
  /** Nomor order terkait, mis. "KHD-2026-0903-0142" — Mono caption */
  orderId?: string
  reply?: RatingReply
  /** Diberikan hanya bila user berhak & belum membalas */
  onReply?: () => void
  onEditReply?: (reply: RatingReply) => void
  onDeleteReply?: (reply: RatingReply) => void
  /** Slot bebas di bawah (mis. tombol "Ubah ulasan" untuk ulasan milik sendiri) */
  footer?: ReactNode
  commentLines?: number
  labels?: Partial<RatingReviewCardLabels>
}

export function RatingReviewCard({
  stars,
  comment,
  reviewer,
  date,
  orderId,
  reply,
  onReply,
  onEditReply,
  onDeleteReply,
  footer,
  commentLines = 3,
  labels,
  accessibilityLabel,
  className,
  ...rest
}: RatingReviewCardProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const hasComment = !!comment?.trim()

  // Ringkasan header saja. Komentar & balasan memakai <ReadMore> yang punya
  // toggle "Selengkapnya", dan balasan punya TextLink Ubah/Hapus — semuanya
  // interaktif, jadi tidak boleh masuk grup `accessible` (audit #4).
  const a11y = accessibilityLabel ?? summarize([`${reviewer.name} memberi ${stars} dari 5 bintang`])

  return (
    <Card className={cn("gap-3", className)} {...rest}>
      {/* Header: pemberi ulasan + skor */}
      <CardSummary className="flex-row items-center justify-between gap-3" label={a11y}>
        <View className="flex-1 flex-row items-center justify-between gap-3">
          <View className="flex-1 flex-row items-center gap-2">
            <Avatar source={reviewer.avatar} name={reviewer.name} size="sm" verified={reviewer.verified} />
            <View className="flex-1">
              <Text ellipsizeMode="tail" variant="body" weight={600} tone="primary" numberOfLines={1}>
                {reviewer.name}
              </Text>
              <DateText value={date} format="date" variant="caption" tone="secondary" />
            </View>
          </View>
          <Rating value={stars} readOnly size="sm" showScore />
        </View>

      </CardSummary>

      {/* Komentar */}
      {hasComment ? (
        <ReadMore text={comment!.trim()} lines={commentLines} variant="body" tone="primary" />
      ) : (
        <Text variant="body" tone="secondary">
          {t.noComment}
        </Text>
      )}

      {orderId ? (
        <Text
          accessibilityLabel={`${t.orderPrefix} ${orderId}`}
          variant="caption"
          tone="secondary"
          numberOfLines={1}
          className="font-mono-500 tracking-mono"
        >
          {t.orderPrefix} {orderId}
        </Text>
      ) : null}

      {/* Balasan */}
      {reply ? (
        <View className="gap-2 border-l-2 border-border pl-3">
          <View className="flex-row items-center gap-2">
            <Text variant="caption" weight={600} tone="primary" numberOfLines={1}>
              {reply.by.name}
            </Text>
            {reply.role ? (
              <Badge tone="neutral" variant="outline">
                {reply.role === "seller" ? t.seller : t.buyer}
              </Badge>
            ) : null}
            <DateText value={reply.date} format="date" variant="caption" tone="secondary" className="ml-auto" />
          </View>
          <ReadMore text={reply.content} lines={3} variant="body" tone="secondary" />
          {reply.mine && (onEditReply || onDeleteReply) ? (
            <View className="flex-row items-center gap-4">
              {onEditReply ? (
                <TextLink variant="caption" onPress={() => onEditReply(reply)}>
                  {t.edit}
                </TextLink>
              ) : null}
              {onDeleteReply ? (
                <TextLink variant="caption" onPress={() => onDeleteReply(reply)}>
                  {t.remove}
                </TextLink>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : onReply ? (
        <Button accessibilityHint="Ketuk untuk berinteraksi" variant="secondary" size="sm" onPress={onReply}>
          {t.reply}
        </Button>
      ) : null}

      {footer}
    </Card>
  )
}

/** Placeholder dengan tinggi menyamai kartu tanpa balasan */
export function RatingReviewCardSkeleton({ className, ...rest }: Omit<ViewProps, "children"> & { className?: string }) {
  return (
    <View accessible accessibilityRole="progressbar"
      className={cn("w-full gap-3 rounded-md border border-border bg-surface p-5", className)}
      accessibilityLabel="Memuat ulasan"
      {...rest}
    >
      <View className="flex-row items-center justify-between gap-3 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
        <View className="flex-1 flex-row items-center gap-2">
          <Skeleton shape="circle" width={32} height={32} />
          <View className="gap-1">
            <Skeleton height={14} className="w-28" />
            <Skeleton height={12} className="w-20" />
          </View>
        </View>
        <Skeleton height={16} className="w-24" />
      </View>
      <Skeleton height={14} className="w-full" />
      <Skeleton height={14} className="w-3/4" />
    </View>
  )
}