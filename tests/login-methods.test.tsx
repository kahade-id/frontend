import type { ReactElement, ReactNode } from "react"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  params: {} as Record<string, string>,
  router: {
    replace: vi.fn(),
    push: vi.fn(),
    back: vi.fn(),
    canGoBack: vi.fn(() => false),
  },
  login: vi.fn(),
  generateCaptcha: vi.fn(),
  requestOtp: vi.fn(),
  getProviders: vi.fn(),
  socialLogin: vi.fn(),
  getSocialIdToken: vi.fn(),
  resolveTarget: vi.fn(),
  setPendingNext: vi.fn(),
}))

vi.mock("expo-router", () => ({
  useRouter: () => state.router,
  useLocalSearchParams: () => ({ ...state.params }),
  usePathname: () => "/login",
}))
vi.mock("@/components/theme-provider", () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => children,
  useTheme: () => ({ mode: "light", preference: "light", setPreference: vi.fn(), toggle: vi.fn() }),
}))
vi.mock("expo-apple-authentication", () => ({
  AppleAuthenticationButton: () => null,
  AppleAuthenticationButtonType: { SIGN_IN: 0 },
  AppleAuthenticationButtonStyle: { BLACK: 0 },
}))

vi.mock("@/lib/api", async () => ({
  ...await vi.importActual<Record<string, unknown>>("@/lib/api/errors"),
  api: {
    auth: {
      login: state.login,
      generateCaptcha: state.generateCaptcha,
      requestOtpTrigger: state.requestOtp,
    },
    passkey: {
      getAuthOptions: vi.fn(),
      verifyAuthLogin: vi.fn(),
    },
    social: {
      getProviders: state.getProviders,
      socialLogin: state.socialLogin,
    },
  },
}))

vi.mock("@/lib/location", () => ({ getAuthLocation: vi.fn(async () => null) }))
vi.mock("@/lib/login-redirect", () => ({
  setPendingNext: state.setPendingNext,
  resolvePostLoginTarget: state.resolveTarget,
}))
vi.mock("@/lib/use-auth-session", () => ({ useAuthSession: () => ({ restoring: false, token: null }) }))
vi.mock("@/lib/social-oauth", () => ({
  getSocialIdToken: state.getSocialIdToken,
  classifySocialError: () => "other",
  isAppleButtonSupported: () => true,
}))
vi.mock("@/lib/passkey", () => ({
  getPasskeyCapabilitySync: () => ({ supported: false }),
  startPasskeyAuthentication: vi.fn(),
  PasskeyError: class extends Error {
    code = "CANCELLED"
  },
}))

import { ThemeProvider } from "@/components/theme-provider"
import { PortalHost, PortalProvider } from "@/components/ui/portal"
import { ToastProvider } from "@/components/ui/toast"
import { LoginPasswordForm } from "@/components/auth/login-password-form"
import { LoginWhatsappForm } from "@/components/auth/login-whatsapp-form"
import LoginScreen from "@/app/(auth)/login"
import { clearLoginIdentifier } from "@/lib/login-identifier"
import { ApiError } from "@/lib/api/errors"

function themed(ui: ReactElement) {
  return (
    <ThemeProvider>
      <ToastProvider>
        <PortalProvider>
          {ui}
          <PortalHost />
        </PortalProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  clearLoginIdentifier()
  state.params = {}
  state.login.mockResolvedValue({ accessToken: "session-token" })
  state.generateCaptcha.mockResolvedValue({ captchaId: "captcha-1", targetX: 45 })
  state.requestOtp.mockResolvedValue({
    refCode: "otp-ref-123456",
    whatsappUrl: "https://wa.me/6285786035715?text=otp-ref-123456",
    triggerText: "otp-ref-123456",
    expiresAt: "2099-01-01T00:00:00Z",
  })
  state.getProviders.mockResolvedValue([])
  state.socialLogin.mockResolvedValue({ kind: "session" })
  state.getSocialIdToken.mockResolvedValue({ idToken: "oauth-id-token", nonce: "oauth-nonce" })
  state.resolveTarget.mockResolvedValue("/home")
})

afterEach(cleanup)

