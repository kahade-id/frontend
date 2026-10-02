/**
 * Kahade — adapter checkout DANA (provider utama, Mode Tanpa Wallet Internal).
 *
 * Modul MURNI (tanpa import UI/native) supaya bisa di-unit-test di vitest
 * node env — pemetaan kind → ikon Phosphor dilakukan di lapisan komponen
 * (`components/order-action-sheets.tsx` via `paymentMethodKindIcon`).
 *
 * Sumber kebenaran daftar metode adalah backend
 * (`GET /v1/orders/{id}/payment-methods` — KONTRAK BELUM TERVERIFIKASI).
 * Frontend TIDAK meng-hardcode daftar metode checkout: fungsi di sini hanya
 * menormalisasi + memilih dari apa yang backend kembalikan.
 *
 * `DANA_PAYMENT_METHODS_FALLBACK` adalah jaring pengaman TRANSISI — dipakai
 * hanya bila endpoint daftar metode belum tersedia (404/network). Ia mencerminkan
 * kemampuan DANA Enterprise (QRIS + Virtual Account + DANA) dan DITANDAI
 * fallback supaya tidak dikira data server.
 */
import { getOrderPaymentMethods, type OrderPaymentMethod } from "@/lib/api/orders-endpoints"
import { mapValue } from "@/lib/has-own"

export type { OrderPaymentMethod }

/** Kind tampilan metode — sama dengan `PaymentMethodKind` di payment-method-selector. */
export type DanaMethodKind = "bank" | "ewallet" | "qris" | "balance"

/** Metode checkout untuk pemilih: tanpa ikon (diisi lapisan UI). */
export type CheckoutMethodItem = {
  /** Kode metode stabil — dipakai `onSelectMethod`. */
  id: string
  kind: DanaMethodKind
  name: string
  minAmount?: number
  maxAmount?: number
  recommended: boolean
}

/**
 * Daftar metode DANA yang didukung (Gapura Create Order API): QRIS
 * (payOption QRIS, externalStoreId), Virtual Account (DANA auto-generate
 * kode per bank), dan DANA (saldo/aplikasi DANA). FALLBACK TRANSISI —
 * backend yang live selalu menang.
 */
export const DANA_PAYMENT_METHODS_FALLBACK: readonly OrderPaymentMethod[] = [
  {
    id: "QRIS",
    code: "QRIS",
    name: "QRIS",
    category: "qris",
    enabled: true,
    recommended: true,
  },
  { id: "VA_BCA", code: "VA_BCA", name: "Virtual Account BCA", category: "va", enabled: true },
  { id: "VA_BNI", code: "VA_BNI", name: "Virtual Account BNI", category: "va", enabled: true },
  { id: "VA_BRI", code: "VA_BRI", name: "Virtual Account BRI", category: "va", enabled: true },
  {
    id: "VA_MANDIRI",
    code: "VA_MANDIRI",
    name: "Virtual Account Mandiri",
    category: "va",
    enabled: true,
  },
  { id: "DANA", code: "DANA", name: "Saldo DANA", category: "ewallet", enabled: true },
]

const KAHADE_WALLET_METHOD: OrderPaymentMethod = {
  id: "KAHADE_WALLET",
  code: "KAHADE_WALLET",
  name: "Saldo Kahade",
  category: "wallet",
  enabled: true,
}

/**
 * Peta kode lawas → kind (cerminan `METHOD_KIND` di lib/payment-methods —
 * didefinisikan ulang di sini agar modul ini tetap murni/testable tanpa
 * menarik phosphor-react-native). Hanya dipakai bila `category` backend
 * tidak memberi petunjuk.
 */
const LEGACY_METHOD_KIND: Record<string, DanaMethodKind> = {
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
  // Kontrak kanonis backend (2026-09-30): `kind: "BALANCE"` = otorisasi
  // aplikasi DANA (bukan saldo Kahade) — render panel redirect DANA.
  BALANCE: "ewallet",
  LINKAJA: "ewallet",
  CREDIT_CARD: "bank",
  ALFAMART: "bank",
  INDOMARET: "bank",
  AKULAKU: "ewallet",
  KREDIVO: "ewallet",
  KAHADE_WALLET: "balance",
}

/**
 * Kind checkout dari kode + kategori backend — category-aware: backend DANA
 * boleh memakai kode bank apa pun ("VA_BCA", "BCA_VA", …); `category: "va"`
 * tetap me-render panel Virtual Account. Kode tak dikenal + kategori tak
 * dikenal → "bank" (fail-closed ke pola VA generik, bukan hilang).
 */
export function checkoutMethodKind(method: OrderPaymentMethod): DanaMethodKind {
  const category = method.category?.trim().toLowerCase()
  if (category === "qris") return "qris"
  if (category === "va" || category === "bank" || category === "virtual_account") return "bank"
  if (category === "ewallet" || category === "e_wallet" || category === "redirect") return "ewallet"
  if (category === "wallet" || category === "balance") return "balance"
  return mapValue(LEGACY_METHOD_KIND, method.code, "bank")
}

/**
 * Metode backend → item pemilih checkout. `id` = kode metode stabil
 * (dipakai `onSelectMethod`); ikon diisi lapisan UI dari `kind`.
 */
