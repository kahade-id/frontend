// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest"
vi.mock("react-native", () => ({ Platform: { OS: "web" } }))
vi.mock("expo-secure-store", () => ({ WHEN_UNLOCKED_THIS_DEVICE_ONLY: "device-only" }))
let storage: typeof import("@/lib/secure-storage")
beforeEach(async () => {
  vi.resetModules()
  localStorage.clear()
  storage = await import("@/lib/secure-storage")
})
it("web secrets remain memory-only", async () => {
  for (const key of [
    storage.SecureKeys.accessToken,
    storage.SecureKeys.refreshToken,
    storage.SecureKeys.pinHash,
    storage.SecureKeys.biometricEnabled,
    storage.SecureKeys.pushToken,
  ]) {
    await storage.setSecureItem(key, "private")
    expect(await storage.getSecureItem(key)).toBe("private")
    expect(localStorage.getItem(key)).toBeNull()
  }
})
it("onboarding, theme, device and explicit logout survive browser reload", async () => {
  for (const key of [
    storage.SecureKeys.onboardingSeen,
    storage.SecureKeys.themePreference,
    storage.SecureKeys.deviceId,
    storage.SecureKeys.sessionSignedOut,
  ]) {
    await storage.setSecureItem(key, "value")
    expect(localStorage.getItem(key)).toBe("value")
  }
})
it("clearing a session does not clear device preferences", async () => {
  await storage.setSecureItem(storage.SecureKeys.accessToken, "secret")
  await storage.setSecureItem(storage.SecureKeys.themePreference, "dark")
  await storage.clearSession()
  expect(await storage.getSecureItem(storage.SecureKeys.accessToken)).toBeNull()
  expect(await storage.getSecureItem(storage.SecureKeys.themePreference)).toBe("dark")
})
