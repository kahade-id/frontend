/**
 * Unit test helper notifikasi FE-IMP-3 (item #91 & #94) — lapisan murni,
 * ikut suite `npm test` (vitest node).
 */
import { describe, expect, it } from "vitest"

import {
  effectiveNotificationStatus,
  formatEffectiveStatus,
  summarizeNotificationPreferences,
} from "@/lib/notification-effective"

describe("summarizeNotificationPreferences (#91)", () => {
  it("null/undefined/{} → null (trailing tidak ditampilkan)", () => {
    expect(summarizeNotificationPreferences(null)).toBeNull()
    expect(summarizeNotificationPreferences(undefined)).toBeNull()
    expect(summarizeNotificationPreferences({})).toBeNull()
  })

  it("quiet hours aktif → 'Senyap HH:mm–HH:mm' (prioritas atas hitungan)", () => {
    expect(
      summarizeNotificationPreferences({
        quietHoursEnabled: true,
        quietHoursStart: "22:00",
        quietHoursEnd: "07:00",
        orderPush: true,
      }),
    ).toBe("Senyap 22:00–07:00")
  })

  // Audit 2026-10-10 (FE-05): default jam selesai = 07:00, sama dengan backend.
  it("quiet hours tanpa jam → fallback 22:00–07:00 (default backend)", () => {
    expect(summarizeNotificationPreferences({ quietHoursEnabled: true })).toBe(
      "Senyap 22:00–07:00",
    )
  })

  it("menghitung kategori dengan ≥1 kanal ON", () => {
    expect(
      summarizeNotificationPreferences({
        orderPush: true,
        orderInApp: false,
        walletInApp: true,
        walletPush: false,
        chatPush: false,
        chatInApp: false,
      }),
    ).toBe("2 dari 7 jenis aktif")
  })

  it("semua mati → '0 dari 7 jenis aktif'", () => {
    expect(
      summarizeNotificationPreferences({ orderPush: false, chatInApp: false }),
    ).toBe("0 dari 7 jenis aktif")
  })
})

describe("effectiveNotificationStatus (#94)", () => {
  it("push ON + izin perangkat granted → push efektif", () => {
    const s = effectiveNotificationStatus(
      "order",
      { orderInApp: true, orderPush: true, orderEmail: false },
      true,
    )
    expect(s.effective).toEqual(["InApp", "Push"])
    expect(s.pushBlockedByDevice).toBe(false)
    expect(formatEffectiveStatus(s)).toBe("Efektif: di aplikasi, push")
  })

  it("push ON + izin perangkat mati → push tertahan, ditandai", () => {
    const s = effectiveNotificationStatus(
      "chat",
      { chatInApp: true, chatPush: true },
      false,
    )
    expect(s.effective).toEqual(["InApp"])
    expect(s.pushBlockedByDevice).toBe(true)
    expect(formatEffectiveStatus(s)).toBe(
      "Efektif: di aplikasi · Push tertahan: izin perangkat mati",
    )
  })

  it("izin perangkat null (belum diketahui) → tidak memblokir", () => {
    const s = effectiveNotificationStatus("wallet", { walletPush: true }, null)
    expect(s.effective).toEqual(["Push"])
    expect(s.pushBlockedByDevice).toBe(false)
  })

  it("semua kanal mati → 'Tidak ada kanal aktif'", () => {
    const s = effectiveNotificationStatus(
      "marketing",
      { marketingEmail: false },
      true,
    )
    expect(s.effective).toEqual([])
    expect(formatEffectiveStatus(s)).toBe("Tidak ada kanal aktif")
  })

  it("kategori tanpa email (chat) hanya mengevaluasi kanal yang ada", () => {
    const s = effectiveNotificationStatus(
      "chat",
      { chatInApp: false, chatPush: false },
      true,
    )
    expect(formatEffectiveStatus(s)).toBe("Tidak ada kanal aktif")
  })
})
