/**
 * Screen — Voucher (GET /v1/vouchers/available + /my-usage).
 *
 * Audit:
 *   - State async → `useApiQuery`; kerangka → <DataScreen>.
 *   - `router.push({ pathname: "/create-transaction", … })` diganti
 *     `ROUTES.createTransactionWithVoucher(code)` — satu-satunya route
 *     literal yang tersisa di `app/`.
 *   - Ambang "segera kedaluwarsa" (`3 * 86400_000` inline) menjadi konstanta
 *     bernama; angka telanjang di JSX tidak bisa diaudit.
 *   - Dua daftar tidak lagi berbagi satu EmptyState global: bila voucher
 *     tersedia kosong TAPI riwayat ada, riwayat tetap dirender.
 */
import { Ticket } from "phosphor-react-native"
import { router } from "expo-router"

import { api } from "@/lib/api"
import type { Voucher } from "@/lib/api/vouchers"
import { formatDateTime } from "@/lib/format"
import { ROUTES } from "@/lib/routes"
import { useApiQuery } from "@/lib/use-api-query"

import { DataScreen } from "@/components/ui/data-screen"
import { EmptyState } from "@/components/ui/empty-state"
import { SectionHeader } from "@/components/ui/section"
import { VoucherCard } from "@/components/ui/voucher-card"
import { VoucherUsageListItem } from "@/components/ui/voucher-usage-list-item"

/** Voucher ditandai "segera berakhir" bila sisa waktunya di bawah ambang ini. */
const EXPIRES_SOON_MS = 3 * 24 * 60 * 60 * 1000

/** Enum diskon UI hanya mengenal PERCENTAGE/FIXED; nilai lain dianggap persen. */
function discountTypeOf(v: Voucher) {
  return v.discountType === "FIXED" ? ("FIXED" as const) : ("PERCENTAGE" as const)
}

export default function VouchersScreen() {
  const query = useApiQuery("vouchers", async () => {
    const [available, usage] = await Promise.all([
      api.vouchers.listAvailableVouchers(),
      api.vouchers.listMyVoucherUsage(),
    ])
    return { available: available ?? [], usage: usage ?? [] }
  })
  const available = query.data?.available ?? []
  const usage = query.data?.usage ?? []

  return (
    <DataScreen
      title="Voucher"
      state={query}
      loadingMessage="Memuat voucher…"
      empty={
        available.length === 0 &&
        usage.length === 0 && {
          icon: Ticket,
          title: "Belum ada voucher",
          description: "Voucher promo dan riwayat pemakaiannya akan muncul di sini.",
        }
      }
    >
      <SectionHeader title="Tersedia untuk Anda" />
      {available.length === 0 ? (
        <EmptyState
          compact
          icon={Ticket}
          title="Belum ada voucher aktif"
          description="Voucher promo akan muncul di sini."
        />
      ) : (
        available.map((v) => (
          <VoucherCard
            key={v.code}
            code={v.code}
            title={v.title ?? v.code}
            description={v.description}
            discountType={discountTypeOf(v)}
            discountValue={v.discountValue ?? Number.NaN}
            maxDiscount={v.maxDiscount}
            minOrderValue={v.minOrderValue}
            expiresAt={v.expiresAt ? formatDateTime(v.expiresAt) : undefined}
            expiresSoon={
              v.expiresAt
                ? new Date(v.expiresAt).getTime() - Date.now() < EXPIRES_SOON_MS
                : false
            }
            onUse={() => router.push(ROUTES.createTransactionWithVoucher(v.code))}
          />
        ))
      )}

      <SectionHeader title="Riwayat pemakaian" />
      {usage.length === 0 ? (
        <EmptyState compact icon={Ticket} title="Belum ada pemakaian" />
      ) : (
        usage.map((u, index) => (
          <VoucherUsageListItem
            key={u.usageId ?? `${u.code}:${index}`}
            title={u.title ?? u.code}
            code={u.code}
            savedAmount={u.discountValue ?? Number.NaN}
            usedAt={u.usedAt ? formatDateTime(u.usedAt) : undefined}
          />
        ))
      )}
    </DataScreen>
  )
}
