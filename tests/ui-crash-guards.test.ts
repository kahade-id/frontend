/**
 * Kahade — regresi untuk jalur render yang bisa melempar.
 *
 * Berkas ini mengunci dua kelas bug yang tidak terlihat di typecheck:
 *
 *  1. Peta label status/copy DIINDEKS dengan nilai dari backend. Operator `in`
 *     menelusuri rantai prototipe, jadi `"toString" in LABELS` bernilai true.
 *     Cabang "dikenal" lalu diambil dan `LABELS["toString"]` (sebuah fungsi)
 *     dijadikan anak <Badge>/<Text> → React melempar "Functions are not valid
 *     as a React child" → seluruh layar jatuh ke error boundary.
 *
 *  2. Helper format menerima field yang tipenya hanya DI-CAST dari JSON, bukan
 *     divalidasi. `undefined.replace(...)` melempar TypeError saat render.
 *
 * Uji-uji di bawah sengaja berada di level fungsi murni: komponennya sendiri
 * perlu native/phosphor yang tidak tersedia di jsdom tanpa mock besar.
 */
import { describe, expect, it } from "vitest"

import { hasOwn, mapValue } from "@/lib/has-own"
import { fileExtension, isImageMime, isPdfMime } from "@/lib/mime"
import { isOrderLinkStatus, orderLinkStatusMeta } from "@/lib/order-link-labels"
import {
  amountInputValue,
  formatPhoneId,
  groupAccountNumber,
  initials,
  maskAccountNumber,
  parseRupiah,
  groupThousands,
  truncateMiddle,
} from "@/lib/format"

/** Kunci yang dimiliki SEMUA objek literal lewat Object.prototype. */
const INHERITED_KEYS = ["toString", "constructor", "valueOf", "hasOwnProperty", "__proto__"]

describe("status maps reject inherited keys", () => {
  it.each(INHERITED_KEYS)("%s is not a known order-link status", (key) => {
    expect(hasOwn({}, key)).toBe(false)
    expect(isOrderLinkStatus(key)).toBe(false)
    // Tidak boleh mengembalikan fungsi: nilai itu akan dirender sebagai anak.
    const meta = orderLinkStatusMeta(key)
    expect(meta.label).toBe(key)
    expect(typeof meta.label).toBe("string")
    expect(meta.tone).toBe("neutral")
  })

  it("still recognises the documented statuses", () => {
    expect(isOrderLinkStatus("ACTIVE")).toBe(true)
    expect(orderLinkStatusMeta("EXPIRED")).toEqual({ label: "Kedaluwarsa", tone: "danger" })
  })
})

/**
 * `MAP[key] ?? fallback` TIDAK aman untuk `key` dari data eksternal: `??`
 * hanya aktif pada nullish, sedangkan `MAP["toString"]` mengembalikan sebuah
 * FUNGSI. Fungsi itu bukan nullish, lolos dari `??`, lalu dirender sebagai
 * anak <Badge>/<Text> -> "Functions are not valid as a React child".
 */
describe("mapValue closes the `?? fallback` hole", () => {
  const LABELS: Record<string, string> = { PAID: "Dibayar", FAILED: "Gagal" }

  it.each(INHERITED_KEYS)("%s falls back instead of returning a function", (key) => {
    // Bukti bahayanya dulu: nilai warisan ini BUKAN nullish, jadi `??` —
    // yang dipakai kode sebelumnya — tidak aktif dan nilainya lolos ke JSX.
    const leaked = (LABELS as unknown as Record<string, unknown>)[key]
    expect(leaked).not.toBeUndefined()
    expect(leaked).not.toBeNull()
    expect(["function", "object"]).toContain(typeof leaked)

    // `mapValue` justru mengembalikan fallback, dan tipenya SELALU string
    // (bukan fungsi/objek yang ditolak React sebagai anak).
    expect(mapValue(LABELS, key, "Status tidak diketahui")).toBe("Status tidak diketahui")
  })

  it("never returns a function for any string a backend could send", () => {
    for (const key of ["toString", "valueOf", "constructor", "__proto__", "PAID", "nonsense"]) {
      expect(typeof mapValue(LABELS, key, "-")).toBe("string")
    }
  })

  it("resolves the keys the map actually owns", () => {
    expect(mapValue(LABELS, "PAID", "-")).toBe("Dibayar")
    expect(mapValue(LABELS, "FAILED", "-")).toBe("Gagal")
  })

  it("handles a missing key and a Partial map", () => {
    expect(mapValue(LABELS, undefined, "-")).toBe("-")
    expect(mapValue(LABELS, null, "-")).toBe("-")
    const partial: Partial<Record<string, string>> = { A: "a", B: undefined }
    // Nilai `undefined` yang memang tersimpan juga jatuh ke fallback,
    // karena peta Partial bisa berisi kunci tanpa nilai.
    expect(mapValue(partial, "B", "-")).toBe("-")
    expect(mapValue(partial, "A", "-")).toBe("a")
  })
})

