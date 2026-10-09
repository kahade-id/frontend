/**
 * Kahade — susunan utas balasan Tanya Jawab profil (murni, tanpa React Native).
 *
 * Backend mengirim komentar sebagai DAFTAR DATAR dengan `parentId` (kontrak
 * `AddCommentDto { content, parentId? }`). Modul ini mengubahnya menjadi pohon
 * untuk ditampilkan ala Threads: balasan di bawah induknya, tanpa batas
 * kedalaman, dengan dua aturan visual:
 *
 *   - INDENTASI dibatasi `THREAD_INDENT_MAX` level. Balasan yang lebih dalam
 *     tetap sejajar dengan level maksimum — lebar layar ponsel tidak cukup
 *     untuk menggeser terus-menerus (360dp, 3 level sudah memakan ±130dp).
 *   - COLLAPSE otomatis: balasan pada kedalaman `THREAD_COLLAPSE_DEPTH` ke
 *     atas menyembunyikan anak-anaknya di balik tombol "Tampilkan N balasan".
 *     Pengguna tetap bisa membukanya; default-nya tertutup supaya utas panjang
 *     tidak mendominasi layar.
 *
 * Keputusan non-obvious:
 *   - Komentar yatim (induknya tidak ada di halaman yang dimuat, atau induknya
 *     sudah disembunyikan/dihapus dari daftar) diangkat jadi akar. Lebih baik
 *     terlihat sebagai balasan biasa daripada hilang diam-diam.
 *   - Siklus parentId (A→B→A) dipatahkan: node yang tak tercapai dari akar
 *     ditambahkan sebagai akar. Tanpa ini, data rusak membuat komentar hilang.
 *   - Urutan "Teratas" = jumlah dukungan (`upvoteCount`) terbanyak dulu, seri
 *     dipecah oleh waktu terlama (percakapan mengalir dari awal). "Terbaru" =
 *     waktu terbaru dulu. Urutan diterapkan di setiap level, sehingga balasan
 *     di dalam balasan ikut diurutkan konsisten.
 *   - `upvoteCount` belum ada di kontrak komentar (lihat
 *     docs/rekomendasi-backend-profile.md): sampai backend mengirimnya, nilai
 *     dianggap 0 dan "Teratas" jatuh ke urutan waktu.
 */
import type { QuestionComment } from "@/lib/api/users"

/** Level indentasi maksimum; balasan lebih dalam sejajar dengan level ini. */
export const THREAD_INDENT_MAX = 2

/** Kedalaman (0 = balasan langsung ke pertanyaan) mulai dari mana anak disembunyikan. */
export const THREAD_COLLAPSE_DEPTH = 3

export type ThreadSort = "top" | "newest"

export type ThreadNode = {
  comment: QuestionComment
  /** 0 = balasan langsung ke pertanyaan. */
  depth: number
  children: ThreadNode[]
  /** Jumlah seluruh keturunan (untuk label "Tampilkan N balasan"). */
  descendantCount: number
}

function timeOf(c: QuestionComment): number {
  const t = Date.parse(c.createdAt)
  return Number.isFinite(t) ? t : 0
}

function supportsOf(c: QuestionComment): number {
  const n = c.upvoteCount
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : 0
}

/** Pembanding urutan tampilan. Dipakai di setiap level. */
export function compareThreadComments(sort: ThreadSort) {
  return (a: QuestionComment, b: QuestionComment): number => {
    if (sort === "newest") return timeOf(b) - timeOf(a)
    const bySupport = supportsOf(b) - supportsOf(a)
    if (bySupport !== 0) return bySupport
    return timeOf(a) - timeOf(b)
  }
}

/**
 * Bangun pohon dari daftar datar. Input tidak dimutasi.
 * Mengembalikan akar-akar yang sudah diurutkan (rekursif ke bawah).
 */
export function buildCommentThread(items: readonly QuestionComment[], sort: ThreadSort): ThreadNode[] {
  const byId = new Map<string, QuestionComment>()
  for (const c of items) byId.set(c.id, c)

  const childrenOf = new Map<string, QuestionComment[]>()
  const roots: QuestionComment[] = []
  for (const c of items) {
    const parent = c.parentId
    if (parent && parent !== c.id && byId.has(parent)) {
      const list = childrenOf.get(parent)
      if (list) list.push(c)
      else childrenOf.set(parent, [c])
    } else {
      roots.push(c)
    }
  }

  const cmp = compareThreadComments(sort)
  const visited = new Set<string>()

  function build(c: QuestionComment, depth: number): ThreadNode {
    visited.add(c.id)
    const kids = (childrenOf.get(c.id) ?? [])
      .filter((k) => !visited.has(k.id))
      .sort(cmp)
      .map((k) => build(k, depth + 1))
    const descendantCount = kids.reduce((n, k) => n + 1 + k.descendantCount, 0)
    return { comment: c, depth, children: kids, descendantCount }
  }

  const rootNodes = roots.slice().sort(cmp).map((r) => build(r, 0))

  // Siklus: node yang belum terkunjung tidak tercapai dari akar mana pun.
  // Angkat yang belum terkunjung sebagai akar agar tidak hilang.
  const orphanCycle = items
    .filter((c) => !visited.has(c.id))
    .sort(cmp)
  for (const c of orphanCycle) {
    if (!visited.has(c.id)) rootNodes.push(build(c, 0))
  }

  return rootNodes
}

/** Indentasi visual untuk kedalaman tertentu (dibatasi `THREAD_INDENT_MAX`). */
export function indentLevel(depth: number): number {
  return Math.min(Math.max(depth, 0), THREAD_INDENT_MAX)
}

/** Apakah anak-anak node ini harus disembunyikan secara default. */
export function startsCollapsed(node: ThreadNode): boolean {
  return node.depth >= THREAD_COLLAPSE_DEPTH && node.children.length > 0
}

/** Total komentar dalam pohon (untuk label dan sanity check). */
export function countThread(nodes: readonly ThreadNode[]): number {
  return nodes.reduce((n, node) => n + 1 + node.descendantCount, 0)
}