describe("password login views", () => {
  it("renders an email keyboard and rejects an invalid email before calling auth", async () => {
    render(themed(<LoginPasswordForm method="email" />))
    const email = screen.getByLabelText("Email") as HTMLInputElement
    expect(email.getAttribute("inputmode")).toBe("email")
    fireEvent.focus(email)
    expect(email.getAttribute("placeholder")).toBe("contoh@email.com")

    fireEvent.change(email, { target: { value: "not-an-email" } })
    fireEvent.change(screen.getByLabelText("Kata sandi"), { target: { value: "secret123" } })
    fireEvent.click(screen.getByRole("button", { name: "Masuk" }))

    expect(await screen.findByText(/Format email tidak valid/)).toBeTruthy()
    expect(state.login).not.toHaveBeenCalled()
  })

  it("submits a valid email and password using the frozen auth login payload", async () => {
    render(themed(<LoginPasswordForm method="email" nextPath="/orders" />))
    const email = screen.getByLabelText("Email") as HTMLInputElement
    fireEvent.change(email, { target: { value: "buyer@example.com" } })
    fireEvent.change(screen.getByLabelText("Kata sandi"), { target: { value: "secret123" } })
    fireEvent.click(screen.getByRole("button", { name: "Masuk" }))

    await waitFor(() => expect(state.login).toHaveBeenCalledTimes(1))
    expect(state.login).toHaveBeenCalledWith(expect.objectContaining({
      identifier: "buyer@example.com",
      password: "secret123",
      location: undefined,
    }))
    expect(state.setPendingNext).toHaveBeenCalledWith("/orders")
    await waitFor(() => expect(state.router.replace).toHaveBeenCalledWith("/home"))
  })

  it("uses a username-only field and rejects spaces or @", async () => {
    render(themed(<LoginPasswordForm method="username" />))
    const username = screen.getByLabelText("Username") as HTMLInputElement
    expect(username.getAttribute("inputmode")).toBeNull()
    expect(username.getAttribute("type")).not.toBe("email")
    expect(screen.queryByLabelText("Email")).toBeNull()
    fireEvent.change(username, { target: { value: "john doe" } })
    fireEvent.change(screen.getByLabelText("Kata sandi"), { target: { value: "secret123" } })
    fireEvent.click(screen.getByRole("button", { name: "Masuk" }))

    expect(await screen.findByText(/Username tidak boleh mengandung spasi/)).toBeTruthy()
    expect(state.login).not.toHaveBeenCalled()
  })

  it("submits a valid username as the identifier", async () => {
    render(themed(<LoginPasswordForm method="username" />))
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "johndoe" } })
    fireEvent.change(screen.getByLabelText("Kata sandi"), { target: { value: "secret123" } })
    fireEvent.click(screen.getByRole("button", { name: "Masuk" }))

    await waitFor(() => expect(state.login).toHaveBeenCalledWith(expect.objectContaining({
      identifier: "johndoe",
      password: "secret123",
    })))
  })

  it("warns after two failed attempts, before CAPTCHA is requested", async () => {
    state.login.mockRejectedValue(new ApiError({ code: "UNAUTHORIZED", message: "wrong credentials" }))
    render(themed(<LoginPasswordForm method="email" />))
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "buyer@example.com" } })
    fireEvent.change(screen.getByLabelText("Kata sandi"), { target: { value: "secret123" } })

    fireEvent.click(screen.getByRole("button", { name: "Masuk" }))
    await waitFor(() => expect(state.login).toHaveBeenCalledTimes(1))
    expect(screen.queryByText("Satu percobaan lagi sebelum verifikasi tambahan.")).toBeNull()

    fireEvent.click(screen.getByRole("button", { name: "Masuk" }))
    await waitFor(() => expect(state.login).toHaveBeenCalledTimes(2))
    expect(await screen.findByText("Satu percobaan lagi sebelum verifikasi tambahan.")).toBeTruthy()
    expect(state.generateCaptcha).not.toHaveBeenCalled()
  })

  it("fails closed while a server-required CAPTCHA is loading and unsolved", async () => {
    let resolveChallenge: ((challenge: { captchaId: string; targetX: number }) => void) | undefined
    state.login.mockRejectedValueOnce(
      new ApiError({
        code: "UNAUTHORIZED",
        backendCode: "CAPTCHA_REQUIRED",
        message: "captcha required",
      }),
    )
    state.generateCaptcha.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveChallenge = resolve
      }),
    )

    render(themed(<LoginPasswordForm method="email" />))
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "buyer@example.com" } })
    fireEvent.change(screen.getByLabelText("Kata sandi"), { target: { value: "secret123" } })
    fireEvent.click(screen.getByRole("button", { name: "Masuk" }))

    await waitFor(() => expect(state.generateCaptcha).toHaveBeenCalledTimes(1))
    expect(await screen.findByText("Memuat verifikasi keamanan…")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Masuk" }))
    expect(state.login).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveChallenge?.({ captchaId: "captcha-2", targetX: 42 })
    })
    expect(await screen.findByText("Verifikasi keamanan")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Masuk" }))
    expect(state.login).toHaveBeenCalledTimes(1)
  })

  it("shows a retry action if the required CAPTCHA cannot load", async () => {
    state.login.mockRejectedValueOnce(
      new ApiError({
        code: "UNAUTHORIZED",
        backendCode: "CAPTCHA_REQUIRED",
        message: "captcha required",
      }),
    )
    state.generateCaptcha.mockRejectedValueOnce(new ApiError({ code: "NETWORK", message: "offline" }))

    render(themed(<LoginPasswordForm method="email" />))
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "buyer@example.com" } })
    fireEvent.change(screen.getByLabelText("Kata sandi"), { target: { value: "secret123" } })
    fireEvent.click(screen.getByRole("button", { name: "Masuk" }))

    expect(await screen.findByText("Verifikasi keamanan belum termuat.")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Masuk" }))
    expect(state.login).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole("link", { name: "Coba lagi" }))
    await waitFor(() => expect(state.generateCaptcha).toHaveBeenCalledTimes(2))
    expect(await screen.findByText("Verifikasi keamanan")).toBeTruthy()
    expect(state.login).toHaveBeenCalledTimes(1)
  })
})

