import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  raw: "",
  get: vi.fn(),
  set: vi.fn(),
  post: vi.fn(),
}))

vi.mock("@/lib/api/client", () => ({
  http: {
    post: (...args: unknown[]) => mocks.post(...args),
  },
}))

vi.mock("@/lib/secure-storage", () => ({
  getSecureItem: (...args: unknown[]) => mocks.get(...args),
  setSecureItem: (...args: unknown[]) => mocks.set(...args),
  isSecureKeyPersisted: () => true,
  SecureKeys: { feedbackQueue: "feedback.queue" },
}))

import { flushQueuedFeedback } from "@/lib/feedback"

beforeEach(() => {
  vi.clearAllMocks()
  mocks.raw = JSON.stringify([
    {
      category: "Saran fitur",
      message: "Mohon pertimbangkan tema gelap.",
      queuedAt: new Date().toISOString(),
    },
  ])
  mocks.get.mockImplementation(async () => mocks.raw)
  mocks.set.mockImplementation(async (_key: unknown, value: unknown) => {
    mocks.raw = String(value)
  })
})

describe("feedback queue flush", () => {
  it("shares an in-flight drain so concurrent reconnect triggers POST once", async () => {
    let resolvePost!: () => void
    mocks.post.mockImplementation(
      () => new Promise<void>((resolve) => { resolvePost = resolve }),
    )

    const first = flushQueuedFeedback()
    const second = flushQueuedFeedback()
    expect(second).toBe(first)
    await vi.waitFor(() => expect(mocks.post).toHaveBeenCalledTimes(1))

    resolvePost()
    await Promise.all([first, second])
    expect(mocks.post).toHaveBeenCalledTimes(1)
    expect(mocks.set).toHaveBeenLastCalledWith("feedback.queue", "")
  })
})
