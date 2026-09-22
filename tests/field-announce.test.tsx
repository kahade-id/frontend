/**
 * H-07 (audit 2026-09-22): pengumuman galat `FieldHelper` di iOS.
 *
 * Komentar di `components/ui/field.tsx` menjanjikan debounce 300 ms, padahal
 * pengumumannya sinkron: saat validasi berubah cepat ("minimal 8 karakter" →
 * "huruf besar dan kecil") VoiceOver mengantre SETIAP pesan dan pengguna baru
 * mendengar yang terakhir beberapa detik kemudian. Yang dikunci di sini:
 *   - pesan hanya diumumkan SETELAH jeda (bukan langsung);
 *   - pesan yang berganti cepat hanya menghasilkan SATU pengumuman terakhir;
 *   - unmount membatalkan timer (tidak ada pengumuman dari field yang hilang).
 *
 * Platform dipaksa "ios" karena jalur live region Android/web sudah dicakup
 * `accessibilityLiveRegion` — jalur inilah yang tidak punya padanan.
 */
import { act, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const announce = vi.fn()

vi.mock("react-native", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-native")>()
  return {
    ...actual,
    Platform: { ...actual.Platform, OS: "ios", select: (spec: Record<string, unknown>) => spec.ios },
    AccessibilityInfo: {
      ...actual.AccessibilityInfo,
      announceForAccessibility: (message: string) => announce(message),
    },
  }
})

import { ERROR_ANNOUNCE_DELAY_MS, FieldHelper } from "@/components/ui/field"

beforeEach(() => {
  vi.useFakeTimers()
  announce.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

describe("FieldHelper — pengumuman galat iOS (H-07)", () => {
  it("menunda pengumuman, tidak memanggilnya sinkron", () => {
    const { rerender } = render(<FieldHelper errorText="Minimal 8 karakter" />)
    expect(announce).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(ERROR_ANNOUNCE_DELAY_MS)
    })
    expect(announce).toHaveBeenCalledWith("Minimal 8 karakter")
    // teksnya tetap dirender untuk pembaca layar Android/web (live region)
    expect(screen.getByText("Minimal 8 karakter")).toBeTruthy()
    rerender(<FieldHelper errorText="Minimal 8 karakter" />)
    expect(announce).toHaveBeenCalledTimes(1) // pesan sama tidak diulang
  })

  it("validasi yang berubah cepat hanya mengumumkan pesan TERAKHIR", () => {
    const { rerender } = render(<FieldHelper errorText="Minimal 8 karakter" />)
    act(() => {
      vi.advanceTimersByTime(100)
    })
    rerender(<FieldHelper errorText="Huruf besar dan kecil" />)
    act(() => {
      vi.advanceTimersByTime(100)
    })
    rerender(<FieldHelper errorText="Mengandung angka" />)
    expect(announce).not.toHaveBeenCalled()
    act(() => {
      vi.advanceTimersByTime(ERROR_ANNOUNCE_DELAY_MS)
    })
    expect(announce.mock.calls.map((c) => c[0])).toEqual(["Mengandung angka"])
  })

  it("unmount membatalkan pengumuman yang belum waktunya", () => {
    const { unmount } = render(<FieldHelper errorText="Nama pengguna sudah dipakai" />)
    unmount()
    act(() => {
      vi.advanceTimersByTime(ERROR_ANNOUNCE_DELAY_MS * 3)
    })
    expect(announce).not.toHaveBeenCalled()
  })
})
