/**
 * D1-010 (perf 2026-09-29): poll fingerprint ringan — bundle penuh hanya
 * bila fingerprint berubah sejak tick sebelumnya.
 */
import { renderHook } from "@testing-library/react"
import { beforeEach, expect, it, vi } from "vitest"

const mockCaptured: { cb: ((signal: AbortSignal) => Promise<unknown>) | null } = { cb: null }

vi.mock("@/lib/use-polling", () => ({
  usePolling: (cb: (signal: AbortSignal) => Promise<unknown>) => {
    mockCaptured.cb = cb
  },
}))

const { useFingerprintPoll } = await import("@/lib/use-fingerprint-poll")

beforeEach(() => {
  mockCaptured.cb = null
})

it("refresh hanya bila fingerprint berubah (bukan tiap tick)", async () => {
  const fingerprint = vi.fn()
  const refresh = vi.fn().mockResolvedValue(undefined)
  const signal = new AbortController().signal

  renderHook(() => useFingerprintPoll(fingerprint, refresh, 10_000, true))
  const tick = mockCaptured.cb
  expect(tick).not.toBeNull()

  // Tick 1: baseline — tidak ada refresh palsu.
  fingerprint.mockResolvedValueOnce({ status: "OPEN", updatedAt: "t1", replyCount: 2 })
  await tick!(signal)
  expect(refresh).not.toHaveBeenCalled()

  // Tick 2: fingerprint identik — tetap tidak refresh.
  fingerprint.mockResolvedValueOnce({ status: "OPEN", updatedAt: "t1", replyCount: 2 })
  await tick!(signal)
  expect(refresh).not.toHaveBeenCalled()

  // Tick 3: balasan baru (replyCount + updatedAt berubah) → refresh.
  fingerprint.mockResolvedValueOnce({ status: "OPEN", updatedAt: "t2", replyCount: 3 })
  await tick!(signal)
  expect(refresh).toHaveBeenCalledTimes(1)

  // Tick 4: galat fingerprint — tidak crash, tidak refresh, coba lagi tick berikut.
  fingerprint.mockRejectedValueOnce(new Error("network"))
  await tick!(signal)
  expect(refresh).toHaveBeenCalledTimes(1)
})
