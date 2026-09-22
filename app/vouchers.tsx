/**
 * Screen — Voucher (GET /v1/vouchers/available + /my-usage, POST /v1/vouchers/validate).
 *
 * Tiga bagian, mengikuti cara pengguna memikirkan voucher — bukan urutan
 * endpoint di spec:
 *   1. KODE PROMO   — kolom masukkan kode. Sebelumnya layar ini hanya
 *      menampilkan voucher yang sudah menempel di akun, jadi pengguna yang
 *      menerima kode dari promo/kampanye tidak punya tempat menukarkannya
 *      selain di tengah alur buat transaksi. `POST /v1/vouchers/validate`
 *      sudah ada dan dipakai <VoucherRedeemBox> di create-transaction; layar
 *      ini memakai komponen yang sama supaya perilakunya identik.
 *   2. VOUCHER AKTIF — yang bisa dipakai sekarang, diurut yang paling mendesak.
 *   3. VOUCHER TERPAKAI — riwayat pemakaian + nominal yang dihemat.
 *
 * Keputusan non-obvious:
 *   - Validasi kode TIDAK otomatis memasang voucher ke transaksi apa pun:
 *     tidak ada konteks order di layar ini (orderValue tidak dikirim). Yang
 *     ditawarkan setelah kode dinyatakan berlaku adalah jalan masuk
 *     "Pakai di transaksi baru" → create-transaction dengan kode terisi.
 *     Menyimpan voucher "terpasang" tanpa transaksi akan menjanjikan potongan
 *     yang tidak terikat ke apa pun.
 *   - `discount` pada hasil validasi hanya diisi bila backend mengirim
 *     nominalnya. Untuk voucher persen, potongan baru diketahui setelah
 *     orderValue ada — menebaknya di sini berarti menampilkan angka yang
 *     salah di layar uang.
 *   - Urutan voucher aktif: yang hampir kedaluwarsa lebih dulu, lalu tenggat
 *     terdekat, lalu potongan terbesar. Voucher yang mau hangus adalah alasan
 *     orang membuka layar ini; menaruhnya di bawah daftar panjang membuat
 *     pengguna kehilangannya.
 *   - `discountType` dibaca longgar (lihat `discountTypeOf`): spec mobile
 *     tidak mengekspor schema voucher, dan DTO admin memakai kosakata berbeda
 *     (FEE_DISCOUNT_FLAT / FEE_DISCOUNT_PERCENT / WALLET_CASHBACK /
 *     TOPUP_BONUS). Menganggap "apa pun yang bukan FIXED adalah persen"
 *     membuat voucher nominal Rp50.000 tampil sebagai "50%".
 *   - State async → `useApiQuery`; kerangka → <DataScreen>.
 *   - Dua daftar tidak lagi berbagi satu EmptyState global: bila voucher
 *     tersedia kosong TAPI riwayat ada, riwayat tetap dirender.
 */
import { useCallback, useState } from "react"
import { View } from "react-native"
import { Ticket } from "phosphor-react-native"
import { router } from "expo-router"

import { api } from "@/lib/api"
import { userMessage } from "@/lib/api/errors"
import type { Voucher } from "@/lib/api/vouchers"
import { formatDateTime, formatDateTimeWIB, formatNumber } from "@/lib/format"
import { ROUTES } from "@/lib/routes"
import { useApiQuery } from "@/lib/use-api-query"

import { Button } from "@/components/ui/button"
import { DataScreen } from "@/components/ui/data-screen"
import { EmptyState } from "@/components/ui/empty-state"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { VoucherCard } from "@/components/ui/voucher-card"
import {
  VoucherRedeemBox,
  type AppliedVoucher,
} from "@/components/ui/voucher-redeem-box"
import { VoucherUsageListItem } from "@/components/ui/voucher-usage-list-item"

/** Voucher ditandai "segera berakhir" bila sisa waktunya di bawah ambang ini. */
const EXPIRES_SOON_MS = 3 * 24 * 60 * 60 * 1000

/**
 * Nilai `discountType`/`voucherType` yang berarti POTONGAN NOMINAL (Rupiah).
 *
 * Kosakata backend tidak seragam antar endpoint: DTO admin memakai
 * FEE_DISCOUNT_FLAT / WALLET_CASHBACK / TOPUP_BONUS, tipe lokal layar ini
 * memakai FIXED. Semuanya nominal — cashback dan bonus top-up adalah angka
 * Rupiah, bukan persen.
 */
const FLAT_DISCOUNT_VALUES = new Set([
  "FIXED",
  "FLAT",
  "FEE_DISCOUNT_FLAT",
  "WALLET_CASHBACK",
  "TOPUP_BONUS",
  "NOMINAL",
])

/** Enum diskon UI hanya mengenal PERCENTAGE/FIXED; nilai lain dibaca longgar. */
function discountTypeOf(v: Voucher): "FIXED" | "PERCENTAGE" {
  const raw = (v.discountType ?? v.voucherType ?? "").toUpperCase()
  return FLAT_DISCOUNT_VALUES.has(raw) ? "FIXED" : "PERCENTAGE"
}

function expiresSoon(v: Voucher): boolean {
  if (!v.expiresAt) return false
  const time = new Date(v.expiresAt).getTime()
  return Number.isFinite(time) && time - Date.now() < EXPIRES_SOON_MS
}

