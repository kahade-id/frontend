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
 *   - Schema OpenAPI mobile TIDAK mengekspor enum status order; enum-nya ada
 *     di `/v1/admin/orders` (docs/api/openapi.json) dan itulah yang dipakai:
 *     WAITING_CONFIRMATION → WAITING_PAYMENT → PROCESSING → IN_DELIVERY →
 *     COMPLETED, cabang DISPUTED/CANCELLED. Status asing tetap jatuh ke tone
 *     "neutral" + label apa adanya (tidak crash, tidak menebak warna) dan
 *     `console.warn` di dev.
 *   - "Menunggu tindakan SAYA" ditandai `warning`, bukan `info`: warning =
 *     "ada yang harus Anda lakukan", info = "sedang berjalan di pihak lain".
 *     Karena peran mengubah siapa yang harus bertindak, `role` opsional
 *     menggeser tone lewat peta `ROLE_ACTS_ON`.
 *   - Badge `dot` default ON: dalam daftar padat titik warna membantu scan
 *     tanpa membaca teks; di header detail (`size="md"`) dot dimatikan
 *     karena Badge sudah berdiri sendiri.
 *   - Label default Bahasa Indonesia formal (§12 "Anda"), bisa dioverride
 *     lewat `labels` untuk i18n — komponen tidak mengunci string.
 */
import { Badge, type BadgeProps, type BadgeTone } from "@/components/ui/badge"
import type { OrderStatus } from "@/lib/api/orders"
import { translate } from "@/lib/i18n/translate"

// Re-export: SATU sumber kebenaran status order = lib/api/orders.ts.
// Komponen lain (OrderCard, Timeline, layar) tetap bisa `import type { OrderStatus } from "@/components/ui/order-status-badge"`.
export type { OrderStatus } from "@/lib/api/orders"

export type OrderRole = "buyer" | "seller"

/**
 * Enum backend lebih dulu, urut alur hidup order; alias lama di belakang.
 * Urutan ini juga yang dibaca `Object.entries` di layar filter, jadi status
 * yang paling sering dicari pengguna muncul paling awal.
 */
export const ORDER_STATUSES: readonly OrderStatus[] = [
  "WAITING_CONFIRMATION",
  "WAITING_PAYMENT",
  "PROCESSING",
  "IN_DELIVERY",
  "COMPLETED",
  "DISPUTED",
  "CANCELLED",
  // Alias lama (lihat catatan di OrderStatus, lib/api/orders.ts).
  "PENDING_PAYMENT",
  "PAID",
  "SHIPPED",
  "DELIVERED",
  "REFUNDED",
  "EXPIRED",
]

import { ORDER_STATUS_LABELS } from "@/lib/labels/status"

export { ORDER_STATUS_LABELS }

const BASE_TONE: Record<OrderStatus, BadgeTone> = {
  WAITING_CONFIRMATION: "warning",
  WAITING_PAYMENT: "warning",
  PROCESSING: "info",
  IN_DELIVERY: "info",
  COMPLETED: "success",
  DISPUTED: "danger",
  CANCELLED: "neutral",
  PENDING_PAYMENT: "warning",
  PAID: "info",
  SHIPPED: "info",
  DELIVERED: "warning",
  REFUNDED: "neutral",
  EXPIRED: "neutral",
}

export function isOrderStatus(s: string): s is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(s)
}

/**
 * Status yang menuntut tindakan peran ini → `warning` ("ada yang harus ANDA
 * lakukan"). Sisanya `info` ("sedang berjalan di pihak lain").
 *
 * Ditulis sebagai peta peran, bukan rantai `if` per status: versi lama hanya
 * mengenal tiga kombinasi (PAID/DELIVERED/PROCESSING) sehingga status backend
 * yang sebenarnya — WAITING_CONFIRMATION, WAITING_PAYMENT, IN_DELIVERY — selalu
 * jatuh ke tone dasar dan badge "menunggu pembayaran" milik pembeli tidak
 * pernah terlihat mendesak.
 */
const ROLE_ACTS_ON: Record<OrderRole, ReadonlySet<string>> = {
  buyer: new Set(["WAITING_PAYMENT", "IN_DELIVERY", "PENDING_PAYMENT", "DELIVERED"]),
  seller: new Set(["WAITING_CONFIRMATION", "PROCESSING", "PAID"]),
}

/**
 * Tone untuk status + peran. Status final (sukses/sengketa/netral) TIDAK
 * pernah bergeser karena peran — pergeseran hanya berlaku pada status yang
 * masih berjalan, di mana "siapa yang harus bertindak" memang bergantung peran.
 */
export function orderStatusTone(status: string, role?: OrderRole): BadgeTone {
  if (!isOrderStatus(status)) {
    if (__DEV__) console.warn(`[kahade/order-status] status tidak dikenal: "${status}"`)
    return "neutral"
  }
  const base = BASE_TONE[status]
  if (base === "success" || base === "danger" || base === "neutral") return base
  if (role && ROLE_ACTS_ON[role].has(status)) return "warning"
  return role ? "info" : base
}

/** Status yang masih hidup (belum final) — untuk filter "Aktif" & pulse */
export function isOrderActive(status: string): boolean {
  return isOrderStatus(status) && !["COMPLETED", "CANCELLED", "REFUNDED", "EXPIRED"].includes(status)
}

/**
 * A-09 (audit escrow 2026-09-24): "belum final" ≠ "punya tenggat yang
 * mengikat". `DISPUTED` masih belum final (tetap di filter Aktif), tetapi
 * tenggat KIRIM sudah bukan keputusan — countdown "Batas waktu" pada order
 * sengketa menyesatkan dan memicu refresh sia-sia saat habis (G-07).
 * Fungsi inilah yang dipakai kartu/timeline untuk menampilkan countdown.
 */
export function hasLiveDeadline(status: string): boolean {
  // M-22 (audit end-to-end, issue #74): `IN_DELIVERY` ikut — justru saat barang
  // dikirim pengguna harus melihat hitung mundur masa konfirmasi penerimaan
  // (jendela buka sengketa/konfirmasi). Dulu countdown hilang di fase ini.
  return (
    isOrderStatus(status) &&
    [
      "WAITING_CONFIRMATION",
      "WAITING_PAYMENT",
      "PENDING_PAYMENT",
      "PROCESSING",
      "PAID",
      "IN_DELIVERY",
    ].includes(status)
  )
}

// `role` di-Omit: ViewProps RN punya `role?: Role` (a11y) yang disjoint dengan
// OrderRole — tanpa Omit, `role` tereduksi menjadi `undefined` saja.
export type OrderStatusBadgeProps = Omit<BadgeProps, "children" | "tone" | "dot" | "role"> & {
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
      accessibilityLabel={translate("{x}: {y}", { x: translate("Status"), y: label })}
      {...rest}
    >
      {label}
    </Badge>
  )
}
