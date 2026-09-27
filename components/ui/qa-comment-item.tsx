/**
 * Kahade — <QaCommentItem> + <QaCommentComposer> ala Threads (redesign 2026-09-27, TIM QA).
 * API: GET/POST /v1/users/questions/{questionId}/comments,
 *      DELETE /v1/users/comments/{commentId}
 *
 * Satu balasan di utas Tanya-Jawab: avatar sm -> nama + waktu relatif ->
 * isi -> aksi (Balas · Hapus). Balasan yang bersambung dihubungkan garis
 * vertikal di kolom avatar (`hasNext`) — kosakata Threads untuk utas.
 * Composer: avatar penulis + placeholder elegan + counter karakter +
 * tombol kirim lingkaran yang aktif hanya bila valid.
 *
 * Kontrak presentasi — BUKAN logika: endpoint, payload, batas karakter
 * (pertanyaan 5–500, komentar 1–1000), paginasi 20, dan aturan hapus milik
 * sendiri tidak berubah di sini.
 *
 * Keputusan non-obvious:
 *   - Garis konektor (`hasNext`) menggantikan inset `pl-11` yang lama:
 *     utas Kahade satu level, tapi garis justru memberi tahu "masih ada
 *     lanjutan di bawah" — persis fungsi garis di Threads. Item terakhir
 *     (atau satu-satunya) tidak menggambar garis.
 *   - `createdAt` (baru) diformat relatif di dalam ("5 menit"); prop lama
 *     `timestamp` (string pra-format) tetap didukung untuk pemanggil lama —
 *     bila keduanya ada, `createdAt` menang.
 *   - Aksi "Hapus" hanya muncul bila `onDelete` diberikan (milik sendiri).
 *   - Composer generik: dipakai untuk pertanyaan (minLength 5, maxLength 500)
 *     maupun balasan (minLength 1, maxLength 1000). Tombol kirim TERKUNCI
 *     bila panjang < minLength atau > maxLength — aturan SAMA dengan
 *     validasi layar (bukan sekadar `maxLength` input).
 *   - Counter memakai `showCount` bawaan <TextArea> ("12/500"); di bawah
 *     minimum, teks bantuan menampilkan syarat minimum ("min. 5 karakter").
 */
import type { ReactNode } from "react"
import { View, type ViewProps } from "react-native"

import { ArrowUp } from "phosphor-react-native"

import { Avatar, type AvatarProps } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Icon } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"
import { TextLink } from "@/components/ui/text-link"
import { summarize } from "@/lib/a11y"
import { cn } from "@/lib/cn"
import { focusRing } from "@/lib/focus-ring"
import { formatRelativeTime } from "@/lib/format"
import { translate, useLanguage } from "@/lib/i18n"

export type QaCommentLabels = {
  owner: string
  reply: string
  delete: string
  deleted: string
}

export type QaCommentItemProps = Omit<ViewProps, "children"> & {
  authorName: string
  authorAvatar?: Pick<AvatarProps, "source">
  authorVerified?: boolean
  /** Penulis = pemilik profil (penjual) -> Badge */
  isOwner?: boolean
  content: string
  /** String pra-format (kompat lama) — kalah dari `createdAt` bila keduanya ada */
  timestamp?: string
  /** Waktu mentah — diformat relatif ("5 menit") di dalam */
  createdAt?: Date | number | string
  /**
   * (Lama, dipertahankan) Komentar ini adalah balasan. Tidak lagi
   * meng-inset — konektor garis + indentasi konsisten menggantikannya.
   */
  reply?: boolean
  /** Ada balasan lanjutan di bawah -> gambar garis konektor vertikal */
  hasNext?: boolean
  /** Komentar sudah dihapus (soft) -> placeholder abu */
  deleted?: boolean
  onReply?: () => void
  onDelete?: () => void
  onPressAuthor?: () => void
  extra?: ReactNode
  labels?: Partial<QaCommentLabels>
  className?: string
}

/**
 * Label bawaan mengikuti bahasa aktif (dulu hardcode di default param).
 * Nilai dibaca via translate() saat render.
 */
function useDefaultLabels(): QaCommentLabels {
  useLanguage()
  return {
    owner: translate("Penjual"),
    reply: translate("Balas"),
    delete: translate("Hapus"),
    deleted: translate("Komentar telah dihapus"),
  }
}

