import type { ReactElement } from "react"
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  params: {} as Record<string, string>,
  online: true,
  flow: { phoneNumber: "+6281234567890", purpose: "login", refCode: "abc123def456", whatsappUrl: "https://wa.me/6285786035715?text=abc123def456", triggerText: "abc123def456", expiresAt: "2099-01-01T00:00:00Z" },
  identifier: "",
  requestOtp: vi.fn(),
  verifyOtp: vi.fn(),
  wallet: vi.fn(),
  triggerStatus: vi.fn(),
  replace: vi.fn(),
  push: vi.fn(),
  toast: { show: vi.fn() },
  markLeaving: vi.fn(),
}))

vi.mock("expo-router", async (importOriginal) => ({
  ...await importOriginal<Record<string, unknown>>(),
  useLocalSearchParams: () => ({ ...state.params }),
  useRouter: () => ({ replace: state.replace, push: state.push, back: vi.fn(), canGoBack: () => false }),
}))
vi.mock("@/lib/api", async () => ({
  ...await vi.importActual<Record<string, unknown>>("@/lib/api/errors"),
  api: {
    auth: { requestOtpTrigger: state.requestOtp, verifyOtp: state.verifyOtp, getOtpTriggerStatus: state.triggerStatus },
    wallet: { getWallet: state.wallet },
  },
}))
vi.mock("@/lib/use-auth-session", () => ({ useAuthSession: () => ({ restoring: false, token: null }) }))
vi.mock("@/lib/use-otp-flow", () => ({ useOtpFlow: () => ({ status: "ready", flow: state.flow }) }))
vi.mock("@/lib/otp-flow", () => ({ getOtpFlow: () => state.flow, setOtpFlow: vi.fn(), patchOtpFlow: vi.fn(), clearOtpFlow: vi.fn() }))
vi.mock("@/lib/location", () => ({ getAuthLocation: async () => null }))
vi.mock("@/lib/connectivity", () => ({ useIsOnline: () => state.online, isOfflineKnown: () => !state.online }))
vi.mock("@/lib/use-leave-confirm", () => ({ useLeaveConfirm: () => ({ markLeaving: state.markLeaving, dialogProps: { visible: false, title: "Discard" } }) }))
vi.mock("@/lib/two-factor-login", () => ({ getPendingTwoFactorLogin: () => ({ tempToken: "in-memory-only", identifier: state.identifier }), setPendingTwoFactorLogin: vi.fn(), clearPendingTwoFactorLogin: vi.fn() }))
vi.mock("@/components/ui/toast", () => ({ useToast: () => state.toast }))
vi.mock("@/components/auth/social-login-buttons", () => ({ SocialLoginButtons: () => null }))
vi.mock("@/lib/passkey", () => ({ getPasskeyCapabilitySync: () => ({ supported: false }), startPasskeyAuthentication: vi.fn(), PasskeyError: class extends Error {} }))

import { ThemeProvider } from "@/components/theme-provider"
import { PortalHost, PortalProvider } from "@/components/ui/portal"
import { ApiError } from "@/lib/api/errors"
import LoginScreen from "@/app/(auth)/login"
import PhoneMigrationScreen from "@/app/(auth)/phone-migration"
import VerifyOtpScreen from "@/app/(auth)/verify-otp"
import VerifyTwoFactorScreen from "@/app/(auth)/verify-2fa"
import WhatsappTriggerScreen from "@/app/(auth)/whatsapp-trigger"
import ChangePinScreen from "@/app/change-pin"

function themed(ui: ReactElement) {
  return <ThemeProvider><PortalProvider>{ui}<PortalHost /></PortalProvider></ThemeProvider>
}