describe("WhatsApp OTP login", () => {
  it("renders only the phone/OTP form and requests a WhatsApp code", async () => {
    render(themed(<LoginWhatsappForm nextPath="/orders" />))
    expect(screen.queryByLabelText("Kata sandi")).toBeNull()

    fireEvent.change(screen.getByLabelText("Nomor HP Indonesia"), {
      target: { value: "81234567890" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Minta kode verifikasi" }))

    await waitFor(() => expect(state.requestOtp).toHaveBeenCalledWith(expect.objectContaining({
      phoneNumber: "+6281234567890",
      purpose: "login",
      location: undefined,
    })))
    expect(state.setPendingNext).toHaveBeenCalledWith("/orders")
    expect(state.router.push).toHaveBeenCalled()
  })

  it("blocks an invalid Indonesian phone number", async () => {
    render(themed(<LoginWhatsappForm />))
    fireEvent.change(screen.getByLabelText("Nomor HP Indonesia"), { target: { value: "1234" } })
    fireEvent.click(screen.getByRole("button", { name: "Minta kode verifikasi" }))

    expect(await screen.findByText(/Nomor HP tidak valid/)).toBeTruthy()
    expect(state.requestOtp).not.toHaveBeenCalled()
  })
})

describe("login method router and social OAuth", () => {
  it("shows the method selector in the screen and switches to OTP without a password", () => {
    const { container } = render(themed(<LoginScreen />))
    expect(screen.getByRole("radiogroup", { name: "Metode masuk" })).toBeTruthy()
    expect(container.querySelector('input[aria-label="Email"]')).toBeTruthy()

    fireEvent.click(screen.getByRole("radio", { name: "WhatsApp" }))
    expect(screen.getByRole("button", { name: "Minta kode verifikasi" })).toBeTruthy()
    expect(container.querySelector('input[type="password"]')).toBeNull()
    expect(screen.queryByText("Masuk dengan WhatsApp")).toBeNull()
  })

  it("method=phone opens OTP directly, with no password form", () => {
    state.params = { method: "phone" }
    const { container } = render(themed(<LoginScreen />))
    expect(screen.getByRole("button", { name: "Minta kode verifikasi" })).toBeTruthy()
    expect(container.querySelector('input[type="password"]')).toBeNull()
    expect(screen.queryByRole("radiogroup", { name: "Metode masuk" })).toBeTruthy()
    expect(screen.getByText("Demi keamanan, lokasi perangkat dapat dicatat jika Anda mengizinkan akses.")).toBeTruthy()
    expect(screen.queryByRole("link", { name: "Lupa kata sandi?" })).toBeNull()
  })

  it("shows social OAuth below the credential form and starts it without password submission", async () => {
    state.getProviders.mockResolvedValue([
      { provider: "GOOGLE", enabled: true, configured: true, appId: "google-client-id" },
    ])
    render(themed(<LoginScreen />))

    fireEvent.click(await screen.findByRole("button", { name: "Masuk dengan Google" }))
    await waitFor(() => expect(state.socialLogin).toHaveBeenCalledWith({
      provider: "GOOGLE",
      idToken: "oauth-id-token",
      nonce: "oauth-nonce",
    }))
    expect(state.login).not.toHaveBeenCalled()
  })

  it.each([
    ["google", "GOOGLE"],
    ["apple", "APPLE"],
  ] as const)("method=%s launches %s OAuth directly", async (method, provider) => {
    state.params = { method }
    state.getProviders.mockResolvedValue([
      { provider, enabled: true, configured: true, appId: `${method}-client-id` },
    ])
    render(themed(<LoginScreen />))

    expect(screen.queryByLabelText("Email")).toBeNull()
    expect(screen.queryByRole("link", { name: "Lupa kata sandi?" })).toBeNull()
    await waitFor(() => expect(state.socialLogin).toHaveBeenCalledWith({
      provider,
      idToken: "oauth-id-token",
      nonce: "oauth-nonce",
    }))
  })
})
