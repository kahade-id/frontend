/**
 * Draft lokal form "Buat karya" (S7 audit 2026-09-26).
 *
 * Menyimpan TEKS saja (judul, deskripsi, kategori, harga) — TANPA foto, karena
 * fileKey presigned kedaluwarsa dan blob tidak bisa diserialisasi aman.
 * Autosave di-debounce 1 detik; dihapus setelah publish atau discard.
 */
import { getSecureItem, setSecureItem, deleteSecureItem, SecureKeys } from "@/lib/secure-storage"

export type ShowcaseDraft = {
  title: string
  description: string
  category: string
  priceMin: number | null
  priceMax: number | null
  isPublic: boolean
  /** ISO timestamp terakhir disimpan. */
  savedAt: string
}

const KEY = SecureKeys.showcaseDraft

export async function saveShowcaseDraft(draft: Omit<ShowcaseDraft, "savedAt">): Promise<void> {
  try {
    const payload: ShowcaseDraft = { ...draft, savedAt: new Date().toISOString() }
    await setSecureItem(KEY, JSON.stringify(payload))
  } catch {
    // Draft bersifat best-effort — gagal simpan tidak boleh mengganggu form.
  }
}

export async function loadShowcaseDraft(): Promise<ShowcaseDraft | null> {
  try {
    const raw = await getSecureItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ShowcaseDraft>
    if (typeof parsed !== "object" || parsed === null) return null
    return {
      title: typeof parsed.title === "string" ? parsed.title : "",
      description: typeof parsed.description === "string" ? parsed.description : "",
      category: typeof parsed.category === "string" ? parsed.category : "",
      priceMin: typeof parsed.priceMin === "number" ? parsed.priceMin : null,
      priceMax: typeof parsed.priceMax === "number" ? parsed.priceMax : null,
      isPublic: parsed.isPublic !== false,
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : new Date().toISOString(),
    }
  } catch {
    return null
  }
}

export async function clearShowcaseDraft(): Promise<void> {
  try {
    await deleteSecureItem(KEY)
  } catch {
    // Best-effort.
  }
}

/** Draft dianggap "berisi" bila ada teks yang diketik user. */
export function isDraftMeaningful(d: ShowcaseDraft): boolean {
  return (
    d.title.trim().length > 0 ||
    d.description.trim().length > 0 ||
    d.category.trim().length > 0 ||
    d.priceMin != null ||
    d.priceMax != null
  )
}
