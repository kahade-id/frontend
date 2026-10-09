/**
 * Kahade — <QACard> ala Threads (redesign 2026-09-27, TIM QA).
 *
 * Kartu pertanyaan publik: avatar + nama + @username + cap waktu relatif,
 * isi pertanyaan dengan line-height lega, jawaban resmi pemilik profil
 * sebagai balasan ber-utas (garis konektor kiri), dan bar aksi gaya Threads
 * (balas / suka / bagikan + hitungan, target sentuh 44px).
 *
 * Kontrak presentasi — BUKAN logika: endpoint, payload, batas karakter,
 * paginasi, dan aturan hapus milik sendiri tidak berubah di sini.
 *
 * Keputusan non-obvious:
 *   - Flat + hairline divider (bukan <Card> berbordir): utas Threads adalah
 *     aliran percakapan, bukan tumpukan kartu. Root memakai `-mx-5` supaya
 *     divider full-bleed di dalam induk ber-padding `px-5` (daftar feed).
 *   - Cap waktu RELATIF (`formatRelativeTime`: "5 menit", "2 jam") — untuk
 *     feed sosial memang itu kontrasnya; lewat 7 hari jatuh ke tanggal
 *     eksplisit (§13).
 *   - Jawaban resmi dirender sebagai balasan ber-utas dengan garis konektor
 *     di bawah avatar penanya (sejajar tengah avatar md = ml-5), bukan blok
 *     fill seperti dulu: hierarki utas dibentuk dari garis, bukan fill.
 *   - "Membantu" = ikon HandsClapping (tepuk tangan), BUKAN hati: di Tanya
 *     Jawab arti like adalah "jawaban ini membantu / pertanyaan ini sudah
 *     terjawab". Hati tetap milik etalase (❤️ = suka produk). Aktif = fill +
 *     tone aksen. Bentuk prop `upvote` `{ count, active, loading, onToggle }`
 *     tidak berubah supaya pemanggil tidak ikut berubah.
 *   - Jawaban pemilik = blok ber-latar (`bg-surface`) berbadge "Pemilik" di
 *     bawah pertanyaan — beda visual dari pertanyaan (netral) dan balasan
 *     pengunjung (indent biasa, lihat <QaCommentItem>).
 *   - Ikon balas berfungsi ganda: bila `onToggleComments` diberikan ia jadi
 *     tombol buka/tutup utas; bila tidak, ia indikator statis jumlah
 *     balasan. Ikon bagikan HANYA dirender bila `onShare` diberikan — tombol
 *     mati dilarang.
 *   - Hapus milik sendiri lewat menu overflow (DotsThree) di header: menu
 *     hanya ada bila `onDelete` diberikan, jadi pemanggil (= pemilik)
 *     yang menentukan visibilitas — komponen tidak tahu sesi.
 *   - Slot lama `answerAction` (tombol "Jawab" inbox) dan `footer` (aksi
 *     tambahan: sembunyikan/hapus/lihat profil) dipertahankan agar layar
 *     inbox tidak perlu berubah logika.
 */
import { useState, type ReactNode } from "react"
import { View, type ViewProps } from "react-native"

import { ChatCircle, DotsThree, HandsClapping, PaperPlaneTilt, Trash } from "phosphor-react-native"

import { Avatar, type AvatarProps } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Icon } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { summarize } from "@/lib/a11y"
import { cn } from "@/lib/cn"
import { focusRing } from "@/lib/focus-ring"
import { formatNumber, formatRelativeTime } from "@/lib/format"
import { translate, useLanguage } from "@/lib/i18n"

export type QAPerson = {
  name: string
  /** Handle TANPA "@" — ditampilkan sebagai @username di bawah nama */
  username?: string
  avatar?: AvatarProps["source"]
  verified?: boolean
}

export type QAAnswer = {
  text: string
  by: QAPerson
  date: Date | number | string
}

/** Bentuk prop tidak berubah dari desain lama — hanya presentasinya jadi tepuk tangan (HandsClapping). */
export type QAUpvote = {
  count: number
  active: boolean
  loading?: boolean
  onToggle: (next: boolean) => void
}

