// @vitest-environment jsdom
/**
 * FD-14 (audit etalase 2026-10-10): <SellerRatingLine> di baris penulis —
 * username berganti & fetch baru gagal → rating penulis LAMA tidak boleh
 * tetap tampil (ringkasan di-reset dulu).
 *
 * Ditulis dengan React.createElement mengikuti tests/profile-etalase-tab-perf.
 */
import * as React from "react"
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const h = React.createElement
const mocks = vi.hoisted(() => ({ summary: vi.fn() }))

vi.mock("expo-router", () => ({ router: { push: vi.fn() } }))
vi.mock("phosphor-react-native", () => ({ Star: () => null, SealCheck: () => null }))
vi.mock("@/lib/api/ratings", () => ({
  getPublicRatingSummary: (username: string, signal?: AbortSignal) => mocks.summary(username, signal),
}))
vi.mock("@/components/ui/avatar", () => ({ Avatar: () => null }))
vi.mock("@/components/ui/badge", () => ({ Badge: ({ children }: { children: unknown }) => h("span", null, children as never) }))
vi.mock("@/components/ui/icon", () => ({ Icon: () => null }))
vi.mock("@/components/ui/verified-name", () => ({ VerifiedName: ({ name }: { name: string }) => h("span", null, name) }))
vi.mock("@/components/ui/pressable-scale", () => ({
  PressableScale: ({ children }: { children: unknown }) => h("div", null, children as never),
}))
vi.mock("@/components/ui/text", () => ({
  Text: ({ children }: { children: unknown }) => h("span", null, children as never),
}))

import { ShowcaseAuthorRow } from "@/components/showcase-author-row"

const item = (username: string) => ({
  id: "s1",
  createdAt: "2026-10-10T00:00:00.000Z",
  author: { userId: `U-${username}`, username, fullName: null },
})

beforeEach(() => {
  vi.clearAllMocks()
})
afterEach(cleanup)

describe("SellerRatingLine FD-14", () => {
  it("penulis berganti + fetch baru gagal → rating penulis lama hilang (bukan tetap tampil)", async () => {
    mocks.summary.mockImplementation((username: string) =>
      username === "lama"
        ? Promise.resolve({ averageRating: 4.5, distribution: { total: 12 } })
        : Promise.reject(new Error("gagal")),
    )
    const { rerender } = render(h(ShowcaseAuthorRow, { item: item("lama"), isOwner: false, hasSession: true }))
    await waitFor(() => expect(screen.getByText(/12 ulasan/)).toBeTruthy())
    rerender(h(ShowcaseAuthorRow, { item: item("baru"), isOwner: false, hasSession: true }))
    await waitFor(() => expect(mocks.summary).toHaveBeenCalledWith("baru", expect.anything()))
    await waitFor(() => expect(screen.queryByText(/12 ulasan/)).toBeNull())
  })

  it("penulis berganti + fetch baru sukses → rating baru menggantikan yang lama", async () => {
    mocks.summary.mockImplementation((username: string) =>
      Promise.resolve(
        username === "lama"
          ? { averageRating: 4.5, distribution: { total: 12 } }
          : { averageRating: 3, distribution: { total: 2 } },
      ),
    )
    const { rerender } = render(h(ShowcaseAuthorRow, { item: item("lama"), isOwner: false, hasSession: true }))
    await waitFor(() => expect(screen.getByText(/12 ulasan/)).toBeTruthy())
    rerender(h(ShowcaseAuthorRow, { item: item("baru"), isOwner: false, hasSession: true }))
    await waitFor(() => expect(screen.getByText(/2 ulasan/)).toBeTruthy())
    expect(screen.queryByText(/12 ulasan/)).toBeNull()
  })
})
