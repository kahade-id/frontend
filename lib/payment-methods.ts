/**
 * Kahade — adapter metode pembayaran API → model `<PaymentMethodSelector>`.
 *
 * Dipakai oleh Isi Saldo (topup) dan Langganan (subscribe.paymentMethod);
 * satu peta kode → kind/ikon supaya kedua layar konsisten dan tidak ada
 * duplikasi tabel di layar.
 *
 * Keputusan non-obvious:
 *   - Selector hanya punya 4 kind (bank/ewallet/qris/balance). Kartu, gerai
 *     retail, dan paylater tidak punya kind sendiri → tetap kind terdekat
 *     tetapi ikon di-override via `METHOD_ICON` supaya tidak semua tampil
 *     sebagai ikon bank.
 *   - `KAHADE_WALLET` (bayar dari saldo) → kind "balance"; `balance` diisi
 *     pemanggil bila saldo diketahui supaya selector bisa menandai "saldo
 *     tidak cukup".
 *   - Kode asing dari server → kind "qris" (ikon QR generik) + tetap bisa
 *     dipilih; server yang memutuskan validitasnya.
 */
import { CreditCard, Receipt, Storefront } from "phosphor-react-native"

import type { WalletPaymentMethod } from "@/lib/api/wallet"
import type { IconComponent } from "@/components/ui/icon"
import type { PaymentMethod, PaymentMethodKind } from "@/components/ui/payment-method-selector"

/** Peta kode API → kind komponen. */
export const METHOD_KIND: Record<string, PaymentMethodKind> = {
  VIRTUAL_ACCOUNT_BCA: "bank",
  VIRTUAL_ACCOUNT_BNI: "bank",
  VIRTUAL_ACCOUNT_BRI: "bank",
  VIRTUAL_ACCOUNT_MANDIRI: "bank",
  VIRTUAL_ACCOUNT_CIMB: "bank",
  VIRTUAL_ACCOUNT_PERMATA: "bank",
  VIRTUAL_ACCOUNT_OTHER: "bank",
  QRIS: "qris",
  GOPAY: "ewallet",
  SHOPEEPAY: "ewallet",
  OVO: "ewallet",
  DANA: "ewallet",
  LINKAJA: "ewallet",
  CREDIT_CARD: "bank",
  ALFAMART: "bank",
  INDOMARET: "bank",
  AKULAKU: "ewallet",
  KREDIVO: "ewallet",
  KAHADE_WALLET: "balance",
}

/** Ikon khusus untuk kode yang tidak cocok dengan ikon default kind-nya. */
export const METHOD_ICON: Partial<Record<string, IconComponent>> = {
  CREDIT_CARD: CreditCard,
  ALFAMART: Storefront,
  INDOMARET: Storefront,
  AKULAKU: Receipt,
  KREDIVO: Receipt,
}

/** Kode yang ditandai "direkomendasikan" di selector. */
const RECOMMENDED_CODES = new Set(["QRIS", "VIRTUAL_ACCOUNT_BCA"])

export type ToPaymentMethodOptions = {
  /** Saldo dompet saat ini — hanya dipakai untuk kind "balance". */
  walletBalance?: number
}

/** Konversi satu metode dari `GET /v1/wallet/payment-methods`. */
export function toPaymentMethod(raw: WalletPaymentMethod, opts: ToPaymentMethodOptions = {}): PaymentMethod {
  const kind = METHOD_KIND[raw.code] ?? "qris"
  return {
    id: raw.code,
    kind,
    icon: METHOD_ICON[raw.code],
    name: raw.name,
    description: raw.fee ? "Biaya layanan berlaku" : undefined,
    fee: raw.fee
      ? raw.fee.percent
        ? { type: "percent", value: raw.fee.percent }
        : { type: "flat", amount: raw.fee.fixed ?? 0 }
      : undefined,
    balance: kind === "balance" ? opts.walletBalance : undefined,
    recommended: RECOMMENDED_CODES.has(raw.code),
    unavailable: raw.enabled === false,
    unavailableReason: raw.enabled === false ? "Metode sedang tidak tersedia" : undefined,
  }
}

/** Konversi daftar; metode nonaktif diletakkan di akhir. */
export function toPaymentMethods(raw: WalletPaymentMethod[] | null | undefined, opts?: ToPaymentMethodOptions) {
  return (raw ?? [])
    .map((m) => toPaymentMethod(m, opts))
    .sort((a, b) => Number(Boolean(a.unavailable)) - Number(Boolean(b.unavailable)))
}
