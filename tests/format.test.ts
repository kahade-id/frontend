/**
 * H-03 (audit 2026-09-20): fungsi format uang/telepon/tanggal/PII adalah
 * lapisan dengan riwayat bug terpanjang di repo (≥6 bug "audit #5" dicatat di
 * lib/format.ts) tetapi nyaris tak teruji — hanya formatCountCompact yang
 * punya suite. File ini mengunci kontrak tiap fungsi publik dengan tabel
 * input→output, termasuk kasus tepi yang dulu melahirkan bug: -0, setengah
 * grouping saat mengetik, prefix "062", truncateMiddle tail=0, dan tangga
 * satuan file >MB.
 *
 * Tanggal diuji dengan komponen lokal (new Date(y, m, d, …)) sehingga hasil
 * tidak bergantung TZ mesin CI; formatDateTimeWIB diuji dari timestamp UTC
 * karena konversinya justru harus TZ-independent.
 */
import { afterEach, describe, expect, it } from "vitest"

import {
  amountInputValue,
  formatCountdown,
  formatDate,
  formatDateLong,
  formatDateTime,
  formatDateTimeWIB,
  formatDecimal,
  formatFileSize,
  formatNumber,
  formatPhoneId,
  formatRupiah,
  formatTime,
  groupAccountNumber,
  groupThousands,
  initials,
  maskAccountNumber,
  parseRupiah,
  parseRupiahPartial,
  truncateMiddle,
} from "@/lib/format"
import { applyLanguage } from "@/lib/i18n/store"

afterEach(() => {
  applyLanguage("id")
})

describe("groupThousands / formatNumber", () => {
  it("mengelompokkan per tiga tanpa prefix", () => {
    expect(groupThousands(1_000_000)).toBe("1.000.000")
    expect(groupThousands(0)).toBe("0")
    expect(groupThousands(-1234)).toBe("1.234") // nilai mutlak
    expect(groupThousands(Number.NaN)).toBe("—")
  })

  it("formatNumber tidak pernah menghasilkan '-0' (audit #5)", () => {
    expect(formatNumber(-0.4)).toBe("0")
    expect(formatNumber(1234567)).toBe("1.234.567")
    expect(formatNumber(Number.POSITIVE_INFINITY)).toBe("—")
  })
})

describe("formatRupiah", () => {
  it("format dasar dan negatif", () => {
    expect(formatRupiah(1_500_000)).toBe("Rp1.500.000")
    expect(formatRupiah(0)).toBe("Rp0")
    expect(formatRupiah(-50_000)).toBe("-Rp50.000")
    expect(formatRupiah(1500.4)).toBe("Rp1.500") // dibulatkan
    expect(formatRupiah(Number.NaN)).toBe("—")
  })

  it("sign 'always' hanya untuk positif; 0 tanpa tanda", () => {
    expect(formatRupiah(50_000, { sign: "always" })).toBe("+Rp50.000")
    expect(formatRupiah(0, { sign: "always" })).toBe("Rp0")
    expect(formatRupiah(-50_000, { sign: "always" })).toBe("-Rp50.000")
  })

  it("sign 'never' tetap menampilkan negatif (audit #5: debet≠kredit)", () => {
    expect(formatRupiah(50_000, { sign: "never" })).toBe("Rp50.000")
    expect(formatRupiah(-50_000, { sign: "never" })).toBe("-Rp50.000")
  })

  it("compact menaikkan tingkat setelah pembulatan", () => {
    expect(formatRupiah(1_500_000, { compact: true })).toBe("Rp1,5 jt")
    expect(formatRupiah(999_999, { compact: true })).toBe("Rp1 jt") // bukan "1000,0 rb"
    expect(formatRupiah(1_000_000_000, { compact: true })).toBe("Rp1 M")
    expect(formatRupiah(1_200_000_000_000, { compact: true })).toBe("Rp1,2 T")
    expect(formatRupiah(999, { compact: true })).toBe("Rp999")
  })
})

describe("parseRupiah (strict, untuk paste)", () => {
  it.each([
    ["Rp1.500.000", 1_500_000],
    ["rp. 50.000", 50_000],
    ["IDR50.000", 50_000],
    ["1500000", 1_500_000],
    ["1.000,00", 1_000],
    ["", 0],
  ])("%s → %s", (input, expected) => {
    expect(parseRupiah(input)).toBe(expected)
  })

  it("menolak desimal dan sampah — TIDAK pernah salah skala uang", () => {
    expect(parseRupiah("10.000,50")).toBe(Number.NaN)
    expect(parseRupiah("1.00")).toBe(Number.NaN) // grouping rusak → strict menolak
    expect(parseRupiah("abc")).toBe(Number.NaN)
    expect(parseRupiah("12345678901234567890")).toBe(Number.NaN) // > safe integer
  })
})