export function QaCommentItem({
  authorName,
  authorAvatar,
  authorVerified = false,
  isOwner = false,
  content,
  timestamp,
  createdAt,
  reply = false,
  hasNext = false,
  deleted = false,
  onReply,
  onDelete,
  onPressAuthor,
  extra,
  labels,
  className,
  ...rest
}: QaCommentItemProps) {
  const t = { ...useDefaultLabels(), ...labels }
  // `reply` dipertahankan di signature untuk kompatibilitas; tidak lagi
  // memengaruhi layout (lihat docblock modul).
  void reply
  const time = createdAt != null ? formatRelativeTime(createdAt) : (timestamp ?? "")

  return (
    // Root TANPA `accessible`: nama penulis bisa berupa <TextLink> dan `extra`
    // memuat aksi yang wajib fokusable. Ringkasan dipasang di blok isi (audit #4).
    <View className={cn("flex-row gap-3 py-3", className)} {...rest}>
      {/* Kolom avatar + garis konektor utas */}
      <View className="items-center">
        <Avatar source={authorAvatar?.source} name={authorName} size="sm" verified={authorVerified} />
        {hasNext ? (
          <View testID="qa-thread-line" className="w-0.5 flex-1 bg-border" style={{ marginTop: 6 }} />
        ) : null}
      </View>

      <View className="flex-1 gap-1">
        <View className="flex-row flex-wrap items-center gap-x-2 gap-y-1">
          {onPressAuthor ? (
            <TextLink variant="body" weight={600} onPress={onPressAuthor} numberOfLines={1}>
              {authorName}
            </TextLink>
          ) : (
            <Text ellipsizeMode="tail" variant="body" weight={600} tone="primary" numberOfLines={1}>
              {authorName}
            </Text>
          )}
          {isOwner ? (
            <Badge tone="info" variant="soft">
              {t.owner}
            </Badge>
          ) : null}
          <Text variant="caption" tone="secondary" className="tabular-nums">
            {time}
          </Text>
        </View>

        {deleted ? (
          <Text
            accessibilityLabel={summarize([authorName, isOwner ? t.owner : undefined, time, t.deleted])}
            variant="body"
            tone="secondary"
            className="italic"
          >
            {t.deleted}
          </Text>
        ) : (
          <Text
            accessibilityLabel={summarize([authorName, isOwner ? t.owner : undefined, time, content])}
            variant="body"
            tone="primary"
            className="leading-7"
          >
            {content}
          </Text>
        )}

        {!deleted && (onReply || onDelete) ? (
          <View className="flex-row items-center gap-4 pt-1">
            {onReply ? (
              <TextLink variant="caption" weight={500} onPress={onReply}>
                {t.reply}
              </TextLink>
            ) : null}
            {onDelete ? (
              <TextLink
                variant="caption"
                weight={500}
                onPress={onDelete}
                accessibilityLabel={translate("{x} balasan", { x: t.delete })}
              >
                {t.delete}
              </TextLink>
            ) : null}
          </View>
        ) : null}

        {extra ? <View className="pt-2">{extra}</View> : null}
      </View>
    </View>
  )
}

export type QaCommentComposerProps = Omit<ViewProps, "children"> & {
  value: string
  onChangeText: (text: string) => void
  onSubmit: () => void
  submitting?: boolean
  placeholder?: string
  /** Label aksesibilitas tombol kirim (kompat lama) */
  submitLabel?: string
  /** Batas maksimum karakter (kompat lama: komentar 1000) */
  maxLength?: number
  /** Batas minimum karakter — tombol terkunci di bawah ini. Pertanyaan: 5. */
  minLength?: number
  /** Nama yang dibalas, mis. "@budisantoso" — tampil sebagai caption */
  replyingTo?: string
  onCancelReply?: () => void
  errorText?: string
  /** Avatar penulis di sisi input (inisial bila tanpa foto) */
  authorName?: string
  authorAvatar?: Pick<AvatarProps, "source">
  className?: string
}

export function QaCommentComposer({
  value,
  onChangeText,
  onSubmit,
  submitting = false,
  placeholder,
  submitLabel,
  maxLength = 1000,
  minLength = 1,
  replyingTo,
  onCancelReply,
  errorText,
  authorName,
  authorAvatar,
  className,
  ...rest
}: QaCommentComposerProps) {
  // i18n: default mengikuti bahasa aktif (dulu hardcode di default param).
  useLanguage()
  const trimmedLength = value.trim().length
  const tooShort = trimmedLength < minLength
  const tooLong = maxLength != null && trimmedLength > maxLength
  const canSubmit = !tooShort && !tooLong && !submitting
  const resolvedPlaceholder = placeholder ?? translate("Tulis balasan…")
  const resolvedSubmitLabel = submitLabel ?? translate("Kirim balasan")

  return (
    <View className={cn("gap-2", className)} {...rest}>
      {replyingTo ? (
        <View className="flex-row items-center justify-between gap-3">
          <Text variant="caption" tone="secondary" numberOfLines={1} className="flex-1">
            {translate("Membalas {x}", { x: replyingTo })}
          </Text>
          {onCancelReply ? (
            <TextLink variant="caption" weight={500} onPress={onCancelReply}>
              {translate("Batal")}
            </TextLink>
          ) : null}
        </View>
      ) : null}

      <View className="flex-row items-start gap-3">
        <Avatar source={authorAvatar?.source} name={authorName} size="sm" />
        <View className="flex-1">
          <TextArea
            value={value}
            onChangeText={onChangeText}
            placeholder={resolvedPlaceholder}
            maxLength={maxLength}
            showCount
            rows={3}
            errorText={errorText}
            accessibilityLabel={translate("Tulis balasan")}
          />
        </View>
      </View>

      <View className="flex-row items-center justify-between pl-11">
        <Text variant="caption" tone={tooShort && trimmedLength > 0 ? "warning" : "secondary"}>
          {tooShort && trimmedLength > 0
            ? translate("min. {x} karakter", { x: minLength })
            : translate("maks. {x} karakter", { x: maxLength })}
        </Text>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={resolvedSubmitLabel}
          accessibilityState={{ disabled: !canSubmit, busy: submitting }}
          disabled={!canSubmit}
          onPress={onSubmit}
          hitSlop={8}
          containerClassName={cn("rounded-full", focusRing)}
          className={cn(
            "h-11 w-11 items-center justify-center rounded-full",
            canSubmit ? "bg-primary" : "bg-surface-elevated opacity-50",
          )}
        >
          <Icon icon={ArrowUp} size="sm" weight="bold" tone={canSubmit ? "inverse" : "default"} />
        </PressableScale>
      </View>
    </View>
  )
}

/** Validasi panjang composer — diekspor untuk test & dokumentasi aturan. */
export function isQaComposerValid(value: string, minLength: number, maxLength: number): boolean {
  const len = value.trim().length
  return len >= minLength && len <= maxLength
}
