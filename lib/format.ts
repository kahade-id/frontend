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

const MONTHS_ID = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
]
const MONTHS_ID_LONG = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
]
const DAYS_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"]

/** 1000000 -> "1.000.000" (tanpa prefix) */
export function groupThousands(n: number): string {
  if (!Number.isFinite(n)) return "—"
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
  if (!Number.isFinite(amount) || !Number.isSafeInteger(Math.round(amount))) return "—"
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

/** Backend fields are cast, not validated: never let a non-string reach `.replace`. */
function asText(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value)
}

/** "Rp1.500.000" / "1.500.000" / "1500000" -> 1500000 */
export function parseRupiah(input: string): number {
  const text = asText(input)
    .trim()
    .replace(/^(?:rp\.?|idr)\s*/i, "")
    .replace(/\s/g, "")
  // IDR is integer-only here. Never turn a pasted decimal 10.000,50 into 1.000.050.
  if (!text) return 0
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,0+)?$/.test(text)) return Number.NaN
  const value = Number(text.replace(/,0+$/, "").replace(/\./g, ""))
  return Number.isSafeInteger(value) ? value : Number.NaN
}

/**
 * Lenient sibling of `parseRupiah` for a field being TYPED INTO, not pasted.
 *
 * `<AmountInput>` is controlled: it re-renders every keystroke as a grouped
 * string, so the next `onChangeText` receives a half-finished grouping —
 * "1.00" after a backspace on "1.000", "1.0000" after typing another digit.
 * The strict parser rejects both as NaN, and the field wiped itself empty:
 * one backspace on "Rp1.000" deleted the whole amount.
 *
 * Digits are therefore the source of truth here. Input carrying a decimal
 * separator is still rejected outright — silently turning "10.000,50" into
 * 1.000.050 in a money field would be worse than ignoring the keystroke.
 */
export function parseRupiahPartial(input: string): number {
  const text = asText(input)
    .trim()
    .replace(/^(?:rp\.?|idr)\s*/i, "")
    .replace(/\s/g, "")
  // Angka desimal tidak bisa direpresentasikan di field integer-only. Lebih
  // baik mengabaikan ketikan daripada mengubah "10.000,50" jadi 1.000.050.
  if (/[,]/.test(text)) return Number.NaN
  // Hanya digit dan titik: "-5" tidak boleh diam-diam menjadi 5.
  if (!/^[\d.]*$/.test(text)) return Number.NaN
  /*
   * Pengelompokan separuh jadi punya bentuk yang khas: grup SETELAH titik
   * boleh 0–4 karakter (sedang diketik, belum dirender ulang), tetapi grup
   * PERTAMA tidak pernah lebih dari 3 digit. Kombinasi itu membedakan
   * "1.0000" (pengguna baru saja menambah digit pada "1.000") dari
   * "10000.50" (nominal desimal yang ditempel).
   */
  const groups = text.split(".")
  if (groups.length > 1) {
    const [head = "", ...rest] = groups
    if (!/^\d{1,3}$/.test(head)) return Number.NaN
    if (!rest.every((g) => /^\d{0,4}$/.test(g))) return Number.NaN
  }
  const digits = text.replace(/\D/g, "")
  if (!digits || digits.length > 15) return Number.NaN
  const value = Number(digits)
  return Number.isSafeInteger(value) ? value : Number.NaN
}

/**
 * Nilai berikutnya untuk <AmountInput>, atau `null` bila ketikan harus
 * DIABAIKAN (nilai lama dipertahankan).
 *
 * Dipisah ke sini supaya kontraknya bisa diuji tanpa merender komponen:
 * field nominal adalah satu-satunya tempat di mana pengguna mengetik angka
 * yang langsung memengaruhi uang yang dikirim ke server.
 */
