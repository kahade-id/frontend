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
  "notification/[id]",
  "notification-preferences",
  "notifications",
  "order/[id]",
  "order-links",
  "privacy-settings",
  "profile/[id]",
  "questions",
  "rate/[orderId]",
  "ratings",
  "receive",
  "referral",
  "reports",
  "saved",
  "search",
  "security",
  "security-activity",
  "settings",
  "showcase",
  "showcase-management",
  "subscriptions",
  "support/[ticketId]",
  "support",
  "topup-history",
  "topup",
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
  "wallet-history",
  "wallet-transaction/[txId]",
  "welcome",
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
 */
export const WEB_GUEST_TAB_SCREENS = ["transactions", "wallet", "showcase", "more"] as const

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
  "/live-support",
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
  "/create-security",
  "/profile-data",
  "/setup-profile",
  "/account-type",
  ...WEB_GUEST_TAB_SCREENS.map((name) => `/${name}`),
]

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
