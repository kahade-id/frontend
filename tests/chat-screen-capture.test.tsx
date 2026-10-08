/**
 * Audit chat H21 — "Izinkan screenshot & rekam layar di chat".
 *
 * Kontrak yang dikunci:
 *   - default IZINKAN (kebijakan 2026-09-27: layar biasa tetap boleh di-screenshot);
 *     hanya `false` eksplisit yang mematikan, data rusak jatuh ke izinkan;
 *   - saklar mematikan → <ScreenCaptureGuard> dipasang (expo-screen-capture);
 *     menyalakan lagi → dilepas; pohon anak TIDAK di-remount (draft/scroll aman);
 *   - tab chat memakai `active` (fokus) supaya proteksi tidak menempel di tab lain;
 *   - tombol di Pengaturan pesan menulis preferensi LOKAL (tanpa API).
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useEffect, useState } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const sc = vi.hoisted(() => ({
  prevent: vi.fn(async (_key?: string) => undefined),
  allow: vi.fn(async (_key?: string) => undefined),
  listener: vi.fn(() => ({ remove: vi.fn() })),
}))

vi.mock("expo-screen-capture", () => ({
  preventScreenCaptureAsync: sc.prevent,
  allowScreenCaptureAsync: sc.allow,
  addScreenshotListener: sc.listener,
  enableAppSwitcherProtectionAsync: vi.fn(async () => undefined),
  disableAppSwitcherProtectionAsync: vi.fn(async () => undefined),
}))

import { ThemeProvider } from "@/components/theme-provider"
import { ChatScreenCaptureGate, chatCaptureGuardEnabled } from "@/components/security/chat-screen-capture-gate"
import { ScreenCaptureGuard } from "@/components/security/screen-capture-guard"
import {
  getUiPrefsSnapshot,
  loadUiPrefs,
  resetUiPrefsForTest,
  sanitizePrefs,
  setUiPrefs,
} from "@/lib/ui-prefs"

beforeEach(async () => {
  resetUiPrefsForTest()
  // Hidrasi dari storage SELESAI dulu: `useUiPref` memicu loadUiPrefs() saat mount, dan
  // load pertama menimpa preferensi memori dengan isi storage (kosong di test) — di app
  // itu terjadi sekali saat boot, jauh sebelum pengguna sempat membuka Pengaturan.
  await loadUiPrefs()
  sc.prevent.mockClear()
  sc.allow.mockClear()
})
afterEach(cleanup)

const inTheme = (ui: React.ReactElement) => render(<ThemeProvider>{ui}</ThemeProvider>)

describe("preferensi chatAllowScreenCapture", () => {
  it("default IZINKAN", () => {
    expect(getUiPrefsSnapshot().chatAllowScreenCapture).toBe(true)
    expect(sanitizePrefs(null).chatAllowScreenCapture).toBe(true)
    expect(sanitizePrefs({}).chatAllowScreenCapture).toBe(true)
  })

  it("hanya `false` eksplisit yang mematikan; nilai rusak jatuh ke izinkan", () => {
    expect(sanitizePrefs({ chatAllowScreenCapture: false }).chatAllowScreenCapture).toBe(false)
    expect(sanitizePrefs({ chatAllowScreenCapture: true }).chatAllowScreenCapture).toBe(true)
    for (const junk of ["false", 0, null, undefined, "no"]) {
      expect(sanitizePrefs({ chatAllowScreenCapture: junk }).chatAllowScreenCapture).toBe(true)
    }
  })

  it("preferensi lain tidak terpengaruh", () => {
    const prefs = sanitizePrefs({ chatAllowScreenCapture: false, balanceHidden: true })
    expect(prefs.balanceHidden).toBe(true)
    expect(prefs.scanFeedback).toBe(true)
  })
})

describe("chatCaptureGuardEnabled", () => {
  it("menyala hanya bila pengguna MEMATIKAN izin DAN layar aktif", () => {
    expect(chatCaptureGuardEnabled(true)).toBe(false)
    expect(chatCaptureGuardEnabled(false)).toBe(true)
    expect(chatCaptureGuardEnabled(false, true)).toBe(true)
    // Tab chat tidak terfokus → jangan tempelkan FLAG_SECURE ke tab lain.
    expect(chatCaptureGuardEnabled(false, false)).toBe(false)
    expect(chatCaptureGuardEnabled(true, true)).toBe(false)
  })
})

describe("<ScreenCaptureGuard enabled>", () => {
  it("enabled (default): layar sensitif tetap dilindungi seperti sebelumnya", async () => {
    inTheme(
      <ScreenCaptureGuard>
        <span>isi</span>
      </ScreenCaptureGuard>,
    )
    await waitFor(() => expect(sc.prevent).toHaveBeenCalledTimes(1))
  })

  it("enabled=false: tidak ada pencegahan sama sekali", async () => {
    inTheme(
      <ScreenCaptureGuard enabled={false}>
        <span>isi</span>
      </ScreenCaptureGuard>,
    )
    await act(async () => {
      await Promise.resolve()
    })
    expect(sc.prevent).not.toHaveBeenCalled()
  })

  it("dimatikan di tengah umur komponen → proteksi dilepas", async () => {
    const { rerender } = inTheme(
      <ScreenCaptureGuard enabled>
        <span>isi</span>
      </ScreenCaptureGuard>,
    )
    await waitFor(() => expect(sc.prevent).toHaveBeenCalledTimes(1))
    const key = sc.prevent.mock.calls[0]?.[0]
    rerender(
      <ThemeProvider>
        <ScreenCaptureGuard enabled={false}>
          <span>isi</span>
        </ScreenCaptureGuard>
      </ThemeProvider>,
    )
    await waitFor(() => expect(sc.allow).toHaveBeenCalledWith(key))
  })
})

describe("<ChatScreenCaptureGate>", () => {
  /** Anak berstatus: bila di-remount, hitungannya kembali ke 1. */
  function Child({ onMount }: { onMount: () => void }) {
    const [n, setN] = useState(0)
    useEffect(() => {
      onMount()
    }, [onMount])
    return (
      <button type="button" onClick={() => setN((v) => v + 1)}>
        draft-{n}
      </button>
    )
  }

  it("default izinkan: tidak ada proteksi", async () => {
    inTheme(
      <ChatScreenCaptureGate>
        <span>chat</span>
      </ChatScreenCaptureGate>,
    )
    await act(async () => {
      await Promise.resolve()
    })
    expect(sc.prevent).not.toHaveBeenCalled()
  })

  it("pengguna mematikan izin → dilindungi; menyalakan lagi → dilepas; anak TIDAK di-remount", async () => {
    const onMount = vi.fn()
    inTheme(
      <ChatScreenCaptureGate>
        <Child onMount={onMount} />
      </ChatScreenCaptureGate>,
    )
    fireEvent.click(screen.getByText("draft-0"))
    expect(screen.getByText("draft-1")).toBeTruthy()

    act(() => setUiPrefs({ chatAllowScreenCapture: false }))
    await waitFor(() => expect(sc.prevent).toHaveBeenCalledTimes(1))

    act(() => setUiPrefs({ chatAllowScreenCapture: true }))
    await waitFor(() => expect(sc.allow).toHaveBeenCalled())

    // State anak (mis. draft ketikan) utuh dan efek mount hanya sekali.
    expect(screen.getByText("draft-1")).toBeTruthy()
    expect(onMount).toHaveBeenCalledTimes(1)
  })

  it("active=false (tab tidak fokus) menahan proteksi walau izin dimatikan", async () => {
    setUiPrefs({ chatAllowScreenCapture: false })
    const { rerender } = inTheme(
      <ChatScreenCaptureGate active={false}>
        <span>daftar chat</span>
      </ChatScreenCaptureGate>,
    )
    await act(async () => {
      await Promise.resolve()
    })
    expect(sc.prevent).not.toHaveBeenCalled()
    rerender(
      <ThemeProvider>
        <ChatScreenCaptureGate active>
          <span>daftar chat</span>
        </ChatScreenCaptureGate>
      </ThemeProvider>,
    )
    await waitFor(() => expect(sc.prevent).toHaveBeenCalledTimes(1))
  })
})
