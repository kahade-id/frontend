/**
 * Kahade — <SupportTicketCard> + <TicketStatusBadge> tiket bantuan (§9.6
 * Card, §9.7 Badge, §3.1 Mono untuk nomor tiket, §2.3 semantic status).
 *
 * Satu baris `GET /v1/support/tickets`; tap -> Push detail
 * (`GET /v1/support/tickets/{ticketId}`, balas via `/reply`). Anatomi:
 *   baris 1 : nomor tiket (Mono caption) ..... TicketStatusBadge
 *   baris 2 : subjek (body 600, 2 baris)
 *   baris 3 : kategori · jumlah lampiran (caption)
 *   baris 4 : cuplikan balasan terakhir (caption, 1 baris) ..... waktu
 *   opsional: strip "Menunggu balasan Anda" (border-t, Dot primary)
 *
 * Keputusan non-obvious:
 *   - Status: OPEN (warning — baru, belum ditangani), IN_PROGRESS (info),
 *     WAITING_USER (warning — giliran user), RESOLVED (success), CLOSED
 *     (neutral). Merah tidak dipakai: tidak ada status tiket yang "gagal".
 *   - `awaitingYou` diturunkan dari status WAITING_USER, tapi juga bisa
 *     dipaksa lewat prop (mis. admin menandai). Ditampilkan sebagai strip
 *     bawah — pola yang sama dengan DisputeCard, bukan Badge kedua.
 *   - `unread` (balasan baru belum dibaca) = Dot primary di kiri nomor tiket,
 *     konsisten dengan OrderCard.
 *   - Cuplikan balasan terakhir diawali nama pengirim ("CS Kahade: …" /
 *     "Anda: …") supaya user tahu siapa yang terakhir bicara tanpa membuka.
 */
import { Paperclip } from "phosphor-react-native"
import { View, type ViewProps } from "react-native"

import { Badge, type BadgeProps, type BadgeTone } from "@/components/ui/badge"
import { Card, type CardProps } from "@/components/ui/card"
import { Dot } from "@/components/ui/dot"
import { Icon } from "@/components/ui/icon"
import { Skeleton } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"
import { summarize } from "@/lib/a11y"
import { cn } from "@/lib/cn"
import { hasOwn } from "@/lib/has-own"
// UX: haptic feedback ensured for onPress (light) — improves confirmation

export type TicketStatus = "OPEN" | "IN_PROGRESS" | "WAITING_USER" | "RESOLVED" | "CLOSED"

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  OPEN: "Terbuka",
  IN_PROGRESS: "Ditangani",
  WAITING_USER: "Menunggu Anda",
  RESOLVED: "Selesai",
  CLOSED: "Ditutup",
}

const STATUS_TONE: Record<TicketStatus, BadgeTone> = {
  OPEN: "warning",
  IN_PROGRESS: "info",
  WAITING_USER: "warning",
  RESOLVED: "success",
  CLOSED: "neutral",
}

export function isTicketStatus(s: string): s is TicketStatus {
  // Own keys only — `in` would also accept inherited keys like "toString".
  return hasOwn(TICKET_STATUS_LABELS, s)
}

export function isTicketActive(status: string): boolean {
  return status === "OPEN" || status === "IN_PROGRESS" || status === "WAITING_USER"
}

export type TicketStatusBadgeProps = Omit<BadgeProps, "children" | "tone" | "dot"> & {
  status: TicketStatus | string
  size?: "sm" | "md"
  labels?: Partial<Record<TicketStatus, string>>
}

export function TicketStatusBadge({ status, size = "sm", labels, variant = "soft", ...rest }: TicketStatusBadgeProps) {
  const known = isTicketStatus(status)
  const label = known ? labels?.[status] ?? TICKET_STATUS_LABELS[status] : status
  return (
    <Badge tone={known ? STATUS_TONE[status] : "neutral"} variant={variant} dot={size === "sm"} accessibilityLabel={`Status tiket: ${label}`} {...rest}>
      {label}
    </Badge>
  )
}

export type SupportTicketCardLabels = {
  awaitingYou: string
  you: string
  support: string
  attachments: (n: number) => string
}

const DEFAULT_LABELS: SupportTicketCardLabels = {
  awaitingYou: "Menunggu balasan Anda",
  you: "Anda",
  support: "CS Kahade",
  attachments: (n) => `${n} lampiran`,
}

