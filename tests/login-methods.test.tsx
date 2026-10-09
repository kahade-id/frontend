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
  getPasskeyCapability: vi.fn(async () => ({
    supported: false,
    conditionalMediation: false,
    platformAuthenticator: false,
  })),
  startPasskeyAuthentication: vi.fn(),
  passkeyAuthOptions: vi.fn(),
  passkeyVerify: vi.fn(),
}))

vi.mock("expo-router", () => ({
  useRouter: () => state.router,
  useLocalSearchParams: () => ({ ...state.params }),
  usePathname: () => "/login",
  // Hub me-redirect deep link lama `?method=`; baris metode memakai <Link href>.
  Redirect: ({ href }: { href: string | { pathname: string; params?: Record<string, string> } }) => (
    <span
      data-testid="router-redirect"
      data-href={typeof href === "string" ? href : href.pathname}
      data-params={typeof href === "string" ? "" : JSON.stringify(href.params ?? {})}
    />
  ),
  Link: ({ href, children }: { href: string | { pathname: string }; children?: ReactNode }) => (
    <a href={typeof href === "string" ? href : href.pathname}>{children}</a>
  ),
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
      getAuthOptions: state.passkeyAuthOptions,
      verifyAuthLogin: state.passkeyVerify,
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
  getPasskeyCapability: state.getPasskeyCapability,
  startPasskeyAuthentication: state.startPasskeyAuthentication,
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
import LoginEmailScreen from "@/app/(auth)/login/email"
import LoginUsernameScreen from "@/app/(auth)/login/username"
import LoginWhatsappScreen from "@/app/(auth)/login/whatsapp"
import { clearLoginIdentifier } from "@/lib/login-identifier"
import { PASSKEY_COPY } from "@/lib/passkey-instructions"
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
  state.getPasskeyCapability.mockResolvedValue({
    supported: false,
    conditionalMediation: false,
    platformAuthenticator: false,
  })
  state.passkeyAuthOptions.mockResolvedValue({ challengeId: "pk-1", options: { challenge: "c" } })
  state.passkeyVerify.mockResolvedValue({ accessToken: "session-token" })
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

describe("hub Masuk — satu pintu, satu metode per halaman", () => {
  beforeEach(() => {
    state.getProviders.mockResolvedValue([
      { provider: "GOOGLE", enabled: true, configured: true, appId: "google-client-id" },
    ])
  })

  it("menampilkan aksi besar + pemisah \"atau\" + tiga tautan halaman metode", async () => {
    const { container } = render(themed(<LoginScreen />))

    expect(await screen.findByRole("button", { name: /Lanjut dengan Google/ })).toBeTruthy()
    expect(screen.getByRole("button", { name: /Masuk dengan Passkey/i })).toBeTruthy()
    expect(screen.getByText("atau")).toBeTruthy()

    // Satu metode = satu halaman: baris metode adalah tautan rute, bukan radio
    // yang menukar form di layar yang sama.
    expect(container.querySelector('a[href="/login/whatsapp"]')).toBeTruthy()
    expect(container.querySelector('a[href="/login/email"]')).toBeTruthy()
    expect(container.querySelector('a[href="/login/username"]')).toBeTruthy()

    // Hub tidak boleh punya kolom kredensial sama sekali.
    expect(container.querySelectorAll("input")).toHaveLength(0)
    expect(screen.queryByRole("radiogroup")).toBeNull()
  })

  it("mengganti paragraf disclaimer dengan satu baris persetujuan bertautan", async () => {
    render(themed(<LoginScreen />))
    await screen.findByRole("button", { name: /Lanjut dengan Google/ })

    expect(screen.getByRole("link", { name: "Syarat & Ketentuan" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Kebijakan Privasi" })).toBeTruthy()
    expect(
      screen.queryByText("Demi keamanan, lokasi perangkat dapat dicatat jika Anda mengizinkan akses."),
    ).toBeNull()
    // Detailnya pindah ke ikon ⓘ di header, tetap satu ketukan dari layar ini.
    expect(screen.getByRole("button", { name: "Detail keamanan masuk" })).toBeTruthy()
  })

  it("tetap mengarahkan pendaftaran ke nomor HP dan menyediakan pemulihan akun", async () => {
    render(themed(<LoginScreen />))
    await screen.findByRole("button", { name: /Lanjut dengan Google/ })

    fireEvent.click(screen.getByRole("link", { name: "Daftar" }))
    expect(state.router.push).toHaveBeenCalledWith("/register")
    fireEvent.click(screen.getByRole("link", { name: "Lupa kata sandi?" }))
    expect(state.router.push).toHaveBeenCalledWith("/forgot-password")
    fireEvent.click(screen.getByRole("link", { name: "Akun dihapus? Pulihkan di sini" }))
    expect(state.router.push).toHaveBeenCalledWith("/deletion-status")
  })

  it("menjalankan OAuth Google dari hub tanpa menyentuh login kata sandi", async () => {
    render(themed(<LoginScreen />))

    fireEvent.click(await screen.findByRole("button", { name: /Lanjut dengan Google/ }))
    await waitFor(() =>
      expect(state.socialLogin).toHaveBeenCalledWith({
        provider: "GOOGLE",
        idToken: "oauth-id-token",
        nonce: "oauth-nonce",
      }),
    )
    expect(state.login).not.toHaveBeenCalled()
  })

  it("passkey: perangkat tidak mendukung → penjelasan spesifik, bukan permintaan ke server", async () => {
    render(themed(<LoginScreen />))

    fireEvent.click(await screen.findByRole("button", { name: /Masuk dengan Passkey/i }))
    expect(await screen.findByText(PASSKEY_COPY.loginNativeInfo.title)).toBeTruthy()
    expect(state.passkeyAuthOptions).not.toHaveBeenCalled()
    expect(state.router.replace).not.toHaveBeenCalled()
  })

  it("passkey: perangkat mendukung → assertion ditukar menjadi sesi", async () => {
    state.getPasskeyCapability.mockResolvedValue({
      supported: true,
      conditionalMediation: false,
      platformAuthenticator: true,
    })
    state.startPasskeyAuthentication.mockResolvedValue({ id: "cred-1", rawId: "raw", type: "public-key" })
    render(themed(<LoginScreen />))

    fireEvent.click(await screen.findByRole("button", { name: /Masuk dengan Passkey/i }))
    await waitFor(() => expect(state.passkeyAuthOptions).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(state.passkeyVerify).toHaveBeenCalledWith({
      challengeId: "pk-1",
      assertion: { id: "cred-1", rawId: "raw", type: "public-key" },
    }))
    await waitFor(() => expect(state.router.replace).toHaveBeenCalledWith("/home"))
  })

  it("passkey: verifikasi dua langkah diteruskan ke layar 2FA", async () => {
    state.getPasskeyCapability.mockResolvedValue({
      supported: true,
      conditionalMediation: false,
      platformAuthenticator: true,
    })
    state.startPasskeyAuthentication.mockResolvedValue({ id: "cred-1", rawId: "raw", type: "public-key" })
    state.passkeyVerify.mockResolvedValue({ requiresTwoFactor: true, tempToken: "tmp-1" })
    render(themed(<LoginScreen />))

    fireEvent.click(await screen.findByRole("button", { name: /Masuk dengan Passkey/i }))
    await waitFor(() => expect(state.router.push).toHaveBeenCalledWith("/verify-2fa"))
    expect(state.router.replace).not.toHaveBeenCalled()
  })

  it.each([
    ["phone", "/login/whatsapp"],
    ["email", "/login/email"],
    ["username", "/login/username"],
  ] as const)("deep link lama method=%s dialihkan ke %s", (method, target) => {
    state.params = { method }
    render(themed(<LoginScreen />))

    expect(screen.getByTestId("router-redirect").getAttribute("data-href")).toBe(target)
  })

  it("deep link lama meneruskan `next` ke halaman metode", () => {
    state.params = { method: "email", next: "/transactions" }
    render(themed(<LoginScreen />))

    const redirect = screen.getByTestId("router-redirect")
    expect(redirect.getAttribute("data-href")).toBe("/login/email")
    // Tujuan semula tidak boleh hilang di tengah alur (OTP/2FA).
    expect(redirect.getAttribute("data-params")).toBe(JSON.stringify({ next: "/transactions" }))
  })

  it.each([
    ["google", "GOOGLE"],
    ["apple", "APPLE"],
  ] as const)("method=%s memulai OAuth %s langsung di hub", async (method, provider) => {
    state.params = { method }
    state.getProviders.mockResolvedValue([
      { provider, enabled: true, configured: true, appId: `${method}-client-id` },
    ])
    render(themed(<LoginScreen />))

    await waitFor(() =>
      expect(state.socialLogin).toHaveBeenCalledWith({
        provider,
        idToken: "oauth-id-token",
        nonce: "oauth-nonce",
      }),
    )
    expect(state.login).not.toHaveBeenCalled()
  })
})

describe("halaman metode: satu kredensial per layar", () => {
  it("halaman WhatsApp hanya meminta nomor HP", () => {
    const { container } = render(themed(<LoginWhatsappScreen />))

    expect(screen.getByRole("heading", { name: "Masuk dengan WhatsApp" })).toBeTruthy()
    expect(screen.getByLabelText("Nomor HP Indonesia")).toBeTruthy()
    expect(container.querySelector('input[type="password"]')).toBeNull()
    expect(screen.getByRole("button", { name: "Minta kode verifikasi" })).toBeTruthy()
  })

  it("halaman email meminta email + kata sandi dan menawarkan lupa kata sandi", () => {
    const { container } = render(themed(<LoginEmailScreen />))

    expect(screen.getByRole("heading", { name: "Masuk dengan email" })).toBeTruthy()
    expect(screen.getByLabelText("Email")).toBeTruthy()
    expect(container.querySelector('input[type="password"]')).toBeTruthy()
    expect(screen.getByRole("link", { name: "Lupa kata sandi?" })).toBeTruthy()
    // Tidak ada metode lain yang menumpuk di halaman ini.
    expect(screen.queryByLabelText("Nomor HP Indonesia")).toBeNull()
    expect(screen.queryByLabelText("Username")).toBeNull()
  })

  it("halaman username meminta username, bukan email", () => {
    render(themed(<LoginUsernameScreen />))

    expect(screen.getByRole("heading", { name: "Masuk dengan username" })).toBeTruthy()
    expect(screen.getByLabelText("Username")).toBeTruthy()
    expect(screen.queryByLabelText("Email")).toBeNull()
  })

  it("setiap halaman metode menyediakan jalan keluar ke hub dan ke pendaftaran", () => {
    render(themed(<LoginWhatsappScreen />))

    expect(screen.getByRole("link", { name: "Pilih metode lain" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Daftar" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Syarat & Ketentuan" })).toBeTruthy()
  })
})