beforeEach(() => {
  vi.clearAllMocks()
  state.params = {}
  state.online = true
  state.identifier = ""
  state.wallet.mockResolvedValue({ hasPin: true })
  state.verifyOtp.mockRejectedValue(new ApiError({ code: "NETWORK", message: "offline" }))
  state.requestOtp.mockResolvedValue({ refCode: "new-code", whatsappUrl: "https://wa.me/6285786035715", expiresAt: "2099-01-01T00:00:00Z" })
  state.triggerStatus.mockResolvedValue({ status: "PENDING" })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe("A5 — phone migration always has a way out", () => {
  it("a missing token shows an actionable error immediately, not after an impossible submit", () => {
    render(themed(<PhoneMigrationScreen />))
    expect(screen.getByText("Sesi migrasi tidak valid. Silakan masuk kembali.")).toBeTruthy()
    fireEvent.click(screen.getByRole("link", { name: "Kembali ke Masuk" }))
    expect(state.replace).toHaveBeenCalledWith("/login")
    expect(state.requestOtp).not.toHaveBeenCalled()
  })
  it("an active migration can also be exited explicitly", () => {
    state.params = { migrationToken: "in-memory-existing-route" }
    render(themed(<PhoneMigrationScreen />))
    expect(screen.queryByText("Sesi migrasi tidak valid. Silakan masuk kembali.")).toBeNull()
    fireEvent.click(screen.getByRole("link", { name: "Kembali ke Masuk" }))
    expect(state.replace).toHaveBeenCalledWith("/login")
  })
})

describe("A6 — login method=phone", () => {
  it("has only identifier+password until WhatsApp is explicitly selected", () => {
    state.params = { method: "phone" }
    const { container } = render(themed(<LoginScreen />))
    expect(container.querySelectorAll("input")).toHaveLength(2)
    expect(screen.getByRole("button", { name: "Masuk dengan WhatsApp" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Minta kode verifikasi" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Masuk dengan WhatsApp" }))
    expect(container.querySelectorAll("input")).toHaveLength(3)
    expect(screen.getByRole("button", { name: "Minta kode verifikasi" })).toBeTruthy()
  })
})

describe("B2 — OTP input is never silently discarded after verification failure", () => {
  it.each(["NETWORK", "VALIDATION", "RATE_LIMITED"] as const)("keeps the full input after %s", async (code) => {
    state.verifyOtp.mockRejectedValueOnce(new ApiError({ code, message: code === "VALIDATION" ? "invalid otp code" : "offline" }))
    const { container } = render(themed(<VerifyOtpScreen />))
    const input = container.querySelector("input") as HTMLInputElement
    fireEvent.change(input, { target: { value: "123456" } })
    fireEvent.click(screen.getByRole("button", { name: "Verifikasi" }))
    await act(async () => {})
    expect(state.verifyOtp).toHaveBeenCalledWith(expect.objectContaining({ code: "123456" }))
    expect(input.value).toBe("123456")
    // The error-render path of the real OtpInput is exercised, not just the screen state.
    fireEvent.click(screen.getByRole("button", { name: "Verifikasi" }))
    await act(async () => {})
    expect(input.value).toBe("123456")
  })
  it("offline notice and retry preserve the already typed code", async () => {
    state.online = false
    const { container } = render(themed(<VerifyOtpScreen />))
    const input = container.querySelector("input") as HTMLInputElement
    fireEvent.change(input, { target: { value: "123456" } })
    expect(screen.getByText(/kode yang sudah diketik tidak hilang/)).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Verifikasi" }))
    await act(async () => {})
    expect(input.value).toBe("123456")
    expect(state.verifyOtp).not.toHaveBeenCalled()
  })
})

describe("B6 — PIN title waits for backend knowledge", () => {
  it.each([false, true])("unknown -> %s does not flash the wrong action", async (hasPin) => {
    let resolve!: (value: { hasPin: boolean }) => void
    state.wallet.mockReturnValueOnce(new Promise((done) => { resolve = done }))
    render(themed(<ChangePinScreen />))
    expect(screen.getByText("PIN dompet")).toBeTruthy()
    expect(screen.queryByText("Ubah PIN")).toBeNull()
    expect(screen.queryByText("Buat PIN")).toBeNull()
    await act(async () => resolve({ hasPin }))
    expect(screen.getByText(hasPin ? "Ubah PIN" : "Buat PIN")).toBeTruthy()
  })
})

describe("B8 — minimal WhatsApp trigger", () => {
  it("keeps the essential instructions, reference code, manual check and escape actions", async () => {
    render(themed(<WhatsappTriggerScreen />))
    expect(screen.getByText("abc123def456")).toBeTruthy()
    expect(screen.getByText(/bukan OTP 6 digit/)).toBeTruthy()
    expect(screen.getByRole("button", { name: "Kirim lewat WhatsApp" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Minta kode baru" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Masuk" })).toBeTruthy()
    expect(screen.queryByText(/Tidak bisa membuka WhatsApp otomatis/)).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Saya sudah kirim pesan" }))
    await act(async () => {})
    expect(state.triggerStatus).toHaveBeenCalledWith("abc123def456")
  })
  it("still distinguishes offline from normal waiting", () => {
    state.online = false
    render(themed(<WhatsappTriggerScreen />))
    expect(screen.getByText("Anda sedang offline")).toBeTruthy()
    expect(screen.queryByText("Menunggu balasan kode…")).toBeNull()
  })
})

describe("B15 — social 2FA has no dangling account line", () => {
  it("empty identifier has a complete generic instruction, without 'untuk akun:'", () => {
    render(themed(<VerifyTwoFactorScreen />))
    expect(screen.getByText("Buka aplikasi autentikator dan masukkan kode 6 digit.")).toBeTruthy()
    expect(document.body.textContent).not.toContain("untuk akun:")
  })
  it("non-empty identifier is still shown for password/phone logins", () => {
    state.identifier = "budi"
    render(themed(<VerifyTwoFactorScreen />))
    expect(screen.getByText("budi")).toBeTruthy()
  })
})
