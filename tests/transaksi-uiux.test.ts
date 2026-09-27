/**
 * TIM TRANSAKSI & ESCROW — audit UI/UX 2026-09-27.
 *
 * Mengunci logika tampilan yang diperbaiki audit ini:
 *  - UI-T001: resolusi peran kartu sengketa memakai public userId (USR-XXX),
 *    BUKAN cuid internal `me.id` — perbandingan lama tidak pernah cocok
 *    sehingga "Dibuka oleh saya" & "Tanggapan Anda dibutuhkan" kosong.
 *  - UI-T003: RETURN_ACTOR_ROLE_LABEL — enum peran mentah tidak ke pengguna.
 *  - UI-T004: pola fallback label (status/reason/resolution asing → nilai mentah).
 *  - UI-T010: shortId untuk meta "Order" di invoice (bukan UUID 36 char).
 *  - UI-T020: tenggat memakai formatDateTimeWIB (label zona eksplisit).
 */
import { describe, expect, it } from "vitest"

import { pickPublicUserId } from "@/lib/api/users"
import {
  RETURN_ACTOR_ROLE_LABEL,
  RETURN_REASON_LABEL,
  RETURN_RESOLUTION_LABEL,
  RETURN_STATUS_LABEL,
} from "@/lib/api/returns"
import { shortId } from "@/lib/short-id"
import { formatDateTimeWIB } from "@/lib/format"

type Party = "BUYER" | "SELLER" | undefined

/** Replika ekspresi peran di app/disputes.tsx (setelah fix UI-T001). */
function resolveDisputeMyRole(
  order: { buyerId?: string; sellerId?: string } | undefined,
  meId: string | null,
): Party {
  return order
    ? meId && order.buyerId === meId
      ? "BUYER"
      : meId && order.sellerId === meId
        ? "SELLER"
        : undefined
    : undefined
}

describe("UI-T001 resolusi peran kartu sengketa", () => {
  const me = { userId: "USR-ABCD1234", id: "cuid-internal-xyz" }
  const order = { buyerId: "USR-ABCD1234", sellerId: "USR-WXYZ9876" }

  it("public userId cocok dengan buyerId backend", () => {
    const meId = pickPublicUserId(me)
    expect(meId).toBe("USR-ABCD1234")
    expect(resolveDisputeMyRole(order, meId)).toBe("BUYER")
  })

  it("cuid internal TIDAK pernah cocok (bug lama)", () => {
    const buggyMeId = me.id
    expect(resolveDisputeMyRole(order, buggyMeId)).toBeUndefined()
  })

  it("peran penjual terdeteksi", () => {
    const seller = { userId: "USR-WXYZ9876", id: "cuid-internal-abc" }
    expect(resolveDisputeMyRole(order, pickPublicUserId(seller))).toBe("SELLER")
  })

  it("fallback ke cuid bila userId belum ada", () => {
    expect(pickPublicUserId({ id: "cuid-only" })).toBe("cuid-only")
    expect(pickPublicUserId(null)).toBeNull()
  })
})

describe("UI-T003 RETURN_ACTOR_ROLE_LABEL", () => {
  it("BUYER → Pembeli, SELLER → Penjual", () => {
    expect(RETURN_ACTOR_ROLE_LABEL.BUYER).toBe("Pembeli")
    expect(RETURN_ACTOR_ROLE_LABEL.SELLER).toBe("Penjual")
  })

  it("nilai asing → undefined agar pemanggil jatuh ke nilai mentah", () => {
    expect(RETURN_ACTOR_ROLE_LABEL["ADMIN"]).toBeUndefined()
    const raw = "ADMIN"
    expect(RETURN_ACTOR_ROLE_LABEL[raw] ?? raw).toBe("ADMIN")
  })
})

describe("UI-T004 fallback label retur", () => {
  it("status dikenal → label Indonesia", () => {
    expect(RETURN_STATUS_LABEL.REQUESTED).toBe("Diajukan")
    expect(RETURN_REASON_LABEL.BARANG_RUSAK).toBe("Barang rusak")
    expect(RETURN_RESOLUTION_LABEL.REFUND).toBe("Refund dana")
  })

  it("nilai asing → nilai mentah (bukan render kosong)", () => {
    const status = "SOME_FUTURE_STATUS"
    expect(RETURN_STATUS_LABEL[status as keyof typeof RETURN_STATUS_LABEL] ?? status).toBe(status)
    const reason = "ALASAN_BARU"
    expect(RETURN_REASON_LABEL[reason as keyof typeof RETURN_REASON_LABEL] ?? reason).toBe(reason)
  })
})

describe("UI-T010 shortId meta invoice", () => {
  it("UUID 36 char → 8 char pertama", () => {
    expect(shortId("a1b2c3d4-e5f6-7890-abcd-ef1234567890")).toBe("a1b2c3d4")
  })

  it("nilai kosong → em dash", () => {
    expect(shortId("")).toBe("—")
    expect(shortId(null)).toBe("—")
  })

  it("label meta memakai prefix #", () => {
    expect(`#${shortId("a1b2c3d4-e5f6-7890-abcd-ef1234567890")}`).toBe("#a1b2c3d4")
  })
})

describe("UI-T020 tenggat memakai WIB eksplisit", () => {
  it("formatDateTimeWIB memuat penanda zona", () => {
    // 2026-09-27 10:00 UTC = 17:00 WIB.
    const out = formatDateTimeWIB("2026-09-27T10:00:00Z")
    expect(out).toContain("WIB")
    expect(out).toContain("17:00")
  })

  it("nilai kosong → em dash (bukan 'Invalid Date')", () => {
    expect(formatDateTimeWIB("")).toBe("—")
  })
})
