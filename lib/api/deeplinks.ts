/**
 * Kahade — domain `deeplinks` (resolusi slug/username → route app).
 * Dipakai di app/_layout.tsx saat app dibuka dari link eksternal.
 */

export type DeeplinkResolution = {
  kind: "user" | "profile" | "order-link" | "order" | "notification" | "showcase"
  id?: string
  username?: string
  orderId?: string
  notificationId?: string
  token?: string
  /** id item etalase (kind "showcase"). */
  showcaseId?: string
}

// NOTE (P3 cleanup 2026-10-06): resolve*Deeplink functions dihapus — tidak dipakai
// di mana pun (deeplink handling kini via expo-router + lib/deeplinks.ts).