describe("format helpers survive unvalidated payloads", () => {
  it.each([undefined, null, 123, {}])("maskAccountNumber(%s) does not throw", (value) => {
    expect(() => maskAccountNumber(value as unknown as string)).not.toThrow()
  })

  it.each([undefined, null, 123])("groupAccountNumber(%s) does not throw", (value) => {
    expect(() => groupAccountNumber(value as unknown as string)).not.toThrow()
  })

  it.each([undefined, null])("formatPhoneId(%s) does not throw", (value) => {
    expect(formatPhoneId(value as unknown as string)).toBe("")
  })

  it.each([undefined, null])("initials(%s) does not throw", (value) => {
    expect(initials(value as unknown as string)).toBe("")
  })

  it.each([undefined, null])("truncateMiddle(%s) does not throw", (value) => {
    expect(() => truncateMiddle(value as unknown as string)).not.toThrow()
  })

  it("still masks a real account number", () => {
    // 6 digit tersamar + 4 digit terakhir, dikelompokkan per 4.
    expect(maskAccountNumber("1234567890")).toBe("\u2022\u2022\u2022\u2022 \u2022\u202278 90")
  })
})

/**
 * <AmountInput> adalah field controlled: ia merender ulang setiap ketikan
 * sebagai string ber-grup, sehingga `onChangeText` berikutnya menerima
 * pengelompokan yang BELUM SELESAI. Parser yang ketat menolak keduanya sebagai
 * NaN dan field mengosongkan diri — sekali backspace pada "Rp1.000" menghapus
 * seluruh nominal.
 */
describe("amount input keeps digits while the grouping is half-finished", () => {
  it("accepts a complete grouped value", () => {
    expect(amountInputValue("1.000")).toBe(1000)
    expect(amountInputValue("Rp 10.000.000")).toBe(10_000_000)
  })

  it("does not wipe the field mid-edit", () => {
    // "1.000" lalu mengetik "0" -> 10.000 (bukan NaN / field kosong)
    expect(amountInputValue("1.0000")).toBe(10_000)
    // backspace pada "1.000" -> 100 (bukan NaN / field kosong)
    expect(amountInputValue("1.00")).toBe(100)
    expect(amountInputValue("1.")).toBe(1)
    expect(amountInputValue("")).toBe(0)
  })

  it("still refuses to invent an amount", () => {
    // Pemisah desimal: nominal tidak bisa direpresentasikan → abaikan ketikan.
    expect(amountInputValue("10.000,50")).toBeNull()
    expect(amountInputValue("10000.50")).toBeNull()
    expect(amountInputValue("1e6")).toBeNull()
    expect(amountInputValue("USD10000")).toBeNull()
    expect(amountInputValue("+10000")).toBeNull()
    // Overflow: lebih dari 15 digit bukan nominal Rupiah.
    expect(amountInputValue("999999999999999999")).toBeNull()
  })

  it("never returns NaN into form state", () => {
    for (const raw of ["1.00", "1.0000", "abc", "", "-5", "1.2.3"]) {
      const next = amountInputValue(raw)
      if (next !== null) expect(Number.isFinite(next)).toBe(true)
    }
  })

  it("keeps the strict parser intact for pasted values", () => {
    // `parseRupiah` sengaja tetap ketat — pemanggil lain bergantung padanya.
    expect(Number.isNaN(parseRupiah("1..000"))).toBe(true)
    expect(Number.isNaN(parseRupiah("-Rp100.000"))).toBe(true)
  })

  /**
   * Menjalankan field persis seperti React melakukannya: `onChangeText`
   * menerima teks yang SEDANG DITAMPILKAN sudah dimodifikasi satu karakter,
   * lalu field dirender ulang dari nilai baru.
   */
  it("survives a full type → append → backspace sequence", () => {
    let value = 0
    const shown = () => (value > 0 ? groupThousands(value) : "")
    const edit = (raw: string) => {
      const next = amountInputValue(raw)
      if (next !== null) value = next
    }
    const type = (char: string) => edit(shown() + char)
    const backspace = () => edit(shown().slice(0, -1))

    for (const char of "1000") type(char)
    expect(shown()).toBe("1.000")

    type("0")
    expect(shown()).toBe("10.000") // dulu: field kosong

    backspace()
    expect(shown()).toBe("1.000") // dulu: field kosong

    backspace()
    expect(shown()).toBe("100")

    // Ketikan yang bukan nominal diabaikan, bukan mengubah angka yang sudah ada.
    edit(shown() + ",")
    expect(shown()).toBe("100")
  })
})

