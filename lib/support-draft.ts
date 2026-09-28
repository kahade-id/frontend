/**
 * Kahade — draft form tiket dukungan otomatis (item mega-batch 131,
 * direvisi batch 139 item F11).
 *
 * REVISI F11: satu draft global tertimpa setiap kategori berubah. Sekarang
 * draft disimpan PER KATEGORI (map kategori → draft) + waktu kedaluwarsa
 * yang jelas (7 hari sejak disimpan). UI menampilkan sisa waktu draft.
 *
 * Migrasi: kunci lama `supportDraft` (satu draft) dibaca sekali dan
 * dipindahkan ke kategorinya, lalu dihapus.
 *
 * Keamanan akun: secure storage + DIHAPUS `clearSession()` saat logout.
 * Di web = memory-only.
 */
import { getSecureItem, setSecureItem, deleteSecureItem, SecureKeys } from "@/lib/secure-storage"
import { logWarn } from "@/lib/telemetry"

export type SupportDraft = {
  category: string
  subject: string
  message: string
  /** fileKey lampiran yang sudah terunggah. */
  attachments: string[]
  /** Keterangan singkat per lampiran (F09) — keyed by fileKey. */
  attachmentCaptions?: Record<string, string>
  /** Dari artikel bantuan ("Tidak membantu" → Buat tiket, item 123). */
  relatedArticleId?: string
  /** Dari detail order (item 133) atau pemilih order (item 132). */
  orderId?: string
  savedAt: number
  /** Epoch ms kedaluwarsa draft (F11: eksplisit, bukan diam-diam hilang). */
  expiresAt: number
}

/** Draft kedaluwarsa 7 hari setelah terakhir disimpan. */
export const SUPPORT_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000

type DraftMap = Record<string, SupportDraft>

export function isEmptyDraft(d: SupportDraft): boolean {
  return (
    !d.subject.trim() &&
    !d.message.trim() &&
    d.attachments.length === 0 &&
    !d.orderId &&
    !d.relatedArticleId
  )
}

/** Sisa waktu draft dalam bahasa pengguna, mis. "6 hari lagi" / "kedaluwarsa". */
export function draftTtlLabel(draft: SupportDraft, now: number = Date.now()): string {
  const ms = draft.expiresAt - now
  if (ms <= 0) return "kedaluwarsa"
  const days = Math.floor(ms / (24 * 60 * 60 * 1000))
  if (days >= 1) return `${days} hari lagi`
  const hours = Math.floor(ms / (60 * 60 * 1000))
  if (hours >= 1) return `${hours} jam lagi`
  return "kurang dari 1 jam lagi"
}

function sanitizeDraft(raw: unknown): SupportDraft | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  const str = (v: unknown) => (typeof v === "string" ? v : "")
  const savedAt = typeof r.savedAt === "number" ? r.savedAt : 0
  const expiresAt =
    typeof r.expiresAt === "number" && Number.isFinite(r.expiresAt)
      ? r.expiresAt
      : savedAt + SUPPORT_DRAFT_TTL_MS
  const captions =
    r.attachmentCaptions && typeof r.attachmentCaptions === "object" && !Array.isArray(r.attachmentCaptions)
      ? Object.fromEntries(
          Object.entries(r.attachmentCaptions as Record<string, unknown>)
            .filter(([, v]) => typeof v === "string")
            .map(([k, v]) => [k, (v as string).slice(0, 140)]),
        )
      : undefined
  return {
    category: str(r.category) || "GENERAL",
    subject: str(r.subject).slice(0, 120),
    message: str(r.message).slice(0, 5000),
    attachments: Array.isArray(r.attachments)
      ? (r.attachments as unknown[]).filter((a): a is string => typeof a === "string").slice(0, 5)
      : [],
    attachmentCaptions: captions,
    relatedArticleId: str(r.relatedArticleId) || undefined,
    orderId: str(r.orderId) || undefined,
    savedAt,
    expiresAt,
  }
}

function sanitizeMap(raw: unknown): DraftMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  const out: DraftMap = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof k !== "string" || k.length > 32) continue
    const d = sanitizeDraft(v)
    if (d) out[k] = d
  }
  return out
}

async function loadMap(): Promise<DraftMap> {
  try {
    const raw = await getSecureItem(SecureKeys.supportDrafts)
    if (raw) return sanitizeMap(JSON.parse(raw))
  } catch (err) {
    logWarn("support-draft:load", err)
    return {}
  }
  // Migrasi sekali: draft lama (satu kunci) → kategorinya.
  try {
    const legacy = await getSecureItem(SecureKeys.supportDraft)
    if (!legacy) return {}
    const d = sanitizeDraft(JSON.parse(legacy))
    await deleteSecureItem(SecureKeys.supportDraft)
    if (!d || isEmptyDraft(d)) return {}
    const map: DraftMap = { [d.category || "GENERAL"]: d }
    await setSecureItem(SecureKeys.supportDrafts, JSON.stringify(map))
    return map
  } catch (err) {
    logWarn("support-draft:migrate", err)
    return {}
  }
}

async function saveMap(map: DraftMap): Promise<void> {
  try {
    await setSecureItem(SecureKeys.supportDrafts, JSON.stringify(map))
  } catch (err) {
    logWarn("support-draft:save", err)
  }
}

function isExpired(d: SupportDraft, now: number): boolean {
  return d.expiresAt <= now
}

/** Muat draft untuk kategori tertentu (null bila kosong/kedaluwarsa). */
export async function loadSupportDraft(category: string, now: number = Date.now()): Promise<SupportDraft | null> {
  const map = await loadMap()
  const d = map[category]
  if (!d || isEmptyDraft(d) || isExpired(d, now)) {
    if (d && isExpired(d, now)) {
      delete map[category]
      await saveMap(map)
    }
    return null
  }
  return d
}

/** Simpan draft untuk kategorinya (expiresAt dihitung ulang tiap simpan). */
export async function saveSupportDraft(draft: Omit<SupportDraft, "expiresAt">): Promise<void> {
  const map = await loadMap()
  const savedAt = draft.savedAt || Date.now()
  map[draft.category || "GENERAL"] = { ...draft, savedAt, expiresAt: savedAt + SUPPORT_DRAFT_TTL_MS }
  await saveMap(map)
}

/** Hapus draft satu kategori (dipakai setelah tiket terkirim). */
export async function clearSupportDraft(category?: string): Promise<void> {
  if (!category) {
    // Tanpa kategori: bersihkan SEMUA (kompatibilitas pemanggil lama).
    try {
      await deleteSecureItem(SecureKeys.supportDrafts)
      await deleteSecureItem(SecureKeys.supportDraft)
    } catch (err) {
      logWarn("support-draft:clear", err)
    }
    return
  }
  const map = await loadMap()
  delete map[category]
  await saveMap(map)
}

/** Daftar kategori yang punya draft aktif (untuk indikator UI bila perlu). */
export async function listDraftCategories(now: number = Date.now()): Promise<string[]> {
  const map = await loadMap()
  return Object.keys(map).filter((k) => !isEmptyDraft(map[k]) && !isExpired(map[k], now))
}
