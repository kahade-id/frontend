/**
 * Kahade — <OrderHistoryTimeline> (§9.21 Timeline, §13 format tanggal,
 * §2.3 status).
 * API: GET /v1/orders/{orderId}/history, GET /v1/orders/average-durations
 *
 * Riwayat transisi status pesanan sebagai <Timeline> — di sini garis
 * penghubung TEPAT karena setiap entri adalah langkah proses berurutan
 * (dibuat -> dibayar -> diproses -> dikirim -> selesai). Ini kebalikan dari
 * SecurityLogItem/ActivityLogItem yang sengaja menghindari Timeline.
 *
 * Komponen memetakan entri backend (`from_status`, `to_status`, `actor`,
 * `note`, `created_at`) menjadi TimelineItem:
 *   - title       : label status tujuan (ORDER_STATUS_LABELS)
 *   - description : "oleh Pembeli/Penjual/Sistem" + catatan opsional
 *   - timestamp   : sudah diformat pemanggil (§13)
 *   - status      : semua "done" kecuali entri terakhir = "current" bila
 *                   pesanan masih aktif (isOrderActive)
 *   - tone        : DISPUTED/CANCELLED/REFUNDED -> danger; EXPIRED -> warning
 *
 * Keputusan non-obvious:
 *   - `expectedNext` (dari average-durations) menambah SATU item "upcoming"
 *     di bawah, mis. "Biasanya dikirim dalam 1–2 hari". Ini cara
 *     menampilkan estimasi tanpa menjanjikan tanggal pasti: teks durasi
 *     rata-rata, bukan deadline. Tidak dirender bila pesanan sudah final.
 *   - Urutan input dianggap kronologis naik (terlama di atas) — sesuai
 *     response backend; komponen TIDAK mengurutkan ulang agar pemanggil
 *     tetap sumber kebenaran.
 */
import { View, type ViewProps } from "react-native"

import {
  ORDER_STATUS_LABELS,
  isOrderActive,
  isOrderStatus,
  type OrderStatus,
} from "@/components/ui/order-status-badge"
import { Timeline, type TimelineItem, type TimelineTone } from "@/components/ui/timeline"
import { cn } from "@/lib/cn"

export type OrderHistoryActor = "BUYER" | "SELLER" | "SYSTEM" | "ADMIN"

export type OrderHistoryEntry = {
  id: string
  toStatus: OrderStatus | string
  fromStatus?: OrderStatus | string
  actor?: OrderHistoryActor | string
  note?: string
  /** Sudah diformat (§13): "3 Sep 2026, 14:30" */
  timestamp: string
}

export type OrderHistoryLabels = {
  by: string
  actors: Record<OrderHistoryActor, string>
  statuses: Partial<Record<OrderStatus, string>>
}

export type OrderHistoryTimelineProps = Omit<ViewProps, "children"> & {
  entries: readonly OrderHistoryEntry[]
  /** Status pesanan saat ini — menentukan apakah entri terakhir "current" */
  currentStatus: OrderStatus | string
  /**
   * Estimasi langkah berikutnya dari GET /v1/orders/average-durations,
   * mis. { title: "Dikirim", description: "Biasanya dalam 1–2 hari" }
   */
  expectedNext?: { title: string; description?: string }
  labels?: Partial<OrderHistoryLabels>
  className?: string
}

const DEFAULT_LABELS: OrderHistoryLabels = {
  by: "oleh",
  actors: { BUYER: "Pembeli", SELLER: "Penjual", SYSTEM: "Sistem", ADMIN: "Admin Kahade" },
  statuses: {},
}

const DANGER_STATUSES: readonly string[] = ["DISPUTED", "CANCELLED", "REFUNDED"]
const WARNING_STATUSES: readonly string[] = ["EXPIRED"]

function toneFor(status: string): TimelineTone {
  if (DANGER_STATUSES.includes(status)) return "danger"
  if (WARNING_STATUSES.includes(status)) return "warning"
  return "neutral"
}

export function mapOrderHistoryToTimeline(
  entries: readonly OrderHistoryEntry[],
  currentStatus: string,
  labels: OrderHistoryLabels,
  expectedNext?: OrderHistoryTimelineProps["expectedNext"],
): TimelineItem[] {
  const active = isOrderActive(currentStatus)
  const lastIdx = entries.length - 1

  const items: TimelineItem[] = entries.map((e, i) => {
    const statusLabel =
      labels.statuses[e.toStatus as OrderStatus] ??
      (isOrderStatus(e.toStatus) ? ORDER_STATUS_LABELS[e.toStatus] : e.toStatus)
    const actorLabel = e.actor ? labels.actors[e.actor as OrderHistoryActor] ?? e.actor : undefined
    const parts: string[] = []
    if (actorLabel) parts.push(`${labels.by} ${actorLabel}`)
    if (e.note) parts.push(e.note)

    return {
      id: e.id,
      title: statusLabel,
      description: parts.length > 0 ? parts.join(" \u2014 ") : undefined,
      timestamp: e.timestamp,
      status: i === lastIdx && active ? "current" : "done",
      tone: toneFor(e.toStatus),
    }
  })

  if (active && expectedNext) {
    items.push({
      id: "__expected_next",
      title: expectedNext.title,
      description: expectedNext.description,
      status: "upcoming",
      tone: "neutral",
    })
  }

  return items
}

export function OrderHistoryTimeline({
  entries,
  currentStatus,
  expectedNext,
  labels,
  className,
  ...rest
}: OrderHistoryTimelineProps) {
  const t: OrderHistoryLabels = {
    ...DEFAULT_LABELS,
    ...labels,
    actors: { ...DEFAULT_LABELS.actors, ...labels?.actors },
    statuses: { ...DEFAULT_LABELS.statuses, ...labels?.statuses },
  }
  const items = mapOrderHistoryToTimeline(entries, currentStatus, t, expectedNext)

  return (
    <View accessible={false} className={cn("w-full", className)} {...rest}>
      <Timeline items={items} accessibilityLabel="Riwayat status pesanan" />
    </View>
  )
}
