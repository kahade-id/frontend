/**
 * Kahade — Helper format data (§13 Format Data & Lokalisasi).
 *
 * Satu tempat untuk SEMUA format angka/tanggal yang tampil di UI supaya
 * komponen (Amount, DateText, BankAccountCard, …) tidak punya logika format
 * sendiri-sendiri. Aturan §13:
 *   - Mata uang : `Rp1.000.000` — titik pemisah ribuan, TANPA desimal,
 *                 TANPA spasi setelah "Rp".
 *   - Tanggal   : selalu eksplisit "3 Sep 2026, 14:30" — TIDAK ada relative
 *                 time ("2 jam lalu").
 *
 * Kenapa tidak memakai `Intl.NumberFormat("id-ID")` (non-obvious): di
 * Android (Hermes) dukungan Intl bergantung versi engine dan bisa jatuh ke
 * format default; implementasi manual berbasis regex deterministik di semua
 * platform dan cukup untuk Rupiah bulat (§13: tidak ada desimal).
 */

const MONTHS_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]
const MONTHS_ID_LONG = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
]
const DAYS_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"]

/** 1000000 -> "1.000.000" (tanpa prefix) */
export function groupThousands(n: number): string {
  const abs = Math.abs(Math.trunc(n))
  return abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")
}

/**
 * Format Rupiah bulat: 1500000 -> "Rp1.500.000". Negatif -> "-Rp1.500.000".
 * `sign` = "+"/"-" eksplisit untuk mutasi saldo (mis. "+Rp50.000").
 */
export function formatRupiah(
  amount: number,
  opts: { sign?: "auto" | "always" | "never"; compact?: boolean } = {},
): string {
  const { sign = "auto", compact = false } = opts
  const negative = amount < 0
  const abs = Math.abs(Math.round(amount))
  let body: string
  if (compact && abs >= 1_000_000) {
    // "Rp1,5 jt" hanya untuk chart/label sempit — bukan nominal transaksi
    const v = abs / 1_000_000
    body = `${v.toFixed(v % 1 === 0 ? 0 : 1).replace(".", ",")} jt`
  } else if (compact && abs >= 1_000) {
    const v = abs / 1_000
    body = `${v.toFixed(v % 1 === 0 ? 0 : 1).replace(".", ",")} rb`
  } else {
    body = groupThousands(abs)
  }
  const prefix = negative ? "-" : sign === "always" && amount > 0 ? "+" : ""
  return sign === "never" ? `Rp${body}` : `${prefix}Rp${body}`
}

/** "Rp1.500.000" / "1.500.000" / "1500000" -> 1500000 */
export function parseRupiah(input: string): number {
  const digits = input.replace(/[^\d]/g, "")
  return digits ? Number.parseInt(digits, 10) : 0
}

/** Format angka biasa dengan pemisah ribuan (bukan uang) */
export function formatNumber(n: number): string {
  return (n < 0 ? "-" : "") + groupThousands(n)
}

/**
 * Desimal lokal ID: koma sebagai pemisah desimal, tanpa Intl.
 * `formatDecimal(4.5)` → "4,5"; `formatDecimal(4)` → "4"; `formatDecimal(4.25, 1)` → "4,3".
 * Dipakai rating, persentase, dan nilai pecahan lain (§13).
 */
export function formatDecimal(n: number, maxFractionDigits = 1): string {
  if (!Number.isFinite(n)) return "—"
  const fixed = n.toFixed(maxFractionDigits)
  const [int, frac = ""] = fixed.split(".")
  const trimmed = frac.replace(/0+$/, "")
  const sign = n < 0 ? "-" : ""
  const absInt = groupThousands(Math.abs(Number(int)))
  return trimmed ? `${sign}${absInt},${trimmed}` : `${sign}${absInt}`
}

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n)
}

/** "3 Sep 2026" */
export function formatDate(d: Date | number | string, opts: { long?: boolean } = {}): string {
  const date = d instanceof Date ? d : new Date(d)
  const month = opts.long ? MONTHS_ID_LONG[date.getMonth()] : MONTHS_ID[date.getMonth()]
  return `${date.getDate()} ${month} ${date.getFullYear()}`
}

/** "14:30" */
export function formatTime(d: Date | number | string): string {
  const date = d instanceof Date ? d : new Date(d)
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

/** "3 Sep 2026, 14:30" — format default timestamp di seluruh app (§13) */
export function formatDateTime(d: Date | number | string): string {
  return `${formatDate(d)}, ${formatTime(d)}`
}

/** "Rabu, 3 September 2026" — untuk layar konfirmasi/struk */
export function formatDateLong(d: Date | number | string): string {
  const date = d instanceof Date ? d : new Date(d)
  return `${DAYS_ID[date.getDay()]}, ${formatDate(date, { long: true })}`
}

/** Sisa waktu detik -> "04:59" atau "1:04:59" (countdown OTP/lockout/deadline) */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h > 0 ? `${h}:${pad2(m)}:${pad2(sec)}` : `${pad2(m)}:${pad2(sec)}`
}

/**
 * Nomor rekening: tampilkan 4 digit terakhir, sisanya bullet, dikelompokkan
 * per 4 agar terbaca dalam Mono: "•••• •••• 1234".
 */
export function maskAccountNumber(account: string, visible = 4): string {
  const digits = account.replace(/\s/g, "")
  const hidden = Math.max(0, digits.length - visible)
  const masked = "\u2022".repeat(hidden) + digits.slice(-visible)
  return masked.replace(/(.{4})/g, "$1 ").trim()
}

/** Kelompokkan nomor per 4 tanpa mask: "1234 5678 9012" */
export function groupAccountNumber(account: string): string {
  return account.replace(/\s/g, "").replace(/(.{4})/g, "$1 ").trim()
}

/** Nomor HP Indonesia -> "+62 812-3456-7890" */
export function formatPhoneId(raw: string): string {
  let digits = raw.replace(/\D/g, "")
  if (digits.startsWith("62")) digits = digits.slice(2)
  if (digits.startsWith("0")) digits = digits.slice(1)
  const parts = [digits.slice(0, 3), digits.slice(3, 7), digits.slice(7, 11)].filter(Boolean)
  return digits ? `+62 ${parts.join("-")}` : ""
}

/** "Budi Santoso" -> "BS" (Avatar fallback) */
export function initials(name: string, max = 2): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, max)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
}

/** Potong string panjang di tengah: "KHD-2026-0903-ABCDEF" -> "KHD-2026…CDEF" */
export function truncateMiddle(s: string, head = 8, tail = 4): string {
  if (s.length <= head + tail + 1) return s
  return `${s.slice(0, head)}\u2026${s.slice(-tail)}`
}

/** Byte -> "2,4 MB" (batasan upload KYC §9.19) */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`
}
