/**
 * Kahade — <QaCommentItem> + <QaCommentComposer> (§9.17, §9.4 Avatar, §13).
 * API: GET/POST /v1/users/questions/{questionId}/comments,
 *      DELETE /v1/users/comments/{commentId}
 *
 * Satu komentar di utas Tanya-Jawab profil penjual: Avatar sm -> nama +
 * waktu -> isi -> aksi (Balas · Hapus). Composer terpisah di bawah utas.
 *
 * Keputusan non-obvious:
 *   - Avatar `sm` (32) bukan `md`: komentar adalah konten sekunder di bawah
 *     pertanyaan; avatar besar membuat utas terasa seperti daftar pengguna.
 *   - Balasan (`reply`) di-inset pl-11 (avatar sm 32 + gap-3 12) tanpa garis
 *     vertikal: utas Kahade hanya satu level; garis "thread" menyiratkan
 *     kedalaman yang tidak ada.
 *   - Badge "Penjual" untuk `isOwner` (pemilik profil menjawab) — satu-satunya
 *     penanda semantik (tone info), karena pembaca perlu tahu jawaban resmi.
 *   - Aksi "Hapus" hanya muncul bila `onDelete` diberikan (komentar sendiri).
 *     TextLink caption, bukan IconButton: aksi jarang, tidak boleh dominan.
 *   - Composer: TextArea + Button sm; tombol disabled saat kosong; Enter
 *     tidak submit (multiline) — kirim eksplisit via tombol.
 */
import type { ReactNode } from "react"
import { View, type ViewProps } from "react-native"
import { translate, useLanguage } from "@/lib/i18n"

import { Avatar, type AvatarProps } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"
import { TextLink } from "@/components/ui/text-link"
import { summarize } from "@/lib/a11y"
import { cn } from "@/lib/cn"

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
  /** Sudah diformat (§13) */
  timestamp: string
  /** Komentar ini adalah balasan -> inset */
  reply?: boolean
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
 * Label bawaan mengikuti bahasa aktif (dulu konstanta modul yang tidak
 * reaktif). Nilai dibaca via translate() saat render.
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
  reply = false,
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

  return (
    // Root TANPA `accessible`: nama penulis bisa berupa <TextLink> dan `extra`
    // memuat aksi (suka/laporkan) yang wajib fokusable. Ringkasan dipasang di
    // blok isi komentar (audit #4).
    <View className={cn("flex-row gap-3 py-3", reply && "pl-11", className)} {...rest}>
      <Avatar source={authorAvatar?.source} name={authorName} size="sm" verified={authorVerified} />
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
          <Text variant="monoBody" tone="secondary">
            {timestamp}
          </Text>
        </View>

        {deleted ? (
          <Text
            accessibilityLabel={summarize([authorName, isOwner ? t.owner : undefined, timestamp, t.deleted])}
            variant="body"
            tone="secondary"
            className="italic"
          >
            {t.deleted}
          </Text>
        ) : (
          <Text
            accessibilityLabel={summarize([authorName, isOwner ? t.owner : undefined, timestamp, content])}
            variant="body"
            tone="primary"
            className="leading-6"
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
              <TextLink variant="caption" weight={500} onPress={onDelete} accessibilityLabel={translate("{x} komentar", { x: t.delete })}>
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
  submitLabel?: string
  maxLength?: number
  /** Nama yang dibalas, mis. "@budisantoso" — tampil sebagai caption */
  replyingTo?: string
  onCancelReply?: () => void
  errorText?: string
  className?: string
}

export function QaCommentComposer({
  value,
  onChangeText,
  onSubmit,
  submitting = false,
  placeholder,
  submitLabel,
  maxLength = 500,
  replyingTo,
  onCancelReply,
  errorText,
  className,
  ...rest
}: QaCommentComposerProps) {
  // i18n: default mengikuti bahasa aktif (dulu hardcode di default param).
  useLanguage()
  const canSubmit = value.trim().length > 0 && !submitting
  const resolvedPlaceholder = placeholder ?? translate("Tulis komentar…")
  const resolvedSubmitLabel = submitLabel ?? translate("Kirim")

  return (
    <View className={cn("gap-3", className)} {...rest}>
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
      <TextArea
        value={value}
        onChangeText={onChangeText}
        placeholder={resolvedPlaceholder}
        maxLength={maxLength}
        showCount
        errorText={errorText}
        accessibilityLabel={translate("Tulis komentar")}
      />
      <View className="flex-row justify-end">
        <Button size="sm" onPress={onSubmit} disabled={!canSubmit} loading={submitting} fullWidth={false}>
          {resolvedSubmitLabel}
        </Button>
      </View>
    </View>
  )
}