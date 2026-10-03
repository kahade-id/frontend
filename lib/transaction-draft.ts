/**
 * Kahade — draft lokal form "Buat Transaksi" (P1-3, audit perf/UX 2026-10-03).
 *
 * Masalah yang ditutup: wizard 4 langkah ini mengumpulkan isian yang mahal
 * (lawan tervalidasi, rincian pesanan, nominal, tenggat) dan sebelumnya
 * SEMUA hilang begitu layar ter-unmount — app ke background lalu OS membunuh
 * proses, tap notifikasi, atau pindah layar untuk menyalin kode voucher.
 *
 * Pola mengikuti `lib/showcase-draft.ts` (S7) dan `lib/registration-draft.ts`
 * (Batch 139 A05):
 *   - Yang disimpan hanya TEKS/nilai non-rahasia. Tidak ada kredensial,
 *     tidak ada token, tidak ada berkas.
 *   - Autosave di-DEBOUNCE (1 detik) di sisi layar; modul ini hanya
 *     menyimpan/membaca/menghapus.
 *   - Pemulihan SELALU ditanyakan ke pengguna (tidak ada pemulihan senyap) —
 *     draft bisa berasal dari konteks yang sudah tidak relevan.
 *   - Umur draft dibatasi 24 jam (`TRANSACTION_DRAFT_MAX_AGE_MS`): nominal,
 *     tenggat, dan lawan transaksi adalah data yang cepat basi; menawarkan
 *     draft kemarin berisiko membuat pengguna mengirim order dengan angka
 *     lama.
 *
 * Keamanan & privasi:
 *   - Termasuk data milik AKUN (lawan, judul, nominal) → kunci ini dihapus
 *     `clearSession()` saat logout dan SENGAJA tidak masuk
 *     `WEB_PERSISTENT_KEYS` (web = memory-only), sama seperti draft tiket
 *     dukungan.
 *   - Semua nilai dari storage divalidasi ulang (enum dikenal, angka
 *     terbatas, panjang string dibatasi) — isi storage bisa rusak/diubah
 *     pihak lain; nilai tak dikenal JATUH ke default, tidak diteruskan ke
 *     form apa adanya.
 */
import { deleteSecureItem, getSecureItem, SecureKeys, setSecureItem } from "@/lib/secure-storage"

export type TransactionDraftMode = "direct" | "link"
export type TransactionDraftRole = "BUYER" | "SELLER"
export type TransactionDraftOrderType =
  | "PHYSICAL_GOODS"
  | "DIGITAL_GOODS"
  | "SERVICE"
  | "OTHER"
export type TransactionDraftFee = "BUYER" | "SELLER" | "SPLIT"

export type TransactionDraft = {
  mode: TransactionDraftMode
  role: TransactionDraftRole
  counterpart: string
  title: string
  description: string
  orderType: TransactionDraftOrderType
  orderValue: number
  /** ISO tanggal tenggat pilihan pengguna; null = belum dipilih. */
  deadlineIso: string | null
  feeResponsibility: TransactionDraftFee
  /** ISO waktu simpan — dasar ambang 24 jam. */
  savedAt: string
}

/** Batas umur draft yang masih boleh ditawarkan (24 jam). */
export const TRANSACTION_DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000

/** Batas panjang field agar storage tidak bisa dipakai menulis teks raksasa. */
const MAX_COUNTERPART = 40
const MAX_TITLE = 200
const MAX_DESCRIPTION = 4000

const MODES: readonly TransactionDraftMode[] = ["direct", "link"]
const ROLES: readonly TransactionDraftRole[] = ["BUYER", "SELLER"]
const ORDER_TYPES: readonly TransactionDraftOrderType[] = [
  "PHYSICAL_GOODS",
  "DIGITAL_GOODS",
  "SERVICE",
  "OTHER",
]
const FEES: readonly TransactionDraftFee[] = ["BUYER", "SELLER", "SPLIT"]

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : ""
}

export async function saveTransactionDraft(
  draft: Omit<TransactionDraft, "savedAt">,
): Promise<void> {
  try {
    const payload: TransactionDraft = { ...draft, savedAt: new Date().toISOString() }
    await setSecureItem(SecureKeys.transactionDraft, JSON.stringify(payload))
  } catch {
    // Draft bersifat best-effort — gagal simpan tidak boleh mengganggu form.
  }
}

