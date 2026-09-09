import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn(), patch: vi.fn() }))
vi.mock("@/lib/api/client", () => ({ http: mocks, seg: encodeURIComponent }))

import { listSessions, normalizeSession } from "@/lib/api/sessions"
import { getBlockedUsers } from "@/lib/api/settings"
import { getSubscriptionBenefits, normalizeSubscriptionBenefit } from "@/lib/api/subscriptions"

describe("source-verified backend response contracts", () => {
  beforeEach(() => vi.clearAllMocks())

  it("normalizes session fields without inventing a device ID or trust state", () => {
    expect(normalizeSession({
      id: "session-1",
      deviceInfo: "Chrome on Android",
      ipAddress: "10.20.***.***",
      isCurrentSession: true,
      lastActiveAt: "2026-09-09T00:00:00.000Z",
      createdAt: "2026-09-08T00:00:00.000Z",
    })).toEqual({
      id: "session-1",
      deviceName: "Chrome on Android",
      ip: "10.20.***.***",
      current: true,
      lastActiveAt: "2026-09-09T00:00:00.000Z",
      createdAt: "2026-09-08T00:00:00.000Z",
    })
  })

  it("reads the backend sessions envelope", async () => {
    mocks.get.mockResolvedValue({ sessions: [{ id: "session-1", deviceInfo: "Android", isCurrentSession: false, createdAt: "now" }] })
    await expect(listSessions({ page: 1, limit: 20 })).resolves.toMatchObject([
      { id: "session-1", deviceName: "Android", current: false },
    ])
  })

  it("uses flattened blocked users and preserves userId for unblock", async () => {
    mocks.get.mockResolvedValue({ users: [{ userId: "public-user-1", username: "redacted", blockedAt: "now", blockId: "block-1" }] })
    await expect(getBlockedUsers()).resolves.toEqual([
      { id: "public-user-1", username: "redacted", blockedAt: "now", fullName: undefined, avatarUrl: undefined },
    ])
    expect(mocks.get).toHaveBeenCalledWith("/v1/users/me/blocked", expect.objectContaining({ auth: "required" }))
  })

  it("maps backend benefit label to the UI title", async () => {
    expect(normalizeSubscriptionBenefit({ key: "priority", label: "Priority Support", description: "Faster" }))
      .toEqual({ key: "priority", title: "Priority Support", description: "Faster" })
    mocks.get.mockResolvedValue({ benefits: [{ key: "priority", label: "Priority Support" }] })
    await expect(getSubscriptionBenefits()).resolves.toEqual([
      { key: "priority", title: "Priority Support", description: undefined },
    ])
  })
})
