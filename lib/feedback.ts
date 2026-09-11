/**
 * Kahade — pengiriman umpan balik pengguna.
 *
 * Endpoint backend `POST /v1/feedback` masih berupa kontrak yang DIJADWALKAN,
 * sehingga pengiriman dibuat tahan-gagal:
 *   - Bila server merespons (2xx/4xx bisnis), hasilnya diteruskan apa adanya.
 *   - Bila server BELUM punya endpoint (404) atau perangkat sedang luring,
 *     masukan disimpan dalam antrean lokal (SecureStore; di web jatuh ke
 *     localStorage) dan dilaporkan sebagai "queued" — pengguna tetap melihat
 *     masukan terkirim, dan saat ia mengirim masukan berikutnya secara
 *     DARING, antrean lama dicoba dikirim ulang lebih dulu.
 *
 * Ini BUKAN rahasia: isinya saran/keluhan + waktu lokal, setara penyimpanan
 * preferensi. Disimpan di SecureStore hanya karena proyek tidak memasang
 * AsyncStorage (konvensi sama dengan onboardingSeen/languagePreference).
 */
import { http } from "@/lib/api/client"
import {
  getSecureItem,
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

async function readQueue(): Promise<QueuedFeedback[]> {
  try {
    const raw = await getSecureItem(SecureKeys.feedbackQueue)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as QueuedFeedback[]) : []
  } catch {
    return []
  }
}

async function writeQueue(items: QueuedFeedback[]): Promise<void> {
  try {
    if (items.length === 0) {
      await setSecureItem(SecureKeys.feedbackQueue, "")
    } else {
      await setSecureItem(SecureKeys.feedbackQueue, JSON.stringify(items.slice(-20)))
    }
  } catch {
    // Penyimpanan penuh/tidak tersedia — tidak boleh membuat gagal kirim.
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

/** Coba kirim ulang antrean lama; satu kegagalan menghentikan flush. */
async function flushQueue(): Promise<void> {
  const pending = await readQueue()
  for (const item of pending) {
    const { queuedAt: _queuedAt, ...input } = item
    await postFeedback(input)
  }
  await writeQueue([])
}

/**
 * Kirim umpan balik; mengantre lokal saat endpoint belum ada / luring.
 * Tidak melempar untuk kegagalan jaringan — melempar hanya untuk kesalahan
 * validasi dari server (mis. pesan kosong) agar UI bisa menampilkan pesannya.
 */
export async function submitFeedback(input: FeedbackInput): Promise<FeedbackResult> {
  // Pendahuluan: coba kosongkan antrean lama, kegagalannya diabaikan —
  // masukan baru tetap akan diproses di bawah.
  await flushQueue().catch(() => undefined)

  try {
    await postFeedback(input)
    return { status: "sent" }
  } catch (err) {
    const kind = classifyFailure(err)
    if (kind === "other") throw err
    const queue = await readQueue()
    queue.push({ ...input, queuedAt: new Date().toISOString() })
    await writeQueue(queue)
    return { status: "queued", reason: kind }
  }
}

/** Jumlah masukan yang masih mengantre (untuk info/diagnostik UI). */
export async function queuedFeedbackCount(): Promise<number> {
  return (await readQueue()).length
}
