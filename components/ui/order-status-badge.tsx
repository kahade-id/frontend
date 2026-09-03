/**
 * Kahade — <OrderStatusBadge> + peta status escrow (§2.3 semantic eksklusif
 * untuk status transaksi, §9.7 Badge, §12 i18n-ready).
 *
 * SATU tempat yang menerjemahkan status order backend (`GET /v1/orders`,
 * `/v1/orders/{id}`) menjadi tone semantik + label Bahasa Indonesia. Dipakai
 * OrderCard, detail order, NotificationListItem, Timeline — supaya
 * "DISPUTED = danger" tidak diputuskan ulang di tiap layar.
 *
 * Siklus escrow (diturunkan dari endpoint orders: create -> pay -> process ->
 * shipping -> delivery-proof -> confirm -> complete; cabang cancel/dispute):
 *
 *   PENDING_PAYMENT  warning  menunggu pembeli bayar
 *   PAID             info     dana masuk escrow, menunggu penjual proses
 *   PROCESSING       info     penjual menyiapkan
 *   SHIPPED          info     dalam pengiriman
 *   DELIVERED        warning  bukti kirim masuk, menunggu konfirmasi pembeli
 *   COMPLETED        success  dana dilepas ke penjual
 *   DISPUTED         danger   sengketa dibuka
 *   CANCELLED        neutral  dibatalkan sebelum bayar / disepakati
 *   REFUNDED         neutral  dana dikembalikan ke pembeli
 *   EXPIRED          neutral  link/tagihan lewat batas waktu
 *
 * Keputusan non-obvious:
 *   - Schema OpenAPI mobile TIDAK mengekspor enum status order (hanya alur
 *     endpoint). Union `OrderStatus` di sini adalah kontrak sisi klien; status
 *     asing dari server jatuh ke tone "neutral" + label apa adanya (tidak
 *     crash, tidak menebak warna) — dan `console.warn` di dev.
 *   - "Menunggu tindakan SAYA" (PENDING_PAYMENT untuk pembeli, DELIVERED
 *     untuk pembeli, PAID untuk penjual) ditandai `warning`, bukan `info`:
 *     warning = "ada yang harus Anda lakukan", info = "sedang berjalan di
 *     pihak lain". Karena peran (pembeli/penjual) mengubah siapa yang harus
 *     bertindak, `role` opsional menggeser PAID -> warning bila penjual.
 *   - Badge `dot` default ON: dalam daftar padat titik warna membantu scan
 *     tanpa membaca teks; di header detail (`size="md"`) dot dimatikan
 *     karena Badge sudah berdiri sendiri.
 *   - Label default Bahasa Indonesia formal (§12 "Anda"), bisa dioverride
 *     lewat `labels` untuk i18n — komponen tidak mengunci string.
 */
import { Badge, type BadgeProps, type BadgeTone } from "@/components/ui/badge"

export type OrderStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "COMPLETED"
  | "DISPUTED"
  | "CANCELLED"
  | "REFUNDED"
  | "EXPIRED"

export type OrderRole = "buyer" | "seller"

export const ORDER_STATUSES: readonly OrderStatus[] = [
  "PENDING_PAYMENT",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "COMPLETED",
  "DISPUTED",
  "CANCELLED",
  "REFUNDED",
  "EXPIRED",
]

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Menunggu pembayaran",
  PAID: "Dana di escrow",
  PROCESSING: "Diproses penjual",
  SHIPPED: "Dalam pengiriman",
  DELIVERED: "Menunggu konfirmasi",
  COMPLETED: "Selesai",
  DISPUTED: "Sengketa",
  CANCELLED: "Dibatalkan",
  REFUNDED: "Dana dikembalikan",
  EXPIRED: "Kedaluwarsa",
}

const BASE_TONE: Record<OrderStatus, BadgeTone> = {
  PENDING_PAYMENT: "warning",
  PAID: "info",
  PROCESSING: "info",
  SHIPPED: "info",
  DELIVERED: "warning",
  COMPLETED: "success",
  DISPUTED: "danger",
  CANCELLED: "neutral",
  REFUNDED: "neutral",
  EXPIRED: "neutral",
}

export function isOrderStatus(s: string): s is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(s)
}

/**
 * Tone untuk status + peran. Penjual yang melihat PAID harus bertindak
 * (memproses) -> warning; pembeli melihat PAID hanya menunggu -> info.
 * Pembeli melihat DELIVERED harus konfirmasi -> warning; penjual menunggu -> info.
 */
export function orderStatusTone(status: string, role?: OrderRole): BadgeTone {
  if (!isOrderStatus(status)) {
    if (__DEV__) console.warn(`[kahade/order-status] status tidak dikenal: "${status}"`)
    return "neutral"
  }
  if (role === "seller" && status === "PAID") return "warning"
  if (role === "seller" && status === "DELIVERED") return "info"
  if (role === "buyer" && status === "PROCESSING") return "info"
  return BASE_TONE[status]
}

/** Status yang masih hidup (belum final) — untuk filter "Aktif" & pulse */
export function isOrderActive(status: string): boolean {
  return isOrderStatus(status) && !["COMPLETED", "CANCELLED", "REFUNDED", "EXPIRED"].includes(status)
}

export type OrderStatusBadgeProps = Omit<BadgeProps, "children" | "tone" | "dot"> & {
  status: OrderStatus | string
  /** Menggeser tone untuk status yang butuh tindakan pihak ini */
  role?: OrderRole
  /** "sm" di list (dot + caption), "md" di header detail (tanpa dot) */
  size?: "sm" | "md"
  /** Override label per status (i18n) */
  labels?: Partial<Record<OrderStatus, string>>
}

export function OrderStatusBadge({ status, role, size = "sm", labels, variant = "soft", ...rest }: OrderStatusBadgeProps) {
  const label = isOrderStatus(status) ? labels?.[status] ?? ORDER_STATUS_LABELS[status] : status
  return (
    <Badge
      tone={orderStatusTone(status, role)}
      variant={variant}
      dot={size === "sm"}
      accessibilityLabel={`Status: ${label}`}
      {...rest}
    >
      {label}
    </Badge>
  )
}