/** Paling mendesak dulu: hampir hangus → tenggat terdekat → potongan terbesar. */
function byUrgency(a: Voucher, b: Voucher): number {
  const soonDiff = Number(expiresSoon(b)) - Number(expiresSoon(a))
  if (soonDiff !== 0) return soonDiff
  const ta = a.expiresAt ? new Date(a.expiresAt).getTime() : Number.POSITIVE_INFINITY
  const tb = b.expiresAt ? new Date(b.expiresAt).getTime() : Number.POSITIVE_INFINITY
  if (ta !== tb) return ta - tb
  return (b.discountValue ?? 0) - (a.discountValue ?? 0)
}

export default function VouchersScreen() {
  const query = useApiQuery("vouchers", async (signal) => {
    const [available, usage] = await Promise.all([
      api.vouchers.listAvailableVouchers(signal),
      api.vouchers.listMyVoucherUsage(signal),
    ])
    return { available: available ?? [], usage: usage ?? [] }
  })
  const available = query.data?.available ?? []
  const usage = query.data?.usage ?? []

  // ── Kode promo ─────────────────────────────────────────────────
  const [checking, setChecking] = useState(false)
  const [applied, setApplied] = useState<AppliedVoucher | undefined>(undefined)
  const [promoError, setPromoError] = useState<string | null>(null)

  const handleApplyCode = useCallback(async (code: string) => {
    setChecking(true)
    setPromoError(null)
    try {
      const result = await api.vouchers.validateVoucher({ code })
      if (!result.valid) {
        setApplied(undefined)
        setPromoError(result.message ?? "Kode ini tidak berlaku untuk akun Anda.")
        return
      }
      const voucher = result.voucher
      // Nominal hanya diisi bila backend benar-benar mengirim angkanya.
      const discount =
        voucher && Number.isFinite(voucher.discountValue ?? Number.NaN)
          ? (voucher.discountValue as number)
          : undefined
      setApplied({ code, title: voucher?.title ?? undefined, discount })
    } catch (error) {
      setApplied(undefined)
      setPromoError(userMessage(error))
    } finally {
      setChecking(false)
    }
  }, [])

  const clearPromo = useCallback(() => {
    setApplied(undefined)
    setPromoError(null)
  }, [])

  const sorted = [...available].sort(byUrgency)

  return (
    <DataScreen
      title="Voucher"
      state={query}
      loadingMessage="Memuat voucher…"
      /*
       * SENGAJA tanpa prop `empty`: DataScreen mengganti SELURUH children
       * dengan EmptyState bila `empty` truthy, dan itu akan menyembunyikan
       * kolom kode promo persis pada pengguna yang paling membutuhkannya —
       * yang belum punya voucher sama sekali. Tiap bagian menangani kosongnya
       * sendiri sehingga kode promo selalu bisa dimasukkan.
       */
    >
      {/* ── 1. Kode promo ────────────────────────────────────── */}
      <View className="gap-3">
        <SectionHeader
          title="Kode promo"
          level="h3"
          subtitle="Punya kode dari promo atau kampanye? Periksa di sini."
        />
        <VoucherRedeemBox
          applied={applied}
          applying={checking}
          errorText={promoError ?? undefined}
          onApply={(code) => void handleApplyCode(code)}
          onRemove={clearPromo}
          labels={{ heading: "Kode promo", placeholder: "Masukkan kode", apply: "Cek kode" }}
        />
        {applied ? (
          <>
            <Text variant="caption" tone="secondary">
              Kode berlaku. Potongan diterapkan saat transaksi dibuat.
            </Text>
            <Button
              variant="secondary"
              size="sm"
              fullWidth={false}
              onPress={() => router.push(ROUTES.createTransactionWithVoucher(applied.code))}
            >
              Pakai di transaksi baru
            </Button>
          </>
        ) : null}
      </View>

      {/* ── 2. Voucher aktif ─────────────────────────────────── */}
      <View className="gap-3">
        <SectionHeader
          title="Voucher aktif"
          level="h3"
          action={
            available.length > 0 ? (
              <Text variant="caption" tone="tertiary">
                {formatNumber(available.length)} tersedia
              </Text>
            ) : undefined
          }
        />
        {sorted.length === 0 ? (
          <EmptyState
            compact
            icon={Ticket}
            title="Belum ada voucher aktif"
            description="Voucher promo akan muncul di sini."
          />
        ) : (
          sorted.map((v) => (
            <VoucherCard
              key={v.code}
              code={v.code}
              title={v.title ?? v.code}
              description={v.description}
              discountType={discountTypeOf(v)}
              discountValue={v.discountValue ?? Number.NaN}
              maxDiscount={v.maxDiscount}
              minOrderValue={v.minOrderValue}
              expiresAt={v.expiresAt ? formatDateTimeWIB(v.expiresAt) : undefined}
              expiresSoon={expiresSoon(v)}
              onUse={() => router.push(ROUTES.createTransactionWithVoucher(v.code))}
            />
          ))
        )}
      </View>

      {/* ── 3. Voucher terpakai ──────────────────────────────── */}
      <View className="gap-3">
        <SectionHeader
          title="Voucher terpakai"
          level="h3"
          action={
            usage.length > 0 ? (
              <Text variant="caption" tone="tertiary">
                {formatNumber(usage.length)} kali dipakai
              </Text>
            ) : undefined
          }
        />
        {usage.length === 0 ? (
          <EmptyState
            compact
            icon={Ticket}
            title="Belum ada pemakaian"
            description="Voucher yang sudah Anda pakai akan tercatat di sini."
          />
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
      </View>
    </DataScreen>
  )
}
