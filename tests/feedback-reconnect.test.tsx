import { act, cleanup, render, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  reconnect: null as (() => void) | null,
  flush: vi.fn(),
  queuedCount: vi.fn(),
}))

vi.mock("@/lib/connectivity", () => ({
  onReconnect: (listener: () => void) => {
    mocks.reconnect = listener
    return () => {
      if (mocks.reconnect === listener) mocks.reconnect = null
    }
  },
}))

vi.mock("@/lib/feedback", () => ({
  FEEDBACK_CATEGORIES: ["Saran fitur", "Laporan masalah", "Pengalaman pengguna", "Pujian", "Lainnya"],
  FEEDBACK_QUEUE_PERSISTS: true,
  flushQueuedFeedback: () => mocks.flush(),
  queuedFeedbackCount: () => mocks.queuedCount(),
  submitFeedback: vi.fn(),
}))

vi.mock("@/lib/api", () => ({ userMessage: () => "Gagal" }))
vi.mock("@/lib/telemetry", () => ({ logWarn: vi.fn() }))
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ show: vi.fn(), dismiss: vi.fn(), dismissAll: vi.fn() }),
}))

import { ThemeProvider } from "@/components/theme-provider"
import FeedbackScreen from "@/app/feedback"

beforeEach(() => {
  vi.clearAllMocks()
  mocks.reconnect = null
  mocks.flush.mockResolvedValue(undefined)
  mocks.queuedCount.mockResolvedValue(0)
})

afterEach(() => {
  cleanup()
})

describe("feedback queue reconnect", () => {
  it("retries on native connectivity reconnect and unregisters when the screen unmounts", async () => {
    const view = render(
      <ThemeProvider>
        <FeedbackScreen />
      </ThemeProvider>,
    )

    await waitFor(() => expect(mocks.flush).toHaveBeenCalledTimes(1))
    const reconnect = mocks.reconnect
    expect(reconnect).toBeTypeOf("function")

    await act(async () => {
      reconnect?.()
    })
    await waitFor(() => expect(mocks.flush).toHaveBeenCalledTimes(2))

    view.unmount()
    expect(mocks.reconnect).toBeNull()
  })
})
