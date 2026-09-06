import { describe, expect, it, vi } from "vitest"

vi.mock("expo-constants", () => ({
  default: {
    expoConfig: {
      scheme: "kahade",
    },
  },
}))

import { profileUrl } from "@/lib/deeplinks"
import { ROUTES } from "@/lib/routes"

describe("User profile screen routes & links", () => {
  it("formats user profile deep links correctly", () => {
    expect(profileUrl("johndoe")).toBe("kahade://user/johndoe")
    expect(profileUrl("alice_seller")).toBe("kahade://user/alice_seller")
  })

  it("builds correct related user routes", () => {
    expect(ROUTES.userProfile("johndoe")).toEqual({
      pathname: "/user/[username]",
      params: { username: "johndoe" },
    })
    expect(ROUTES.followers("johndoe")).toEqual({
      pathname: "/followers/[username]",
      params: { username: "johndoe", tab: "followers" },
    })
    expect(ROUTES.followers("johndoe", "following")).toEqual({
      pathname: "/followers/[username]",
      params: { username: "johndoe", tab: "following" },
    })
    expect(ROUTES.createTransactionWith("johndoe")).toEqual({
      pathname: "/create-transaction",
      params: { counterpart: "johndoe" },
    })
    expect(ROUTES.reports({ targetId: "u123", targetName: "johndoe" })).toEqual({
      pathname: "/reports",
      params: { targetId: "u123", targetName: "johndoe" },
    })
  })
})
