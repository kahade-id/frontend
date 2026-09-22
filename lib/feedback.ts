/**
 * Kahade — pengiriman umpan balik pengguna.
 *
 * Feedback offline bersifat sementara dan tidak dianggap sebagai tiket resmi.
 * Antrean dibatasi ukuran, dibersihkan setelah TTL, dan ikut dihapus saat
 * logout agar masukan milik akun sebelumnya tidak terbawa ke akun berikutnya.
 * Nilai yang menunggu kirim bukan rahasia, tetapi tetap berpotensi memuat data
 * pribadi sehingga lifecycle-nya sengaja pendek. Tidak ada worker background
 * yang menjamin pengiriman otomatis; retry dilakukan saat halaman feedback
 * dibuka atau saat pengguna mengirim masukan berikutnya.
 */
import { http } from "@/lib/api/client"
import {
  getSecureItem,
  isSecureKeyPersisted,
  SecureKeys,
  setSecureItem,
} from "@/lib/secure-storage"

export const FEEDBACK_CATEGORIES = [
  "Saran fitur",
  "Laporan masalah",
  "Pengalaman pengguna",
  "Pujian",
  "Lainnya",
] as const

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number]

export type FeedbackInput = {
  category: FeedbackCategory
  message: string
  /** Email/kontak opsional bila pengguna ingin dihubungi. */
  contact?: string
  rating?: number
}

type QueuedFeedback = FeedbackInput & { queuedAt: string }

export type FeedbackResult =
  | { status: "sent" }
  | { status: "queued"; reason: "offline" | "unsupported" }

/** Retention pendek: feedback yang tidak terkirim bukan arsip pengguna. */
export const FEEDBACK_QUEUE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const MAX_MESSAGE_LENGTH = 2_000
const MAX_CONTACT_LENGTH = 254
const MAX_QUEUE_ITEMS = 5
/** SecureStore punya batas sekitar 2 KB per nilai; sisakan ruang aman. */
const MAX_QUEUE_JSON_LENGTH = 1_700

function isCategory(value: unknown): value is FeedbackCategory {
  return typeof value === "string" && (FEEDBACK_CATEGORIES as readonly string[]).includes(value)
}

function normalizeInput(input: FeedbackInput): FeedbackInput {
  return {
    category: input.category,
    message: input.message.trim().replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").slice(0, MAX_MESSAGE_LENGTH),
    contact: input.contact?.trim().slice(0, MAX_CONTACT_LENGTH) || undefined,
    rating: input.rating,
  }
}

function isQueuedFeedback(value: unknown): value is QueuedFeedback {
  if (!value || typeof value !== "object") return false
  const item = value as Partial<QueuedFeedback>
  return (
    isCategory(item.category) &&
    typeof item.message === "string" &&
    item.message.length > 0 &&
    item.message.length <= MAX_MESSAGE_LENGTH &&
    typeof item.queuedAt === "string" &&
    Number.isFinite(Date.parse(item.queuedAt)) &&
    (item.contact === undefined || typeof item.contact === "string") &&
    (item.rating === undefined || typeof item.rating === "number")
  )
}

function isFresh(item: QueuedFeedback, now = Date.now()): boolean {
  const queuedAt = Date.parse(item.queuedAt)
  return Number.isFinite(queuedAt) && now - queuedAt >= 0 && now - queuedAt <= FEEDBACK_QUEUE_TTL_MS
}

async function readQueue(): Promise<QueuedFeedback[]> {
  try {
    const raw = await getSecureItem(SecureKeys.feedbackQueue)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const fresh = parsed.filter(isQueuedFeedback).filter((item) => isFresh(item))
    const bounded = fresh.slice(-MAX_QUEUE_ITEMS)
    // Opportunistically remove expired/corrupt entries from persistent storage.
    if (bounded.length !== parsed.length) await writeQueue(bounded)
    return bounded
  } catch {
    return []
  }
}

