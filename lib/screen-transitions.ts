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

/**
 * Bottom-bar destinations — harus terasa seperti ganti tab, bukan push halaman baru.
 * Tanpa ini, stack screen di atas Tabs membuat bottom bar terlihat double/ganti
 * (slide_from_right menggeser bar lama keluar dan bar baru masuk).
 * Pakai 'none' agar bar tetap di tempat, hanya konten yang berganti — sama
 * seperti etalase & transaksi yang memang tab.
 */
const STABLE_BAR_SCREENS: ReadonlySet<string> = new Set([
  "chat",
  "vouchers",
  "wallet-history",
  "user/[username]",
  // PERF-FIX (P2 nav): samakan untuk semua destinasi setara tab —
  // notifications & transactions juga tab utama, bar tidak boleh bergeser.
  "notifications",
  "transactions",
])

/**
 * PERF-FIX (P1 nav): layar berat (>1000 baris implementasi, kini thin shell
 * + lazy) — animasi push dipersingkat agar tidak berebut JS thread dengan
 * mount modul lazy. Transisi tetap terasa, tapi frame drop berkurang.
 */
const HEAVY_SCREENS: ReadonlySet<string> = new Set([
  "chat/[roomId]",
  "user/[username]",
  "order/[id]",
  "showcase/[id]",
  "showcase/create",
  "search",
  "showcase-management",
  "chat",
  "notifications",
  "transactions",
])

export function animationForScreen(name: string, reducedMotion: boolean): ScreenAnimation {
  if (reducedMotion) return "none"
  if (STABLE_BAR_SCREENS.has(name)) return "none"
  if (MODAL_LIKE_SCREENS.has(name)) return "slide_from_bottom"
  if (DETAIL_SCREENS.has(name)) return "fade_from_bottom"
  return "slide_from_right"
}

export function animationDurationForScreen(name?: string): number {
  // PERF-FIX (P1 nav): layar berat = durasi lebih pendek (200ms vs 300ms)
  // agar animasi tidak jank saat JS thread sibuk mount modul lazy.
  if (name && HEAVY_SCREENS.has(name)) return Math.round(tokens.motion.duration.base * 0.67)
  return tokens.motion.duration.base
}

/**
 * PERF-FIX (P1 nav): `getId` untuk rute dinamis — tanpa ini, `router.push`
 * ke id berbeda selalu membuat instance screen baru (A→B→A = 3 entri).
 * Dengan getId, expo-router me-reuse/mengganti dengan benar.
 * Mengembalikan undefined untuk rute statis (perilaku default).
 */
export function getScreenId(name: string): ((params: { params?: Record<string, string | string[]> }) => string) | undefined {
  const match = name.match(/\[([^\]]+)\]/)
  if (!match) return undefined
  const paramName = match[1]
  return ({ params }) => {
    const value = params?.[paramName]
    return `${name}:${Array.isArray(value) ? value[0] : value ?? "index"}`
  }
}
