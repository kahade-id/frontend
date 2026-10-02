/**
 * Expo Router protected screens. Keep public onboarding/legal screens
 * accessible without a session.
 *
 * B-01/B-02 (audit 2026-09-20): `settings`, `receive`, `saved`,
 * `showcase-management`, `notifications`, dan alias `profile/[id]` SEBELUMNYA
 * tidak terdaftar — semuanya memanggil endpoint `auth:"required"`. Tanpa
 * entri di sini, deep link native membuka layar tanpa sesi (badai 401) dan
 * tamu web tidak pernah melihat <GuestLoginPrompt> (B-06). Alias
 * `profile/[id]` ikut dilindungi agar konsisten dengan target kanoniknya
 * `user/[username]` yang sudah protected (satu kebijakan untuk dua URL yang
 * sama maksudnya). `tests/route-protection.test.ts` membandingkan inventaris
 * rute app/ terhadap daftar ini + allowlist publik agar tidak bolong lagi.
 */

import { TAB_ROUTE_NAMES } from "@/lib/routes"

export const AUTHENTICATED_SCREENS = [
  "(tabs)",
  "(auth)/setup-profile",
  "account-type",
  "addresses",
  "analytics",
  "badges",
  "bank-accounts",
  "business-verification",
  "biometric-settings",
  "blocked-users",
  "change-email",
  "change-password",
  "change-phone",
  "change-pin",
  "chat/[roomId]",
  "chat",
  "chat/settings", // NAV-004 (2026-09-28): GET /v1/chat/privacy auth-required — deep link native tanpa sesi = 401
  "contact",
  "create-transaction",
  "delete-account",
  "delivery-proof/[orderId]",
  "discover",
  "dispute/[id]",
  "disputes",
  "edit-profile",
  "extension/[orderId]",
  "favorites",
  "followers/[username]",
  "invoice/[orderId]",
  "kyc",
  "language",
  "live-support", // NAV-005 (2026-09-28): listSupportTickets auth-required — tamu web/native tidak boleh menembak endpoint
  "milestones/[id]", // detail milestone escrow — GET ber-auth (Tim C, integrasi 2026-09-27)
  "notification/[id]",
  "notification-preferences",
  "notification-settings", // alias pengaturan notifikasi terpadu
  "notifications",
  "onboarding-checklist", // kartu progres KYC + rekening + etalase pertama (batch UI/UX 2026-09-28)
  "order/[id]",
  "order-links",
  "passkeys", // kelola passkey — endpoint auth required (Tim A, integrasi 2026-09-27)
  "privacy-settings",
  "profile/[id]",
  "questions",
  "rate/[orderId]",
  "ratings",
  "receive",
  "referral",
  "reports",
  "returns/index", // retur buyer/seller — endpoint auth required (GAP-D, integrasi 2026-09-27)
  "returns/[id]",
  "returns/new",
  "saved",
  "search",
  "security",
  "security-activity",
  "seller/products/index", // katalog seller — endpoint auth required (GAP-D, integrasi 2026-09-27)
  "seller/products/[id]",
  "seller/vouchers", // batch 43, item 9: voucher toko penjual
  "jastip/index", // batch 43, item 15: trip jastip host
  "jastip/[id]", // batch 43, item 15: detail trip jastip
  "jastip/how-it-works", // U5-014 (journey): konsisten dengan seksi jastip (butuh sesi)
  "service-bookings", // batch 43, item 12: booking jasa buyer
  "settings",
  "showcase",
  "showcase-management",
  "showcase/create",
  "social-providers", // tautan akun sosial — endpoint auth required (Tim A, integrasi 2026-09-27)
  "kahade-plus/plans",
  "kahade-plus/manage",
  "kahade-plus/theme",
  "subscriptions",
  "support/[ticketId]",
  "support",
  "topup-history",
  "topup",
  "tracking/[shipmentId]", // timeline kurir — endpoint auth required (GAP-D, integrasi 2026-09-27)
  "transaction-templates",
  "transfer",
  "trust-score",
  "two-factor",
  "user/[username]/questions",
  "user/[username]/ratings",
  // Revisi audit Etalase 2026-09-23 (I-05): galeri etalase publik per user
  // dikeluarkan dari daftar ini — halaman indeks "et al." yang bisa dibagikan
  // ("user/[username]/showcase" kini publik; profil induknya tetap protected).
  "user/[username]",
  "vouchers",
  "wallet", // NAV-006 (2026-09-28): satu kebijakan dengan 90+ layar lain — web tetap self-gate (lihat allowlist di bawah)
  "wallet-history",
  "wallet-transaction/[txId]",
  // U5-003 (journey): layar "welcome" dihapus.
  "withdraw-history",
  "withdraw",
  "withdrawal-schedules",
] as const

