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
import { getLanguage } from "@/lib/i18n/store"
import { logWarn } from "@/lib/telemetry"

/** E-05: fallback formatDateTimeWIB dilaporkan sekali per proses. */
let wibFallbackReported = false

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

/**
 * Nama bulan & hari pengikut bahasa aktif (§13 menjaga URUTAN dan bentuk
 * eksplisit, kamus yang mengganti namanya). "Mei" → "May", "Rabu" → "Wednesday".
 *
 * Kenapa TIDAK `Intl.DateTimeFormat("en-US")`: §13 menuntut "3 Sep 2026,
 * 14:30" — tanggal dulu, tanpa comma setelah bulan, TANPA relative time.
 * Intl menata ulang urutan per locale dan di Hermes (Android) dukungan Intl
 * bergantung engine; tabel eksplisit deterministik di semua platform.
 */
const MONTHS_EN = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]
const MONTHS_EN_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]
const DAYS_EN = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]

function monthNames(long: boolean): readonly string[] {
  return getLanguage() === "en"
    ? long
      ? MONTHS_EN_LONG
      : MONTHS_EN
    : long
      ? MONTHS_ID_LONG
      : MONTHS_ID
}

function dayNames(): readonly string[] {
  return getLanguage() === "en" ? DAYS_EN : DAYS_ID
}

/** 1000000 -> "1.000.000" (tanpa prefix) */
export function groupThousands(n: number): string {
  if (!Number.isFinite(n)) return "—"
  const abs = Math.abs(Math.trunc(n))
  return abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")
}

/**
 * Tingkat compact, menurun. `min` = batas bawah pemakaian tingkat itu.
 * "rb"/"jt" sudah dipakai di app; "M"(miliar)/"T"(triliun) ditambahkan karena
 * tanpa keduanya nilai besar jatuh ke tingkat di bawahnya dan menghasilkan
 * label tidak masuk akal seperti "Rp1000,0 jt" (audit #5).
 */
const COMPACT_UNITS = [
  { min: 1_000_000_000_000, div: 1_000_000_000_000, suffix: " T" },
  { min: 1_000_000_000, div: 1_000_000_000, suffix: " M" },
  { min: 1_000_000, div: 1_000_000, suffix: " jt" },
  { min: 1_000, div: 1_000, suffix: " rb" },
] as const

/**
 * "Rp1,5 jt" hanya untuk chart/label sempit — bukan nominal transaksi.
 *
 * Nilai dibulatkan ke 1 desimal lebih dulu, lalu tingkatnya dinaikkan bila
 * hasil pembulatan mencapai 1000: 999.999 harus jadi "1 jt", bukan "1000,0 rb"
 * (audit #5). `findIndex` pada array menurun memilih tingkat terbesar yang muat.
 */
function compactBody(abs: number): string {
  let i = COMPACT_UNITS.findIndex((u) => abs >= u.min)
  if (i === -1) return groupThousands(abs)
  let r = Math.round((abs / COMPACT_UNITS[i].div) * 10) / 10
  while (r >= 1000 && i > 0) {
    i -= 1
    r = Math.round((abs / COMPACT_UNITS[i].div) * 10) / 10
  }
  const text = r % 1 === 0 ? r.toFixed(0) : r.toFixed(1)
  return `${text.replace(".", ",")}${COMPACT_UNITS[i].suffix}`
}

/**
 * Format Rupiah bulat: 1500000 -> "Rp1.500.000". Negatif -> "-Rp1.500.000".
 *
 * `sign` mengatur tanda POSITIF saja (audit #5):
 *   - "auto"   : tanpa "+" (default)
 *   - "always" : "+Rp50.000" untuk mutasi saldo; 0 tetap "Rp0" karena nol
 *                tidak bertanda
 *   - "never"  : menyembunyikan "+", TIDAK menyembunyikan "-". Implementasi
 *                lama mengembalikan `Rp${body}` tanpa prefix sama sekali, jadi
 *                -Rp50.000 tampil identik dengan +Rp50.000 — di tooltip
 *                bar-chart (satu-satunya pemakai `never`) debet terbaca sebagai
 *                kredit. Tanda negatif adalah informasi, bukan hiasan.
 */
