/**
 * Kahade — umpan balik artikel "sekali per versi" (batch 139, item F17).
 *
 * Tombol membantu/tidak membantu sebelumnya bisa ditekan berulang dan
 * mengubah metrik. Sekarang pilihan disimpan PER VERSI ARTIKEL secara lokal:
 * - Kunci versi = hash sederhana dari konten artikel (backend belum punya
 *   field `version` — fallback jujur yang didokumentasikan di sini).
 * - Satu pilihan per versi; pengguna boleh mengoreksi TEPAT SATU KALI
 *   (mis. salah ketuk). Setelah koreksi dipakai, pilihan terkunci.
 *
 * Per akun: secure storage + dihapus `clearSession()` saat logout.
 */
import { getSecureItem, setSecureItem, SecureKeys } from "@/lib/secure-storage"
import { logWarn } from "@/lib/telemetry"

export type HelpFeedbackChoice = "helpful" | "not_helpful"

type StoredChoice = {
  choice: HelpFeedbackChoice
  /** true bila koreksi tunggal sudah dipakai. */
  corrected: boolean
  updatedAt: number
}

type FeedbackMap = Record<string, StoredChoice>

/**
 * Hash FNV-1a 32-bit dari konten → heksadesimal. BUKAN untuk keamanan;
 * hanya penanda versi konten yang murah dan deterministik.
 */
export function contentVersionHash(content: string): string {
  let h = 0x811c9dc5
  const s = content ?? ""
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, "0")
}

/** Kunci penyimpanan = articleId + hash versi konten. */
export function feedbackKey(articleId: string, content: string): string {
  return `${articleId}::${contentVersionHash(content)}`
}

function sanitize(raw: unknown): FeedbackMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  const out: FeedbackMap = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof k !== "string" || k.length > 256 || !v || typeof v !== "object") continue
    const rec = v as Record<string, unknown>
    const choice = rec.choice
    if (choice !== "helpful" && choice !== "not_helpful") continue
    out[k] = {
      choice,
      corrected: rec.corrected === true,
      updatedAt: typeof rec.updatedAt === "number" && Number.isFinite(rec.updatedAt) ? rec.updatedAt : 0,
    }
  }
  return out
}

async function loadMap(): Promise<FeedbackMap> {
  try {
    const raw = await getSecureItem(SecureKeys.helpFeedback)
    if (!raw) return {}
    return sanitize(JSON.parse(raw))
  } catch (err) {
    logWarn("help-feedback:load", err)
    return {}
  }
}

async function saveMap(map: FeedbackMap): Promise<void> {
  try {
    await setSecureItem(SecureKeys.helpFeedback, JSON.stringify(map))
  } catch (err) {
    logWarn("help-feedback:save", err)
  }
}

/** Pilihan yang tersimpan untuk versi artikel ini (null = belum memilih). */
export async function getHelpFeedback(articleId: string, content: string): Promise<StoredChoice | null> {
  const map = await loadMap()
  return map[feedbackKey(articleId, content)] ?? null
}

export type SaveFeedbackResult =
  | { status: "saved" }
  | { status: "corrected" }
  | { status: "already_locked" }

/**
 * Simpan pilihan. Aturan:
 * - Belum ada pilihan → "saved".
 * - Pilihan beda & koreksi belum dipakai → "corrected" (koreksi tunggal).
 * - Pilihan sama atau koreksi sudah dipakai → "already_locked".
 */
export async function saveHelpFeedback(
  articleId: string,
  content: string,
  choice: HelpFeedbackChoice,
): Promise<SaveFeedbackResult> {
  const key = feedbackKey(articleId, content)
  const map = await loadMap()
  const existing = map[key]
  if (!existing) {
    map[key] = { choice, corrected: false, updatedAt: Date.now() }
    await saveMap(map)
    return { status: "saved" }
  }
  if (existing.choice === choice || existing.corrected) {
    return { status: "already_locked" }
  }
  map[key] = { choice, corrected: true, updatedAt: Date.now() }
  await saveMap(map)
  return { status: "corrected" }
}
