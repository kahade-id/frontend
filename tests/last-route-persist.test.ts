/**
 * Temuan #15 — rute terakhir HARUS tersimpan walau app ditutup mendadak.
 *
 * Inti bug: penulisan rute dulu di-debounce 500ms. `SecureStore.setItemAsync`
 * itu ASINKRON, jadi flush yang dijalankan saat `AppState` berubah tetap bisa
 * keburu mati bersama prosesnya — apalagi saat pengguna menutup app dari app
 * switcher. Hasilnya: boot berikutnya lupa halaman terakhir dan jatuh ke
 * Etalase (`ROUTES.home`), persis keluhan "harus kill aplikasi berulang kali".
 *
 * Perbaikan: tulis SEGERA setiap kali pathname berubah, digabung lewat
 * dedupe (bukan timer). Test di bawah mengunci dua-duanya: tanpa timer, dan
 * tanpa menulis ulang nilai yang sama.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const setSecureItem = vi.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined)
const deleteSecureItem = vi.fn<(...args: unknown[]) => Promise<void>>().mockResolvedValue(undefined)
const getSecureItem = vi.fn<(...args: unknown[]) => Promise<string | null>>().mockResolvedValue(null)

// Platform.OS = "ios": stub bawaan node men-set "web", dan di web
// `saveLastNativeRouteDebounced` memang sengaja tidak melakukan apa-apa.
vi.mock("react-native", () => ({
  Platform: { OS: "ios", select: <T,>(o: { default?: T }) => o.default },
}))
vi.mock("@/lib/secure-storage", () => ({
  SecureKeys: { lastNativeRoute: "kahade.navigation.lastNativeRoute" },
  getSecureItem: (...args: unknown[]) => getSecureItem(...args),
  setSecureItem: (...args: unknown[]) => setSecureItem(...args),
  deleteSecureItem: (...args: unknown[]) => deleteSecureItem(...args),
}))
vi.mock("@/lib/api/session", () => ({ getSessionRevision: () => 0 }))

const { saveLastNativeRouteDebounced, flushLastNativeRouteSave, __resetLastRouteDedupe } =
  await import("@/lib/last-route")

/** Kuras antrean mikrotask (`saveQueue` di dalam modul bersifat rantai janji). */
const drain = () => new Promise((resolve) => setTimeout(resolve, 0))

beforeEach(() => {
  setSecureItem.mockClear()
  getSecureItem.mockClear()
  __resetLastRouteDedupe()
})

describe("penulisan rute terakhir", () => {
  it("MENULIS SEGERA — 0ms setelah pathname berubah, tanpa menunggu debounce", async () => {
    vi.useFakeTimers()
    try {
      saveLastNativeRouteDebounced("/chat/room-123")
      // Maju 0ms sambil menuntaskan mikrotask. Kalau penulisan masih
      // di-debounce, jendelanya 500ms dan hitungan di bawah pasti nol.
      await vi.advanceTimersByTimeAsync(0)
      expect(setSecureItem).toHaveBeenCalledTimes(1)
      expect(setSecureItem).toHaveBeenCalledWith(
        "kahade.navigation.lastNativeRoute",
        "/chat/room-123",
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it("render ulang dengan path SAMA tidak menulis ulang (dedupe, bukan timer)", async () => {
    saveLastNativeRouteDebounced("/transactions")
    await drain()
    saveLastNativeRouteDebounced("/transactions")
    saveLastNativeRouteDebounced("/transactions")
    await drain()
    expect(setSecureItem).toHaveBeenCalledTimes(1)
  })

  it("berpindah halaman menulis tiap rute baru (yang terakhir yang menang)", async () => {
    saveLastNativeRouteDebounced("/showcase")
    saveLastNativeRouteDebounced("/chat")
    saveLastNativeRouteDebounced("/chat/room-123")
    await drain()
    const paths = setSecureItem.mock.calls.map((call) => call[1])
    expect(paths).toEqual(["/showcase", "/chat", "/chat/room-123"])
  })

  it("flush saat background mengirim ULANG rute terakhir (jaring pengaman)", async () => {
    saveLastNativeRouteDebounced("/order/abc")
    await drain()
    setSecureItem.mockClear()
    flushLastNativeRouteSave()
    await drain()
    expect(setSecureItem).toHaveBeenCalledWith("kahade.navigation.lastNativeRoute", "/order/abc")
  })

  it("rute yang tidak aman tidak pernah ditulis", async () => {
    for (const path of ["/", "/home", "/login-required", "/prepare-navigation"]) {
      __resetLastRouteDedupe()
      saveLastNativeRouteDebounced(path)
    }
    await drain()
    expect(setSecureItem).not.toHaveBeenCalled()
  })
})
