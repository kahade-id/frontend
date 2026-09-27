/**
 * Kahade — template balasan "/" tersinkron backend (batch 43 FE-CHAT, 2026-09-28).
 *
 * Menggantikan `lib/quick-replies.ts` (SecureStore per-perangkat) sebagai
 * sumber kebenaran: GET/POST/PATCH/DELETE /v1/chat/reply-templates.
 * Pola memory-first + hydration async; kegagalan backend graceful (daftar
 * kosong, bukan throw) kecuali operasi tulis yang memang melempar agar
 * pemanggil bisa menampilkan toast.
 */
import { useCallback, useEffect, useState } from "react"
import {
  createReplyTemplate,
  deleteReplyTemplate,
  listReplyTemplates,
  updateReplyTemplate,
  REPLY_TEMPLATE_SHORTCUT_RE,
  REPLY_TEMPLATE_TEXT_MAX,
  type ChatReplyTemplate,
} from "@/lib/api/chat"
import { logWarn } from "@/lib/telemetry"

export type { ChatReplyTemplate }
export { REPLY_TEMPLATE_SHORTCUT_RE, REPLY_TEMPLATE_TEXT_MAX }

let cache: ChatReplyTemplate[] | null = null
let inflight: Promise<ChatReplyTemplate[]> | null = null

function sortTemplates(list: ChatReplyTemplate[]): ChatReplyTemplate[] {
  return [...list].sort((a, b) => a.shortcut.localeCompare(b.shortcut))
}

/** Muat template dari backend (idempoten). Gagal → daftar kosong. */
export function loadReplyTemplates(force = false): Promise<ChatReplyTemplate[]> {
  if (cache && !force) return Promise.resolve(cache)
  if (!inflight) {
    inflight = listReplyTemplates()
      .then((list) => {
        cache = sortTemplates(list)
        return cache
      })
      .catch((err: unknown) => {
        logWarn("chat:reply-templates-load", err)
        return cache ?? []
      })
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

/** Refresh paksa dari backend (setelah tulis / kembali ke layar). */
export async function refreshReplyTemplates(): Promise<ChatReplyTemplate[]> {
  cache = null
  return loadReplyTemplates(true)
}

/** Saring template berdasarkan shortcut atau isi (case-insensitive). */
export function filterReplyTemplates(
  templates: ChatReplyTemplate[],
  query: string,
): ChatReplyTemplate[] {
  const q = query.trim().toLowerCase()
  if (!q) return templates
  return templates.filter(
    (t) => t.shortcut.toLowerCase().includes(q) || t.text.toLowerCase().includes(q),
  )
}

/** Normalisasi shortcut: huruf kecil, tanpa spasi. */
export function normalizeTemplateShortcut(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "_")
}

/** Validasi lokal sebelum kirim (backend juga memvalidasi). */
export function validateTemplateInput(
  shortcut: string,
  text: string,
): { ok: true } | { ok: false; message: string } {
  const sc = normalizeTemplateShortcut(shortcut)
  if (!sc) return { ok: false, message: "Shortcut wajib diisi." }
  if (sc.length > 32) return { ok: false, message: "Shortcut maksimal 32 karakter." }
  if (!REPLY_TEMPLATE_SHORTCUT_RE.test(sc))
    return { ok: false, message: "Shortcut hanya huruf kecil, angka, dan underscore." }
  if (!text.trim()) return { ok: false, message: "Isi template wajib diisi." }
  if (text.length > REPLY_TEMPLATE_TEXT_MAX)
    return { ok: false, message: `Isi template maksimal ${REPLY_TEMPLATE_TEXT_MAX} karakter.` }
  return { ok: true }
}

/** Tambah template (backend) + update cache. Melempar bila gagal. */
export async function addReplyTemplate(
  shortcut: string,
  text: string,
): Promise<ChatReplyTemplate> {
  const created = await createReplyTemplate({
    shortcut: normalizeTemplateShortcut(shortcut),
    text: text.trim(),
  })
  cache = sortTemplates([...(cache ?? []), created])
  return created
}

/** Ubah template (backend) + update cache. Melempar bila gagal. */
export async function editReplyTemplate(
  id: string,
  patch: { shortcut?: string; text?: string },
): Promise<ChatReplyTemplate> {
  const updated = await updateReplyTemplate(id, {
    ...(patch.shortcut !== undefined
      ? { shortcut: normalizeTemplateShortcut(patch.shortcut) }
      : {}),
    ...(patch.text !== undefined ? { text: patch.text.trim() } : {}),
  })
  cache = sortTemplates((cache ?? []).map((t) => (t.id === id ? updated : t)))
  return updated
}

/** Hapus template (backend) + update cache. Melempar bila gagal. */
export async function removeReplyTemplate(id: string): Promise<void> {
  await deleteReplyTemplate(id)
  cache = (cache ?? []).filter((t) => t.id !== id)
}

/**
 * Hook React untuk daftar template tersinkron.
 * ATURAN KERAS context: hook ini murni data — tidak merender provider apa pun.
 */
export function useReplyTemplates() {
  const [templates, setTemplates] = useState<ChatReplyTemplate[] | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setTemplates(await refreshReplyTemplates())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let alive = true
    loadReplyTemplates()
      .then((list) => {
        if (alive) setTemplates(list)
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [])

  return { templates, loading, refresh }
}

/** Reset untuk test. */
export function __resetReplyTemplatesForTest(): void {
  cache = null
  inflight = null
}
