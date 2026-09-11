/** Expo Router protected screens. Keep public onboarding/legal screens accessible without a session. */
export const AUTHENTICATED_SCREENS = [
  "(tabs)",
  "(auth)/setup-profile",
  "account-type",
  "analytics",
  "badges",
  "bank-accounts",
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
  "order/[id]",
  "order-link/[token]",
  "order-links",
  "privacy-settings",
  "questions",
  "rate/[orderId]",
  "ratings",
  "referral",
  "reports",
  "search",
  "security",
  "security-activity",
  "showcase",
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
  "user/[username]/showcase",
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
 * Layar tab yang boleh ditelusuri tamu. Tab "settings" SENGAJA tidak masuk
 * (seluruh isinya akun).
 */
export const WEB_GUEST_TAB_SCREENS = ["home", "transactions", "wallet", "notifications"] as const

/**
 * Path yang boleh diakses tanpa login di web. Selain layar tab di atas:
 * pencarian/penjelajahan, bantuan & legal, alur auth, dan ajakan login.
 */
export const WEB_GUEST_ALLOWED_PATHS: readonly string[] = [
  "/",
  "/login-required",
  "/search",
  "/discover",
  "/faq",
  "/help",
  "/about",
  "/feedback",
  "/live-support",
  "/terms",
  "/privacy-policy",
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

/** Tab (tabs) yang butuh login — semua kecuali yang ada di WEB_GUEST_TAB_SCREENS. */
const PROTECTED_TABS = new Set(
  ["settings"].filter((name) => !WEB_GUEST_TAB_SCREENS.includes(name as never)),
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

  const tabMatch = path.match(/^\/([^/]+)/)
  if (tabMatch && PROTECTED_TABS.has(tabMatch[1])) return true

  return PROTECTED_PATTERNS.some((re) => re.test(path))
}