// ------------------------------------------------------------------
// Web guest mode — lihat app/index.tsx (web langsung ke Beranda).
// Pengunjung web boleh menelusuri layar berikut tanpa akun; layar lain
// yang termasuk AUTHENTICATED_SCREENS menampilkan ajakan login.
// ------------------------------------------------------------------

/**
 * Layar tab yang boleh ditelusuri tamu web. "notifications" DIHAPUS dari
 * daftar ini (audit B-01): layar Notifikasi menembak `auth:"required"` tanpa
 * guest-gate — tamu yang membukanya hanya memanen badai 401.
 *
 * REVISI 2026-09-23 (audit Etalase I-01): "showcase" dibuka untuk tamu.
 * Feed-nya memang publik (`GET /v1/showcase/feed` auth:"none"), rute detail
 * `/showcase/[id]` sudah lebih dulu publik (corong share/SEO), dan seluruh
 * aksi yang butuh akun di dalam tab (suka/komentar/simpan/lapor, saldo,
 * kelola, notifikasi) masing-masing digate sesi. Menutup tab ini dulu hanya
 * menutup corong penemuan pasar yang backend-nya sendiri izinkan.
 *
 * REVISI 2026-09-27 (redesign navigasi mobile): "wallet" dan "more" keluar
 * dari daftar tab (keduanya bukan lagi layar tab — dijangkau lewat drawer).
 * "chat" dan "notifications" tetap butuh login (audit chat B-01).
 */
export const WEB_GUEST_TAB_SCREENS = ["transactions", "showcase"] as const

/**
 * Path yang boleh diakses tanpa login di web. Selain layar tab di atas:
 * pencarian/penjelajahan, bantuan & legal, alur auth, dan ajakan login.
 */
export const WEB_GUEST_ALLOWED_PATHS: readonly string[] = [
  "/",
  "/home", // redirect ke /showcase (Beranda dihapus) — publik seperti tujuannya
  "/login-required",
  "/search",
  "/scan",
  "/discover",
  "/more",
  "/faq",
  "/help",
  "/about",
  "/feedback",
  // NAV-006: "/wallet" tetap boleh di-mount tamu web — wallet.tsx self-gate
  // (GuestLoginPrompt bare, query digate hasSession), jadi overlay ganda
  // dari isProtectedPath justru merusak. Entri registri di atas menutup
  // celah native (deep link tanpa sesi).
  // Mode Tanpa Wallet Internal (BI-safe): SEMUA layar dompet juga self-gate
  // kill-switch (useWalletGate → <WalletDisabledScreen/> saat flag false),
  // jadi deep link / push ke rute dompet tidak pernah membuka konten dompet.
  "/wallet",
  "/terms",
  "/privacy-policy",
  // R2 (audit ronde-2, butir #69): preview order-link publik (auth:"none")
  // adalah corong share — tamu web boleh membuka; aksi Terima/Tolak di dalam
  // tetap digerbang sesi (dialihkan ke login membawa next-path).
  "/order-link",
  // Alur auth (native-only, tapi aman bila terbuka di web)
  "/onboarding",
  "/login",
  "/register",
  "/verify-otp",
  "/forgot-password",
  "/reset-password",
  "/register-security",
  "/phone-migration",
  "/setup-profile",
  "/account-type",
  ...WEB_GUEST_TAB_SCREENS.map((name) => `/${name}`),
]

/**
 * Path alur auth PRA-SESI (dipakai SEBELUM ada `session.token`).
 *
 * AUDIT 2026-10-01 (layar blank setelah trigger WhatsApp): `emitSessionExpired`
 * menyala juga untuk pengguna yang memang belum login (refresh token tidak ada
 * → 401). Root layout lalu mengarahkan ke `/login?next=<halaman saat itu>`;
 * bila halaman itu `/verify-otp` atau `/whatsapp-trigger`, `next` tersebut
 * mengantar pengguna kembali ke layar OTP TANPA state alur setelah login —
 * layar kosong (state alur hidup di memori, tidak ikut query param).
 *
 * Karena itu path pra-sesi tidak pernah boleh menjadi tujuan `next` login.
 */
export const PRE_SESSION_AUTH_PATHS: readonly string[] = [
  "/onboarding",
  "/login",
  "/register",
  "/verify-otp",
  "/whatsapp-trigger",
  "/register-security",
  "/forgot-password",
  "/reset-password",
  "/phone-migration",
  "/verify-2fa",
  "/social-link-confirm",
]

