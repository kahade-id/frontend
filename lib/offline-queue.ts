/**
 * Kahade — antrean offline KHUSUS aksi sosial (item #27).
 *
 * ATURAN KERAS (fail-closed, jangan dilonggarkan tanpa persetujuan produk):
 *   - Yang BOLEH masuk antrean: like/unlike karya showcase dan
 *     follow/unfollow pengguna (allowlist `SOCIAL_QUEUE_PATTERNS`).
 *   - Yang TIDAK BOLEH: aksi finansial/transaksi/wallet/escrow/sengketa/chat —
 *     semuanya melempar `OfflineError` dari transport dengan pesan jelas,
 *     TIDAK PERNAH diantrekan diam-diam.
 *
 * Keputusan non-obvious:
 *   - FIFO mempertahankan niat terakhir: like lalu unlike saat offline =
 *     dua entri berurutan; hasil akhir di server = unlike. Benar.
 *   - Entri kedaluwarsa 7 hari dan terikat revisi sesi: antrean milik sesi
 *     login yang membuatnya; logout/login membuang sisanya (aksi sosial
 *     akun A tidak boleh terkirim sebagai akun B).
 *   - Promise pemanggil resolve saat entri DIEKSEKUSI (bukan saat dienqueue),
 *     membawa respons server asli — hook optimistis (like) tetap bekerja
 *     tanpa perubahan: state final diset dari respons seperti biasa.
 *   - Eksekutor di-inject oleh `lib/api/client.ts` (hindari import sirkular).
 *   - Persist di SecureStore supaya selamat dari restart app; resolver
 *     in-memory hanya untuk sesi proses ini.
 */
import { getSessionRevision } from "@/lib/api/session"
import { getSecureItem, setSecureItem, SecureKeys } from "@/lib/secure-storage"
import { logWarn } from "@/lib/telemetry"
import { onReconnect } from "@/lib/connectivity"

/** ID acak non-kriptografis — cukup untuk kunci antrean lokal. */
function randomQueueId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export type SocialQueueMethod = "POST" | "DELETE"

export type QueuedSocialAction = {
  id: string
  method: SocialQueueMethod
  path: string
  body?: unknown
  headers?: Record<string, string>
  /** Copy manusiawi untuk feedback ("Suka karya", "Ikuti pengguna"). */
  label: string
  enqueuedAt: number
  sessionRevision: number
}

type QueueExecutor = (item: QueuedSocialAction) => Promise<unknown>

let executor: QueueExecutor | null = null
export function setSocialQueueExecutor(fn: QueueExecutor): void {
  executor = fn
}

/**
 * Allowlist MUTLAK aksi yang boleh diantrekan offline. Path dinormalisasi
 * (encodeURIComponent untuk id/username — lihat `seg()` di client).
 */
const SOCIAL_QUEUE_PATTERNS: { method: SocialQueueMethod; pattern: RegExp }[] = [
  { method: "POST", pattern: /^\/v1\/showcase\/[^/]+\/like$/ },
  { method: "DELETE", pattern: /^\/v1\/showcase\/[^/]+\/like$/ },
  { method: "POST", pattern: /^\/v1\/users\/[^/]+\/follow$/ },
  { method: "DELETE", pattern: /^\/v1\/users\/[^/]+\/follow$/ },
]

export function isQueueableSocialAction(method: string, path: string): boolean {
  return SOCIAL_QUEUE_PATTERNS.some(
    (entry) => entry.method === method && entry.pattern.test(path),
  )
}

const MAX_QUEUE = 100
const ENTRY_TTL_MS = 7 * 24 * 60 * 60 * 1000

const drainedListeners = new Set<(result: { executed: number; failed: number }) => void>()
const queuedListeners = new Set<(label: string) => void>()

/** Langganan feedback "aksi diantrekan" / "antrean terkirim" untuk toast. */
export function onSocialActionQueued(listener: (label: string) => void): () => void {
  queuedListeners.add(listener)
  return () => {
    queuedListeners.delete(listener)
  }
}

export function onSocialQueueDrained(
  listener: (result: { executed: number; failed: number }) => void,
): () => void {
  drainedListeners.add(listener)
  return () => {
    drainedListeners.delete(listener)
  }
}

let memoryQueue: QueuedSocialAction[] = []
let restored = false
/** Resolver promise pemanggil per id entri (hanya hidup di proses ini). */
const pendingResolvers = new Map<
  string,
  { resolve: (value: unknown) => void; reject: (err: unknown) => void }
>()

async function persist(): Promise<void> {
  try {
    await setSecureItem(SecureKeys.offlineSocialQueue, JSON.stringify(memoryQueue))
  } catch (error) {
    logWarn("offline-queue:persist", error)
  }
}

