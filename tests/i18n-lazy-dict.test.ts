/**
 * FE-072: kamus English dimuat LAZY, bukan static-import di graph boot.
 *
 * Yang dijaga:
 *   1. Mengimpor `translate`/`store` SAJA tidak mendaftarkan kamus EN
 *      (graph boot bebas ±256KB).
 *   2. `ensureDictionary("en")` memuat kamus via dynamic import; setelah itu
 *      `translate` mengembalikan terjemahan English.
 *   3. Side-effect `en/index.ts`: siapa pun yang mengimpor `./en` langsung
 *      (test lama) tetap mendapat kamus terdaftar secara sinkron.
 *
 * File ini SENGAJA tidak mengimpor `@/lib/i18n/en` secara statis — impor
 * dinamis di test (3) memakai `await import()` agar urutan terkontrol.
 */
import { describe, expect, it } from "vitest"

import { ensureDictionary, getDictionary, registerDictionary } from "@/lib/i18n/dictionaries"
import { applyLanguage, getLanguage } from "@/lib/i18n/store"
import { translate } from "@/lib/i18n/translate"

describe("FE-072 kamus English lazy", () => {
  it("registry kosong saat hanya translate/store yang diimpor (boot bebas EN)", () => {
    expect(getDictionary("en")).toBeUndefined()
  })

  it("translate jatuh ke teks sumber bila kamus EN belum dimuat", () => {
    expect(applyLanguage("en")).toBe(true)
    expect(getLanguage()).toBe("en")
    // "Batal" -> "Cancel" ada di kamus, tapi kamus belum dimuat.
    expect(translate("Batal")).toBe("Batal")
    applyLanguage("id")
  })

  it("ensureDictionary memuat kamus; translate lalu mengembalikan English", async () => {
    applyLanguage("en")
    await ensureDictionary("en")
    const dict = getDictionary("en")
    expect(dict).toBeDefined()
    expect(Object.keys(dict!).length).toBeGreaterThan(1000)
    expect(translate("Batal")).toBe("Cancel")
    expect(translate("Tutup")).toBe("Close")
    applyLanguage("id")
    // Bahasa sumber tidak butuh kamus — selalu lolos apa adanya.
    expect(translate("Batal")).toBe("Batal")
  })

  it("ensureDictionary idempotent (tidak import ulang)", async () => {
    const first = getDictionary("en")
    await ensureDictionary("en")
    expect(getDictionary("en")).toBe(first)
  })

  it("side-effect: import ./en langsung mendaftarkan kamus secara sinkron", async () => {
    const mod = await import("@/lib/i18n/en")
    expect(mod.EN).toBeDefined()
    expect(getDictionary("en")).toBe(mod.EN)
  })

  it("registerDictionary menimpa secara eksplisit (kontrak registry)", () => {
    const custom = { Halo: "Hi" }
    registerDictionary("en", custom)
    expect(getDictionary("en")).toBe(custom)
  })
})