export function formatRupiah(
  amount: number,
  opts: { sign?: "auto" | "always" | "never"; compact?: boolean } = {},
): string {
  if (!Number.isFinite(amount) || !Number.isSafeInteger(Math.round(amount))) return "—"
  const { sign = "auto", compact = false } = opts
  const negative = amount < 0
  const abs = Math.abs(Math.round(amount))
  const body = compact ? compactBody(abs) : groupThousands(abs)
  const prefix = negative ? "-" : sign === "always" && amount > 0 ? "+" : ""
  return `${prefix}Rp${body}`
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

/**
 * Format angka biasa dengan pemisah ribuan (bukan uang).
 *
 * Tanda diambil dari hasil `Math.trunc`, bukan dari `n`: `Math.trunc(-0.4)`
 * adalah `-0`, dan `-0 < 0` bernilai false, jadi `formatNumber(-0.4)`
 * menghasilkan "0" — bukan "-0" yang merupakan nilai yang tidak ada (audit #5).
 */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "—"
  const truncated = Math.trunc(n)
  return `${truncated < 0 ? "-" : ""}${groupThousands(truncated)}`
}

/**
 * Angka ringkas untuk PENGHITUNG SOSIAL (suka/komentar/view): 1400 → "1,4K",
 * 2.000.000 → "2M" — pola feed sosial (mockup docs/image/IMG_20260917_224056).
 * Di bawah 1000 tampil apa adanya ("999"), sebab "0,9K" lebih sulit dipindai
 * daripada tiga digit. K/M/B (ribu/juta/miliar) dipilih untuk hitungan —
 * BUKAN "rb"/"jt" milik `formatRupiah(compact)` — karena satuan sosial ini
 * menempel pada ikon, bukan nominal uang; campur keduanya membuat "1,5 jt"
 * terbaca sebagai harga di baris aksi.
 *
 * Pembulatan 1 desimal dengan koma (id); tingkat dinaikkan bila pembulatan
 * menyentuh 1000 (999.999 → "1M", bukan "1000K") — tangga yang sama dengan
 * compactBody di atas.
 */
export function formatCountCompact(n: number): string {
  if (!Number.isFinite(n)) return "—"
  const truncated = Math.trunc(n)
  const abs = Math.abs(truncated)
  const units = [
    { min: 1_000_000_000, suffix: "B" },
    { min: 1_000_000, suffix: "M" },
    { min: 1_000, suffix: "K" },
  ] as const
  let i = units.findIndex((u) => abs >= u.min)
  if (i === -1) return groupThousands(truncated)
  let value = Math.round((abs / units[i].min) * 10) / 10
  while (value >= 1000 && i > 0) {
    i -= 1
    value = Math.round((abs / units[i].min) * 10) / 10
  }
  const text = value % 1 === 0 ? value.toFixed(0) : value.toFixed(1).replace(".", ",")
  return `${truncated < 0 ? "-" : ""}${text}${units[i].suffix}`
}

/**
 * Desimal lokal ID: koma sebagai pemisah desimal, tanpa Intl.
 * `formatDecimal(4.5)` → "4,5"; `formatDecimal(4)` → "4"; `formatDecimal(4.25, 1)` → "4,3".
 * Dipakai rating, persentase, dan nilai pecahan lain (§13).
 *
 * Tanda dibaca dari string hasil `toFixed`, lalu dibatalkan bila nilainya nol:
 * `formatDecimal(-0.4, 0)` membulat ke 0 dan harus tampil "0", bukan "-0"
 * (audit #5). `toFixed` sudah menyertakan tanda, jadi int tidak perlu
 * di-`Math.abs` dua kali.
 */
export function formatDecimal(n: number, maxFractionDigits = 1): string {
  if (!Number.isFinite(n)) return "—"
  const precision = Number.isFinite(maxFractionDigits)
    ? Math.max(0, Math.min(20, Math.trunc(maxFractionDigits)))
    : 1
  const fixed = n.toFixed(precision)
  const negative = fixed.startsWith("-") && Number(fixed) !== 0
  const [int, frac = ""] = (negative ? fixed.slice(1) : fixed).split(".")
  const trimmed = frac.replace(/0+$/, "")
  const absInt = groupThousands(Number(int))
  const sign = negative ? "-" : ""
  return trimmed ? `${sign}${absInt},${trimmed}` : `${sign}${absInt}`
}

