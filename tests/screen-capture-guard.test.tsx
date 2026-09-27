/**
 * Kahade — uji <ScreenCaptureGuard> (SEC-404).
 *
 * Proteksi screen-capture iOS di layar sensitif (PIN/OTP/saldo):
 *  - saat mount: preventScreenCaptureAsync dipanggil (mencegah screenshot &
 *    screen recording di iOS);
 *  - saat screenshot terdeteksi: overlay opaque menutupi konten + tombol
 *    "Tutup" mengembalikannya;
 *  - saat unmount: allowScreenCaptureAsync dipanggil (tidak mengunci
 *    screen-capture di luar layar sensitif).
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

const hoisted = vi.hoisted(() => ({
  listeners: [] as Array<() => void>,
  prevent: vi.fn(async (_key?: string) => {}),
  allow: vi.fn(async (_key?: string) => {}),
  enableBlur: vi.fn(async (_intensity?: number) => {}),
  disableBlur: vi.fn(async () => {}),
}))

vi.mock("expo-screen-capture", () => ({
  preventScreenCaptureAsync: hoisted.prevent,
  allowScreenCaptureAsync: hoisted.allow,
  enableAppSwitcherProtectionAsync: hoisted.enableBlur,
  disableAppSwitcherProtectionAsync: hoisted.disableBlur,
  addScreenshotListener: (listener: () => void) => {
    hoisted.listeners.push(listener)
    return { remove: () => {} }
  },
}))

import { ThemeProvider } from "@/components/theme-provider"
import { ScreenCaptureGuard } from "@/components/security/screen-capture-guard"

afterEach(() => {
  cleanup()
  hoisted.listeners.length = 0
  vi.clearAllMocks()
})

function renderGuard() {
  return render(
    <ThemeProvider>
      <ScreenCaptureGuard>
        <div data-testid="konten-sensitif">saldo Rp1.000.000</div>
      </ScreenCaptureGuard>
    </ThemeProvider>,
  )
}

describe("ScreenCaptureGuard (SEC-404)", () => {
  it("merender children tanpa overlay, dan mencegah capture saat mount", async () => {
    renderGuard()
    expect(screen.getByTestId("konten-sensitif")).toBeTruthy()
    expect(screen.queryByText("Layar disembunyikan")).toBeNull()
    await waitFor(() => expect(hoisted.prevent).toHaveBeenCalledTimes(1))
    // Key unik per instance — dua guard tidak saling menonaktifkan.
    expect(typeof hoisted.prevent.mock.calls[0][0]).toBe("string")
  })

  it("menampilkan overlay saat screenshot terdeteksi; tombol Tutup mengembalikannya", async () => {
    renderGuard()
    await waitFor(() => expect(hoisted.listeners.length).toBe(1))
    act(() => {
      hoisted.listeners[0]()
    })
    expect(screen.getByText("Layar disembunyikan")).toBeTruthy()
    fireEvent.click(screen.getByText("Tutup"))
    expect(screen.queryByText("Layar disembunyikan")).toBeNull()
    expect(screen.getByTestId("konten-sensitif")).toBeTruthy()
  })

  it("mengizinkan kembali capture saat unmount", async () => {
    const { unmount } = renderGuard()
    await waitFor(() => expect(hoisted.prevent).toHaveBeenCalled())
    unmount()
    await waitFor(() => expect(hoisted.allow).toHaveBeenCalledTimes(1))
  })
})
