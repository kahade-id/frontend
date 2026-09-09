/**
 * Kahade — klasifikasi transisi antar screen (v2 § motion).
 *
 * Dulunya semua push memakai satu preset (`slide_from_right`). Sekarang tiga
 * rasa, dipilih dari HUBUNGAN screen tujuan dengan pemanggilnya:
 *
 *   - push biasa (default) — `slide_from_right`: "pindah halaman" lateral.
 *     Untuk daftar, pengaturan, dan alur multi-langkah (auth, KYC).
 *   - modal-like — `slide_from_bottom`: alur SINGKAT yang kembali ke pemanggil
 *     (buat transaksi, topup/transfer/withdraw, nilai pesanan, cari). Naik
 *     dari bawah memberi tahu "ini lapisan sementara di atas tempatmu tadi".
 *   - list→detail — `fade_from_bottom`: pasangan daftar→rinci (order,
 *     notifikasi, chat, sengketa, tiket, profil user, invoice, bukti
 *     kirim, dsb). Kartu "naik + fade" dari arah scroll list terasa seperti
 *     kontinuitas item yang dibuka — bukan pindah halaman baru.
 *
 * Kenapa daftar statis, bukan heuristik (non-obvious): hubungan
 * pemanggil-tujuan tidak bisa ditebak dari nama file dengan andal
 * (`search` modal-like tapi `discover` bukan; `transfer` modal tapi
 * `transaction-templates` push). Daftar eksplisit = keputusan produk yang
 * bisa di-review per baris, dan screen baru otomatis jatuh ke default push
 * (aman) sampai seseorang mengklasifikasikannya.
 *
 * Reduced motion: semua preset → `none`. Durasi ikut token (base 300).
 */

import { tokens } from "@/lib/tokens"

export type ScreenAnimation = "slide_from_right" | "slide_from_bottom" | "fade_from_bottom" | "none"

/**
 * Alur singkat yang kembali ke pemanggil — naik dari bawah seperti modal.
 * Daftar konservatif: hanya yang jelas-jelas "sementara". Back gesture iOS
 * untuk preset ini adalah swipe-down (bawaan), yang memang cocok.
 */
const MODAL_LIKE_SCREENS: ReadonlySet<string> = new Set([
  "create-transaction",
  "topup",
  "transfer",
  "withdraw",
  "rate/[orderId]",
  "search",
])

/**
 * Pasangan list→detail — fade dari bawah untuk rasa kontinuitas dengan list.
 * Termasuk sub-route profil user (questions/ratings/showcase) yang dibuka
 * dari kartu profil.
 */
const DETAIL_SCREENS: ReadonlySet<string> = new Set([
  "order/[id]",
  "notification/[id]",
  "chat/[roomId]",
  "dispute/[id]",
  "support/[ticketId]",
  "user/[username]",
  "user/[username]/questions",
  "user/[username]/ratings",
  "user/[username]/showcase",
  "invoice/[orderId]",
  "delivery-proof/[orderId]",
  "extension/[orderId]",
  "order-link/[token]",
  "followers/[username]",
  "wallet-transaction/[txId]",
])

export function animationForScreen(name: string, reducedMotion: boolean): ScreenAnimation {
  if (reducedMotion) return "none"
  if (MODAL_LIKE_SCREENS.has(name)) return "slide_from_bottom"
  if (DETAIL_SCREENS.has(name)) return "fade_from_bottom"
  return "slide_from_right"
}

export function animationDurationForScreen(): number {
  return tokens.motion.duration.base
}