export type QACardProps = Omit<ViewProps, "children"> & {
  question: string
  asker: QAPerson
  date: Date | number | string
  answer?: QAAnswer
  /** Slot saat belum dijawab (mis. tombol "Jawab") — hanya untuk pemilik */
  answerAction?: ReactNode
  /** Slot bawah: aksi tambahan (sembunyikan, hapus, lihat profil, dsb.) */
  footer?: ReactNode
  /** Toggle "membantu" — dirender sebagai tepuk tangan + hitungan di bar aksi */
  upvote?: QAUpvote
  /** Jumlah balasan — indikator di ikon balas */
  commentCount?: number
  /** Utas balasan sedang dibuka (ikon balas menyala) */
  commentsOpen?: boolean
  /** Toggle buka/tutup utas balasan — tanpa ini ikon balas jadi indikator statis */
  onToggleComments?: () => void
  /** Bagikan — tanpa ini ikon bagikan tidak dirender (tanpa tombol mati) */
  onShare?: () => void
  /** Hapus milik sendiri — menu "⋯" hanya muncul bila ini diberikan */
  onDelete?: () => void
  /** Batas baris di mode daftar; undefined = penuh */
  questionLines?: number
  answerLines?: number
  /** Teks i18n */
  labels?: Partial<QACardLabels>
  className?: string
}

/** Teks i18n */
export type QACardLabels = {
  /** Badge di jawaban resmi pemilik profil. */
  owner: string
  unanswered: string
  askedBy: (name: string) => string
  answeredBy: (name: string) => string
  reply: string
  like: string
  unlike: string
  share: string
  moreOptions: string
  delete: string
}

function useDefaultLabels(): QACardLabels {
  useLanguage()
  return {
    owner: translate("Pemilik"),
    unanswered: translate("Belum dijawab"),
    askedBy: (name: string) => translate("Ditanya {x}", { x: name }),
    answeredBy: (name: string) => translate("Dijawab {x}", { x: name }),
    reply: translate("Balas"),
    like: translate("Membantu"),
    unlike: translate("Batal membantu"),
    share: translate("Bagikan"),
    moreOptions: translate("Opsi lainnya"),
    delete: translate("Hapus"),
  }
}

