/**
 * Kahade — <QACard> (§9.6 Card, §3 tipografi, §13 format tanggal).
 *
 * Kartu tanya-jawab publik di halaman etalase/profil penjual: calon pembeli
 * bertanya, penjual menjawab. Anatomi: penanya (Avatar xs + nama + tanggal)
 * -> pertanyaan -> blok jawaban (atau state "Belum dijawab") -> footer aksi.
 *
 * Dibangun di atas <Card variant="default" padded={false}> supaya border,
 * radius `md`, dan pressed-scale (bila `onPress` untuk buka detail) sama
 * dengan kartu lain; QACard hanya menyusun isi.
 *
 * Keputusan non-obvious:
 *   - Jawaban dibedakan dari pertanyaan lewat FILL (`bg-surface-elevated`
 *     di dalam kartu `bg-surface`) + border-top, BUKAN garis aksen kiri
 *     atau indentasi: hierarki §6 dibentuk dari fill + border. Nama penjawab
 *     diberi Badge "Penjual" (neutral — peran, bukan status transaksi §2.3)
 *     supaya pembaca tahu jawaban resmi, bukan komentar pengguna lain.
 *   - Pertanyaan `body` weight 500 text-primary; jawaban `body` 400
 *     text-primary. Pertanyaan sedikit lebih berat karena itu "judul" kartu
 *     saat di-scan dalam daftar.
 *   - Tanggal selalu eksplisit "3 Sep 2026" lewat formatDate (§13: tidak
 *     ada "2 jam lalu"). Pemanggil kirim Date/ISO/epoch; format di sini agar
 *     seluruh kartu Q&A seragam.
 *   - Belum dijawab: teks caption text-secondary + slot `answerAction`
 *     (mis. <Button size="sm" variant="secondary">Jawab</Button>) yang hanya
 *     relevan untuk pemilik etalase — komponen tidak tahu peran user,
 *     pemanggil yang memutuskan mengirim slot atau tidak.
 *   - "Membantu" (helpful) dibuat sebagai slot `footer`, bukan prop count
 *     bawaan: kebutuhan berbeda antar layar (vote, laporkan, bagikan) dan
 *     FavoriteIconButton sudah menyediakan toggle + count bila dibutuhkan.
 *   - `numberOfLines` pertanyaan/jawaban opsional untuk mode ringkas di
 *     daftar; detail penuh (Push §10) mengirim undefined.
 */
import type { ReactNode } from "react"
import { View } from "react-native"

import { ThumbsUp } from "phosphor-react-native"

import { Avatar, type AvatarProps } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, type CardProps } from "@/components/ui/card"
import { Icon } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { summarize } from "@/lib/a11y"
import { cn } from "@/lib/cn"
import { focusRing } from "@/lib/focus-ring"
import { formatDate, formatNumber } from "@/lib/format"
import { translate } from "@/lib/i18n/translate"

export type QAPerson = {
  name: string
  avatar?: AvatarProps["source"]
  verified?: boolean
}

export type QAAnswer = {
  text: string
  by: QAPerson
  date: Date | number | string
}

export type QACardProps = Omit<CardProps, "children" | "padded"> & {
  question: string
  asker: QAPerson
  date: Date | number | string
  answer?: QAAnswer
  /** Slot saat belum dijawab (mis. tombol "Jawab") — hanya untuk pemilik */
  answerAction?: ReactNode
  /** Slot bawah: helpful toggle, laporkan, dsb. */
  footer?: ReactNode
  /**
   * Toggle upvote (POST/DELETE /v1/users/questions/{id}/upvote). Dirender
   * sebagai chip di baris footer kanan; `count` memakai angka final dari
   * respons `{ upvoted, upvoteCount }` setelah request selesai.
   */
  upvote?: {
    count: number
    active: boolean
    loading?: boolean
    onToggle: (next: boolean) => void
  }
  /** Batas baris di mode daftar; undefined = penuh */
  questionLines?: number
  answerLines?: number
  /** Teks i18n */
  labels?: Partial<typeof DEFAULT_LABELS>
}