/** True bila `pathname` adalah halaman alur auth pra-sesi (tanpa sesi). */
export function isPreSessionAuthPath(pathname: string): boolean {
  const path = pathname.split("?")[0]
  return PRE_SESSION_AUTH_PATHS.some(
    (authPath) => path === authPath || path.startsWith(`${authPath}/`),
  )
}

function routeToRegExp(name: string): RegExp {
  const pattern = name
    .replace(/^\([^)]*\)\//, "") // buang segmen grup, mis. "(auth)/"
    .replace(/\[[^\]]+\]/g, "[^/]+")
  return new RegExp(`^/${pattern}/?$`)
}

// "(tabs)" tidak punya satu path; dispesialkan di pemanggil.
const PROTECTED_PATTERNS = AUTHENTICATED_SCREENS.filter(
  (name) => !name.startsWith("("),
).map(routeToRegExp)

/**
 * Tab (tabs) yang butuh login — semua kecuali yang ada di WEB_GUEST_TAB_SCREENS.
 *
 * B-11 (audit): sebelumnya hardcode `["settings"]` yang bukan tab sama sekali
 * (Pengaturan hidup di /settings sebagai layar Stack, bukan di (tabs)). Kini
 * diturunkan dari `TAB_ROUTE_NAMES` (sumber yang sama dengan layout tab) —
 * tab baru otomatis terproteksi kecuali eksplisit dibuka untuk tamu.
 * "discover" tetap bisa diakses tamu karena WEB_GUEST_ALLOWED_PATHS diperiksa
 * lebih dulu di `isProtectedPath`.
 */
const PROTECTED_TABS = new Set<string>(
  TAB_ROUTE_NAMES.filter(
    (name) => !WEB_GUEST_TAB_SCREENS.includes(name as (typeof WEB_GUEST_TAB_SCREENS)[number]),
  ),
)

/**
 * True bila `pathname` adalah layar ber-auth untuk pengunjung web tamu.
 * Layar publik yang tidak terdaftar sama sekali (mis. legal lain) tidak
 * diblokir — pemblokiran hanya untuk route yang MEMANG terdaftar protected.
 */
export function isProtectedPath(pathname: string): boolean {
  const path = pathname.split("?")[0]

  // Eksplisit diizinkan (termasuk prefix /help/[slug]).
  if (
    WEB_GUEST_ALLOWED_PATHS.some(
      (allowed) => path === allowed || path.startsWith(`${allowed}/`),
    )
  )
    return false

  // Hanya path tab PERSIS (bukan sub-path): tab di WEB_GUEST_TAB_SCREENS
  // sudah lolos allowlist di atas; sub-path publik seperti corong share
  // "/showcase/[id]" tidak terkena pencocokan tab.
  const tabMatch = path.match(/^\/([^/?#]+)\/?$/)
  if (tabMatch && PROTECTED_TABS.has(tabMatch[1])) return true

  return PROTECTED_PATTERNS.some((re) => re.test(path))
}

// Pola guard NATIVE: seluruh AUTHENTICATED_SCREENS termasuk
// "(auth)/setup-profile" (versi web mengecualikannya dari PROTECTED_PATTERNS
// karena sudah ada di allowlist tamu). "(tabs)" ditangani terpisah lewat
// TAB_ROUTE_NAMES di bawah — grup tab ikut dicabut guard saat tidak ada sesi.
const NATIVE_GUARDED_PATTERNS = AUTHENTICATED_SCREENS.filter(
  (name) => name !== "(tabs)",
).map(routeToRegExp)

/**
 * NAV-007 (2026-09-28): true bila `pathname` disembunyikan guard sesi native
 * (`Stack.Protected` dengan guard=false mencabut layarnya dari navigator).
 *
 * Beda dengan `isProtectedPath` (semantik tamu WEB): grup "(tabs)" ikut
 * dicabut di native, jadi deep link dingin ke tab mana pun saat logout juga
 * mendarat di layar kosong — bukan cuma layar stack. Dipakai root layout
 * untuk mengalihkan ke /login dengan `next` alih-alih layar putih.
 */
export function isNativeGuardedPath(pathname: string): boolean {
  const path = pathname.split("?")[0]
  const tabMatch = path.match(/^\/([^/?#]+)\/?$/)
  if (
    tabMatch &&
    (TAB_ROUTE_NAMES as readonly string[]).includes(tabMatch[1])
  )
    return true
  return NATIVE_GUARDED_PATTERNS.some((re) => re.test(path))
}
