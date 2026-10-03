// @vitest-environment jsdom
/**
 * P0-1 (audit perf/UX 2026-10-03): WIRING modal pemulihan lembut.
 *
 * Lapisan keputusan (latch, guard, fallback) dikunci di tests/soft-reauth.test.ts
 * (konfigurasi node). Berkas ini mengunci bagian yang tidak terlihat di sana:
 * komponennya benar-benar merender sheet login saat kedaluwarsa, submit-nya
 * memakai `api.auth.login` yang SAMA dengan layar login, dan menutup sheet
 * (tombol "Buka layar masuk") menjalankan fallback alur lama.
 *
 * `api.auth.login` di-mock supaya tidak ada jaringan; backend tiruan ini
 * menerbitkan sesi lewat `startSession` yang asli, sehingga jalur
 * "login → snapshot sesi terbit → sheet tertutup" ikut teruji.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { ThemeProvider } from "@/components/theme-provider"
import { SoftReauthGate } from "@/components/soft-reauth-gate"
import { PortalHost, PortalProvider } from "@/components/ui/portal"
import { ToastProvider } from "@/components/ui/toast"
import { clearSession, startSession } from "@/lib/api/session"
import {
  getSoftReauthTarget,
  isSoftReauthActive,
  requestSoftReauthFallback,
  resetSoftReauth,
  setSoftReauthTarget,
  subscribeSoftReauthFallback,
} from "@/lib/soft-reauth"

const loginMock = vi.fn(async (_dto: unknown) => {
  await startSession({ accessToken: "access-soft", refreshToken: "refresh-soft" })
  return { accessToken: "access-soft", refreshToken: "refresh-soft" }
})

vi.mock("@/lib/api", () => ({
  api: { auth: { login: (dto: unknown) => loginMock(dto) } },
  isApiError: (error: unknown) =>
    typeof error === "object" && error !== null && "code" in error,
  userMessage: () => "Gagal memproses permintaan.",
}))

vi.mock("@/lib/location", () => ({ getAuthLocation: async () => null }))

function renderGate() {
  return render(
    <ThemeProvider>
      <ToastProvider>
        <PortalProvider>
          <SoftReauthGate />
          <PortalHost />
        </PortalProvider>
      </ToastProvider>
    </ThemeProvider>,
  )
}

async function expireSession() {
  await startSession({ accessToken: "access-live", refreshToken: "refresh-live" })
  await clearSession({ reason: "expired" })
}

beforeEach(async () => {
  await clearSession()
  resetSoftReauth()
  loginMock.mockClear()
})

afterEach(cleanup)

describe("P0-1: SoftReauthGate", () => {
  it("tidak merender apa pun selama sesi sehat", () => {
    const { container } = renderGate()

    expect(container.textContent).toBe("")
    expect(screen.queryByText("Sesi Anda berakhir")).toBeNull()
  })

  it("menampilkan sheet login saat sesi kedaluwarsa", async () => {
    await expireSession()
    renderGate()

    expect(screen.getByText("Sesi Anda berakhir")).toBeTruthy()
    expect(screen.getByText("Masuk")).toBeTruthy()
  })

  it("login dari sheet menutup pemulihan tanpa mengganti layar", async () => {
    await expireSession()
    const { container } = renderGate()
    const inputs = container.querySelectorAll("input")
    expect(inputs.length).toBeGreaterThanOrEqual(2)

    fireEvent.change(inputs[0]!, { target: { value: "budi" } })
    fireEvent.change(inputs[1]!, { target: { value: "rahasia-ku" } })
    fireEvent.click(screen.getByText("Masuk"))

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledTimes(1)
      expect(isSoftReauthActive()).toBe(false)
    })
    expect(screen.queryByText("Sesi Anda berakhir")).toBeNull()
  })

  it("tombol keluar menjalankan fallback alur lama dengan tujuan tersimpan", async () => {
    setSoftReauthTarget("/dispute/123")
    await expireSession()
    const seen: (string | null)[] = []
    subscribeSoftReauthFallback((next) => seen.push(next))
    renderGate()

    fireEvent.click(screen.getByText("Buka layar masuk"))

    expect(seen).toEqual(["/dispute/123"])
    expect(isSoftReauthActive()).toBe(false)
    expect(getSoftReauthTarget()).toBeNull()
  })

  it("fallback dari luar komponen juga memakai jalur yang sama", async () => {
    await expireSession()
    const seen: (string | null)[] = []
    subscribeSoftReauthFallback((next) => seen.push(next))
    renderGate()

    // Reaksi React terhadap latch harus di-flush sebelum memeriksa DOM.
    act(() => requestSoftReauthFallback())

    expect(seen).toEqual([null])
    expect(screen.queryByText("Sesi Anda berakhir")).toBeNull()
  })
})
