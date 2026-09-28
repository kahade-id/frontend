/**
 * Test validasi tujuan notifikasi (B15, lib/notification-target.ts).
 *
 * Menjamin: target yang dikenali & ada → ok + route; 404 → unavailable
 * dengan label entitas; galat jaringan → fail-open (tetap ok); referensi
 * tak dikenal → unknown-route; chat tidak di-probe (layar room sudah
 * menangani roomGone).
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/api", () => {
  const apiError = (status: number) => ({ __apiError: true, status })
  return {
    api: {
      orders: {
        getOrder: vi.fn(),
        __apiError: apiError,
      },
      disputes: {
        getDispute: vi.fn(),
      },
      showcase: {
        getShowcaseDetail: vi.fn(),
      },
    },
    isApiError: (e: unknown) =>
      typeof e === "object" && e !== null && (e as { __apiError?: boolean }).__apiError === true,
  }
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getMock(ns: "orders" | "disputes" | "showcase", fn: string): Promise<any> {
  const mod = await import("@/lib/api")
  return (mod.api[ns][fn] as unknown as ReturnType<typeof vi.fn>)
}

import { checkNotificationTarget } from "@/lib/notification-target"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("checkNotificationTarget", () => {
  it("order yang ada → ok + route detail order", async () => {
    (await getMock("orders", "getOrder")).mockResolvedValue({ id: "o1" })
    const res = await checkNotificationTarget({ referenceType: "ORDER", referenceId: "o1" })
    expect(res.status).toBe("ok")
    if (res.status === "ok") expect(JSON.stringify(res.route)).toContain("o1")
  })

  it("order 404 → unavailable dengan label 'Order'", async () => {
    (await getMock("orders", "getOrder")).mockRejectedValue({ __apiError: true, status: 404 })
    const res = await checkNotificationTarget({ referenceType: "order", referenceId: "gone" })
    expect(res).toEqual({ status: "unavailable", entityLabel: "Order" })
  })

  it("galat jaringan (non-404) → fail-open, tetap ok", async () => {
    (await getMock("disputes", "getDispute")).mockRejectedValue(new Error("network down"))
    const res = await checkNotificationTarget({ referenceType: "DISPUTE", referenceId: "d1" })
    expect(res.status).toBe("ok")
  })

  it("showcase 404 → unavailable dengan label 'Karya'", async () => {
    (await getMock("showcase", "getShowcaseDetail")).mockRejectedValue({ __apiError: true, status: 404 })
    const res = await checkNotificationTarget({ referenceType: "SHOWCASE", referenceId: "s1" })
    expect(res).toEqual({ status: "unavailable", entityLabel: "Karya" })
  })

  it("chat tidak di-probe — langsung ok (roomGone ditangani layar)", async () => {
    const res = await checkNotificationTarget({ referenceType: "CHAT_ROOM", referenceId: "r1" })
    expect(res.status).toBe("ok")
  })

  it("referensi tak dikenal → unknown-route", async () => {
    const res = await checkNotificationTarget({ referenceType: "NOPE", referenceId: "x" })
    expect(res.status).toBe("unknown-route")
  })

  it("order tanpa id → route tab transaksi, tanpa probe", async () => {
    const res = await checkNotificationTarget({ referenceType: "ORDER", referenceId: "" })
    expect(res.status).toBe("ok")
    expect(await getMock("orders", "getOrder")).not.toHaveBeenCalled()
  })
})