const DEFAULT_LABELS = {
  seller: "Penjual",
  unanswered: "Belum dijawab",
  askedBy: (name: string) => `Ditanya ${name}`,
  answeredBy: (name: string) => `Dijawab ${name}`,
}

export function QACard({
  question,
  asker,
  date,
  answer,
  answerAction,
  footer,
  upvote,
  questionLines,
  answerLines,
  labels,
  className,
  ...cardProps
}: QACardProps) {
  const t = { ...DEFAULT_LABELS, ...labels }

  return (
    // Grouping SR (audit #4): pertanyaan dan jawaban masing-masing SATU elemen
    // ("Ditanya Budi, 3 Sep: Apakah ..."), bukan 3 fragmen (nama, tanggal,
    // teks). Tidak digrup di root karena `answerAction` ("Jawab") dan `footer`
    // berisi kontrol yang harus tetap fokusable terpisah.
    <Card padded={false} className={cn("gap-0", className)} {...cardProps}>
      {/* Pertanyaan */}
      <View
        accessible
        accessibilityLabel={summarize([t.askedBy(asker.name), formatDate(date), question])}
        className="gap-3 p-5"
      >
        <PersonRow person={asker} date={date} />
        <Text ellipsizeMode="tail" variant="body" weight={500} numberOfLines={questionLines}>
          {question}
        </Text>
      </View>

      {/* Jawaban / belum dijawab */}
      {answer ? (
        <View
          accessible
          accessibilityLabel={summarize([
            t.answeredBy(answer.by.name),
            t.seller,
            formatDate(answer.date),
            answer.text,
          ])}
          className="gap-3 border-t border-border bg-surface-elevated p-5"
        >
          <PersonRow person={answer.by} date={answer.date} badge={t.seller} />
          <Text variant="body" numberOfLines={answerLines}>
            {answer.text}
          </Text>
        </View>
      ) : (
        <View className="flex-row items-center justify-between gap-3 border-t border-border px-5 py-3">
          <Text variant="caption" tone="secondary">
            {t.unanswered}
          </Text>
          {answerAction}
        </View>
      )}

      {footer || upvote ? (
        <View className="flex-row items-center gap-3 border-t border-border px-5 py-3">
          {footer ? <View className="flex-row flex-1 flex-wrap gap-2">{footer}</View> : null}
          {upvote ? <UpvoteChip {...upvote} /> : null}
        </View>
      ) : null}
    </Card>
  )
}

/** Chip upvote: ikon ThumbsUp + count. Aktif = fill + tone active. */
function UpvoteChip({
  count,
  active,
  loading,
  onToggle,
}: {
  count: number
  active: boolean
  loading?: boolean
  onToggle: (next: boolean) => void
}) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={active ? "Tarik dukungan" : "Dukung pertanyaan"}
      accessibilityHint={translate("Saat ini {x} dukungan", { x: formatNumber(count) })}
      disabled={loading}
      scaleOnPress={false}
      onPress={() => onToggle(!active)}
      containerClassName={cn(
        "flex-row items-center gap-1 rounded-full border px-2.5 py-1",
        active ? "border-primary bg-surface-elevated" : "border-border bg-surface",
        focusRing,
      )}
    >
      <Icon
        icon={ThumbsUp}
        size="xs"
        tone={active ? "active" : "default"}
        weight={active ? "fill" : "regular"}
      />
      <Text
        variant="caption"
        tone={active ? "primary" : "secondary"}
        weight={600}
        className="tabular-nums"
      >
        {formatNumber(count)}
      </Text>
    </PressableScale>
  )
}

function PersonRow({
  person,
  date,
  badge,
}: {
  person: QAPerson
  date: Date | number | string
  badge?: string
}) {
  return (
    <View className="flex-row items-center gap-2">
      <Avatar source={person.avatar} name={person.name} size="xs" verified={person.verified} />
      <Text variant="caption" weight={500} tone="primary" numberOfLines={1} className="shrink">
        {person.name}
      </Text>
      {badge ? <Badge tone="neutral">{badge}</Badge> : null}
      <Text variant="caption" tone="secondary" numberOfLines={1} className="ml-auto">
        {formatDate(date)}
      </Text>
    </View>
  )
}