describe("klasifikasi MIME tidak boleh melempar pada field mentah", () => {
  /**
   * Lampiran chat, bukti sengketa, dan data topup TIDAK dinormalisasi:
   * `http.get<Dto>()` hanya meng-cast tipe. `mimeType` karena itu bisa
   * `undefined`, `null`, atau angka walau tipenya `string`.
   * `undefined.startsWith("image/")` melempar TypeError saat render —
   * bukan sekadar ikon yang salah, melainkan seluruh layar yang jatuh ke
   * error boundary.
   */
  const HOSTILE: unknown[] = [undefined, null, 0, 42, {}, [], true, Number.NaN]

  it.each(HOSTILE.map((v) => [v]))("isImageMime(%p) -> false, tanpa melempar", (value) => {
    expect(() => isImageMime(value as never)).not.toThrow()
    expect(isImageMime(value as never)).toBe(false)
  })

  it.each(HOSTILE.map((v) => [v]))("isPdfMime(%p) -> false, tanpa melempar", (value) => {
    expect(() => isPdfMime(value as never)).not.toThrow()
    expect(isPdfMime(value as never)).toBe(false)
  })

  it.each(HOSTILE.map((v) => [v]))("fileExtension(%p) -> undefined, tanpa melempar", (value) => {
    expect(() => fileExtension(value as never)).not.toThrow()
    expect(fileExtension(value as never)).toBeUndefined()
  })

  it("mengenali MIME gambar & PDF yang sesungguhnya", () => {
    expect(isImageMime("image/png")).toBe(true)
    expect(isImageMime("image/jpeg")).toBe(true)
    expect(isImageMime("image/svg+xml")).toBe(true)
    expect(isPdfMime("application/pdf")).toBe(true)
    // Bukan gambar — jangan terkecoh awalan yang mirip.
    expect(isImageMime("application/pdf")).toBe(false)
    expect(isImageMime("text/plain")).toBe(false)
    expect(isImageMime("images/png")).toBe(false)
    expect(isImageMime("")).toBe(false)
    expect(isPdfMime("image/png")).toBe(false)
  })

  it("ekstensi diambil dari nama berkas, kapital, dan aman tanpa ekstensi", () => {
    expect(fileExtension("bukti.pdf")).toBe("PDF")
    expect(fileExtension("foto.selfie.JPG")).toBe("JPG")
    expect(fileExtension("arsip.tar.gz")).toBe("GZ")
    // Tanpa titik → tidak ada ekstensi, BUKAN seluruh nama berkas.
    expect(fileExtension("README")).toBeUndefined()
    expect(fileExtension("")).toBeUndefined()
    // Titik di akhir tidak boleh menghasilkan string kosong yang dirender.
    expect(fileExtension("bukti.")).toBeUndefined()
  })
})
