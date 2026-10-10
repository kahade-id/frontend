/**
 * Kahade — logika murni yang dulu hidup di dalam `useEffect` layar ruang chat
 * (audit chat F14: "audit 20 useEffect — deps benar, tidak ada firing berlebih").
 *
 * Tiga efek bermasalah diurai menjadi fungsi murni sehingga (a) kebenarannya
 * bisa diuji, dan (b) efeknya cukup memanggil fungsi ini dengan deps primitif:
 *
 *   1. Penandaan bintang (`applyStarredIds`): dulu `prev.map((m) => ({ ...m,
 *      isStarred }))` membuat objek BARU untuk SETIAP pesan saat ruang dibuka
 *      — seluruh baris di-render ulang sekali tanpa ada yang berubah (memo
 *      baris jebol). Kini pesan yang statusnya tidak berubah dipertahankan
 *      (`===`), dan array yang sama dikembalikan bila tak ada yang berubah.
 *   2. Popup keselamatan DM (`dmSafetyCounterpartId`): efek bergantung pada
 *      objek `room` utuh sehingga menyala ulang tiap `setRoom` (bisukan/arsip).
 *      Keputusannya kini diturunkan jadi satu id primitif.
 *   3. Hasil pencarian inline (`nextInlineActiveId`): dulu efek memanggil
 *      `jumpToInlineMatch` DI DALAM updater `setInlineActiveId` — efek samping
 *      di updater (dua kali di StrictMode). Kini keputusan murni di luar updater.
 */
import type { ChatMessage } from "@/lib/api/chat"

/**
 * Tandai `isStarred` dari daftar id berbintang. Pesan yang statusnya sudah
 * benar TIDAK diganti objeknya; bila tak ada yang berubah, `prev` dikembalikan.
 */
export function applyStarredIds(
  prev: ChatMessage[],
  starredIds: ReadonlySet<string>,
): ChatMessage[] {
  let changed = false
  const next = prev.map((m) => {
    const starred = starredIds.has(m.id)
    if (Boolean(m.isStarred) === starred) return m
    changed = true
    return { ...m, isStarred: starred }
  })
  return changed ? next : prev
}

export type DmSafetyInput = {
  /** Ruang percakapan 1:1 (bukan grup/transaksi multi-pihak). */
  isOneToOne: boolean
  isSelfChat: boolean
  orderId?: string | null
  /** Tier seal lawan bicara; non-null = penjual terverifikasi. */
  sealTier?: string | null
  counterpartId?: string | null
}

/**
 * Id lawan bicara yang berhak dapat banner anti-tipu DM (audit Pesan #8:
 * tampil permanen selama syaratnya terpenuhi), atau null.
 * Syarat: DM 1:1, bukan self-chat, TANPA orderId, dan lawan bicara belum
 * berbadge. Mengembalikan id (satu string primitif) supaya render/efek tidak
 * bergantung pada identitas objek `room`.
 */
export function dmSafetyCounterpartId(input: DmSafetyInput): string | null {
  if (!input.isOneToOne || input.isSelfChat) return null
  if (input.orderId) return null
  if (input.sealTier != null) return null
  return input.counterpartId || null
}

/**
 * Hasil aktif pencarian inline sesudah daftar hasil berubah: pertahankan yang
 * sekarang bila masih ada; bila tidak, hasil pertama; tanpa hasil → undefined.
 * `shouldJump` = id aktif BERUBAH ke hasil yang valid (perlu menggulir).
 */
export function nextInlineActiveId(
  matches: readonly string[],
  current: string | undefined,
): { id: string | undefined; shouldJump: boolean } {
  if (matches.length === 0) return { id: undefined, shouldJump: false }
  if (current && matches.includes(current)) return { id: current, shouldJump: false }
  return { id: matches[0], shouldJump: true }
}
