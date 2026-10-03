import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ get: vi.fn() }))

vi.mock("@/lib/api/client", () => ({
  http: { get: mocks.get },
  seg: (value: string) => encodeURIComponent(value),
}))

import { getUserByUsername } from "@/lib/api/users"

beforeEach(() => vi.resetAllMocks())

describe("getUserByUsername rating summary", () => {
  it("reads average and total count from the documented ratings section", async () => {
    mocks.get.mockResolvedValue({
      id: "profile-1",
      username: "seller",
      ratings: { averageRating: 4.8, totalRatingCount: 127 },
      stats: { trustScore: 72 },
    })

    const profile = await getUserByUsername("seller")

    expect(profile.rating).toBe(4.8)
    expect(profile.ratingCount).toBe(127)
    expect(profile.trustScore).toBe(72)
  })

  it("keeps legacy flat/stat rating fields as a fallback", async () => {
    mocks.get.mockResolvedValue({
      id: "profile-2",
      username: "seller",
      rating: 5,
      stats: { ratingCount: 1 },
    })

    const profile = await getUserByUsername("seller")

    expect(profile.rating).toBe(5)
    expect(profile.ratingCount).toBe(1)
  })

  it("does not expose a negative review count", async () => {
    mocks.get.mockResolvedValue({
      id: "profile-3",
      username: "seller",
      ratings: { averageRating: 4, totalRatingCount: -1 },
    })

    const profile = await getUserByUsername("seller")

    expect(profile.rating).toBe(4)
    expect(profile.ratingCount).toBeUndefined()
  })
})
