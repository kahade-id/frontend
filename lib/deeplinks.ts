/**
 * Kahade — pembentuk URL yang DIBAGIKAN keluar aplikasi (Order Link, kode
 * referral, profil publik, voucher).
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
 *     selalu `link.url ?? orderShortUrl(token)`.
 *   - Format publik mengikuti keputusan 1 Oktober 2026 (gaya Instagram):
 *     `/<username>` → profil, `/p/<id>` → etalase/post, `/v/<code>` →
 *     voucher/promo, `/r/<code>` → undangan referral. Rute internal Expo
 *     Router tetap terpisah (`/user/…`, `/showcase/…`, …); konfigurasi
 *     host/native tidak diubah (app.json associatedDomains tetap kahade.id).
 *   - Skema kustom `kahade://` tetap didukung OS-level (app.json `scheme` +
 *     intent filter) untuk tautan lama yang sudah beredar — hanya tidak lagi
 *     dipakai untuk tautan BARU.
 */

/** Host kanonis web app — tanpa `www` (lihat _redirects & associatedDomains). */
export const PUBLIC_WEB_HOST = "kahade.id"

function https(path: string): string {
  return `https://${PUBLIC_WEB_HOST}${path}`
}

/** `https://kahade.id/order-link/<token>` — format lama, dipertahankan untuk
 * kompatibilitas tautan yang sudah beredar. Untuk tautan BARU pakai
 * `orderShortUrl()` (`https://kahade.id/o/<token>`). */
export function orderLinkUrl(token: string): string {
  return https(`/order-link/${encodeURIComponent(token)}`)
}

/** `https://kahade.id/o/<token>` — tautan order pendek untuk dibagikan
 * (3 Okt 2026). Backend tetap menerima `/order-link/<token>`; rute `/o`
 * di aplikasi mengarah ke sana. */
export function orderShortUrl(token: string): string {
  return https(`/o/${encodeURIComponent(token)}`)
}

/** `https://kahade.id/r/<code>` — undangan referral pendek (1 Oktober 2026).
 * Dibuka aplikasi → layar referral dengan kode terisi; tanpa aplikasi → web. */
export function referralUrl(code: string): string {
  return https(`/r/${encodeURIComponent(code)}`)
}

/** `https://kahade.id/v/<code>` — tautan voucher/promo untuk dibagikan. */
export function voucherUrl(code: string): string {
  return https(`/v/${encodeURIComponent(code)}`)
}

/** `https://kahade.id/<username>` — profil publik (1 Oktober 2026). */
export function profileUrl(username: string): string {
  return https(`/${encodeURIComponent(username)}`)
}

/** Canonical public item URL, safe for native and web share gestures. */
export function showcaseUrl(id: string): string {
  return https(`/p/${encodeURIComponent(id)}`)
}

/**
 * FE-IMP-4 item 26/27: URL transfer universal — `https://kahade.id/transfer?to=<username>&amount=<n>`.
 *
 * Bentuk https (bukan skema `kahade://`): pemindai tanpa aplikasi tetap
 * membuka web app sebagai fallback (prinsip file ini), sedangkan di perangkat
 * dengan aplikasi terverifikasi (App Links / Universal Links) tautan yang
 * sama langsung membuka layar Transfer. `amount` opsional — "minta nominal
 * tertentu" (item 27); layar Transfer memvalidasi ulang nominalnya.
 */
export function transferUrl(username: string, amount?: number): string {
  const params = new URLSearchParams({ to: username })
  if (amount != null && Number.isSafeInteger(amount) && amount > 0) {
    params.set("amount", String(amount))
  }
  return https(`/transfer?${params.toString()}`)
}

/**
 * Item mega-batch 122: `https://kahade.id/help/<category>?article=<slug>` —
 * tautan kanonis artikel bantuan untuk dibagikan (dibuka web app / deep link).
 */
export function helpArticleUrl(article: string, category?: string): string {
  const cat = encodeURIComponent(category ?? article)
  return https(`/help/${cat}?article=${encodeURIComponent(article)}`)
}
