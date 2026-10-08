/**
 * Kahade — baris thread chat dengan IDENTITAS STABIL (audit chat I24).
 *
 * Keluhan: "kedip putih saat kirim pesan — dicurigai render ulang besar".
 * Mengirim satu pesan hanya menambah satu baris, tetapi `threadRows` lama
 * membuat OBJEK BARU untuk setiap baris pada setiap perubahan daftar pesan:
 *   - tiap sel FlatList menerima `item` baru → di-render ulang semua,
 *   - `renderThreadRow` bergantung pada seluruh `visibleMessages` (untuk
 *     `previous`) → identitasnya berganti tiap kirim → FlatList me-render
 *     ulang SEMUA sel yang ter-mount.
 *
 * Di sini baris dibangun dengan dua jaminan:
 *   1. `previous` (pesan tepat di atas, penentu pengelompokan bubble) ditanam
 *      DI BARIS — `renderThreadRow` tidak lagi perlu daftar pesan, jadi
 *      identitasnya stabil saat pesan ditambah;
 *   2. baris yang isinya tidak berubah MEMAKAI ULANG objek lama (`===`).
 *      Menambah satu pesan di ujung ⇒ HANYA baris baru (dan pemisah hari baru
 *      bila hari berganti) yang objek barunya; seluruh baris lain identik.
 *      Bila tak ada yang berubah sama sekali, array lama dikembalikan.
 *
 * Kunci baris = kunci render stabil (`clientKeyOf`): id temp diwariskan ke
 * pesan server, jadi mengganti bubble optimistis dengan pesan resmi tidak
 * me-remount baris (itu yang tampak sebagai kedip).
 */
import type { ChatMessage } from "@/lib/api/chat"
import { clientKeyOf } from "@/lib/chat-dedupe"

export type ThreadRow =
  | { kind: "day"; key: string; label: string }
  | { kind: "unread"; key: string; anchorId: string; count: number }
  | { kind: "msg"; key: string; message: ChatMessage; previous: ChatMessage | undefined }

export type BuildThreadRowsOptions = {
  /** Pesan jangkar "Belum dibaca" (pemisah disisipkan tepat di atasnya). */
  unreadAnchorId: string | null
  /** Jumlah pesan belum dibaca yang diabadikan saat ruang dibuka. */
  unreadCount: number
  /** Kunci hari lokal (lihat lib/chat-day-label). */
  dayKey: (iso: string) => string
  /** Label manusia untuk satu hari. */
  dayLabel: (iso: string) => string
  /** Hasil sebelumnya — sumber objek yang dipakai ulang. */
  previousRows?: readonly ThreadRow[]
}

function sameRow(a: ThreadRow, b: ThreadRow): boolean {
  if (a.kind !== b.kind || a.key !== b.key) return false
  switch (a.kind) {
    case "day":
      return a.label === (b as typeof a).label
    case "unread":
      return a.anchorId === (b as typeof a).anchorId && a.count === (b as typeof a).count
    case "msg":
      return (
        a.message === (b as typeof a).message && a.previous === (b as typeof a).previous
      )
  }
}

export function buildThreadRows(
  messages: readonly ChatMessage[],
  opts: BuildThreadRowsOptions,
): ThreadRow[] {
  const reusable = new Map<string, ThreadRow>()
  for (const row of opts.previousRows ?? []) reusable.set(row.key, row)

  const rows: ThreadRow[] = []
  let lastDay = ""
  let previous: ChatMessage | undefined
  const push = (row: ThreadRow) => {
    const old = reusable.get(row.key)
    rows.push(old && sameRow(old, row) ? old : row)
  }
  for (const m of messages) {
    const day = opts.dayKey(m.createdAt)
    if (day !== lastDay) {
      lastDay = day
      push({ kind: "day", key: `day-${day}`, label: opts.dayLabel(m.createdAt) })
    }
    if (opts.unreadAnchorId && m.id === opts.unreadAnchorId) {
      push({
        kind: "unread",
        key: "unread-separator",
        anchorId: m.id,
        count: opts.unreadCount,
      })
    }
    push({ kind: "msg", key: clientKeyOf(m), message: m, previous })
    previous = m
  }

  // Tidak ada perubahan sama sekali → array LAMA (data FlatList identik ⇒ bail-out).
  const before = opts.previousRows
  if (before && before.length === rows.length && rows.every((row, i) => row === before[i])) {
    return before as ThreadRow[]
  }
  return rows
}

/**
 * Indeks anak untuk `stickyHeaderIndices` FlatList: baris "day" (pemisah hari
 * menempel di atas saat digulir — B10).
 *
 * `stickyHeaderIndices` memakai ruang indeks ANAK, bukan indeks data:
 * VirtualizedList memperlakukan `ListHeaderComponent` sebagai anak ke-0 dan
 * mencocokkan item data `i` dengan `i + 1` bila header ada (lihat
 * `stickyOffset` di @react-native/virtualized-lists). Memberi indeks data apa
 * adanya — yang dilakukan layar ini sebelumnya — membuat SALAH sel menempel:
 * header "Muat pesan sebelumnya" menempel (indeks 0) dan, untuk tiap pemisah
 * hari di indeks data k, yang menempel justru baris SEBELUMNYA (sebuah bubble).
 * Hasilnya pemisah hari tidak pernah menempel dan sel yang berbeda dibungkus
 * ulang tiap daftar berubah.
 */
export function stickyDayChildIndices(
  rows: readonly ThreadRow[],
  /** 1 bila FlatList punya ListHeaderComponent, 0 bila tidak. */
  headerOffset: 0 | 1,
): number[] {
  const indices: number[] = []
  rows.forEach((row, i) => {
    if (row.kind === "day") indices.push(i + headerOffset)
  })
  return indices
}