export async function loadTransactionDraft(): Promise<TransactionDraft | null> {
  try {
    const raw = await getSecureItem(SecureKeys.transactionDraft)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<TransactionDraft>
    if (typeof parsed !== "object" || parsed === null) return null

    const orderValue =
      typeof parsed.orderValue === "number" && Number.isFinite(parsed.orderValue)
        ? Math.max(0, parsed.orderValue)
        : 0
    const deadlineIso =
      typeof parsed.deadlineIso === "string" && !Number.isNaN(Date.parse(parsed.deadlineIso))
        ? parsed.deadlineIso
        : null

    return {
      mode: pick(parsed.mode, MODES, "direct"),
      role: pick(parsed.role, ROLES, "BUYER"),
      counterpart: text(parsed.counterpart, MAX_COUNTERPART),
      title: text(parsed.title, MAX_TITLE),
      description: text(parsed.description, MAX_DESCRIPTION),
      orderType: pick(parsed.orderType, ORDER_TYPES, "SERVICE"),
      orderValue,
      deadlineIso,
      feeResponsibility: pick(parsed.feeResponsibility, FEES, "SPLIT"),
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : "",
    }
  } catch {
    return null
  }
}

export async function clearTransactionDraft(): Promise<void> {
  try {
    await deleteSecureItem(SecureKeys.transactionDraft)
  } catch {
    // Best-effort.
  }
}

/** Draft dianggap "berisi" bila ada isian yang diketik/dipilih pengguna. */
export function isMeaningfulTransactionDraft(d: TransactionDraft): boolean {
  return (
    d.counterpart.trim().length > 0 ||
    d.title.trim().length > 0 ||
    d.description.trim().length > 0 ||
    d.orderValue > 0 ||
    d.deadlineIso != null
  )
}

/**
 * Umur draft masih di bawah ambang. `savedAt` tidak valid / di masa depan
 * (jam perangkat bergeser) diperlakukan BASI — fail-closed: lebih baik
 * menanyakan form kosong daripada memulihkan angka yang tidak jelas umurnya.
 */
export function isTransactionDraftFresh(
  d: TransactionDraft,
  nowMs: number = Date.now(),
): boolean {
  const saved = Date.parse(d.savedAt)
  if (Number.isNaN(saved)) return false
  const age = nowMs - saved
  return age >= 0 && age <= TRANSACTION_DRAFT_MAX_AGE_MS
}

/** Satu gerbang untuk "boleh ditawarkan ke pengguna?". */
export function shouldOfferTransactionDraftRestore(
  d: TransactionDraft | null,
  nowMs: number = Date.now(),
): d is TransactionDraft {
  if (!d) return false
  return isMeaningfulTransactionDraft(d) && isTransactionDraftFresh(d, nowMs)
}

/**
 * Sidik jari isi draft TANPA `savedAt` — dipakai layar untuk membedakan
 * "isian pengguna" dari "prefill template/etalase yang belum disentuh":
 * prefill saja tidak boleh mengubah form menjadi draft yang ditawarkan lagi
 * di kunjungan berikutnya.
 */
export function transactionDraftFingerprint(
  d: Omit<TransactionDraft, "savedAt"> | TransactionDraft,
): string {
  return JSON.stringify([
    d.mode,
    d.role,
    d.counterpart.trim(),
    d.title.trim(),
    d.description.trim(),
    d.orderType,
    d.orderValue,
    d.deadlineIso,
    d.feeResponsibility,
  ])
}

/**
 * Tenggat yang layak dipulihkan: hanya tanggal VALID di masa depan.
 * Tanggal yang sudah lewat tidak boleh diam-diam kembali ke form — validasi
 * "Pilih tanggal" akan menahan Lanjut dan pengguna tidak tahu kenapa.
 */
export function transactionDraftDeadline(
  d: TransactionDraft,
  now: Date = new Date(),
): Date | null {
  if (!d.deadlineIso) return null
  const parsed = new Date(d.deadlineIso)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.getTime() > now.getTime() ? parsed : null
}

/**
 * Langkah wizard yang paling masuk akal setelah pemulihan: draft yang sudah
 * berisi rincian → langsung ke "Detail" (2); baru mengisi lawan → "Lawan" (1);
 * sisanya dari awal.
 */
export function transactionDraftStep(d: TransactionDraft): 0 | 1 | 2 {
  const hasDetails =
    d.title.trim().length > 0 || d.description.trim().length > 0 || d.orderValue > 0
  if (hasDetails) return 2
  if (d.counterpart.trim().length > 0) return 1
  return 0
}
