/**
 * Kahade — <RatingForm> beri ulasan pasca transaksi selesai (§9.26 Rating,
 * §9.2 Input/TextArea, §9.1 Button, §12 voice & tone).
 *
 * Form untuk `POST /v1/ratings` (CreateRatingDto: orderId, stars 1–5,
 * comment ≤500) dan `PUT /v1/ratings/{ratingId}` (mode ubah). Komponen
 * controlled: state `value` dipegang pemanggil supaya bisa disimpan sebagai
 * draft & dikirim bersama orderId yang tidak perlu diketahui form.
 *
 * Anatomi:
 *   ringkasan lawan (Avatar + nama + peran) — konteks "Anda menilai siapa"
 *   <Rating lg> di tengah + label deskriptif per skor ("Buruk" … "Sangat baik")
 *   <TextArea maxLength=500 showCount>
 *   <Button primary fullWidth> Kirim (disabled bila stars 0)
 *
 * Keputusan non-obvious:
 *   - Bintang dipusatkan & berukuran lg (32px): ini SATU-SATUNYA tempat
 *     bintang boleh besar — form review adalah "momen penting" (§1 poin 6),
 *     dan target sentuh 32px + gap-2 memudahkan pilih skor tanpa salah tap.
 *   - Label skor ("Buruk", "Cukup", …) muncul di bawah bintang, bukan
 *     tooltip: mobile tidak punya hover, dan label mengurangi ambiguitas
 *     "3 bintang itu bagus atau jelek?".
 *   - `allowClear` dimatikan: di form, tap bintang yang sama tidak boleh
 *     mengosongkan skor (kebiasaan double-tap tidak sengaja menghapus).
 *   - Komentar opsional sesuai DTO; tombol kirim hanya butuh stars ≥ 1.
 *     Helper text "opsional" ditulis eksplisit supaya user tidak merasa
 *     wajib mengetik.
 *   - `errorText` server (mis. "Order belum selesai") tampil di bawah
 *     tombol lewat Text danger — bukan Banner, karena error ini lokal ke form.
 */
import { View, type ViewProps } from "react-native"

import { Avatar, type AvatarProps } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Rating } from "@/components/ui/rating"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"
import { cn } from "@/lib/cn"

export const RATING_COMMENT_MAX = 500

export type RatingFormValue = {
  stars: number
  comment: string
}

export type RatingFormCounterpart = {
  name: string
  avatar?: AvatarProps["source"]
  verified?: boolean
  /** Peran LAWAN di order: "seller" bila user pembeli, dst. */
  role?: "buyer" | "seller"
}

export type RatingFormLabels = {
  title: string
  editTitle: string
  prompt: string
  scoreLabels: readonly [string, string, string, string, string]
  commentLabel: string
  commentHelper: string
  submit: string
  update: string
  buyer: string
  seller: string
}

const DEFAULT_LABELS: RatingFormLabels = {
  title: "Beri ulasan",
  editTitle: "Ubah ulasan",
  prompt: "Bagaimana pengalaman transaksi Anda?",
  scoreLabels: ["Buruk", "Kurang", "Cukup", "Baik", "Sangat baik"],
  commentLabel: "Komentar",
  commentHelper: "Opsional. Ceritakan yang membantu pengguna lain.",
  submit: "Kirim ulasan",
  update: "Simpan perubahan",
  buyer: "Pembeli",
  seller: "Penjual",
}

export type RatingFormProps = Omit<ViewProps, "children"> & {
  value: RatingFormValue
  onChange: (value: RatingFormValue) => void
  onSubmit: (value: RatingFormValue) => void
  counterpart?: RatingFormCounterpart
  /** Judul order yang dinilai — konteks singkat di bawah nama lawan */
  orderTitle?: string
  /** Mode ubah ulasan (PUT) — mengganti judul & label tombol */
  editing?: boolean
  submitting?: boolean
  errorText?: string
  disabled?: boolean
  labels?: Partial<RatingFormLabels>
  className?: string
}

export function isRatingComplete(value: RatingFormValue): boolean {
  return value.stars >= 1 && value.stars <= 5 && value.comment.length <= RATING_COMMENT_MAX
}

export function RatingForm({
  value,
  onChange,
  onSubmit,
  counterpart,
  orderTitle,
  editing = false,
  submitting = false,
  errorText,
  disabled = false,
  labels,
  className,
  ...rest
}: RatingFormProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const canSubmit = isRatingComplete(value) && !submitting && !disabled
  const scoreLabel = value.stars >= 1 ? t.scoreLabels[Math.min(5, Math.round(value.stars)) - 1] : undefined

  return (
    <View className={cn("w-full gap-6", className)} {...rest}>
      <View className="gap-1">
        <Text variant="h2" tone="primary">
          {editing ? t.editTitle : t.title}
        </Text>
        <Text variant="body" tone="secondary">
          {t.prompt}
        </Text>
      </View>

      {counterpart ? (
        <View className="flex-row items-center gap-3 rounded-md border border-border bg-surface p-4">
          <Avatar source={counterpart.avatar} name={counterpart.name} size="md" verified={counterpart.verified} />
          <View className="flex-1">
            <Text variant="body" weight={600} tone="primary" numberOfLines={1}>
              {counterpart.name}
            </Text>
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {[counterpart.role ? (counterpart.role === "seller" ? t.seller : t.buyer) : undefined, orderTitle]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Bintang — satu-satunya tempat ukuran lg dipakai */}
      <View className="items-center gap-3 py-2">
        <Rating
          value={value.stars}
          onChange={(stars) => onChange({ ...value, stars })}
          size="lg"
          allowClear={false}
          disabled={disabled || submitting}
          accessibilityLabel="Pilih skor 1 sampai 5 bintang"
        />
        {/* Tinggi tetap supaya layout tidak melompat saat label muncul */}
        <View className="h-6 justify-center">
          {scoreLabel ? (
            <Text variant="label" tone="primary">
              {scoreLabel}
            </Text>
          ) : null}
        </View>
      </View>

      <TextArea
        label={t.commentLabel}
        value={value.comment}
        onChangeText={(comment) => onChange({ ...value, comment })}
        maxLength={RATING_COMMENT_MAX}
        rows={4}
        helperText={t.commentHelper}
        disabled={disabled || submitting}
      />

      <View className="gap-2">
        <Button variant="primary" fullWidth loading={submitting} disabled={!canSubmit} onPress={() => onSubmit(value)}>
          {editing ? t.update : t.submit}
        </Button>
        {errorText ? (
          <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
            {errorText}
          </Text>
        ) : null}
      </View>
    </View>
  )
}
