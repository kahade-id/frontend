/**
 * Pelacakan lokal karya etalase yang di-soft-delete.
 *
 * Backend tidak menyediakan endpoint list item terhapus, jadi aplikasi
 * menyimpan info item yang dihapus secara lokal (SecureStore) agar user
 * bisa melihat daftar "Baru dihapus" dan memulihkannya dalam 30 hari.
 */
import { getSecureItem, setSecureItem, SecureKeys } from "@/lib/secure-storage"

export type DeletedShowcaseItem = {
  id: string
  title: string
  /** ISO timestamp saat dihapus. */
  deletedAt: string
  /** URL cover untuk pratinjau (opsional). */
  coverUrl?: string
}

/** Batas pemulihan soft-delete (hari) — sinkron dengan kebijakan backend. */
export const SHOWCASE_RESTORE_WINDOW_DAYS = 30

async function readAll(): Promise<DeletedShowcaseItem[]> {
  try {
    const raw = await getSecureItem(SecureKeys.deletedShowcaseItems)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (it): it is DeletedShowcaseItem =>
        typeof it === "object" &&
        it !== null &&
        typeof (it as DeletedShowcaseItem).id === "string" &&
        typeof (it as DeletedShowcaseItem).deletedAt === "string",
    )
  } catch {
    return []
  }
}

async function writeAll(items: DeletedShowcaseItem[]): Promise<void> {
  try {
    await setSecureItem(SecureKeys.deletedShowcaseItems, JSON.stringify(items))
  } catch {
    // Penyimpanan lokal best-effort; kegagalan tidak boleh menggagalkan alur.
  }
}

/** Catat item yang baru dihapus (soft-delete). */
export async function markShowcaseDeleted(item: DeletedShowcaseItem): Promise<void> {
  const items = await readAll()
  const next = [item, ...items.filter((it) => it.id !== item.id)]
  await writeAll(next)
}

/** Hapus dari daftar setelah berhasil dipulihkan. */
export async function unmarkShowcaseDeleted(id: string): Promise<void> {
  const items = await readAll()
  await writeAll(items.filter((it) => it.id !== id))
}

/** Daftar item terhapus yang masih dalam jendela 30 hari. */
export async function getDeletedShowcaseItems(): Promise<DeletedShowcaseItem[]> {
  const now = Date.now()
  const cutoff = now - SHOWCASE_RESTORE_WINDOW_DAYS * 24 * 60 * 60 * 1000
  const items = await readAll()
  const valid = items.filter((it) => {
    const t = Date.parse(it.deletedAt)
    return Number.isFinite(t) && t >= cutoff
  })
  if (valid.length !== items.length) {
    await writeAll(valid)
  }
  return valid.sort((a, b) => Date.parse(b.deletedAt) - Date.parse(a.deletedAt))
}

/** Sisa hari pemulihan (dibulatkan ke atas). */
export function restoreDaysLeft(deletedAt: string): number {
  const t = Date.parse(deletedAt)
  if (!Number.isFinite(t)) return 0
  const elapsed = Date.now() - t
  const remaining = SHOWCASE_RESTORE_WINDOW_DAYS * 24 * 60 * 60 * 1000 - elapsed
  return Math.max(0, Math.ceil(remaining / (24 * 60 * 60 * 1000)))
}
