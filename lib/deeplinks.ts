/**
 * Kahade — pembentuk URL yang DIBAGIKAN keluar aplikasi (Order Link, kode
 * referral, profil publik).
 *
 * Satu tempat untuk skema & host, supaya `kahade://…` tidak tersebar sebagai
 * literal di layar. Skema diambil dari `expo.scheme` di app.json lewat
 * expo-constants — mengganti skema cukup di satu file konfigurasi.
 *
 * Keputusan non-obvious:
 *   - Backend biasanya sudah mengembalikan `url` publik (https) untuk Order
 *     Link; fungsi di sini hanya FALLBACK bila field itu kosong. Tautan https
 *     lebih baik dibagikan (bisa dibuka penerima yang belum memasang app),
 *     jadi pemanggil selalu `link.url ?? orderLinkUrl(token)`.
 *   - Path di bawah cermin route Expo Router (`app/order-link/[token].tsx`,
 *     `app/user/[username].tsx`) sehingga `Linking` membuka layar yang tepat
 *     tanpa tabel pemetaan tambahan.
 *   - Referral belum punya layar `app/referral/[code]`; deep link mengarah ke
 *     register dengan query `ref` yang dibaca form registrasi (bila didukung
 *     backend `ApplyReferralDto` setelah akun jadi).
 */
import Constants from "expo-constants"

const FALLBACK_SCHEME = "kahade"

function appScheme(): string {
  const scheme = Constants.expoConfig?.scheme
  if (Array.isArray(scheme)) return scheme[0] ?? FALLBACK_SCHEME
  return scheme ?? FALLBACK_SCHEME
}

/** `kahade://order-link/<token>` — fallback bila API tidak memberi `url`. */
export function orderLinkUrl(token: string): string {
  return `${appScheme()}://order-link/${encodeURIComponent(token)}`
}

/** `kahade://register?ref=<code>` — ajakan referral. */
export function referralUrl(code: string): string {
  return `${appScheme()}://register?ref=${encodeURIComponent(code)}`
}

/** `kahade://user/<username>` — profil publik. */
export function profileUrl(username: string): string {
  return `${appScheme()}://user/${encodeURIComponent(username)}`
}