export type SupportTicketCardProps = Omit<CardProps, "children" | "variant" | "padded"> & {
  /** Nomor tiket yang ditampilkan, mis. "TKT-2026-0903-0012" */
  ticketNumber: string
  subject: string
  status: TicketStatus | string
  category?: string
  attachmentCount?: number
  lastMessage?: { text: string; fromUser: boolean }
  /** Sudah diformat pemanggil (§13) */
  updatedAt?: string
  unread?: boolean
  awaitingYou?: boolean
  labels?: Partial<SupportTicketCardLabels>
}

export function SupportTicketCard({
  ticketNumber,
  subject,
  status,
  category,
  attachmentCount,
  lastMessage,
  updatedAt,
  unread = false,
  awaitingYou,
  labels,
  onPress,
  accessibilityLabel,
  className,
  ...rest
}: SupportTicketCardProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const showAwaiting = (awaitingYou ?? status === "WAITING_USER") && isTicketActive(status)
  const statusLabel = isTicketStatus(status) ? TICKET_STATUS_LABELS[status] : status

  const a11y =
    accessibilityLabel ??
    summarize([
      unread ? "Ada balasan baru" : undefined,
      `Tiket ${ticketNumber}`,
      subject,
      statusLabel,
      category,
      updatedAt,
    ])

  return (
    <Card onPress={onPress} accessibilityLabel={a11y} accessibilityHint={onPress ? "Buka detail tiket" : undefined} className={cn("gap-3", className)} {...rest}>
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1 flex-row items-center gap-2">
          {unread ? <Dot size="md" tone="primary" /> : null}
          <Text ellipsizeMode="tail" variant="caption" tone="secondary" numberOfLines={1} className="font-mono-500 tracking-mono">
            {ticketNumber}
          </Text>
        </View>
        <TicketStatusBadge status={status} size="sm" />
      </View>

      <Text variant="body" weight={600} tone="primary" numberOfLines={2}>
        {subject}
      </Text>

      {category || attachmentCount ? (
        <View className="flex-row items-center gap-2">
          {category ? (
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {category}
            </Text>
          ) : null}
          {attachmentCount ? (
            <View className="flex-row items-center gap-1">
              {category ? (
                <Text variant="caption" tone="secondary">
                  ·
                </Text>
              ) : null}
              <Icon icon={Paperclip} size="xs" tone="default" />
              <Text variant="caption" tone="secondary" className="tabular-nums">
                {t.attachments(attachmentCount)}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {lastMessage || updatedAt ? (
        <View className="flex-row items-end justify-between gap-3">
          {lastMessage ? (
            <Text variant="caption" tone="secondary" numberOfLines={1} className="flex-1">
              <Text variant="inherit" tone="secondary">
                {lastMessage.fromUser ? t.you : t.support}
                {": "}
              </Text>
              {lastMessage.text}
            </Text>
          ) : (
            <View className="flex-1" />
          )}
          {updatedAt ? (
            <Text variant="caption" tone="secondary" className="tabular-nums">
              {updatedAt}
            </Text>
          ) : null}
        </View>
      ) : null}

      {showAwaiting ? (
        <View className="flex-row items-center gap-2 border-t border-border pt-3">
          <Dot size="md" tone="primary" />
          <Text variant="caption" weight={500} tone="primary">
            {t.awaitingYou}
          </Text>
        </View>
      ) : null}
    </Card>
  )
}

export function SupportTicketCardSkeleton({ className, ...rest }: Omit<ViewProps, "children"> & { className?: string }) {
  return (
    <View accessible accessibilityRole="progressbar" className={cn("w-full gap-3 rounded-md border border-border bg-surface p-5", className)} accessibilityLabel="Memuat tiket" {...rest}>
      <View className="flex-row items-center justify-between">
        <Skeleton height={12} className="w-32" />
        <Skeleton height={22} className="w-20" />
      </View>
      <Skeleton height={18} className="w-full" />
      <Skeleton height={12} className="w-28" />
      <View className="flex-row items-center justify-between">
        <Skeleton height={12} className="w-48" />
        <Skeleton height={12} className="w-20" />
      </View>
    </View>
  )
}