/**
 * H-08 (audit 2026-09-20): fallback web `lib/secure-storage.ts` adalah
 * KEPUTUSAN KEAMANAN — token/PIN/push/PII tidak boleh masuk localStorage,
 * sementara preferensi kecil non-rahasia (deviceId, bahasa, tema, uiPrefs)
 * boleh persist. Tanpa test, satu nama kunci yang salah pindah ke
 * WEB_PERSISTENT_KEYS lolos review dan membocorkan JWT ke storage browser.
 *
 * Environment: stub `react-native` di vitest.config.ts menetapkan
 * Platform.OS = "web", jadi jalur web yang teruji. `window.localStorage`
 * dipalsukan per-test (node environment tidak punya window).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  clearSession,
  deleteSecureItem,
  getSecureItem,
  SecureKeys,
  setSecureItem,
} from "@/lib/secure-storage"

function createFakeStorage(options: { throwOnWrite?: boolean } = {}) {
  const store = new Map<string, string>()
  return {
    store,
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      if (options.throwOnWrite) throw new Error("QuotaExceededError")
      store.set(key, value)
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key)
    }),
    clear: vi.fn(() => store.clear()),
    key: vi.fn(() => null),
    get length() {
      return store.size
    },
  }
}

type FakeStorage = ReturnType<typeof createFakeStorage>
let fake: FakeStorage

beforeEach(() => {
  fake = createFakeStorage()
  ;(globalThis as { window?: unknown }).window = { localStorage: fake }
})

afterEach(async () => {
  // Bersihkan memori modul antar test (nilai dari test lain tidak boleh bocor).
  for (const key of Object.values(SecureKeys)) await deleteSecureItem(key)
  delete (globalThis as { window?: unknown }).window
})

describe("kunci rahasia: memory-only di web", () => {
  const SECRET_KEYS = [
    SecureKeys.accessToken,
    SecureKeys.refreshToken,
    SecureKeys.pushToken,
    SecureKeys.feedbackQueue,
    SecureKeys.recentRecipients,
    SecureKeys.pendingActions,
  ] as const

  it.each(SECRET_KEYS)("%s tidak pernah menyentuh localStorage", async (key) => {
    await setSecureItem(key, "nilai-rahasia")
    expect(fake.setItem).not.toHaveBeenCalledWith(key, "nilai-rahasia")
    expect(fake.store.has(key)).toBe(false)
    // tetap terbaca dari memory selama sesi berjalan
    expect(await getSecureItem(key)).toBe("nilai-rahasia")
  })
})

describe("kunci preferensi: persist di localStorage", () => {
  const PERSISTENT_KEYS = [
    SecureKeys.deviceId,
    SecureKeys.onboardingSeen,
    SecureKeys.themePreference,
    SecureKeys.languagePreference,
    SecureKeys.uiPrefs,
  ] as const

  it.each(PERSISTENT_KEYS)("%s ditulis ke localStorage dan terbaca kembali", async (key) => {
    await setSecureItem(key, "nilai-preferensi")
    expect(fake.store.get(key)).toBe("nilai-preferensi")
    expect(await getSecureItem(key)).toBe("nilai-preferensi")
  })

  it("delete menghapus dari localStorage sekaligus memory", async () => {
    await setSecureItem(SecureKeys.uiPrefs, "{\"x\":1}")
    await deleteSecureItem(SecureKeys.uiPrefs)
    expect(fake.store.has(SecureKeys.uiPrefs)).toBe(false)
    expect(await getSecureItem(SecureKeys.uiPrefs)).toBeNull()
  })
})

describe("clearSession (logout)", () => {
  it("menghapus rahasia sesi tapi mempertahankan identitas & preferensi perangkat", async () => {
    await setSecureItem(SecureKeys.accessToken, "jwt-lama")
    await setSecureItem(SecureKeys.refreshToken, "rt-lama")
    await setSecureItem(SecureKeys.deviceId, "device-1")
    await setSecureItem(SecureKeys.languagePreference, "en")
    await setSecureItem(SecureKeys.pendingActions, "[{\"txId\":\"t1\"}]")

    await clearSession()

    expect(await getSecureItem(SecureKeys.accessToken)).toBeNull()
    expect(await getSecureItem(SecureKeys.refreshToken)).toBeNull()
    // jejak uang milik akun ikut dibersihkan (akun berikutnya tak mewarisi)
    expect(await getSecureItem(SecureKeys.pendingActions)).toBeNull()
    // preferensi perangkat bertahan: logout bukan alasan reset bahasa/deviceId
    expect(await getSecureItem(SecureKeys.deviceId)).toBe("device-1")
    expect(await getSecureItem(SecureKeys.languagePreference)).toBe("en")
  })
})

describe("localStorage tidak tersedia / menolak tulis (private browsing)", () => {
  it("set/get tetap berfungsi lewat memory tanpa melempar", async () => {
    const broken = createFakeStorage({ throwOnWrite: true })
    ;(globalThis as { window?: unknown }).window = { localStorage: broken }

    await setSecureItem(SecureKeys.uiPrefs, "nilai")
    expect(broken.store.size).toBe(0)
    expect(await getSecureItem(SecureKeys.uiPrefs)).toBe("nilai")
  })

  it("tanpa window sama sekali pun tidak melempar", async () => {
    delete (globalThis as { window?: unknown }).window
    await setSecureItem(SecureKeys.themePreference, "dark")
    expect(await getSecureItem(SecureKeys.themePreference)).toBe("dark")
  })
})
