/**
 * Test lapisan i18n murni (Node, tanpa React Native runtime).
 *
 * Yang dijaga di sini adalah keputusan yang TIDAK terlihat di screenshot tapi
 * merusak kapan-kapan:
 *   - bentuk kunci `{x}` harus dihasilkan sama oleh codegen dan runtime, kalau
 *     tidak, teks berisi nominal tidak pernah diterjemahkan (dan tidak ada yang
 *     sadar sampai user melapor);
 *   - kamus tidak boleh berisi kunci yang sudah mati (copy Indonesia berubah di
 *     kode → entri diam-diam tidak pernah dipakai);
 *   - cakupan tidak boleh turun diam-diam (ratchet);
 *   - `translate` tidak boleh pernah menghasilkan string kosong.
 *
 * Render <Text> TIDAK diuji di sini — vitest config ini `environment: "node"`,
 * tidak ada RN runtime. Titik render diverifikasi lewat build web + manual.
 */
import { readFileSync, readdirSync } from "node:fs"
import { describe, expect, it } from "vitest"

import catalogJson from "@/lib/i18n/catalog.json"
import { EN } from "@/lib/i18n/en"
import { EN_DIR } from "./i18n-helpers"
import {
  LANGUAGES,
  SOURCE_LANGUAGE,
  isLanguageCode,
  languageLabel,
  toLanguageCode,
} from "@/lib/i18n/languages"
import { resolveSystemLanguage } from "@/lib/i18n/system-language"
import { SHAPE_TOKEN, SLOT_TOKEN, fillTokens, interpolate, maskNumbers, shapeOf } from "@/lib/i18n/shape"
import {
  adoptAccountLanguage,
  applyLanguage,
  getLanguage,
  persistLanguage,
  readCachedLanguage,
} from "@/lib/i18n/store"
import { clearTranslationCache, translate } from "@/lib/i18n/translate"

describe("daftar bahasa", () => {
  it("hanya 'id' dan 'en' — sama dengan enum backend UpdateLanguageDto", () => {
    expect(LANGUAGES.map((l) => l.code)).toEqual(["id", "en"])
    expect(isLanguageCode("en")).toBe(true)
    expect(isLanguageCode("ms")).toBe(false)
  })

  it("menulis nama bahasa dalam bahasanya sendiri (endonim)", () => {
    expect(languageLabel("id")).toBe("Bahasa Indonesia")
    expect(languageLabel("en")).toBe("English")
  })

  it("memetakan kode BCP-47 OS ke bahasa yang didukung, sisanya null", () => {
    expect(toLanguageCode("en-US")).toBe("en")
    expect(toLanguageCode("id")).toBe("id")
    expect(toLanguageCode("ID-ID")).toBe("id")
    expect(toLanguageCode("jv")).toBeNull()
    expect(toLanguageCode(undefined)).toBeNull()
  })

  it("setiap bahasa punya entri kamus atau menjadi bahasa sumber", () => {
    for (const l of LANGUAGES) {
      if (l.code === SOURCE_LANGUAGE) continue
      expect(Object.keys(EN).length).toBeGreaterThan(0)
    }
  })
})

describe("bentuk string ({x})", () => {
  it("memaski pemisah ribuan dan nilai lepas sebagai SATU token", () => {
    expect(maskNumbers("Saldo Rp1.250.000 keluar")).toEqual({
      shape: `Saldo ${SHAPE_TOKEN} keluar`,
      values: ["Rp1.250.000"],
    })
    expect(maskNumbers("3 item dipilih").shape).toBe(`${SHAPE_TOKEN} item dipilih`)
    expect(maskNumbers("Diskon 25%").shape).toBe(`Diskon ${SHAPE_TOKEN}`)
  })

  it("menggabungkan spasi/newline JSX agar kunci sumber = kunci runtime", () => {
    expect(shapeOf("Baris satu\n   baris dua").shape).toBe("Baris satu baris dua")
  })

  it("mengubah SLOT codegen (${expr}) menjadi token yang sama", () => {
    expect(shapeOf(`Gagal membuka ${SLOT_TOKEN}`).shape).toBe(`Gagal membuka ${SHAPE_TOKEN}`)
  })

  it("mengisi kembali nilai sesuai urutan", () => {
    const { shape, values } = shapeOf("2 dari 9")
    expect(shape).toBe(`${SHAPE_TOKEN} dari ${SHAPE_TOKEN}`)
    expect(fillTokens(`${SHAPE_TOKEN} dari ${SHAPE_TOKEN}`, values)).toBe("2 dari 9")
  })

  it("interpolasi bernama dan posisional; token tak dikenal dibiarkan", () => {
    expect(interpolate("Halo {name}", { name: "Budi" })).toBe("Halo Budi")
    expect(interpolate("{0} dan {1}", ["a", "b"])).toBe("a dan b")
    expect(interpolate("Halo {name}", {})).toBe("Halo {name}")
  })
})