async function writeQueue(items: QueuedFeedback[]): Promise<boolean> {
  try {
    let bounded = items.slice(-MAX_QUEUE_ITEMS)
    // Drop oldest records until the SecureStore value stays below its limit.
    while (bounded.length > 0 && JSON.stringify(bounded).length > MAX_QUEUE_JSON_LENGTH) {
      bounded = bounded.slice(1)
    }
    await setSecureItem(SecureKeys.feedbackQueue, bounded.length ? JSON.stringify(bounded) : "")
    return true
  } catch {
    // Storage penuh/tidak tersedia — caller harus memberi tahu bahwa data belum tersimpan.
    return false
  }
}

function classifyFailure(err: unknown): "offline" | "unsupported" | "other" {
  const code = (err as { code?: string } | null)?.code
  if (code === "NOT_FOUND") return "unsupported"
  if (code === "NETWORK" || code === "TIMEOUT") return "offline"
  return "other"
}

async function postFeedback(payload: FeedbackInput): Promise<void> {
  await http.post(
    "/v1/feedback",
    {
      category: payload.category,
      message: payload.message,
      contact: payload.contact?.trim() || undefined,
      rating: payload.rating,
      platform: "app",
    },
    { auth: "optional" },
  )
}

/** Coba kirim ulang antrean lama tanpa menghapus item yang belum berhasil. */
async function flushQueue(): Promise<void> {
  const pending = await readQueue()
  for (let index = 0; index < pending.length; index += 1) {
    const { queuedAt: _queuedAt, ...input } = pending[index]
    try {
      await postFeedback(input)
    } catch {
      // Simpan item gagal + item setelahnya; jangan retry agresif di background.
      await writeQueue(pending.slice(index))
      return
    }
  }
  if (pending.length > 0) await writeQueue([])
}

/** Coba kirim antrean feedback secara best-effort dari lifecycle UI. */
export async function flushQueuedFeedback(): Promise<void> {
  await flushQueue()
}

/**
 * Kirim umpan balik; mengantre lokal saat endpoint belum ada / luring.
 * Validasi server tetap dilempar agar UI dapat memberi pesan yang tepat.
 */
export async function submitFeedback(input: FeedbackInput): Promise<FeedbackResult> {
  const normalized = normalizeInput(input)
  if (!isCategory(normalized.category) || normalized.message.length === 0) {
    throw new Error("Feedback tidak boleh kosong")
  }

  await flushQueuedFeedback()

  try {
    await postFeedback(normalized)
    return { status: "sent" }
  } catch (err) {
    const kind = classifyFailure(err)
    if (kind === "other") throw err
    const queue = await readQueue()
    queue.push({ ...normalized, queuedAt: new Date().toISOString() })
    const stored = await writeQueue(queue)
    if (!stored) {
      throw new Error("Masukan belum terkirim dan tidak dapat disimpan di perangkat")
    }
    return { status: "queued", reason: kind }
  }
}

/**
 * D-07 (audit): di web, antrean masukan SENGAJA hanya di memori (isi masukan
 * bisa memuat email/konteks transaksi; reload tidak boleh meninggalkannya di
 * localStorage). Konsekuensinya antrean itu HILANG saat halaman dimuat ulang —
 * dan UI tidak boleh menjanjikan "akan dikirim otomatis saat terhubung" untuk
 * data yang sudah tidak ada. Layar memakai nilai ini untuk memilih kalimat yang
 * benar.
 */
export const FEEDBACK_QUEUE_PERSISTS = isSecureKeyPersisted(SecureKeys.feedbackQueue)

/** Jumlah masukan yang masih mengantre (untuk info/diagnostik UI). */
export async function queuedFeedbackCount(): Promise<number> {
  return (await readQueue()).length
}

/** Hapus masukan lokal yang belum terkirim (dipakai oleh logout/privacy controls). */
export async function clearFeedbackQueue(): Promise<void> {
  await setSecureItem(SecureKeys.feedbackQueue, "")
}
