/**
 * @vitest-environment jsdom
 *
 * Kahade — deep linking: logika Smart App Banner + resolusi URL → path.
 *
 * Yang diuji di sini adalah bagian yang tidak terlihat saat pengembangan
 * biasa: banner hanya boleh muncul pada kombinasi kondisi yang sempit, dan
 * salah satu arah kegagalannya (banner tidak pernah muncul) tidak
 * memunculkan error apa pun.
 */
import { afterEach, describe, expect, it } from "vitest"

import {
  BANNER_STORAGE_KEY,
  clearDismiss,
  detectMobileOS,
  DISMISS_DAYS,
  isDismissActive,
  isPlaceholderStoreUrl,
  recordDismiss,
  shouldShowBanner,
  STORE_URLS,
} from "@/lib/smart-app-banner"

const UA = {
  iphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  ipadOS:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  android:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",
  macDesktop:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  windows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
}

afterEach(() => {
  clearDismiss()
})

describe("detectMobileOS", () => {
  it("mengenali Android dan iPhone", () => {
    expect(detectMobileOS(UA.android)).toBe("android")
    expect(detectMobileOS(UA.iphone)).toBe("ios")
  })

  it("mengembalikan null untuk desktop", () => {
    expect(detectMobileOS(UA.macDesktop)).toBeNull()
    expect(detectMobileOS(UA.windows)).toBeNull()
  })

  it("mengenali iPadOS yang menyamar sebagai Macintosh lewat maxTouchPoints", () => {
    // Tanpa sinyal sentuh, iPad tidak bisa dibedakan dari Mac — dan memang
    // harus dianggap desktop supaya Mac tidak kena banner.
    expect(detectMobileOS(UA.ipadOS, 0)).toBeNull()
    expect(detectMobileOS(UA.ipadOS, 5)).toBe("ios")
  })

  it("aman terhadap UA kosong (server render)", () => {
    expect(detectMobileOS(undefined)).toBeNull()
    expect(detectMobileOS("")).toBeNull()
  })
})

describe("dismiss", () => {
  it("menyembunyikan banner selama masa tenang lalu menampilkannya lagi", () => {
    const now = Date.UTC(2026, 0, 10)
    recordDismiss(now)
    expect(isDismissActive(now)).toBe(true)
    expect(isDismissActive(now + (DISMISS_DAYS - 1) * 86_400_000)).toBe(true)
    // Tepat di batas dan sesudahnya: muncul lagi.
    expect(isDismissActive(now + DISMISS_DAYS * 86_400_000)).toBe(false)
    expect(isDismissActive(now + (DISMISS_DAYS + 1) * 86_400_000)).toBe(false)
  })

  it("tanpa catatan dismiss, banner tampil", () => {
    expect(isDismissActive()).toBe(false)
  })

  it("nilai rusak diperlakukan sebagai belum pernah ditutup", () => {
    // Gagal ke arah menampilkan banner, bukan menyembunyikannya selamanya.
    for (const bad of ["", "bukan-angka", "-1", "0", "NaN"]) {
      window.localStorage.setItem(BANNER_STORAGE_KEY, bad)
      expect(isDismissActive()).toBe(false)
    }
  })

  it("jam perangkat mundur tidak menyembunyikan banner selamanya", () => {
    const now = Date.UTC(2026, 0, 10)
    // Dismiss tercatat di masa depan (pengguna memutar jam maju lalu mundur).
    recordDismiss(now + 400 * 86_400_000)
    expect(isDismissActive(now)).toBe(false)
  })
})

describe("shouldShowBanner", () => {
  const base = { isWeb: true, os: "android" as const, standalone: false, dismissed: false }

  it("tampil untuk pengunjung web seluler yang belum menutup", () => {
    expect(shouldShowBanner(base)).toBe(true)
    expect(shouldShowBanner({ ...base, os: "ios" })).toBe(true)
  })

  it("tidak pernah tampil di native (dibuka dari dalam app)", () => {
    expect(shouldShowBanner({ ...base, isWeb: false })).toBe(false)
  })

  it("tidak tampil di desktop browser", () => {
    expect(shouldShowBanner({ ...base, os: null })).toBe(false)
  })

  it("tidak tampil bila sudah terpasang sebagai PWA", () => {
    expect(shouldShowBanner({ ...base, standalone: true })).toBe(false)
  })

  it("tidak tampil selama masa tenang", () => {
    expect(shouldShowBanner({ ...base, dismissed: true })).toBe(false)
  })
})

describe("URL store", () => {
  it("Android memakai package name yang sama dengan app.json", () => {
    expect(STORE_URLS.android).toContain("id=id.kahade")
    expect(isPlaceholderStoreUrl(STORE_URLS.android)).toBe(false)
  })

  it("iOS masih placeholder — menunggu App Store ID", () => {
    // Sengaja diuji: kalau suatu saat diisi, tes ini gagal dan memaksa
    // pembaruan dokumentasi "yang masih perlu dilengkapi".
    expect(isPlaceholderStoreUrl(STORE_URLS.ios)).toBe(true)
  })
})

/**
 * Bukti bahwa custom scheme dan App Links/Universal Links mendarat di rute
 * yang SAMA — inti dari yang seharusnya ditunjukkan `npx uri-scheme open`,
 * tetapi tanpa butuh emulator.
 *
 * Fungsi ini milik expo-router dan dipakai baik oleh `getInitialURL()`
 * (cold start) maupun `subscribe()` (warm start), jadi keduanya berbagi
 * hasil yang diuji di sini.
 *
 * Catatan tanda tangan: argumen pertama adalah `prefixes`, URL-nya kedua.
 * Memanggilnya dengan URL sebagai argumen pertama diam-diam mengembalikan
 * string kosong — mudah salah, karena itu dikunci lewat tes.
 */
describe("resolusi URL → path rute", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { extractExpoPathFromURL } = require("expo-router/build/fork/extractPathFromURL")
  const toPath = (url: string): string => "/" + extractExpoPathFromURL([], url)

  it("scheme kustom dan https menghasilkan path identik", () => {
    for (const [scheme, https, www] of [
      ["kahade://order/123", "https://kahade.id/order/123", "https://www.kahade.id/order/123"],
      ["kahade://dispute/9", "https://kahade.id/dispute/9", "https://www.kahade.id/dispute/9"],
      ["kahade://wallet", "https://kahade.id/wallet", "https://www.kahade.id/wallet"],
    ]) {
      expect(toPath(scheme)).toBe(toPath(https))
      expect(toPath(https)).toBe(toPath(www))
    }
  })

  it("memetakan setiap path deep link utama apa adanya", () => {
    const cases: Record<string, string> = {
      "https://kahade.id/order/123": "/order/123",
      "https://kahade.id/user/budi/ratings": "/user/budi/ratings",
      "https://kahade.id/profile/budi": "/profile/budi",
      "https://kahade.id/notification/5": "/notification/5",
      "https://kahade.id/notifications": "/notifications",
      "https://kahade.id/wallet-transaction/tx1": "/wallet-transaction/tx1",
      "https://kahade.id/": "/",
    }
    for (const [url, expected] of Object.entries(cases)) {
      expect(toPath(url)).toBe(expected)
    }
  })

  it("mempertahankan query string", () => {
    expect(toPath("https://kahade.id/dispute/9?tab=chat")).toBe("/dispute/9?tab=chat")
    expect(toPath("kahade://dispute/9?tab=chat")).toBe("/dispute/9?tab=chat")
  })
})
