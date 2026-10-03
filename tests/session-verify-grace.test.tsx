// @vitest-environment jsdom
/**
 * P0-2 (audit perf/UX 2026-10-03): perilaku waktu jendela toleransi verifikasi.
 *
 * Kontrak murninya (`isVerificationWithinGrace`) diuji di tests/soft-reauth.test.ts
 * (konfigurasi node). Berkas ini mengunci sisi yang hanya terlihat saat hook
 * berjalan: timer 10 detik benar-benar dijalankan, `onExpired` dipanggil
 * SEKALI, dan verifikasi yang selesai lebih dulu (token terbit ATAU gagal
 * jaringan) tidak pernah memicu alur kedaluwarsa.
 */
import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { SESSION_VERIFY_GRACE_MS, useSessionVerifyGrace } from "@/lib/session-verify-grace"

afterEach(() => {
  vi.useRealTimers()
})

describe("P0-2: useSessionVerifyGrace", () => {
  it("menahan stack selama verifikasi berjalan di bawah jendela", () => {
    vi.useFakeTimers()
    const onExpired = vi.fn()
    const { result } = renderHook(() =>
      useSessionVerifyGrace({ verifying: true, token: null, onExpired }),
    )

    expect(result.current).toBe(true)
    act(() => {
      vi.advanceTimersByTime(SESSION_VERIFY_GRACE_MS - 1)
    })
    expect(result.current).toBe(true)
    expect(onExpired).not.toHaveBeenCalled()
  })

  it("jendela habis → onExpired sekali dan guard toleransi mati", () => {
    vi.useFakeTimers()
    const onExpired = vi.fn()
    const { result } = renderHook(() =>
      useSessionVerifyGrace({ verifying: true, token: null, onExpired }),
    )

    act(() => {
      vi.advanceTimersByTime(SESSION_VERIFY_GRACE_MS)
    })

    expect(result.current).toBe(false)
    expect(onExpired).toHaveBeenCalledTimes(1)

    // Verifikasi yang tetap menggantung tidak memicu expired berulang.
    act(() => {
      vi.advanceTimersByTime(SESSION_VERIFY_GRACE_MS * 3)
    })
    expect(onExpired).toHaveBeenCalledTimes(1)
  })

  it("token terbit sebelum jendela habis → tidak ada expired", () => {
    vi.useFakeTimers()
    const onExpired = vi.fn()
    const { result, rerender } = renderHook(
      (props: { token: string | null }) =>
        useSessionVerifyGrace({ verifying: true, token: props.token, onExpired }),
      { initialProps: { token: null as string | null } },
    )

    rerender({ token: "access-1" })
    act(() => {
      vi.advanceTimersByTime(SESSION_VERIFY_GRACE_MS * 2)
    })

    expect(result.current).toBe(false)
    expect(onExpired).not.toHaveBeenCalled()
  })

  it("verifikasi gagal jaringan sebelum jendela habis → sesi tidak diusik", () => {
    vi.useFakeTimers()
    const onExpired = vi.fn()
    const { result, rerender } = renderHook(
      (props: { verifying: boolean }) =>
        useSessionVerifyGrace({ verifying: props.verifying, token: null, onExpired }),
      { initialProps: { verifying: true } },
    )

    rerender({ verifying: false })
    act(() => {
      vi.advanceTimersByTime(SESSION_VERIFY_GRACE_MS * 2)
    })

    expect(result.current).toBe(false)
    expect(onExpired).not.toHaveBeenCalled()
  })
})