export function QACard({
  question,
  asker,
  date,
  answer,
  answerAction,
  footer,
  upvote,
  commentCount,
  commentsOpen = false,
  onToggleComments,
  onShare,
  onDelete,
  questionLines,
  answerLines,
  labels,
  className,
  ...rest
}: QACardProps) {
  const t = { ...useDefaultLabels(), ...labels }
  const [menuOpen, setMenuOpen] = useState(false)

  const replyCount = commentCount ?? 0
  const showReplyAction = onToggleComments != null || replyCount > 0

  return (
    // Divider full-bleed: induk daftar memakai px-5, jadi -mx-5 + px-5.
    <View
      className={cn("-mx-5 border-b border-border px-5 py-4", className)}
      {...rest}
    >
      <View className="flex-row gap-3">
        <Avatar source={asker.avatar} name={asker.name} size="md" verified={asker.verified} />

        <View className="flex-1 gap-1.5">
          {/* Header: nama + waktu relatif + overflow */}
          <View className="flex-row items-center gap-2">
            <Text variant="body" weight={600} numberOfLines={1} className="shrink">
              {asker.name}
            </Text>
            <Text variant="caption" tone="secondary" numberOfLines={1} className="ml-auto shrink-0 tabular-nums">
              {formatRelativeTime(date)}
            </Text>
            {onDelete ? (
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={t.moreOptions}
                accessibilityState={{ expanded: menuOpen }}
                onPress={() => setMenuOpen((v) => !v)}
                hitSlop={12}
                containerClassName={cn("-mr-2 rounded-full", focusRing)}
              >
                <Icon icon={DotsThree} size="sm" weight="bold" />
              </PressableScale>
            ) : null}
          </View>

          {asker.username ? (
            <Text variant="caption" tone="secondary" numberOfLines={1} className="-mt-1">
              @{asker.username}
            </Text>
          ) : null}

          {/* Menu overflow: hanya Hapus (milik sendiri) */}
          {onDelete && menuOpen ? (
            <View className="flex-row justify-end">
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={t.delete}
                onPress={() => {
                  setMenuOpen(false)
                  onDelete()
                }}
                hitSlop={12}
                containerClassName={cn("rounded-full", focusRing)}
                className="flex-row items-center gap-1.5 rounded-full border border-border px-3 py-1.5"
              >
                <Icon icon={Trash} size="xs" tone="danger" />
                <Text variant="caption" weight={600} tone="danger">
                  {t.delete}
                </Text>
              </PressableScale>
            </View>
          ) : null}

          {/* Isi pertanyaan — line-height lega untuk keterbacaan */}
          <Text
            accessibilityLabel={summarize([t.askedBy(asker.name), formatRelativeTime(date), question])}
            ellipsizeMode="tail"
            variant="body"
            numberOfLines={questionLines}
            className="leading-7"
          >
            {question}
          </Text>

          {/* Jawaban resmi pemilik: blok ber-latar + badge "Pemilik" —
              disorot dari pertanyaan (netral) dan balasan pengunjung. */}
          {answer ? (
            <View className="ml-5 border-l-2 border-border pl-3 pt-1">
              <View
                accessible
                accessibilityLabel={summarize([
                  t.answeredBy(answer.by.name),
                  t.owner,
                  formatRelativeTime(answer.date),
                  answer.text,
                ])}
                className="gap-1.5 rounded-md bg-surface px-3 py-2.5"
              >
                <View className="flex-row items-center gap-2">
                  <Avatar source={answer.by.avatar} name={answer.by.name} size="xs" verified={answer.by.verified} />
                  <Text variant="caption" weight={600} numberOfLines={1} className="shrink">
                    {answer.by.name}
                  </Text>
                  <Badge tone="info" variant="soft">{t.owner}</Badge>
                  <Text variant="caption" tone="secondary" numberOfLines={1} className="ml-auto shrink-0 tabular-nums">
                    {formatRelativeTime(answer.date)}
                  </Text>
                </View>
                <Text variant="body" numberOfLines={answerLines} className="leading-7">
                  {answer.text}
                </Text>
              </View>
            </View>
          ) : (
            <View className="flex-row items-center justify-between gap-3 pt-1">
              <Text variant="caption" tone="secondary">
                {t.unanswered}
              </Text>
              {answerAction}
            </View>
          )}

          {/* Bar aksi gaya Threads */}
          <View className="flex-row items-center gap-6 pt-2">
            {showReplyAction ? (
              <ThreadAction
                icon={ChatCircle}
                label={t.reply}
                count={replyCount}
                active={commentsOpen}
                onPress={onToggleComments}
                accessibilityHint={
                  commentsOpen ? translate("Tutup utas balasan") : translate("Buka utas balasan")
                }
              />
            ) : null}
            {upvote ? (
              <ThreadAction
                icon={HandsClapping}
                label={upvote.active ? t.unlike : t.like}
                count={upvote.count}
                active={upvote.active}
                fillWhenActive
                disabled={upvote.loading}
                onPress={() => upvote.onToggle(!upvote.active)}
                accessibilityHint={translate("Saat ini {x} suka", { x: formatNumber(upvote.count) })}
              />
            ) : null}
            {onShare ? (
              <ThreadAction icon={PaperPlaneTilt} label={t.share} onPress={onShare} />
            ) : null}
          </View>

          {footer ? <View className="pt-1">{footer}</View> : null}
        </View>
      </View>
    </View>
  )
}

/** Satu aksi di bar Threads: ikon 20px + hitungan, target sentuh 44px via hitSlop. */
function ThreadAction({
  icon,
  label,
  count,
  active = false,
  activeTone = "active",
  fillWhenActive = false,
  disabled = false,
  onPress,
  accessibilityHint,
}: {
  icon: typeof HandsClapping
  label: string
  count?: number
  active?: boolean
  activeTone?: "active" | "danger"
  fillWhenActive?: boolean
  disabled?: boolean
  onPress?: () => void
  accessibilityHint?: string
}) {
  const content = (
    <>
      <Icon
        icon={icon}
        size="sm"
        tone={active ? activeTone : "default"}
        weight={active && fillWhenActive ? "fill" : "regular"}
      />
      {count != null && count > 0 ? (
        <Text
          variant="caption"
          tone={active ? (activeTone === "danger" ? "danger" : "primary") : "secondary"}
          weight={500}
          className="tabular-nums"
        >
          {formatNumber(count)}
        </Text>
      ) : null}
    </>
  )

  if (!onPress) {
    // Indikator statis (tanpa tombol mati): mis. jumlah balasan di inbox.
    return (
      <View accessible accessibilityRole="text" accessibilityLabel={`${label}, ${formatNumber(count ?? 0)}`} className="flex-row items-center gap-1.5 py-1">
        {content}
      </View>
    )
  }

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected: active }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={12}
      containerClassName={cn("rounded-full", focusRing)}
      className="flex-row items-center gap-1.5 px-1 py-1"
    >
      {content}
    </PressableScale>
  )
}
