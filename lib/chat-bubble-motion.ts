/**
 * Kahade — motion gelembung pesan (permintaan produk 2026-10-08, bagian 3b).
 *
 * Aturan yang dikunci modul ini (murni, tanpa React — bisa diuji di node):
 *
 *  1. HANYA pesan yang benar-benar BARU yang dianimasikan masuk. Pesan lama
 *     yang di-render ulang (membuka ruang, menelusuri riwayat) tidak boleh
 *     ikut "melompat" — kalau tidak, setiap kali pengguna scroll ke atas
 *     thread akan berkedip.
 *     Penandanya BUKAN state modul (tidak boleh ada memori global yang bocor
 *     dan membuat perilaku bergantung urutan render), melainkan usia pesan:
 *     `createdAt` masih dalam jendela `BUBBLE_ENTRANCE_FRESH_MS`. Sifatnya
 *     deterministik untuk satu render dan tidak butuh pembersihan.
 *
 *  2. Arah masuk mengikuti sisi pesan: pesan MASUK naik dari kiri, pesan
 *     KELUAR (kiriman sendiri) naik dari kanan — gerak itu mengulang bahasa
 *     ruang (kiri = lawan bicara, kanan = saya) sehingga pengguna tahu dari
 *     mana pesan datang SEBELUM membacanya.
 *
 *  3. Kartu sistem (event transaksi) naik dari bawah TANPA geser samping:
 *     ia bukan "milik" salah satu pihak.
 *
 *  4. Bahasa geraknya memakai `tokens.motion.springPlayful` (overshoot halus)
 *     — satu kosakata dengan sisa aplikasi, bukan angka baru yang lahir di
 *     sini. Reduced-motion ditangani pemanggil (komponen) dengan melompat
 *     langsung ke keadaan akhir.
 */

/** Jendela "pesan baru" untuk animasi masuk (ms). */
export const BUBBLE_ENTRANCE_FRESH_MS = 15_000

/** Sisi gelembung — samakan dengan `ChatMessageDirection` di komponen. */
export type BubbleMotionDirection = "incoming" | "outgoing" | "system"

/** Keadaan AWAL animasi masuk: geser + skala yang kemudian diluruhkan ke 0/1. */
export type BubbleEntranceVector = {
  /** Geser horizontal awal (px) — arah datangnya pesan. */
  translateX: number
  /** Geser vertikal awal (px) — pesan selalu datang dari bawah (naik). */
  translateY: number
  /** Skala awal (< 1) — gelembung "mengembang" ke ukuran penuhnya. */
  scale: number
}

/**
 * Vektor masuk per arah. Angkanya kecil (8–14px) dengan sengaja: gelembung
 * chat muncul puluhan kali per menit — gerak besar akan jadi gangguan, bukan
 * kejutan yang menyenangkan. Cukup terasa "mengambang masuk", tidak terbang.
 */
export function bubbleEntranceVector(direction: BubbleMotionDirection): BubbleEntranceVector {
  switch (direction) {
    case "outgoing":
      // Dari kanan, sedikit lebih jauh: kiriman sendiri adalah aksi pengguna,
      // jadi pantas terasa lebih tegas.
      return { translateX: 14, translateY: 10, scale: 0.96 }
    case "incoming":
      return { translateX: -14, translateY: 10, scale: 0.96 }
    case "system":
      return { translateX: 0, translateY: 8, scale: 0.98 }
  }
}

/**
 * True bila pesan ini cukup baru untuk dianimasikan masuk.
 *
 * `createdAt` yang tidak terbaca (bukan ISO) dianggap TIDAK baru — lebih baik
 * tidak beranimasi daripada setiap render memutuskan hal berbeda.
 */
export function isFreshMessage(createdAt: string | null | undefined, now: number = Date.now()): boolean {
  if (!createdAt) return false
  const at = Date.parse(createdAt)
  if (Number.isNaN(at)) return false
  const age = now - at
  // Usia negatif (jam server sedikit di depan) tetap dianggap baru selama
  // tidak lebih dari satu menit di masa depan — skew jam tidak boleh membuat
  // pesan yang baru saja tiba tidak beranimasi.
  if (age < -60_000) return false
  return age <= BUBBLE_ENTRANCE_FRESH_MS
}

/**
 * Urutan "kemajuan" status kirim — dipakai untuk memutuskan apakah sebuah
 * perubahan status layak dipestakan dengan animasi (mis. `sent` → `read`).
 * Mundur (mis. `read` → `failed`) TIDAK dianimasikan sebagai kemajuan.
 */
const STATUS_RANK: Record<string, number> = {
  queued: 0,
  sending: 1,
  sent: 2,
  read: 3,
  failed: 0,
}

/** True bila perpindahan status `from` → `to` adalah kemajuan (layak pop). */
export function isStatusAdvance(from: string | undefined, to: string | undefined): boolean {
  if (!from || !to || from === to) return false
  return (STATUS_RANK[to] ?? 0) > (STATUS_RANK[from] ?? 0)
}
