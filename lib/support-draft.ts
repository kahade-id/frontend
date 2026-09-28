/**
 * Kahade — draft form tiket dukungan otomatis (item mega-batch 131).
 *
 * Disimpan saat pengguna mengetik (debounce oleh pemanggil), dipulihkan
 * saat layar dibuka, dihapus setelah tiket terkirim.
 *
 * Keamanan akun: draft tersimpan di secure storage dan DIHAPUS
 * `clearSession()` saat logout — draft akun A tidak bocor ke akun B.
 * Di web = memory-only (tidak masuk WEB_PERSISTENT_KEYS).
 */
import { getSecureItem, setSecureItem, deleteSecureItem, SecureKeys } from "@/lib/secure-storage"
import { logWarn } from "@/lib/telemetry"

const DRAFT_KEY = SecureKeys.supportDraft

export type SupportDraft = {
  category: string
  subject: string
  message: string
  /** fileKey lampiran yang sudah terunggah. */
  attachments: string[]
  /** Dari artikel bantuan ("Tidak membantu" → Buat tiket, item 123). */
  relatedArticleId?: string
  /** Dari detail order (item 133) atau pemilih order (item 132). */
  orderId?: string
  savedAt: number
}

export function isEmptyDraft(d: SupportDraft): boolean {
  return (
    !d.subject.trim() &&
    !d.message.trim() &&
    d.attachments.length === 0 &&
    !d.orderId &&
    !d.relatedArticleId
  )
}

function sanitize(raw: unknown): SupportDraft | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  const str = (v: unknown) => (typeof v === "string" ? v : "")
  return {
    category: str(r.category) || "GENERAL",
    subject: str(r.subject).slice(0, 120),
    message: str(r.message).slice(0, 5000),
    attachments: Array.isArray(r.attachments)
      ? (r.attachments as unknown[]).filter((a): a is string => typeof a === "string").slice(0, 5)
      : [],
    relatedArticleId: str(r.relatedArticleId) || undefined,
    orderId: str(r.orderId) || undefined,
    savedAt: typeof r.savedAt === "number" ? r.savedAt : 0,
  }
}

export async function loadSupportDraft(): Promise<SupportDraft | null> {
  try {
    const raw = await getSecureItem(DRAFT_KEY)
    if (!raw) return null
    return sanitize(JSON.parse(raw))
  } catch (err) {
    logWarn("support-draft:load", err)
    return null
  }
}

export async function saveSupportDraft(draft: SupportDraft): Promise<void> {
  try {
    await setSecureItem(DRAFT_KEY, JSON.stringify(draft))
  } catch (err) {
    logWarn("support-draft:save", err)
  }
}

export async function clearSupportDraft(): Promise<void> {
  try {
    await deleteSecureItem(DRAFT_KEY)
  } catch (err) {
    logWarn("support-draft:clear", err)
  }
}
