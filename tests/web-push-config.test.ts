/**
 * Regresi audit Cloudflare/FCM:
 *  1. `lib/web-push-config.ts` WAJIB mengakses tiap variabel Firebase via
 *     `process.env.<NAMA>` literal — Metro hanya meng-inline akses literal ke
 *     bundle web. Akses dinamis (`process.env[name]`) membuat config selalu
 *     kosong di browser walau env terisi (pernah lolos review sekali).
 *  2. `getFirebaseWebConfig()` null bila ada variabel kosong (graceful off),
 *     lengkap bila semua terisi.
 *  3. URL share deeplink WAJIB https (fallback aman untuk penerima yang belum
 *     memasang aplikasi), bukan skema kustom.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import {
  FIREBASE_WEB_ENV_NAMES,
  getFirebaseWebConfig,
  isWebPushConfigured,
  missingFirebaseEnvNames,
} from "@/lib/web-push-config"
import { orderLinkUrl, profileUrl, referralUrl } from "@/lib/deeplinks"

const root = join(__dirname, "..")

describe("web-push-config", () => {
  it("mengakses semua env Firebase secara literal (bisa di-inline Metro)", () => {
    const src = readFileSync(join(root, "lib/web-push-config.ts"), "utf8")
    for (const name of FIREBASE_WEB_ENV_NAMES) {
      expect(src, `literal process.env.${name} hilang`).toContain(`process.env.${name}`)
    }
    // Pola dinamis yang merusak inlining tidak boleh muncul kembali.
    // Komentar dokumentasi dikecualikan (boleh menyebut pola terlarang).
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|\s)\/\/.*$/gm, "$1")
    expect(code).not.toMatch(/process\.env\[[^\]]+\]/)
    expect(code).not.toMatch(/process\.env\?\.\[/)
  })

  it("null bila env kosong (web push mati dengan anggun)", () => {
    const saved = { ...process.env }
    for (const name of FIREBASE_WEB_ENV_NAMES) delete process.env[name]
    try {
      expect(getFirebaseWebConfig()).toBeNull()
      expect(isWebPushConfigured()).toBe(false)
      expect(missingFirebaseEnvNames()).toEqual([...FIREBASE_WEB_ENV_NAMES])
    } finally {
      process.env = saved
    }
  })

  it("lengkap bila semua env terisi", () => {
    const saved = { ...process.env }
    const values: Record<string, string> = {
      EXPO_PUBLIC_FIREBASE_API_KEY: "key",
      EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: "x.firebaseapp.com",
      EXPO_PUBLIC_FIREBASE_PROJECT_ID: "kahade-fcm",
      EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: "x.appspot.com",
      EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "123",
      EXPO_PUBLIC_FIREBASE_APP_ID: "1:123:web:abc",
      EXPO_PUBLIC_FIREBASE_VAPID_KEY: "vapid",
    }
    Object.assign(process.env, values)
    try {
      expect(getFirebaseWebConfig()).toEqual({
        apiKey: "key",
        authDomain: "x.firebaseapp.com",
        projectId: "kahade-fcm",
        storageBucket: "x.appspot.com",
        messagingSenderId: "123",
        appId: "1:123:web:abc",
        vapidKey: "vapid",
      })
      expect(isWebPushConfigured()).toBe(true)
      expect(missingFirebaseEnvNames()).toEqual([])
    } finally {
      process.env = saved
    }
  })
})

describe("deeplinks share URLs", () => {
  it("memakai https kahade.id (bukan skema kustom)", () => {
    expect(orderLinkUrl("tok-123")).toBe("https://kahade.id/order-link/tok-123")
    expect(referralUrl("ABC123")).toBe("https://kahade.id/register?ref=ABC123")
    expect(profileUrl("budi")).toBe("https://kahade.id/user/budi")
  })

  it("meng-encode parameter", () => {
    expect(profileUrl("budi santoso")).toBe("https://kahade.id/user/budi%20santoso")
  })
})
