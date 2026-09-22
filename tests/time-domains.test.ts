/**
 * E-03 (audit 2026-09-22): domain waktu.
 *
 * Bug kelas ini sudah tiga kali muncul (A-02 `pendingActions`, E-01 cooldown
 * OTP, E-03 pengingat ulasan) dengan bentuk yang identik: nilai dari satu
 * domain dibandingkan "sekarang" dari domain lain. Test ini mengunci domain
 * yang benar untuk modul yang menyimpan timestamp lintas sesi, dengan
 * mensimulasikan perangkat yang jamnya meleset 2 jam — kondisi yang tidak
 * pernah terlihat di perangkat pengembang.
 *
 * Gate statis `scripts/check-time-domains.mjs` menjaga sisanya (mis. tidak ada
 * `until = Date.now()` baru di layar); test ini menjaga PERILAKU-nya.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { resetServerTime, recordServerDate, serverNow } from "@/lib/server-time"
import { isRatingSnoozed, loadUiPrefs, snoozeRatingReminder } from "@/lib/ui-prefs"

const HOUR = 60 * 60 * 1000

/** Simulasi perangkat yang jamnya LEBIH MAJU `skewMs` dari jam server. */
function deviceAheadBy(skewMs: number) {
  resetServerTime()
  // Header Date punya presisi 1 detik; bulatkan supaya offsetnya eksak.
  const serverMs = Math.floor((Date.now() - skewMs) / 1000) * 1000
  recordServerDate(new Date(serverMs).toUTCString())
}

beforeEach(async () => {
  resetServerTime()
  await loadUiPrefs()
})

afterEach(() => {
  resetServerTime()
})

describe("serverNow() vs jam perangkat", () => {
  it("mengoreksi perangkat yang jamnya maju 2 jam", () => {
    deviceAheadBy(2 * HOUR)
    expect(serverNow()).toBeLessThanOrEqual(Date.now() - 2 * HOUR + 2000)
    expect(Date.now() - serverNow()).toBeGreaterThan(HOUR)
  })
})

describe("isRatingSnoozed memakai domain jam server (E-03)", () => {
  it("membaca penundaan di domain yang sama dengan penulisnya", () => {
    // Perangkat 2 jam lebih maju dari server; layar order menulis snooze di
    // domain server (`serverNow() + RATING_SNOOZE_MS`).
    deviceAheadBy(2 * HOUR)
    const orderId = `order-e03-${Date.now()}`
    snoozeRatingReminder(orderId, serverNow() + HOUR)

    // Benar: dibaca sebagai "masih ditunda" (penundaan 1 jam penuh).
    expect(isRatingSnoozed(orderId)).toBe(true)

    // Kalau pembacaannya memakai jam perangkat (bug yang dilaporkan), batas
    // snooze justru sudah lewat 1 jam yang lalu — pengingat muncul lebih awal.
    expect(isRatingSnoozed(orderId, Date.now())).toBe(false)
  })

  it("penundaan yang sudah lewat di domain server dibuang, bukan disimpan", () => {
    deviceAheadBy(2 * HOUR)
    const orderId = `order-e03-lewat-${Date.now()}`
    snoozeRatingReminder(orderId, serverNow() - HOUR)
    expect(isRatingSnoozed(orderId)).toBe(false)
  })
})
