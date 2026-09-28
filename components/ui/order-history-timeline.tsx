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
import { useState } from "react"

import {
  ORDER_STATUS_LABELS,
  isOrderActive,
  isOrderStatus,
  type OrderStatus,
} from "@/components/ui/order-status-badge"
import { OrderRoleBadge } from "@/components/ui/order-role-badge"
import { Button } from "@/components/ui/button"
import { splitTimelineLatest } from "@/lib/wallet-batch139"
import { Timeline, type TimelineItem, type TimelineTone } from "@/components/ui/timeline"
import { cn } from "@/lib/cn"
import { hasOwn } from "@/lib/has-own"
import { translate } from "@/lib/i18n/translate"

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

// R2 (audit ronde-2, butir #88): label default TETAP lewat translate() —
// string Indonesia mentah di DEFAULT_LABELS tidak pernah tercatat katalog
// sehingga pengguna English membaca campuran bahasa.
const DEFAULT_LABELS: OrderHistoryLabels = {
  by: translate("oleh"),
  actors: {
    BUYER: translate("Pembeli"),
    SELLER: translate("Penjual"),
    SYSTEM: translate("Sistem"),
    ADMIN: translate("Admin Kahade"),
  },
  statuses: {},
}

const DANGER_STATUSES: readonly string[] = ["DISPUTED", "CANCELLED", "REFUNDED"]
const WARNING_STATUSES: readonly string[] = ["EXPIRED"]

// Item 44: alasan manusiawi untuk transisi yang dilakukan sistem tanpa
// catatan — "oleh Sistem" saja tidak menjelaskan KENAPA.
const SYSTEM_REASONS: Record<string, string> = {
  EXPIRED: translate("tenggat habis tanpa sengketa"),
  COMPLETED: translate("dikonfirmasi otomatis setelah tenggat habis"),
  CANCELLED: translate("dibatalkan otomatis karena tenggat pembayaran habis"),
  REFUNDED: translate("dana dikembalikan otomatis"),
}

function toneFor(status: string): TimelineTone {
  if (DANGER_STATUSES.includes(status)) return "danger"
  if (WARNING_STATUSES.includes(status)) return "warning"
  return "neutral"
}

/**
 * Mega-batch FE-IMP-5 (item 44): alasan manusiawi untuk entri "oleh Sistem"
 * tanpa catatan. Sistem hanya memicu transisi otomatis yang bisa dipetakan
 * dari status tujuan — pemetaan konservatif, hanya untuk status yang
 * memang hanya bisa dipicu otomatis:
 * - EXPIRED   = batas pembayaran habis tanpa pembayaran
 * - COMPLETED = tenggat konfirmasi habis tanpa sengketa (rilis otomatis)
 * Status lain (CANCELLED/REFUNDED bisa manual) tidak ditebak.
 */
export function systemReasonLabel(toStatus: string): string | null {
  switch (toStatus) {
    case "EXPIRED":
      return "Batas pembayaran habis tanpa pembayaran"
    case "COMPLETED":
      return "Tenggat konfirmasi habis tanpa sengketa"
    default:
      return null
  }
}

export function mapOrderHistoryToTimeline(
  entries: readonly OrderHistoryEntry[],
  currentStatus: string,
  labels: OrderHistoryLabels,
  expectedNext?: OrderHistoryTimelineProps["expectedNext"],
): TimelineItem[] {
  // A-09: DISPUTED belum final tetapi alur state-machine sudah keluar —
  // entri terakhir tidak diberi penanda "current" yang berdenyut.
  const active = isOrderActive(currentStatus) && currentStatus !== "DISPUTED"
  const lastIdx = entries.length - 1

  const items: TimelineItem[] = entries.map((e, i) => {
    // M-12 (audit end-to-end 2026-09-24, issue #70 / P-C): indeksasi kamus
    // HARUS lewat hasOwn — `statuses["valueOf"]`/`["toString"]` mengembalikan
    // FUNGSI prototipe (bukan undefined), jadi `??` jatuh-tempat tidak pernah
    // jalan dan React crash "Functions are not valid as a React child".
    const statusLabel = (Object.prototype.hasOwnProperty.call(labels.statuses, e.toStatus)
      ? labels.statuses[e.toStatus as OrderStatus]
      : undefined) ??
      (isOrderStatus(e.toStatus) ? ORDER_STATUS_LABELS[e.toStatus] : e.toStatus)
    const actorLabel = e.actor
      ? (Object.prototype.hasOwnProperty.call(labels.actors, e.actor)
          ? labels.actors[e.actor as OrderHistoryActor]
          : undefined) ?? e.actor
      : undefined
    // J-06 (audit escrow 2026-09-24): kalimat digabung via translate supaya
    // urutan kata bisa dibalik bahasa lain — dulu `parts.join(" — ")`
    // (potongan sudah diterjemahkan, tetapi rangkaiannya lolos katalog).
    const systemReason =
      !e.note && e.actor === "SYSTEM" && hasOwn(SYSTEM_REASONS, e.toStatus)
        ? SYSTEM_REASONS[e.toStatus]
        : undefined
    const description =
      actorLabel && (e.note || systemReason)
        ? // R2 (audit ronde-2, butir #86): token kanonik {x}/{y}.
          translate("{x} — {y}", { x: `${labels.by} ${actorLabel}`, y: (e.note ?? systemReason) as string })
        : actorLabel
          ? `${labels.by} ${actorLabel}`
          : e.note

    return {
      id: e.id,
      title: statusLabel,
      description: description || undefined,
      // D14 (batch 139): badge peran yang SAMA dengan header & CTA —
      // komponen badge bersama, bukan teks bebas "oleh Pembeli".
      extra:
        e.actor === "BUYER" || e.actor === "SELLER" ? (
          <OrderRoleBadge role={e.actor} />
        ) : undefined,
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
  /**
   * D13 (batch 139): kejadian TERBARU selalu terbuka di atas; riwayat lama
   * disembunyikan dalam ekspander agar timeline panjang tidak mendominasi
   * layar. `expectedNext` (langkah berikut yang diprediksi) selalu ikut
   * tampil bersama kejadian terbaru — bukan terkubur di ekspander.
   */
  const { older: olderItems, latest } = splitTimelineLatest(
    items.filter((it) => it.id !== "__expected_next"),
  )
  // `expectedNext` (langkah berikut yang diprediksi) selalu ikut tampil
  // bersama kejadian terbaru — bukan terkubur di ekspander.
  const latestItems = [
    ...(latest ? [latest] : []),
    ...items.filter((it) => it.id === "__expected_next"),
  ]
  const [historyOpen, setHistoryOpen] = useState(false)

  return (
    <View className={cn("w-full", className)} {...rest}>
      {latestItems.length > 0 ? (
        <Timeline items={latestItems} accessibilityLabel="Kejadian terbaru" />
      ) : null}
      {olderItems.length > 0 ? (
        <View className="mt-2">
          <Button
            variant="secondary"
            size="sm"
            onPress={() => setHistoryOpen((v) => !v)}
            accessibilityLabel={
              historyOpen ? "Sembunyikan riwayat lama" : "Tampilkan riwayat lama"
            }
          >
            {historyOpen
              ? "Sembunyikan riwayat lama"
              : `Riwayat lama (${olderItems.length})`}
          </Button>
          {historyOpen ? (
            <View className="mt-2">
              <Timeline items={[...olderItems]} accessibilityLabel="Riwayat lama" />
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}
