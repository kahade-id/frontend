/**
 * C-09 (audit 2026-09-20): sinyal tekanan balik dari backend.
 *
 * Bug yang dikunci: saat backend membalas 429/503 berantai (mis. endpoint
 * payment-status selama insiden), klien tetap menembak pada interval tetap
 * selama seluruh sesi pengguna. `retryAfterMs` dihormati jalur retry
 * `useApiQuery`, tetapi TIDAK oleh loop polling — dan callback polling yang
 * menelan galatnya sendiri tidak pernah bisa melihat flag error apa pun.
 * Karena itu sinyalnya dicatat dari transport dan dibaca di sini.
 */
import { beforeEach, describe, expect, it } from "vitest"

import {
  backpressureRemainingMs,
  backpressureSnapshot,
  clearBackpressure,
  DEFAULT_BACKOFF_MS,
  MAX_BACKOFF_MS,
  recordBackpressure,
} from "@/lib/api/backpressure"

const NOW = new Date("2026-09-22T00:00:00.000Z").getTime()

beforeEach(() => clearBackpressure())

describe("C-09: recordBackpressure tanpa Retry-After", () => {
  it("jeda tumbuh 2× per sinyal beruntun lalu berhenti tumbuh", () => {
    expect(recordBackpressure(undefined, NOW)).toBe(DEFAULT_BACKOFF_MS)
    expect(recordBackpressure(undefined, NOW)).toBe(DEFAULT_BACKOFF_MS * 2)
    expect(recordBackpressure(undefined, NOW)).toBe(DEFAULT_BACKOFF_MS * 4)
    expect(recordBackpressure(undefined, NOW)).toBe(DEFAULT_BACKOFF_MS * 8)
    expect(recordBackpressure(undefined, NOW)).toBe(DEFAULT_BACKOFF_MS * 16)
    // Batas eksponen: sinyal ke-6 dan seterusnya TIDAK memperbesar jeda lagi.
    expect(recordBackpressure(undefined, NOW)).toBe(DEFAULT_BACKOFF_MS * 16)
    expect(backpressureRemainingMs(NOW)).toBeLessThanOrEqual(MAX_BACKOFF_MS)
  })

  it("jeda dihitung dari waktu sinyal TERAKHIR, bukan yang pertama", () => {
    recordBackpressure(undefined, NOW)
    recordBackpressure(30_000, NOW + 1_000)
    expect(backpressureRemainingMs(NOW + 1_000)).toBe(30_000)
    expect(backpressureRemainingMs(NOW + 20_000)).toBe(11_000)
  })
})

describe("C-09: Retry-After dari server", () => {
  it("dihormati apa adanya (instruksi eksplisit, bukan bahan eksponensial)", () => {
    expect(recordBackpressure(45_000, NOW)).toBe(45_000)
    expect(backpressureRemainingMs(NOW)).toBe(45_000)
    // Sinyal berikutnya juga tetap memakai angka server, bukan 2×-nya.
    expect(recordBackpressure(45_000, NOW)).toBe(45_000)
  })

  it("dibatasi MAX_BACKOFF_MS supaya polling tidak pernah 'mati' berjam-jam", () => {
    expect(recordBackpressure(60 * 60 * 1000, NOW)).toBe(MAX_BACKOFF_MS)
    expect(backpressureRemainingMs(NOW)).toBe(MAX_BACKOFF_MS)
  })

  it("nilai tidak masuk akal diabaikan dan jatuh ke jalur eksponensial", () => {
    for (const bogus of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      clearBackpressure()
      expect(recordBackpressure(bogus, NOW)).toBe(DEFAULT_BACKOFF_MS)
    }
  })
})

describe("C-09: pemulihan", () => {
  it("respons sukses (clearBackpressure) menghapus cooldown DAN mereset eksponen", () => {
    recordBackpressure(undefined, NOW)
    recordBackpressure(undefined, NOW)
    expect(backpressureRemainingMs(NOW)).toBe(DEFAULT_BACKOFF_MS * 2)

    clearBackpressure()

    expect(backpressureRemainingMs(NOW)).toBe(0)
    // Insiden baru mulai lagi dari jeda dasar — bukan dari 4× yang tersisa.
    expect(recordBackpressure(undefined, NOW)).toBe(DEFAULT_BACKOFF_MS)
  })

  it("sisa cooldown menyusut dengan waktu dan tidak pernah negatif", () => {
    recordBackpressure(10_000, NOW)
    expect(backpressureRemainingMs(NOW + 4_000)).toBe(6_000)
    expect(backpressureRemainingMs(NOW + 10_000)).toBe(0)
    expect(backpressureRemainingMs(NOW + 60_000)).toBe(0)
  })

  it("snapshot memberi hitungan beruntun untuk log/telemetri", () => {
    expect(backpressureSnapshot(NOW)).toEqual({ consecutive: 0, remainingMs: 0 })
    recordBackpressure(undefined, NOW)
    recordBackpressure(undefined, NOW)
    expect(backpressureSnapshot(NOW)).toEqual({
      consecutive: 2,
      remainingMs: DEFAULT_BACKOFF_MS * 2,
    })
  })
})
