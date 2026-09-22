/**
 * Tests untuk lib/server-time.ts (K-01)
 * Memverifikasi koreksi jam server, peredaman drift, penanganan header, dan reset.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  getTimeOffsetMs,
  recordServerDate,
  resetServerTime,
  serverNow,
} from "@/lib/server-time"

describe("lib/server-time", () => {
  beforeEach(() => {
    resetServerTime()
  })

  afterEach(() => {
    resetServerTime()
  })

  it("mengabaikan header kosong atau tidak valid", () => {
    recordServerDate(null)
    expect(getTimeOffsetMs()).toBe(0)
    recordServerDate(undefined)
    expect(getTimeOffsetMs()).toBe(0)
    recordServerDate("invalid-date-string")
    expect(getTimeOffsetMs()).toBe(0)
  })

  it("mencatat offset awal dari header Date yang valid", () => {
    const serverEpoch = Date.now() + 5000
    const dateStr = new Date(serverEpoch).toUTCString()
    recordServerDate(dateStr)

    // Header Date presisi detik; toleransi ~1000ms
    expect(Math.abs(getTimeOffsetMs() - 5000)).toBeLessThan(1500)
    expect(Math.abs(serverNow() - (Date.now() + 5000))).toBeLessThan(1500)
  })

  it("mengabaikan fluktuasi kecil (< 1.5 detik) sebagai noise presisi header", () => {
    const baseServer = Date.now() + 10000
    recordServerDate(new Date(baseServer).toUTCString())
    const initialOffset = getTimeOffsetMs()

    // Fluktuasi 800ms
    recordServerDate(new Date(baseServer + 800).toUTCString())
    expect(getTimeOffsetMs()).toBe(initialOffset)
  })

  it("menerima lompatan waktu besar (>= 1.5 detik) langsung", () => {
    const baseServer = Date.now() + 10000
    recordServerDate(new Date(baseServer).toUTCString())

    // Lompatan 10 detik
    const newServer = Date.now() + 20000
    recordServerDate(new Date(newServer).toUTCString())
    expect(Math.abs(getTimeOffsetMs() - 20000)).toBeLessThan(1500)
  })

  it("resetServerTime membersihkan seluruh state offset dan drift", () => {
    recordServerDate(new Date(Date.now() + 5000).toUTCString())
    expect(getTimeOffsetMs()).not.toBe(0)

    resetServerTime()
    expect(getTimeOffsetMs()).toBe(0)
  })
})
