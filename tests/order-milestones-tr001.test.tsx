// @vitest-environment jsdom
/**
 * TR-001 (audit performa ronde 3) — <MilestoneSection> tidak lagi menembak
 * request serial saat mount bila bundle utama order-detail sudah membawa
 * daftar tahap via prop `initialMilestones`.
 *
 * Yang diuji:
 *  1. initialMilestones disediakan → TIDAK ada panggilan
 *     api.milestones.listOrderMilestones saat mount; section langsung tampil.
 *  2. initialMilestones tidak disediakan → fetch sendiri saat mount
 *     (kompatibilitas mundur untuk pemakaian di luar order-detail).
 *  3. refreshKey berubah → fetch ulang (pengganti remount-buta via `key`).
 *  4. initialMilestones = [] → section tidak tampil (null), tanpa fetch.
 *
 * Ditulis dengan React.createElement mengikuti tests/showcase-profile-saved.test.tsx.
 */
import * as React from "react"
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { OrderMilestone } from "@/lib/api"

const h = React.createElement

const mocks = vi.hoisted(() => ({
  listOrderMilestones: vi.fn(),
}))

vi.mock("expo-router", () => ({ router: { push: vi.fn() } }))
vi.mock("@/lib/api", () => ({
  api: { milestones: { listOrderMilestones: mocks.listOrderMilestones } },
  userMessage: () => "failed",
}))
vi.mock("@/lib/api/milestones", () => ({
  remainingRevisions: () => 0,
}))
vi.mock("@/lib/use-wallet-enabled", () => ({ useWalletEnabled: () => false }))
vi.mock("@/lib/telemetry", () => ({ logWarn: vi.fn() }))
vi.mock("@/lib/format", () => ({
  formatRupiah: (n: number) => `Rp${n}`,
  formatDateTimeWIB: (s: string) => s,
}))
vi.mock("@/lib/i18n", () => ({ translate: (s: string) => s }))
vi.mock("@/lib/routes", () => ({ ROUTES: { milestoneDetail: (id: string) => `/milestones/${id}` } }))
vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: unknown }) => h("span", null, children as never),
}))
vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onPress }: { children: unknown; onPress?: () => void }) =>
    h("button", { onClick: onPress }, children as never),
}))
vi.mock("@/components/ui/modal", () => ({ Dialog: () => null }))
vi.mock("@/components/ui/section", () => ({
  SectionHeader: ({ title }: { title: string }) => h("h2", null, title),
}))
vi.mock("@/components/ui/text", () => ({
  Text: ({ children }: { children: unknown }) => h("span", null, children as never),
}))
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ show: vi.fn() }) }))

import { MilestoneSection } from "@/components/order-milestones"

const byFullText = (t: string) => (_: string, el: Element | null) => el?.textContent === t

const ms = (id: string, overrides: Partial<OrderMilestone> = {}): OrderMilestone =>
  ({
    id,
    seq: 1,
    title: `Tahap ${id}`,
    amount: 100000,
    sellerAmount: 95000,
    status: "AWAITING_ACTIVATION",
    maxRevisionRounds: 2,
    revisionRounds: 0,
    ...overrides,
  }) as OrderMilestone

beforeEach(() => {
  vi.clearAllMocks()
  mocks.listOrderMilestones.mockResolvedValue([])
})
afterEach(cleanup)

describe("MilestoneSection TR-001 (bundle utama paralel)", () => {
  it("1. initialMilestones disediakan → TIDAK fetch saat mount, langsung tampil", async () => {
    render(
      h(MilestoneSection, {
        orderId: "ord-1",
        role: "BUYER",
        initialMilestones: [ms("m1"), ms("m2")],
      }),
    )
    await waitFor(() => expect(screen.getByText("Tahapan Pembayaran")).toBeTruthy())
    expect(screen.getByText(byFullText("Tahap 1: Tahap m1"))).toBeTruthy()
    expect(screen.getByText(byFullText("Tahap 1: Tahap m2"))).toBeTruthy()
    expect(mocks.listOrderMilestones).not.toHaveBeenCalled()
  })

  it("2. tanpa initialMilestones → fetch sendiri saat mount (kompatibilitas mundur)", async () => {
    mocks.listOrderMilestones.mockResolvedValue([ms("m9")])
    render(h(MilestoneSection, { orderId: "ord-2", role: "SELLER" }))
    await waitFor(() => expect(mocks.listOrderMilestones).toHaveBeenCalledTimes(1))
    expect(mocks.listOrderMilestones).toHaveBeenCalledWith("ord-2")
    await waitFor(() => expect(screen.getByText("Tahapan Pembayaran")).toBeTruthy())
  })

  it("3. refreshKey berubah → fetch ulang tanpa remount", async () => {
    mocks.listOrderMilestones.mockResolvedValue([ms("m1")])
    const { rerender } = render(
      h(MilestoneSection, { orderId: "ord-3", initialMilestones: [ms("m1")], refreshKey: 0 }),
    )
    await waitFor(() => expect(screen.getByText("Tahapan Pembayaran")).toBeTruthy())
    expect(mocks.listOrderMilestones).not.toHaveBeenCalled()

    mocks.listOrderMilestones.mockResolvedValue([ms("m1"), ms("m2")])
    rerender(
      h(MilestoneSection, { orderId: "ord-3", initialMilestones: [ms("m1")], refreshKey: 1 }),
    )
    await waitFor(() => expect(mocks.listOrderMilestones).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByText(byFullText("Tahap 1: Tahap m2"))).toBeTruthy())
  })

  it("4. initialMilestones = [] → tidak tampil & tidak fetch (escrow satu tahap)", async () => {
    const { container } = render(
      h(MilestoneSection, { orderId: "ord-4", role: "BUYER", initialMilestones: [] }),
    )
    await act(async () => {})
    expect(mocks.listOrderMilestones).not.toHaveBeenCalled()
    expect(screen.queryByText("Tahapan Pembayaran")).toBeNull()
    expect(container.textContent).toBe("")
  })

  it("5. fetch gagal → sunyi (null), tidak melempar", async () => {
    mocks.listOrderMilestones.mockRejectedValue(new Error("offline"))
    const { container } = render(h(MilestoneSection, { orderId: "ord-5" }))
    await waitFor(() => expect(mocks.listOrderMilestones).toHaveBeenCalledTimes(1))
    expect(screen.queryByText("Tahapan Pembayaran")).toBeNull()
    expect(container.textContent).toBe("")
  })
})