export function amountInputValue(raw: string): number | null {
  const parsed = parseRupiah(raw)
  const n = Number.isNaN(parsed) ? parseRupiahPartial(raw) : parsed
  // Cegah overflow angka absurd: > 15 digit tidak masuk akal untuk Rupiah.
  // Non-finite (input bercampur huruf/simbol) tidak pernah masuk ke state form.
  if (!Number.isFinite(n) || String(n).length > 15) return null
  return n
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
  const precision = Number.isFinite(maxFractionDigits)
    ? Math.max(0, Math.min(20, Math.trunc(maxFractionDigits)))
    : 1
  const fixed = n.toFixed(precision)
  const [int, frac = ""] = fixed.split(".")
  const trimmed = frac.replace(/0+$/, "")
  const sign = n < 0 ? "-" : ""
  const absInt = groupThousands(Math.abs(Number(int)))
  return trimmed ? `${sign}${absInt},${trimmed}` : `${sign}${absInt}`
}

function displayDate(value: Date | number | string): Date | null {
  if (value == null || value === "") return null
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number)
    const date = new Date(year, month - 1, day)
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
      ? date
      : null
  }
  const date = value instanceof Date ? value : new Date(value)
  return Number.isFinite(date.getTime()) ? date : null
}

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n)
}

/** "3 Sep 2026" */
export function formatDate(d: Date | number | string, opts: { long?: boolean } = {}): string {
  const date = displayDate(d)
  if (!date) return "—"
  const month = opts.long ? MONTHS_ID_LONG[date.getMonth()] : MONTHS_ID[date.getMonth()]
  return `${date.getDate()} ${month} ${date.getFullYear()}`
}

/** "14:30" */
export function formatTime(d: Date | number | string): string {
  const date = displayDate(d)
  if (!date) return "—"
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

/** "3 Sep 2026, 14:30" — format default timestamp di seluruh app (§13) */
export function formatDateTime(d: Date | number | string): string {
  return displayDate(d) ? `${formatDate(d)}, ${formatTime(d)}` : "—"
}

/** "Rabu, 3 September 2026" — untuk layar konfirmasi/struk */
export function formatDateLong(d: Date | number | string): string {
  const date = displayDate(d)
  if (!date) return "—"
  return `${DAYS_ID[date.getDay()]}, ${formatDate(date, { long: true })}`
}

/** Sisa waktu detik -> "04:59" atau "1:04:59" (countdown OTP/lockout/deadline) */
export function formatCountdown(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds)) return "—"
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
  const digits = asText(account).replace(/\s/g, "")
  const hidden = Math.max(0, digits.length - visible)
  const masked = "\u2022".repeat(hidden) + digits.slice(-visible)
  return masked.replace(/(.{4})/g, "$1 ").trim()
}

/** Kelompokkan nomor per 4 tanpa mask: "1234 5678 9012" */
export function groupAccountNumber(account: string): string {
  return asText(account)
    .replace(/\s/g, "")
    .replace(/(.{4})/g, "$1 ")
    .trim()
}

/** Nomor HP Indonesia -> "+62 812-3456-7890" */
export function formatPhoneId(raw: string): string {
  let digits = asText(raw).replace(/\D/g, "")
  if (digits.startsWith("62")) digits = digits.slice(2)
  if (digits.startsWith("0")) digits = digits.slice(1)
  const parts = [digits.slice(0, 3), digits.slice(3, 7), digits.slice(7)].filter(Boolean)
  return digits ? `+62 ${parts.join("-")}` : ""
}

/** "Budi Santoso" -> "BS" (Avatar fallback) */
export function initials(name: string, max = 2): string {
  return asText(name)
    .trim()
    .split(/\s+/)
    .slice(0, max)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
}

/** Potong string panjang di tengah: "KHD-2026-0903-ABCDEF" -> "KHD-2026…CDEF" */
export function truncateMiddle(s: string, head = 8, tail = 4): string {
  const text = asText(s)
  if (text.length <= head + tail + 1) return text
  return `${text.slice(0, head)}\u2026${text.slice(-tail)}`
}

/** Byte -> "2,4 MB" (batasan upload KYC §9.19) */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`
}
