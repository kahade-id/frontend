/**
 * Preferensi notifikasi granular LOKAL (klaster Notifikasi, batch 2).
 *
 * Kontrak:
 *  - `localKindForPushData` memetakan payload push backend ke jenis toggle;
 *    tipe tak dikenal → null (fail-open: banner tetap tampil).
 *  - Toggle persisten di SecureStore (`kahade.notifications.localPrefs`);
 *    bawaan semua aktif (perilaku lama tidak berubah).
 *  - Ini preferensi PERANGKAT — tidak menyentuh API/kontrak backend.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

type Mod = typeof import("@/lib/notification-local-prefs")

function createFakeStorage() {
  const store = new Map<string, string>()
  return {
    store,
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => store.clear(),
    key: () => null,
    get length() {
      return store.size
    },
  }
}

async function freshModule(): Promise<Mod> {
  vi.resetModules()
  return import("@/lib/notification-local-prefs")
}

beforeEach(() => {
  ;(globalThis as { window?: unknown }).window = { localStorage: createFakeStorage() }
})

afterEach(() => {
  delete (globalThis as { window?: unknown }).window
  vi.resetModules()
})

describe("localKindForPushData", () => {
  it("chat: enum kanonis, alias push, dan actionUrl", async () => {
    const { localKindForPushData } = await freshModule()
    expect(localKindForPushData({ notificationType: "CHAT_NEW_MESSAGE", roomId: "r1" })).toBe("chat")
    expect(localKindForPushData({ type: "CHAT_NEW", roomId: "r1" })).toBe("chat")
    expect(localKindForPushData({ actionUrl: "/chat/r1" })).toBe("chat")
  })

  it("transaksi: order, wallet, dispute, milestone, rating", async () => {
    const { localKindForPushData } = await freshModule()
    expect(localKindForPushData({ notificationType: "ORDER_PAYMENT_RECEIVED" })).toBe("transaction")
    expect(localKindForPushData({ notificationType: "WALLET_TOPUP_SUCCESS" })).toBe("transaction")
    expect(localKindForPushData({ notificationType: "DISPUTE_DECISION" })).toBe("transaction")
    expect(localKindForPushData({ notificationType: "MILESTONE_RELEASED" })).toBe("transaction")
    expect(localKindForPushData({ notificationType: "RATING_NEW" })).toBe("transaction")
    expect(localKindForPushData({ actionUrl: "/order/o1" })).toBe("transaction")
    expect(localKindForPushData({ actionUrl: "/wallet/transaction?id=t1" })).toBe("transaction")
  })

  it("etalase & promo", async () => {
    const { localKindForPushData } = await freshModule()
    expect(localKindForPushData({ notificationType: "SHOWCASE_LIKED", referenceId: "s1" })).toBe(
      "showcase",
    )
    expect(localKindForPushData({ actionUrl: "/showcase/s1" })).toBe("showcase")
    expect(localKindForPushData({ notificationType: "VOUCHER_ISSUED" })).toBe("promo")
    expect(localKindForPushData({ notificationType: "CAMPAIGN_CASHBACK_CREDITED" })).toBe("promo")
    expect(localKindForPushData({ notificationType: "TOPUP_BONUS_CREDITED" })).toBe("promo")
  })

  it("fail-open: keamanan/sistem/tak dikenal → null (banner tetap tampil)", async () => {
    const { localKindForPushData } = await freshModule()
    expect(localKindForPushData({ notificationType: "SECURITY_NEW_LOGIN" })).toBeNull()
    expect(localKindForPushData({ notificationType: "KYC_APPROVED" })).toBeNull()
    expect(localKindForPushData({ notificationType: "SYSTEM_MAINTENANCE" })).toBeNull()
    expect(localKindForPushData({ notificationType: "SOME_FUTURE_TYPE" })).toBeNull()
    expect(localKindForPushData({})).toBeNull()
    expect(localKindForPushData(null)).toBeNull()
    expect(localKindForPushData("string")).toBeNull()
  })
})

describe("parseLocalNotificationPrefs", () => {
  it("nilai rusak/asing jatuh ke bawaan (semua aktif)", async () => {
    const { parseLocalNotificationPrefs } = await freshModule()
    expect(parseLocalNotificationPrefs(null)).toEqual({
      chat: true,
      transaction: true,
      showcase: true,
      promo: true,
    })
    expect(parseLocalNotificationPrefs("bogus")).toEqual({
      chat: true,
      transaction: true,
      showcase: true,
      promo: true,
    })
    // Kunci asing diabaikan, boolean valid dipertahankan.
    expect(parseLocalNotificationPrefs({ chat: false, bogus: true, promo: "yes" })).toEqual({
      chat: false,
      transaction: true,
      showcase: true,
      promo: true,
    })
  })
})

describe("persistensi toggle", () => {
  it("bawaan semua aktif; perubahan tersimpan dan terbaca ulang", async () => {
    const mod = await freshModule()
    expect(await mod.ensureLocalNotificationPrefs()).toEqual({
      chat: true,
      transaction: true,
      showcase: true,
      promo: true,
    })

    mod.setLocalNotificationPref("chat", false)
    mod.setLocalNotificationPref("promo", false)
    expect(mod.getLocalNotificationPrefsSnapshot()).toEqual({
      chat: false,
      transaction: true,
      showcase: true,
      promo: false,
    })

    // Proses baru (modul di-reset) membaca dari storage.
    const mod2 = await freshModule()
    expect(await mod2.ensureLocalNotificationPrefs()).toEqual({
      chat: false,
      transaction: true,
      showcase: true,
      promo: false,
    })
  })

  it("menulis JSON valid ke kunci kahade.notifications.localPrefs", async () => {
    const mod = await freshModule()
    await mod.ensureLocalNotificationPrefs()
    mod.setLocalNotificationPref("showcase", false)
    const { getSecureItem, SecureKeys } = await import("@/lib/secure-storage")
    const raw = await getSecureItem(SecureKeys.notificationLocalPrefs)
    expect(JSON.parse(raw ?? "{}")).toMatchObject({ showcase: false })
  })
})

// Audit Notifikasi 2026-10-10 (FE-38): keluarga yang dulu jatuh ke null.
describe("localKindForPushData — FE-38", () => {
  it("ESCROW_HELD_NO_BANK → transaction (soal dana, sejajar WALLET_*)", async () => {
    const { localKindForPushData } = await freshModule()
    expect(localKindForPushData({ notificationType: "ESCROW_HELD_NO_BANK" })).toBe("transaction")
  })

  it("BADGE_AWARDED / RANK_UPGRADED → promo (kategori PROMOSI backend)", async () => {
    const { localKindForPushData } = await freshModule()
    expect(localKindForPushData({ notificationType: "BADGE_AWARDED" })).toBe("promo")
    expect(localKindForPushData({ type: "RANK_UPGRADED" })).toBe("promo")
  })

  it("keamanan tetap null (selalu tampil, tidak bisa di-toggle)", async () => {
    const { localKindForPushData } = await freshModule()
    expect(localKindForPushData({ notificationType: "SECURITY_NEW_LOGIN" })).toBeNull()
  })
})
