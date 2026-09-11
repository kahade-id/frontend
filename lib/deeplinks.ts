/**
 * Kahade — pembentuk URL yang DIBAGIKAN keluar aplikasi (Order Link, kode
 * referral, profil publik).
 *
 * Satu tempat untuk host & path, supaya URL share tidak tersebar sebagai
 * literal di layar.
 *
 * Keputusan non-obvious:
 *   - URL share memakai `https://kahade.id/…`, BUKAN skema kustom
 *     `kahade://…`. Penerima tautan sering BELUM memasang aplikasi: tautan
 *     https terbuka sebagai web app (fallback aman), sementara `kahade://`
 *     tidak membuka apa pun di perangkat tanpa aplikasi. Di perangkat yang
 *     sudah memasang aplikasi TERVERIFIKASI (App Links / Universal Links,
 *     lihat docs/DEEP-LINKING.md), tautan https yang sama langsung membuka
 *     aplikasi — jadi satu bentuk URL melayani kedua kasus.
 *   - Backend biasanya sudah mengembalikan `url` publik (https) untuk Order
 *     Link; fungsi di sini hanya FALLBACK bila field itu kosong. Pemanggil
 *     selalu `link.url ?? orderLinkUrl(token)`.
 *   - Path di bawah cermin route Expo Router (`app/order-link/[token].tsx`,
 *     `app/user/[username].tsx`) sehingga web maupun aplikasi membuka layar
 *     yang tepat tanpa tabel pemetaan tambahan.
 *   - Referral mengarah ke register dengan query `ref` yang dibaca form
 *     registrasi (bila didukung backend `ApplyReferralDto` setelah akun jadi).
 *   - Skema kustom `kahade://` tetap didukung OS-level (app.json `scheme` +
 *     intent filter) untuk tautan lama yang sudah beredar — hanya tidak lagi
 *     dipakai untuk tautan BARU.
 */

/** Host kanonis web app — tanpa `www` (lihat _redirects & associatedDomains). */
export const PUBLIC_WEB_HOST = "kahade.id"

function https(path: string): string {
  return `https://${PUBLIC_WEB_HOST}${path}`
}

/** `https://kahade.id/order-link/<token>` — fallback bila API tidak memberi `url`. */
export function orderLinkUrl(token: string): string {
  return https(`/order-link/${encodeURIComponent(token)}`)
}

/** `https://kahade.id/register?ref=<code>` — ajakan referral. */
export function referralUrl(code: string): string {
  return https(`/register?ref=${encodeURIComponent(code)}`)
}

/** `https://kahade.id/user/<username>` — profil publik. */
export function profileUrl(username: string): string {
  return https(`/user/${encodeURIComponent(username)}`)
}
