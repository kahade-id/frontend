/** Consistent native header hierarchy: screen headings H2, item details H3. */

/**
 * Padding horizontal SIMETRIS untuk judul header yang harus center terhadap
 * lebar layar PENUH (permintaan produk 2026-10-08).
 *
 * Masalah yang diselesaikan: kolom judul `flex-1` di antara kolom kiri/kanan
 * hanya center terhadap RUANG SISA — begitu jumlah/lebar aksi kiri ≠ kanan
 * (mis. dua ikon di kiri, satu di kanan), judul bergeser. Menambal dengan
 * margin manual per layar tidak pernah presisi dan pecah di lebar layar lain.
 *
 * Solusi: judul diposisikan ABSOLUT selebar baris (0 → W) dan diberi padding
 * kiri == padding kanan == nilai fungsi ini. Karena kedua sisi memakai angka
 * yang SAMA, titik tengah kotak teks selalu tepat di W/2 untuk setiap lebar
 * layar — berapa pun lebar aksi kiri/kanan. Padding itu ada semata-mata agar
 * judul panjang tidak bertabrakan dengan tombol.
 *
 * `minSlot` = lebar satu slot tombol header (`tokens.space[12]` = 48px) —
 * dipakai supaya judul tidak menyentuh tepi saat salah satu sisi kosong.
 */
export function headerTitleCenterPadding(
  leftWidth: number,
  rightWidth: number,
  minSlot = 48,
): number {
  const widest = Math.max(leftWidth, rightWidth, minSlot)
  return widest
}
const COMPACT_DETAIL_PATHS = [
  /^\/(?:order|notification|chat|dispute|support|invoice|delivery-proof|extension|tracking|milestones|wallet-transaction|order-link|jastip|patungan)\/[^/]+$/,
  /^\/(?:showcase|user|profile)\/[^/]+(?:\/(?:questions|ratings|showcase))?$/,
  /^\/returns\/[^/]+$/,
  /^\/help\/[^/]+$/,
  /^\/help\/category\/[^/]+$/,
] as const

function normalizePathname(pathname: string): string {
  const path = pathname.split(/[?#]/, 1)[0] ?? "/"
  const segments = path
    .split("/")
    .filter(Boolean)
    .filter((segment) => !(/^\([^/]+\)$/).test(segment))
  return `/${segments.join("/")}`.toLowerCase()
}

/** Detail screens get a compact H3; main/list/form screens keep the H2 default. */
export function defaultHeaderTitleVariant(pathname: string): "h2" | "h3" {
  const path = normalizePathname(pathname)
  // Static create form shares the first segment with showcase detail, but is
  // an action screen rather than an item detail.
  if (path === "/showcase/create") return "h2"
  return COMPACT_DETAIL_PATHS.some((pattern) => pattern.test(path)) ? "h3" : "h2"
}