describe("bahasa awal dari OS", () => {
  it("locale Indonesia → Indonesia", () => {
    expect(resolveSystemLanguage([{ languageCode: "id", regionCode: "ID" }])).toBe("id")
  })

  it("locale non-Indonesia → English (satu-satunya kamus yang ada)", () => {
    expect(resolveSystemLanguage([{ languageCode: "en-GB" }])).toBe("en")
    expect(resolveSystemLanguage([{ languageCode: "ar", regionCode: "AE" }])).toBe("en")
  })

  it("bahasa daerah di perangkat Indonesia tetap Indonesia", () => {
    expect(resolveSystemLanguage([{ languageCode: "jv", regionCode: "ID" }])).toBe("id")
  })

  it("daftar kosong tidak melempar", () => {
    expect(resolveSystemLanguage([])).toBe("en")
  })
})

describe("store bahasa", () => {
  it("menolak kode yang tidak didukung tanpa mengubah state", () => {
    const before = getLanguage()
    expect(applyLanguage("de" as never)).toBe(false)
    expect(getLanguage()).toBe(before)
  })

  it("cache perangkat menyimpan pilihan user dan terbaca kembali", async () => {
    await persistLanguage("en")
    expect(await readCachedLanguage()).toBe("en")
    await persistLanguage("id")
    expect(await readCachedLanguage()).toBe("id")
  })

  it("preferensi akun: nilai valid diterapkan, nilai sampah diabaikan", async () => {
    expect(await adoptAccountLanguage("en")).toBe(true)
    expect(getLanguage()).toBe("en")
    expect(await adoptAccountLanguage("fr")).toBe(false)
    expect(getLanguage()).toBe("en")
    expect(await adoptAccountLanguage(undefined)).toBe(false)
    await adoptAccountLanguage(SOURCE_LANGUAGE)
  })
})

describe("translate()", () => {
  it("di bahasa sumber tidak menyentuh kamus sama sekali", () => {
    applyLanguage("id")
    clearTranslationCache()
    expect(translate("Batal")).toBe("Batal")
  })

  it("mencocoki kunci persis di English", () => {
    applyLanguage("en")
    clearTranslationCache()
    expect(translate("Batal")).toBe("Cancel")
    applyLanguage("id")
    clearTranslationCache()
    expect(translate("Batal")).toBe("Batal")
  })

  it("mencocoki BENTUK untuk teks berisi angka, lalu menyisipkan nilainya", () => {
    applyLanguage("en")
    clearTranslationCache()
    expect(translate("3 ulasan")).toBe("3 reviews")
    expect(translate("12 dari 40")).toBe("12 of 40")
  })

  it("tidak pernah mengembalikan string kosong untuk sumber terisi", () => {
    applyLanguage("en")
    clearTranslationCache()
    const out = translate("Kalimat acak yang belum ada di kamus sama sekali")
    expect(out).toBe("Kalimat acak yang belum ada di kamus sama sekali")
  })

  it("melewati angka, boolean, dan nilai kosong apa adanya", () => {
    applyLanguage("en")
    expect(translate(1234)).toBe("1234")
    expect(translate(undefined)).toBe("")
    expect(translate(null)).toBe("")
  })
})

describe("kamus English vs katalog", () => {
  const catalogKeys = new Set(catalogJson.strings.map((s) => s.s))
  const files = readdirSync(EN_DIR).filter((f) => f.endsWith(".json")).sort()
  const all = new Map<string, string>()

  it("terdiri dari beberapa file per area (bukan satu file raksasa)", () => {
    expect(files.length).toBeGreaterThanOrEqual(4)
  })

  for (const file of files) {
    it(`${file}: kunci ada di katalog, token seimbang, nilai terisi`, () => {
      const raw = readFileSync(`${EN_DIR}/${file}`, "utf8")
      const dict = JSON.parse(raw) as Record<string, string>
      const keys = Object.keys(dict)
      expect(keys.length).toBeGreaterThan(0)
      for (const key of keys) {
        expect(catalogKeys.has(key), `${file}: kunci mati — "${key}" tidak ada di katalog`).toBe(true)
        const value = dict[key]
        expect(typeof value).toBe("string")
        expect(value.trim().length).toBeGreaterThan(0)
        expect((key.match(/\{x\}/g) ?? []).length).toBe((value.match(/\{x\}/g) ?? []).length)
        expect(value).not.toMatch(/[\n\r]/)
        expect(all.has(key), `kunci dobel lintas file: "${key}"`).toBe(false)
        all.set(key, file)
      }
    })
  }

  it("EN yang diimport app = gabungan file yang sama", () => {
    expect(Object.keys(EN).length).toBe(all.size)
  })

  it("cakupan tidak turun dari angka yang sudah dicapai (ratchet)", async () => {
    const floor = JSON.parse(readFileSync("lib/i18n/coverage.json", "utf8")) as { translated: number }
    expect(all.size).toBeGreaterThanOrEqual(floor.translated)
  })

  it("EN tidak berisi kunci yang tidak dipakai app", () => {
    for (const key of Object.keys(EN)) expect(catalogKeys.has(key), `kunci mati: ${key}`).toBe(true)
  })
})
