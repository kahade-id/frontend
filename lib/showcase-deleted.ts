/**
 * Pelacakan karya etalase yang di-soft-delete.
 *
 * SH-F-003 (audit 2026-09-27): sumber UTAMA daftar "Baru dihapus" kini
 * endpoint backend GET /v1/users/me/showcase/deleted (SS-012) — lintas
 * perangkat / reinstall / logout-login. Catatan lokal (SecureStore) tetap
 * ada sebagai pelengkap (cover & judul saat server tak mengirimnya) dan
 * fallback saat jaringan gagal.
 */
import { getSecureItem, setSecureItem, SecureKeys } from "@/lib/secure-storage"
import { getDeletedShowcase, type DeletedShowcaseItem as ServerDeletedShowcaseItem } from "@/lib/api/showcase"
import { translate } from "@/lib/i18n/translate"

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
  // TIM-8 (audit performa 2026-09-30): decorate-sort-undecorate — `Date.parse`
  // sekali per item, bukan per perbandingan di comparator.
  return valid
    .map((it) => ({ it, t: Date.parse(it.deletedAt) }))
    .sort((a, b) => b.t - a.t)
    .map((d) => d.it)
}

/** Sisa hari pemulihan (dibulatkan ke atas). */
export function restoreDaysLeft(deletedAt: string): number {
  const t = Date.parse(deletedAt)
  if (!Number.isFinite(t)) return 0
  const elapsed = Date.now() - t
  const remaining = SHOWCASE_RESTORE_WINDOW_DAYS * 24 * 60 * 60 * 1000 - elapsed
  return Math.max(0, Math.ceil(remaining / (24 * 60 * 60 * 1000)))
}

/**
 * SH-F-003: satu entri daftar pulihkan — gabungan sumber server + lokal.
 */
export type RecoverableShowcaseItem = {
  id: string
  title: string
  /** ISO timestamp saat dihapus — hanya ada pada entri lokal. */
  deletedAt?: string
  /** Sisa hari pemulihan — server diutamakan, lokal dihitung. */
  daysRemaining?: number
  coverUrl?: string
  /** true = hanya dikenal dari server (mis. dihapus dari perangkat lain). */
  serverOnly?: boolean
}

/**
 * SH-F-003: gabungkan daftar terhapus server + lokal (dedupe per id).
 * - `daysRemaining` server menang atas hitungan lokal (sumber kanonis).
 * - entri server dengan `restorable: false` / id tak valid dilewati.
 * - judul/cover lokal melengkapi entri server yang minim field.
 * Fungsi murni — bisa diuji tanpa jaringan.
 */
export function mergeDeletedShowcase(
  local: DeletedShowcaseItem[],
  server: ServerDeletedShowcaseItem[],
): RecoverableShowcaseItem[] {
  const byId = new Map<string, RecoverableShowcaseItem>()
  for (const it of local) {
    byId.set(it.id, {
      id: it.id,
      title: it.title,
      deletedAt: it.deletedAt,
      coverUrl: it.coverUrl,
    })
  }
  for (const s of server) {
    if (!s || typeof s.id !== "string" || !s.id) continue
    // Tak bisa dipulihkan → tidak usah tampil di daftar pulihkan.
    if (s.restorable === false) continue
    const daysRemaining =
      typeof s.daysRemaining === "number" && Number.isFinite(s.daysRemaining)
        ? Math.max(0, Math.floor(s.daysRemaining))
        : typeof s.deletedAt === "string"
          ? restoreDaysLeft(s.deletedAt)
          : undefined
    const existing = byId.get(s.id)
    if (existing) {
      if (typeof s.title === "string" && s.title.trim()) existing.title = s.title.trim()
      if (daysRemaining != null) existing.daysRemaining = daysRemaining
    } else {
      byId.set(s.id, {
        id: s.id,
        title: typeof s.title === "string" && s.title.trim() ? s.title.trim() : translate("Tanpa judul"),
        deletedAt: typeof s.deletedAt === "string" ? s.deletedAt : undefined,
        daysRemaining,
        serverOnly: true,
      })
    }
  }
  // Lokal (terbaru dulu) lalu entri server-only — urutan tampilan tak berubah
  // untuk pengguna yang hanya punya entri lokal.
  const entries = [...byId.values()]
  entries.sort((a, b) => {
    const aLocal = a.deletedAt != null
    const bLocal = b.deletedAt != null
    if (aLocal !== bLocal) return aLocal ? -1 : 1
    if (aLocal && bLocal) return Date.parse(b.deletedAt as string) - Date.parse(a.deletedAt as string)
    return 0
  })
  return entries
}

/**
 * CR-06 (audit etalase 2026-10-10): entri lokal yang baru ditulis (< 2 menit)
 * tidak dipurge walau belum muncul di daftar server — menutup jeda antara
 * DELETE yang baru sukses dan daftar server yang mungkin masih ter-cache.
 */
export const LOCAL_DELETED_GRACE_MS = 2 * 60 * 1000

/**
 * CR-06: buang entri lokal yang sudah TIDAK ada di daftar server (dipulihkan
 * dari perangkat lain, dihapus permanen, atau `restorable:false`). Hanya
 * berlaku bila daftar server LENGKAP (`complete`) — halaman terpotong tidak
 * boleh dijadikan bukti ketiadaan. Tanpa purge ini, entri basi menampilkan
 * tombol "Pulihkan" yang gagal selamanya ("Data tidak ditemukan") sampai
 * 30 hari berlalu. Fungsi murni — teruji tanpa jaringan.
 */
export function purgeStaleLocalDeleted(
  local: DeletedShowcaseItem[],
  server: ServerDeletedShowcaseItem[],
  options: { complete: boolean; now?: number },
): DeletedShowcaseItem[] {
  if (!options.complete) return local
  const now = options.now ?? Date.now()
  const alive = new Set(
    server
      .filter((s) => s && typeof s.id === "string" && s.id && s.restorable !== false)
      .map((s) => s.id),
  )
  return local.filter((it) => {
    if (alive.has(it.id)) return true
    const t = Date.parse(it.deletedAt)
    return Number.isFinite(t) && now - t < LOCAL_DELETED_GRACE_MS
  })
}

/**
 * SH-F-003: daftar "Baru dihapus" = server (bila ada sesi) + lokal.
 * Kegagalan jaringan/otorisasi → fallback daftar lokal (fail-open yang aman:
 * menampilkan yang diketahui, bukan error).
 */
export async function getRecoverableShowcaseItems(hasSession: boolean): Promise<RecoverableShowcaseItem[]> {
  const local = await getDeletedShowcaseItems()
  if (!hasSession) return mergeDeletedShowcase(local, [])
  let server: ServerDeletedShowcaseItem[] = []
  let complete = false
  try {
    const res = await getDeletedShowcase({ page: 1, limit: 50 })
    if (res && Array.isArray(res.items)) {
      server = res.items
      // Daftar lengkap bila total server muat di satu halaman.
      complete = typeof res.total === "number" ? res.total <= res.items.length : res.items.length < 50
    }
  } catch {
    // Jaringan gagal → daftar lokal tetap tampil (tanpa purge: tidak ada bukti).
    return mergeDeletedShowcase(local, server)
  }
  // CR-06: server adalah sumber kebenaran — entri lokal yang tidak lagi ada
  // di sana dibuang (dan ditulis balik) supaya tidak jadi "Pulihkan" zombie.
  const kept = purgeStaleLocalDeleted(local, server, { complete })
  if (kept.length !== local.length) await writeAll(kept)
  return mergeDeletedShowcase(kept, server)
}