describe("parseRupiahPartial (lenient, untuk ketikan)", () => {
  it("menerima grouping setengah jadi (audit: backspace menghapus seluruh nominal)", () => {
    expect(parseRupiahPartial("1.00")).toBe(100)
    expect(parseRupiahPartial("1.0000")).toBe(10_000)
    expect(parseRupiahPartial("Rp12.345")).toBe(12_345)
  })

  it("tetap menolak yang berbahaya", () => {
    expect(parseRupiahPartial("10.000,50")).toBe(Number.NaN) // koma = desimal tempel
    expect(parseRupiahPartial("-5")).toBe(Number.NaN) // negatif tak boleh jadi 5
    expect(parseRupiahPartial("1234.56")).toBe(Number.NaN) // grup pertama >3 digit
    expect(parseRupiahPartial("")).toBe(Number.NaN)
    expect(parseRupiahPartial("1234567890123456")).toBe(Number.NaN) // 16 digit
  })
})

describe("amountInputValue (kontrak <AmountInput>)", () => {
  it("mengembalikan angka untuk input sah, null untuk yang harus diabaikan", () => {
    expect(amountInputValue("Rp1.500.000")).toBe(1_500_000)
    expect(amountInputValue("1.00")).toBe(100) // jalur partial
    expect(amountInputValue("abc")).toBeNull()
    expect(amountInputValue("1234567890123456")).toBeNull() // >15 digit
  })
})

describe("formatDecimal", () => {
  it("koma Indonesia, trim nol, tanpa '-0'", () => {
    expect(formatDecimal(4.5)).toBe("4,5")
    expect(formatDecimal(4)).toBe("4")
    expect(formatDecimal(4.25, 1)).toBe("4,3")
    expect(formatDecimal(-0.4, 0)).toBe("0")
    expect(formatDecimal(1234.56)).toBe("1.234,6")
    expect(formatDecimal(-1234.5)).toBe("-1.234,5")
    expect(formatDecimal(Number.NaN)).toBe("—")
  })
})

describe("formatDate / formatTime / formatDateTime", () => {
  const local = new Date(2026, 8, 3, 14, 5) // 3 Sep 2026 14:05 waktu lokal

  it("format pendek & panjang (id)", () => {
    expect(formatDate(local)).toBe("3 Sep 2026")
    expect(formatDate(local, { long: true })).toBe("3 September 2026")
    expect(formatDate("2026-09-03")).toBe("3 Sep 2026") // tanggal polos = lokal
    expect(formatTime(local)).toBe("14:05")
    expect(formatDateTime(local)).toBe("3 Sep 2026, 14:05")
    expect(formatDate("bukan tanggal")).toBe("—")
    expect(formatTime("")).toBe("—")
  })

  it("bulan mengikuti bahasa aktif (Mei vs May)", () => {
    const mei = new Date(2026, 4, 3)
    expect(formatDate(mei)).toBe("3 Mei 2026")
    applyLanguage("en")
    expect(formatDate(mei)).toBe("3 May 2026")
    expect(formatDateLong(mei)).toBe("Sunday, 3 May 2026")
    applyLanguage("id")
    expect(formatDateLong(mei)).toBe("Minggu, 3 Mei 2026")
  })

  it("formatDateLong hari-benar (3 Sep 2026 = Kamis)", () => {
    expect(formatDateLong(new Date(2026, 8, 3))).toBe("Kamis, 3 September 2026")
  })
})

describe("formatDateTimeWIB (E-08)", () => {
  it("mengonversi ke Asia/Jakarta apa pun TZ perangkat + penanda WIB", () => {
    // 2026-09-03 20:30 UTC = 2026-09-04 03:30 WIB
    expect(formatDateTimeWIB(Date.UTC(2026, 8, 3, 20, 30))).toBe("4 Sep 2026, 03:30 WIB")
    // batas tengah malam: 17:00 UTC = 00:00 WIB hari berikutnya
    expect(formatDateTimeWIB(Date.UTC(2026, 8, 3, 17, 0))).toBe("4 Sep 2026, 00:00 WIB")
    // 16:59 UTC masih hari yang sama di WIB
    expect(formatDateTimeWIB(Date.UTC(2026, 8, 3, 16, 59))).toBe("3 Sep 2026, 23:59 WIB")
  })

  it("input tidak valid → em-dash, bukan 'Invalid Date'", () => {
    expect(formatDateTimeWIB("bukan tanggal")).toBe("—")
  })
})

