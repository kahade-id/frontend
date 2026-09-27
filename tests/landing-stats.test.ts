/**
 * Test parser statistik publik landing (lib/landing-stats.ts).
 *
 * Mengunci kontrak kejujuran: field tak valid diabaikan, dan bila tidak ada
 * satu pun angka valid hasilnya null (UI menampilkan placeholder "—",
 * bukan angka palsu).
 */
import { describe, expect, it } from "vitest"

import { parsePublicStats } from "@/lib/landing-stats"

describe("parsePublicStats", () => {
  it("menerima objek lengkap yang valid", () => {
    expect(
      parsePublicStats({
        transactionsCount: 12840,
        usersCount: 5320,
        citiesCount: 27,
        ratingAvg: 4.8,
      }),
    ).toEqual({
      transactionsCount: 12840,
      usersCount: 5320,
      citiesCount: 27,
      ratingAvg: 4.8,
    })
  })

  it("menerima sebagian field (parsial tetap jujur)", () => {
    expect(parsePublicStats({ usersCount: 100 })).toEqual({
      transactionsCount: undefined,
      usersCount: 100,
      citiesCount: undefined,
      ratingAvg: undefined,
    })
  })

  it("mengabaikan field tak valid: negatif, NaN, Infinity, string", () => {
    expect(
      parsePublicStats({
        transactionsCount: -5,
        usersCount: Number.NaN,
        citiesCount: Number.POSITIVE_INFINITY,
        ratingAvg: "4,8",
      }),
    ).toBeNull()
  })

  it("menerima angka 0 (valid, bukan 'tidak ada data')", () => {
    const result = parsePublicStats({ transactionsCount: 0 })
    expect(result?.transactionsCount).toBe(0)
  })

  it("menolak non-objek: null, string, array", () => {
    expect(parsePublicStats(null)).toBeNull()
    expect(parsePublicStats("12840")).toBeNull()
    expect(parsePublicStats([12840])).toBeNull()
    expect(parsePublicStats({})).toBeNull()
  })
})