export function toCheckoutMethodItems(
  methods: readonly OrderPaymentMethod[],
): CheckoutMethodItem[] {
  return methods.map((m) => ({
    id: m.code,
    kind: checkoutMethodKind(m),
    name: m.name,
    minAmount: m.minAmount,
    maxAmount: m.maxAmount,
    recommended: m.recommended === true,
  }))
}

/**
 * Pecah metode VA generik ber-bank (`kind: "VA"` + `banks: ["BCA", …]` dari
 * backend) menjadi entri per-bank ("VA_BCA", …).
 *
 * Alasan: UI checkout tidak punya pemilih bank terpisah — pola yang sudah
 * berjalan di alur langganan adalah satu entri per bank, dan
 * `toDanaPayKind("VA_BCA")` memetakan `bankCode` dengan benar untuk
 * `DanaDirectPayDto`. Entri yang sudah per-bank (mis. daftar fallback)
 * tidak disentuh.
 *
 * BFE-078: VA telanjang (`requiresBankCode: true` tapi `banks` kosong) TIDAK
 * bisa dibayar — tidak ada bank untuk dipilih, POST /payments pasti gagal
 * validasi. Entri seperti itu disembunyikan (fail-closed), bukan ditampilkan
 * sebagai opsi mati.
 */
function expandVaBankMethods(methods: OrderPaymentMethod[]): OrderPaymentMethod[] {
  const out: OrderPaymentMethod[] = []
  for (const m of methods) {
    const codeUpper = m.code.trim().toUpperCase()
    const isVaMethod = codeUpper === "VA" || (m.category ?? "").trim().toLowerCase() === "va"
    const banks = (m.banks ?? [])
      .map((b) => b.trim().toUpperCase())
      .filter((b) => b.length > 0)
    const alreadyPerBank = /^VA[_ -]?[A-Z]+$/.test(codeUpper) && codeUpper !== "VA"
    if (isVaMethod && !alreadyPerBank && banks.length > 0) {
      for (const bank of banks) {
        const code = `VA_${bank}`
        out.push({
          ...m,
          id: code,
          code,
          name: `${m.name} ${bank}`.trim(),
          category: "va",
          banks: undefined,
          requiresBankCode: undefined,
        })
      }
    } else if (
      isVaMethod &&
      !alreadyPerBank &&
      m.requiresBankCode === true &&
      banks.length === 0
    ) {
      // BFE-078: sembunyikan VA telanjang yang wajib bankCode — entri mati.
      continue
    } else {
      out.push(m)
    }
  }
  return out
}

/**
 * Ambil daftar metode untuk order: backend dulu; bila endpoint belum tersedia
 * (404) atau jaringan gagal → fallback DANA statis. Metode dompet internal
 * hanya disisipkan bila kill-switch NYALA — dalam mode BI-safe buyer tidak
 * pernah melihat "Saldo Kahade".
 *
 * Mengembalikan juga `fromFallback` supaya UI bisa menandai ("metode
 * standar") bila diperlukan — default disembunyikan (desain minimalis).
 */
export async function resolveCheckoutPaymentMethods(
  orderId: string,
  opts: { walletEnabled: boolean; signal?: AbortSignal },
): Promise<{ methods: OrderPaymentMethod[]; fromFallback: boolean }> {
  let raw: OrderPaymentMethod[]
  let fromFallback = false
  try {
    raw = await getOrderPaymentMethods(orderId, opts.signal)
  } catch {
    raw = [...DANA_PAYMENT_METHODS_FALLBACK]
    fromFallback = true
  }
  const enabledOnly = raw.filter((m) => m.enabled)
  // Kontrak kanonis (2026-09-30): backend mengirim SATU metode VA + `banks`;
  // UI butuh satu entri per bank (tanpa pemilih bank terpisah).
  const expanded = expandVaBankMethods(enabledOnly)
  // BI-safe: bila kill-switch mati, metode dompet internal TIDAK boleh muncul
  // meski backend (lama) masih mengembalikannya — buyer tidak pernah
  // melihat "Saldo Kahade".
  const noWallet = opts.walletEnabled
    ? expanded
    : expanded.filter((m) => !isWalletCheckoutMethod(m.code))
  const list =
    noWallet.length > 0 ? noWallet : fromFallback ? [...DANA_PAYMENT_METHODS_FALLBACK] : []
  const methods = opts.walletEnabled ? [KAHADE_WALLET_METHOD, ...list] : list
  return { methods, fromFallback }
}

/**
 * Pilihan default: metode `recommended` dari backend → metode aktif pertama.
 * Tidak pernah memilih metode disabled; kosong → null (sheet menampilkan
 * state kosong, bukan metode palsu).
 */
export function selectDefaultCheckoutMethod(
  methods: readonly OrderPaymentMethod[],
): OrderPaymentMethod | null {
  const enabled = methods.filter((m) => m.enabled)
  return enabled.find((m) => m.recommended) ?? enabled[0] ?? null
}

/** Kode metode yang memakai PIN saldo internal (hanya saat wallet nyala). */
export function isWalletCheckoutMethod(code: string): boolean {
  return code === "KAHADE_WALLET"
}