/**
 * Durasi rata-rata jam → nilai + satuan untuk frasa i18n.
 *
 * G-05 (audit 2026-09-22): fungsi sebelumnya mengembalikan KALIMAT Indonesia
 * utuh ("Biasanya sekitar 2 hari") dari lapisan format. Kalimat itu tidak bisa
 * dicocokkan kamus karena angkanya berubah-ubah, jadi pengguna English selalu
 * mendapat teks Indonesia pada layar detail order. Sekarang formatter hanya
 * menyediakan angka + satuan; layar merangkainya lewat `translate("… {x} …")`
 * sehingga kalimatnya ikut terkatalog dan bisa diterjemahkan.
 */
export function durationHoursParts(hours: number): { value: string; unit: "hari" | "jam" } | null {
  if (!Number.isFinite(hours) || hours <= 0) return null
  return hours >= 24
    ? { value: formatDecimal(hours / 24), unit: "hari" }
    : { value: formatDecimal(hours, 0), unit: "jam" }
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
  const month = monthNames(!!opts.long)[date.getMonth()]
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

/**
 * E-08 (audit): formatDateTime + penanda zona WIB eksplisit untuk TENGgat
 * (deadline escrow, kedaluwarsa tautan pembayaran/QRIS, langganan).
 * "14:30" polos ambigu bagi pengguna WITA/WIT — dan tenggat yang dipersepsi
 * beda zona adalah sumber sengketa "terlambat konfirmasi". Backend
 * mengoperasikan tenggat dalam WIB, jadi nilai dikonversi ke Asia/Jakarta
 * apa pun zona perangkat. Butuh ICU (Hermes RN ≥ 0.65 default full-ICU);
 * bila tidak tersedia, jatuh ke formatDateTime TANPA label (melabeli zona
 * perangkat sebagai WIB lebih buruk daripada tanpa label).
 */
export function formatDateTimeWIB(d: Date | number | string): string {
  const date = displayDate(d)
  if (!date) return "—"
  const locale = getLanguage() === "en" ? "en-GB" : "id-ID"
  try {
    const parts = new Intl.DateTimeFormat(locale, {
      timeZone: "Asia/Jakarta",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date)
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ""
    const hour = get("hour") === "24" ? "00" : get("hour")
    return `${get("day")} ${get("month")} ${get("year")}, ${hour}:${get("minute")} WIB`
  } catch {
    // E-05 (audit 2026-09-22): fallback ini SENGAJA tanpa label (melabeli zona
    // perangkat sebagai WIB lebih buruk), tapi sebelumnya terjadi tanpa jejak
    // apa pun. Sekali per proses dicatat supaya build tanpa full-ICU terlihat
    // di telemetri alih-alih diam-diam menampilkan tenggat tanpa zona.
    if (!wibFallbackReported) {
      wibFallbackReported = true
      logWarn("format:wib-fallback", new Error("Intl Asia/Jakarta tidak tersedia"))
    }
    return formatDateTime(date)
  }
}

/** "Rabu, 3 September 2026" — untuk layar konfirmasi/struk */
export function formatDateLong(d: Date | number | string): string {
  const date = displayDate(d)
  if (!date) return "—"
  return `${dayNames()[date.getDay()]}, ${formatDate(date, { long: true })}`
}

/** Sisa waktu detik -> "04:59" atau "1:04:59" (countdown OTP/lockout/deadline) */
export function formatCountdown(totalSeconds: number, placeholder = "—"): string {
  if (!Number.isFinite(totalSeconds)) return placeholder
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h > 0 ? `${h}:${pad2(m)}:${pad2(sec)}` : `${pad2(m)}:${pad2(sec)}`
}

/**
 * Nomor rekening: tampilkan 4 digit terakhir, sisanya bullet, dikelompokkan
 * per 4 agar terbaca dalam Mono: "•••• •••• 1234".
 *
 * A-01 (audit 2026-09-22): versi sebelumnya menggabungkan bullet + digit lalu
 * mengelompokkan ULANG seluruh string dari depan. Karena jumlah bullet bukan
 * kelipatan 4 pada rekening 10/11/13/14/15 digit (BCA/BNI 10, CIMB/Mandiri 13,
 * BRI 15), kelompok terakhir TERBELAH: "•••• ••78 90" sehingga 4 digit
 * verifikasi terakhir tidak lagi utuh di layar konfirmasi penarikan.
 * Sekarang grup dibentuk dari bagian tersembunyi, dan ekor yang terlihat
 * selalu menjadi satu grup utuh.
 */
export function maskAccountNumber(account: string, visible = 4): string {
  const digits = asText(account).replace(/\s/g, "")
  const shown = Math.max(0, Math.min(visible, digits.length))
  const hidden = digits.length - shown
  const groups: string[] = []
  for (let i = 0; i < hidden; i += 4) groups.push("\u2022".repeat(Math.min(4, hidden - i)))
  if (shown > 0) groups.push(digits.slice(-shown))
  return groups.join(" ")
}

/** Kelompokkan nomor per 4 tanpa mask: "1234 5678 9012" */
export function groupAccountNumber(account: string): string {
  return asText(account)
    .replace(/\s/g, "")
    .replace(/(.{4})/g, "$1 ")
    .trim()
}

/**
 * Nomor HP Indonesia -> "+62 812-3456-7890".
 *
 * Prefix trunk "0" dan kode negara "62" bisa datang dalam urutan apa pun
 * karena pengguna menyalin dari berbagai sumber: "0812…", "62812…",
 * "+62 812…", "0062812…" (prefix internasional), bahkan "062812…" bila nomor
 * sudah salah format di hulu. Implementasi lama mengecek `62` lebih dulu lalu
 * `0`, sehingga "0628123456789" kehilangan nol-nya dan menyisakan "62" sebagai
 * bagian nomor pelanggan -> "+62 628-1234-56789" (audit #5). Pembuangan
 * dilakukan berulang sampai keduanya habis, dalam urutan apa pun.
 */
export function formatPhoneId(raw: string): string {
  let digits = asText(raw).replace(/\D/g, "")
  // Maksimum 4 iterasi: "00" + "62" sudah mencakup prefix terpanjang yang
  // realistis, dan loop ini harus selalu berhenti (digits memendek tiap langkah).
  for (let i = 0; i < 4; i++) {
    if (digits.startsWith("0")) digits = digits.slice(1)
    else if (digits.startsWith("62")) digits = digits.slice(2)
    else break
  }
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

/**
 * Potong string panjang di tengah: "KHD-2026-0903-ABCDEF" -> "KHD-2026…CDEF"
 *
 * `tail=0` dicabang eksplisit: `String.prototype.slice(-0)` identik dengan
 * `slice(0)` dan mengembalikan SELURUH string, sehingga `truncateMiddle(x, 8, 0)`
 * dulu menghasilkan "abcdefgh…abcdefghij" — lebih PANJANG dari inputnya
 * (audit #5). `tail` adalah prop publik <Truncate>, jadi 0 bisa dicapai pemanggil.
 */
export function truncateMiddle(s: string, head = 8, tail = 4): string {
  const text = asText(s)
  const h = Math.max(0, Math.trunc(head))
  const t = Math.max(0, Math.trunc(tail))
  if (text.length <= h + t + 1) return text
  return `${text.slice(0, h)}\u2026${t > 0 ? text.slice(-t) : ""}`
}

/**
 * Byte -> "2,4 MB" (batasan upload KYC §9.19).
 *
 * Tangga satuan lengkap sampai PB dan nilai dinaikkan tingkatnya SETELAH
 * pembulatan. Versi lama berhenti di MB, jadi 1 GB tampil "1024,0 MB" dan
 * 1 TB tampil "1048576,0 MB" (audit #5). Byte juga dibulatkan: "1023.5 B"
 * memakai titik desimal Inggris dan byte pecahan tidak bermakna bagi pengguna.
 */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—"
  const units = ["B", "KB", "MB", "GB", "TB", "PB"] as const
  let value = Math.round(bytes)
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i += 1
  }
  // 1048575 B -> 1023,999 KB -> toFixed(0) "1024 KB"; naikkan sekali lagi.
  let text = value.toFixed(i <= 1 ? 0 : 1)
  if (Number(text) >= 1024 && i < units.length - 1) {
    value /= 1024
    i += 1
    text = value.toFixed(i <= 1 ? 0 : 1)
  }
  return `${text.replace(".", ",")} ${units[i]}`
}