async function restore(): Promise<void> {
  if (restored) return
  restored = true
  try {
    const raw = await getSecureItem(SecureKeys.offlineSocialQueue)
    if (!raw) return
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return
    const now = Date.now()
    memoryQueue = parsed.filter(
      (entry): entry is QueuedSocialAction =>
        !!entry &&
        typeof entry === "object" &&
        typeof (entry as QueuedSocialAction).id === "string" &&
        typeof (entry as QueuedSocialAction).path === "string" &&
        typeof (entry as QueuedSocialAction).enqueuedAt === "number" &&
        now - (entry as QueuedSocialAction).enqueuedAt < ENTRY_TTL_MS &&
        isQueueableSocialAction(
          (entry as QueuedSocialAction).method,
          (entry as QueuedSocialAction).path,
        ),
    )
  } catch (error) {
    logWarn("offline-queue:restore", error)
    memoryQueue = []
  }
}

/**
 * Masukkan aksi sosial ke antrean. MENOLAK (throw) apa pun di luar allowlist —
 * ini garis fail-closed: tidak ada jalur kode yang bisa menyelundupkan aksi
 * finansial ke antrean lewat sini.
 */
export async function enqueueSocialAction(input: {
  method: SocialQueueMethod
  path: string
  body?: unknown
  headers?: Record<string, string>
  label: string
}): Promise<unknown> {
  if (!isQueueableSocialAction(input.method, input.path)) {
    throw new Error(
      `offline-queue: aksi ${input.method} ${input.path} bukan aksi sosial — ` +
        `penolakan disengaja (fail-closed).`,
    )
  }
  await restore()
  if (memoryQueue.length >= MAX_QUEUE) {
    throw new Error(
      "Antrean offline penuh (100 aksi). Sambungkan internet untuk mengirimnya.",
    )
  }
  const entry: QueuedSocialAction = {
    id: randomQueueId(),
    method: input.method,
    path: input.path,
    body: input.body,
    headers: input.headers,
    label: input.label,
    enqueuedAt: Date.now(),
    sessionRevision: getSessionRevision(),
  }
  memoryQueue.push(entry)
  await persist()
  for (const listener of queuedListeners) {
    try {
      listener(entry.label)
    } catch (error) {
      logWarn("offline-queue:queued-listener", error)
    }
  }
  return new Promise<unknown>((resolve, reject) => {
    pendingResolvers.set(entry.id, { resolve, reject })
  })
}

/** Jumlah entri menunggu (untuk badge/diagnostik). */
export function socialQueueLength(): number {
  return memoryQueue.length
}

let draining = false

/**
 * Eksekusi FIFO semua entri yang masih milik sesi ini. Idempoten & aman
 * dipanggil berulang (mis. reconnect beruntun).
 */
export async function drainSocialQueue(): Promise<void> {
  if (draining || !executor) return
  await restore()
  if (memoryQueue.length === 0) return
  draining = true
  const revision = getSessionRevision()
  const now = Date.now()
  let executed = 0
  let failed = 0
  const remaining: QueuedSocialAction[] = []
  for (const entry of memoryQueue) {
    const stale = now - entry.enqueuedAt >= ENTRY_TTL_MS
    const foreign = entry.sessionRevision !== revision
    if (stale || foreign) {
      pendingResolvers.get(entry.id)?.reject(
        new Error("Aksi kedaluwarsa atau sesi berubah — antrean dibuang."),
      )
      pendingResolvers.delete(entry.id)
      continue
    }
    try {
      const result = await executor(entry)
      pendingResolvers.get(entry.id)?.resolve(result)
      executed += 1
    } catch (error) {
      // Satu entri gagal (mis. item dihapus server) tidak boleh menahan
      // sisanya — lanjutkan, laporkan agregat.
      pendingResolvers.get(entry.id)?.reject(error)
      failed += 1
      logWarn("offline-queue:entry-failed", error)
    } finally {
      pendingResolvers.delete(entry.id)
    }
  }
  memoryQueue = remaining
  await persist()
  draining = false
  for (const listener of drainedListeners) {
    try {
      listener({ executed, failed })
    } catch (error) {
      logWarn("offline-queue:drained-listener", error)
    }
  }
}

/**
 * Inisialisasi sekali di root layout: pulihkan antrean tersisa dari sesi
 * proses sebelumnya dan daftarkan eksekusi saat koneksi kembali.
 */
export function initOfflineQueue(): void {
  void restore().then(() => {
    // Boot dalam keadaan online dengan sisa antrean (app ditutup saat
    // offline) → langsung eksekusi, jangan tunggu transisi.
    void drainSocialQueue()
  })
  onReconnect(() => {
    void drainSocialQueue()
  })
}
