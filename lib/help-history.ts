/**
 * Kahade — riwayat artikel bantuan terakhir dilihat (batch 139, item F04).
 *
 * Riwayat lokal PER AKUN: disimpan di secure storage dan dihapus
 * `clearSession()` saat logout (pola sama seperti `support-draft`). Di web
 * memory-only — jejak baca tidak menetap di localStorage.
 */
import { getSecureItem, setSecureItem, deleteSecureItem, SecureKeys } from "@/lib/secure-storage"
import { logWarn } from "@/lib/telemetry"
import { serverNow } from "@/lib/server-time"

/** Maksimal entri riwayat yang disimpan (±20 artikel terakhir). */
export const HELP_HISTORY_MAX = 20

export type HelpHistoryEntry = {
  /** id artikel (atau slug bila id kosong). */
  articleId: string
  slug: string
  title: string
  /** Nama kategori (opsional, untuk label). */
  categoryName?: string
  /** Epoch ms kapan artikel dibuka. */
  viewedAt: number
}

function sanitize(raw: unknown): HelpHistoryEntry[] {
  if (!Array.isArray(raw)) return []
  const out: HelpHistoryEntry[] = []
  for (const r of raw) {
    if (!r || typeof r !== "object") continue
    const rec = r as Record<string, unknown>
    const articleId = typeof rec.articleId === "string" ? rec.articleId : ""
    const slug = typeof rec.slug === "string" ? rec.slug : ""
    const title = typeof rec.title === "string" ? rec.title.slice(0, 200) : ""
    if (!articleId && !slug) continue
    out.push({
      articleId,
      slug,
      title: title || "Artikel bantuan",
      categoryName: typeof rec.categoryName === "string" ? rec.categoryName.slice(0, 100) : undefined,
      viewedAt: typeof rec.viewedAt === "number" && Number.isFinite(rec.viewedAt) ? rec.viewedAt : 0,
    })
  }
  return out.slice(0, HELP_HISTORY_MAX)
}

export async function getHelpHistory(): Promise<HelpHistoryEntry[]> {
  try {
    const raw = await getSecureItem(SecureKeys.helpHistory)
    if (!raw) return []
    return sanitize(JSON.parse(raw))
  } catch (err) {
    logWarn("help-history:load", err)
    return []
  }
}

/**
 * Catat artikel dibuka: entri yang sama (per articleId) dipindah ke paling
 * depan, daftar dipotong ke HELP_HISTORY_MAX.
 */
export async function recordHelpArticleView(entry: Omit<HelpHistoryEntry, "viewedAt">): Promise<HelpHistoryEntry[]> {
  try {
    const key = entry.articleId || entry.slug
    const list = (await getHelpHistory()).filter((e) => (e.articleId || e.slug) !== key)
    const next = [{ ...entry, viewedAt: serverNow() }, ...list].slice(0, HELP_HISTORY_MAX)
    await setSecureItem(SecureKeys.helpHistory, JSON.stringify(next))
    return next
  } catch (err) {
    logWarn("help-history:record", err)
    return []
  }
}

/** Hapus seluruh riwayat (aksi "Bersihkan" di Pusat Bantuan). */
export async function clearHelpHistory(): Promise<void> {
  try {
    await deleteSecureItem(SecureKeys.helpHistory)
  } catch (err) {
    logWarn("help-history:clear", err)
  }
}