describe("formatCountdown", () => {
  it("MM:SS di bawah sejam, H:MM:SS di atasnya, negatif → 0:00", () => {
    expect(formatCountdown(299)).toBe("04:59")
    expect(formatCountdown(3899)).toBe("1:04:59")
    expect(formatCountdown(-5)).toBe("00:00")
    expect(formatCountdown(Number.NaN)).toBe("—")
    // G-06: pemanggil boleh memberi label sendiri untuk nilai yang tidak valid
    expect(formatCountdown(Number.NaN, "belum tersedia")).toBe("belum tersedia")
  })
})

describe("maskAccountNumber / groupAccountNumber (PII)", () => {
  it("menyembunyikan semua kecuali 4 digit terakhir, dikelompokkan per 4", () => {
    expect(maskAccountNumber("123456789012")).toBe("•••• •••• 9012")
    expect(maskAccountNumber("1234 5678 9012")).toBe("•••• •••• 9012") // spasi input diabaikan
    expect(maskAccountNumber("12")).toBe("12") // lebih pendek dari visible
    expect(maskAccountNumber("123456", 2)).toBe("•••• 56")
  })

  /**
   * A-01 (audit 2026-09-22): regresi nyata — masker lama mengelompokkan ulang
   * bullet + digit dari depan sehingga 4 digit terakhir TERBELAH pada panjang
   * yang bukan kelipatan 4 (BCA 10 digit, CIMB/Mandiri 13, BRI 15). Empat digit
   * terakhir adalah satu-satunya verifikasi visual pengguna di layar tarik dana,
   * jadi kontraknya ditegakkan untuk semua panjang 4..20.
   */
  it("selalu menampilkan 4 digit terakhir UTUH untuk setiap panjang rekening", () => {
    const tail = "9012"
    for (let n = 4; n <= 20; n++) {
      const account = `1234567890123456${"7".repeat(4)}`.slice(0, n - 4) + tail
      const masked = maskAccountNumber(account)
      expect(masked.endsWith(tail)).toBe(true)
      expect(masked.slice(0, -tail.length).trimEnd()).not.toMatch(/\d/) // sisanya bullet
    }
  })

  it("contoh per bank (10/11/13/15 digit) tidak lagi memecah digit terakhir", () => {
    expect(maskAccountNumber("1234567890")).toBe("•••• •• 7890")
    expect(maskAccountNumber("12345678901")).toBe("•••• ••• 8901")
    expect(maskAccountNumber("1234567890123")).toBe("•••• •••• • 0123")
    expect(maskAccountNumber("123456789012345")).toBe("•••• •••• ••• 2345")
  })

  it("groupAccountNumber tanpa mask", () => {
    expect(groupAccountNumber("123456789012")).toBe("1234 5678 9012")
  })
})

describe("formatPhoneId (audit #5: prefix '062')", () => {
  it.each([
    ["081234567890", "+62 812-3456-7890"],
    ["6281234567890", "+62 812-3456-7890"],
    ["+62 812-3456-7890", "+62 812-3456-7890"],
    ["006281234567890", "+62 812-3456-7890"],
    ["", ""],
  ])("%s → %s", (input, expected) => {
    expect(formatPhoneId(input)).toBe(expected)
  })

  it("'062…' tidak lagi menyisakan '62' sebagai bagian nomor (bug lama)", () => {
    // Bug lama: "+62 628-1234-56789". Sekarang prefix dibuang berulang.
    expect(formatPhoneId("0628123456789")).toBe("+62 812-3456-789")
    expect(formatPhoneId("0628123456789")).not.toContain("628-1234-56789")
  })
})

describe("initials / truncateMiddle", () => {
  it("initials maksimum 2 kata, huruf besar", () => {
    expect(initials("Budi Santoso")).toBe("BS")
    expect(initials("budi santoso wijaya")).toBe("BS")
    expect(initials("")).toBe("")
    expect(initials("a b c", 3)).toBe("ABC")
  })

  it("truncateMiddle tail=0 tidak lebih panjang dari input (audit #5)", () => {
    expect(truncateMiddle("KHD-2026-0903-ABCDEF")).toBe("KHD-2026…CDEF")
    expect(truncateMiddle("abcdefghijkl", 8, 0)).toBe("abcdefgh…")
    expect(truncateMiddle("pendek")).toBe("pendek")
  })
})

describe("formatFileSize (audit #5: tangga >MB)", () => {
  it.each([
    [500, "500 B"],
    [1024, "1 KB"],
    [2_516_582, "2,4 MB"],
    [1_073_741_824, "1,0 GB"],
    [1_099_511_627_776, "1,0 TB"],
  ])("%s → %s", (input, expected) => {
    expect(formatFileSize(input)).toBe(expected)
  })

  it("1048575 B dinaikkan ke MB, bukan '1024 KB'; negatif → em-dash", () => {
    expect(formatFileSize(1_048_575)).toBe("1,0 MB")
    expect(formatFileSize(-5)).toBe("—")
    expect(formatFileSize(Number.NaN)).toBe("—")
  })
})
