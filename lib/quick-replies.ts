/**
 * Kahade — template balasan cepat chat (item 23, 2026-09-28).
 *
 * Ketik "/" di awal composer → picker template → pilih → teks masuk ke
 * composer. Template disimpan LOKAL PER PERANGKAT (SecureStore via
 * `lib/secure-storage`; repo ini tidak memakai AsyncStorage — lihat
 * `lib/chat-drafts.ts`). Template bawaan tidak bisa dihapus/diubah,
 * template buatan user bisa dikelola (tambah/ubah/hapus).
 *
 * CATATAN UNTUK KEPUTUSAN USER: sinkronisasi template antar perangkat butuh
 * endpoint backend baru (CRUD template milik akun) + keputusan produk
 * (apakah template ikut akun atau tetap per perangkat). Tidak dikerjakan di
 * sini.
 */
import { getRawItem, setRawItem } from "@/lib/secure-storage"
import { logWarn } from "@/lib/telemetry"

export type QuickReplyTemplate = {
  /** Stabil per template: bawaan = "builtin:<slug>", custom = cuid-ish. */
  id: string
  text: string
  /** True = template bawaan (tidak bisa dihapus). */
  builtin: boolean
  createdAt: string
}

const STORAGE_KEY = "chat.quickReplies.v1"
/** Batas teks template — sama dengan batas pesan chat (CHAT_MESSAGE_MAX). */
export const QUICK_REPLY_MAX = 2000
/** Batas jumlah template custom per perangkat (jaga ukuran SecureStore). */
export const QUICK_REPLY_CUSTOM_MAX = 50

const BUILTINS: readonly string[] = [
  "Halo kak, terima kasih sudah menghubungi. Ada yang bisa saya bantu?",
  "Baik kak, pesanan sedang saya siapkan. Saya kabari setelah dikirim ya.",
  "Mohon maaf atas ketidaknyamanannya kak. Boleh saya bantu selesaikan?",
  "Terima kasih kak sudah berbelanja di Kahade. Jangan lupa beri ulasan ya!",
]

function builtinTemplates(): QuickReplyTemplate[] {
  return BUILTINS.map((text, i) => ({
    id: `builtin:${i}`,
    text,
    builtin: true,
    createdAt: new Date(0).toISOString(),
  }))
}

type StoredPayload = { custom: { id: string; text: string; createdAt: string }[] }

async function readCustom(): Promise<QuickReplyTemplate[]> {
  try {
    const raw = await getRawItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Partial<StoredPayload>
    if (!Array.isArray(parsed.custom)) return []
    return parsed.custom
      .filter((c) => typeof c?.id === "string" && typeof c?.text === "string")
      .map((c) => ({ id: c.id, text: c.text, builtin: false, createdAt: c.createdAt }))
      .filter((c) => c.text.length > 0 && c.text.length <= QUICK_REPLY_MAX)
  } catch (err: unknown) {
    logWarn("quick-reply:read", err)
    return []
  }
}

async function writeCustom(custom: QuickReplyTemplate[]): Promise<void> {
  const payload: StoredPayload = {
    custom: custom.map((c) => ({ id: c.id, text: c.text, createdAt: c.createdAt })),
  }
  try {
    await setRawItem(STORAGE_KEY, JSON.stringify(payload))
  } catch (err: unknown) {
    logWarn("quick-reply:write", err)
  }
}

function newId(): string {
  return `custom:${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/** Semua template: bawaan + custom (custom paling baru dulu). */
export async function loadQuickReplies(): Promise<QuickReplyTemplate[]> {
  const custom = (await readCustom()).sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1,
  )
  return [...custom, ...builtinTemplates()]
}

/** Filter template dari kueri setelah "/" (case-insensitive, substring). */
export function filterQuickReplies(
  templates: QuickReplyTemplate[],
  query: string,
): QuickReplyTemplate[] {
  const q = query.trim().toLowerCase()
  if (!q) return templates
  return templates.filter((t) => t.text.toLowerCase().includes(q))
}

export async function addQuickReply(text: string): Promise<QuickReplyTemplate> {
  const trimmed = text.trim()
  if (!trimmed) throw new Error("Teks template tidak boleh kosong.")
  if (trimmed.length > QUICK_REPLY_MAX) {
    throw new Error(`Template maksimal ${QUICK_REPLY_MAX} karakter.`)
  }
  const custom = await readCustom()
  if (custom.length >= QUICK_REPLY_CUSTOM_MAX) {
    throw new Error(`Maksimal ${QUICK_REPLY_CUSTOM_MAX} template custom per perangkat.`)
  }
  if (custom.some((c) => c.text === trimmed)) throw new Error("Template ini sudah ada.")
  const created: QuickReplyTemplate = {
    id: newId(),
    text: trimmed,
    builtin: false,
    createdAt: new Date().toISOString(),
  }
  await writeCustom([...custom, created])
  return created
}

export async function updateQuickReply(id: string, text: string): Promise<void> {
  const trimmed = text.trim()
  if (!trimmed) throw new Error("Teks template tidak boleh kosong.")
  if (trimmed.length > QUICK_REPLY_MAX) {
    throw new Error(`Template maksimal ${QUICK_REPLY_MAX} karakter.`)
  }
  const custom = await readCustom()
  const next = custom.map((c) => (c.id === id ? { ...c, text: trimmed } : c))
  await writeCustom(next)
}

export async function removeQuickReply(id: string): Promise<void> {
  const custom = await readCustom()
  await writeCustom(custom.filter((c) => c.id !== id))
}

/** Reset untuk test. */
export function __resetQuickRepliesForTest(): void {
  // Storage di-reset lewat mock; fungsi ini penanda agar test eksplisit.
}
