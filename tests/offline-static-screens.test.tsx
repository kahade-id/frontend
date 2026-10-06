import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const helpApi = vi.hoisted(() => ({
  trackView: vi.fn().mockResolvedValue(undefined),
  submitFeedback: vi.fn().mockResolvedValue(undefined),
}))
const bootApi = vi.hoisted(() => ({
  getAccessToken: vi.fn().mockResolvedValue(null),
  clearSession: vi.fn().mockResolvedValue(undefined),
  getSessionSnapshot: vi.fn(() => null),
  getSessionRevision: vi.fn(() => 0),
  subscribeSession: vi.fn(() => () => undefined),
  hasSeenOnboarding: vi.fn().mockResolvedValue(false),
  getLastNativeRoute: vi.fn().mockResolvedValue(null),
  subscribeLastRouteRestore: vi.fn(() => () => undefined),
}))

vi.mock("@/lib/api/session", () => ({
  getAccessToken: bootApi.getAccessToken,
  getSessionSnapshot: bootApi.getSessionSnapshot,
  getSessionRevision: bootApi.getSessionRevision,
  subscribeSession: bootApi.subscribeSession,
}))
vi.mock("@/lib/onboarding", () => ({ hasSeenOnboarding: bootApi.hasSeenOnboarding }))
vi.mock("@/lib/last-route", () => ({
  getLastNativeRoute: bootApi.getLastNativeRoute,
  isLastRouteRestoreSuppressed: () => false,
  subscribeLastRouteRestore: bootApi.subscribeLastRouteRestore,
}))

vi.mock("@/lib/api", () => ({
  api: {
    helpCenter: {
      trackHelpArticleView: helpApi.trackView,
      submitHelpArticleFeedback: helpApi.submitFeedback,
    },
  },
}))

// Keamanan menampilkan kontrol keluar lokal ini; aksi jaringan di kontrol
// tersebut bukan bagian dari render menu yang diuji di sini.
vi.mock("@/lib/biometrics", () => ({
  getBiometricCapability: vi.fn().mockResolvedValue({
    available: false,
    kind: "none",
    label: "biometrik",
  }),
  authenticateBiometric: vi.fn().mockResolvedValue("unavailable"),
}))

import { OfflineBanner } from "@/components/offline-banner"
import { DataScreen } from "@/components/ui/data-screen"
import { ThemeProvider } from "@/components/theme-provider"
import { PortalHost, PortalProvider } from "@/components/ui/portal"
import { ToastProvider } from "@/components/ui/toast"
import { Platform } from "react-native"
import { initConnectivity, getConnectivitySnapshot } from "@/lib/connectivity"
import { __setNetInfoState } from "@/tests/stubs/netinfo"
import { __setLocalSearchParams } from "@/tests/stubs/expo-router"

import IndexScreen from "@/app/index"
import OnboardingScreen from "@/app/(auth)/onboarding"
import AboutScreen from "@/app/about"
import AppVersionScreen from "@/app/app-version"
import AppearanceScreen from "@/app/appearance"
import BiometricSettingsScreen from "@/app/biometric-settings"
import NotFoundScreen from "@/app/+not-found"
import LoginRequiredScreen from "@/app/login-required"
import SecurityScreen from "@/app/security"
import FaqScreen from "@/app/faq"
import HelpScreen from "@/app/help/[slug]"
import TermsScreen from "@/app/terms"
import PrivacyPolicyScreen from "@/app/privacy-policy"
import HomeRedirect from "@/app/home"
import MoreRedirect from "@/app/more"
import NotificationSettingsRedirect from "@/app/notification-settings"
import SavedRedirect from "@/app/saved"
import LegacySubscriptionsRedirect from "@/app/subscriptions"

const OFFLINE_ERROR_COPY = /Terjadi kesalahan|Gagal memuat|Tidak ada koneksi internet/i

function renderOffline(ui: ReactNode) {
  return render(
    <ThemeProvider>
      <PortalProvider>
        <ToastProvider>
          <OfflineBanner />
          {ui}
          <PortalHost />
        </ToastProvider>
      </PortalProvider>
    </ThemeProvider>,
  )
}

function expectOfflineReady() {
  expect(screen.getByRole("alert", { name: "Anda sedang offline" })).toBeTruthy()
  expect(screen.queryByText(OFFLINE_ERROR_COPY)).toBeNull()
}

beforeAll(async () => {
  __setNetInfoState({ type: "none", isConnected: false, isInternetReachable: false })
  initConnectivity()
  await waitFor(() => expect(getConnectivitySnapshot()).toBe(false))
})

beforeEach(() => {
  __setLocalSearchParams({})
  helpApi.trackView.mockClear()
  helpApi.submitFeedback.mockClear()
})

afterEach(() => {
  cleanup()
})

afterAll(() => {
  act(() => __setLocalSearchParams({}))
})

describe("Kategori A — UI/menu lokal saat offline", () => {
  it("gate awal membaca sesi dan mengarahkan ke onboarding tanpa koneksi", async () => {
    const originalPlatform = Platform.OS
    Object.defineProperty(Platform, "OS", { configurable: true, value: "ios" })
    try {
      const view = renderOffline(<IndexScreen />)
      expectOfflineReady()
      await waitFor(() => expect(screen.getByTestId("router-redirect")).toBeTruthy())
      expect(screen.getByTestId("router-redirect").getAttribute("data-href")).toBe("/onboarding")
      expect(bootApi.getAccessToken).toHaveBeenCalled()
      expect(bootApi.hasSeenOnboarding).toHaveBeenCalled()
      view.unmount()
    } finally {
      Object.defineProperty(Platform, "OS", { configurable: true, value: originalPlatform })
    }
  })

  it("onboarding tetap membuka pilihan masuk/daftar", () => {
    renderOffline(<OnboardingScreen />)
    expectOfflineReady()
    expect(screen.getByText("Daftar")).toBeTruthy()
    expect(screen.getByText("Masuk")).toBeTruthy()
  })

  it("Tentang Kami merender versi dan tautan lokal", () => {
    renderOffline(<AboutScreen />)
    expectOfflineReady()
    expect(screen.getByText("Tentang Kami")).toBeTruthy()
    expect(screen.getByText("Syarat & Ketentuan")).toBeTruthy()
  })

  it("Versi Aplikasi merender informasi runtime lokal tanpa pemeriksaan server", () => {
    renderOffline(<AppVersionScreen />)
    expectOfflineReady()
    expect(screen.getByText("Versi Aplikasi")).toBeTruthy()
    expect(screen.queryByText(/Memeriksa versi server|Versi di toko aplikasi/i)).toBeNull()
  })

  it("Tampilan membuka preferensi perangkat tanpa state jaringan", () => {
    renderOffline(<AppearanceScreen />)
    expectOfflineReady()
    expect(screen.getByText("Tampilan")).toBeTruthy()
    expect(screen.getByText("Mode warna")).toBeTruthy()
  })

  it("Biometrik menampilkan pengaturan perangkat tanpa error jaringan", async () => {
    renderOffline(<BiometricSettingsScreen />)
    expectOfflineReady()
    expect(screen.getByText("Biometrik")).toBeTruthy()
    await waitFor(() => expect(screen.getByText("Lapisan keamanan lain")).toBeTruthy())
  })

  it("Keamanan langsung menampilkan semua pintasan tanpa memuat status server", () => {
    renderOffline(<SecurityScreen />)
    expectOfflineReady()
    expect(screen.getByText("Keamanan")).toBeTruthy()
    expect(screen.getByText("Ganti Email")).toBeTruthy()
    expect(screen.getByText("Perangkat & Log")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Keluar" })).toBeTruthy()
    expect(screen.queryByText(/Memuat pengaturan keamanan|Gagal memuat pengaturan keamanan/i)).toBeNull()
  })

  it("ajakan login dan halaman tidak ditemukan tetap dapat dibuka", () => {
    const login = renderOffline(<LoginRequiredScreen />)
    expectOfflineReady()
    expect(screen.getByText("Masuk dulu untuk melanjutkan")).toBeTruthy()
    login.unmount()

    renderOffline(<NotFoundScreen />)
    expectOfflineReady()
    expect(screen.getByText("Tautan tidak tersedia")).toBeTruthy()
  })

  it.each([
    ["/home", <HomeRedirect />],
    ["/more", <MoreRedirect />],
    ["/notification-settings", <NotificationSettingsRedirect />],
    ["/saved", <SavedRedirect />],
    ["/subscriptions", <LegacySubscriptionsRedirect />],
  ])("alias navigasi %s tidak membutuhkan request", (_route, screenNode) => {
    renderOffline(screenNode)
    expectOfflineReady()
    expect(screen.getByTestId("router-redirect")).toBeTruthy()
  })
})

describe("Kategori B — konten bantuan/legal dari bundle saat offline", () => {
  it("Pusat Bantuan langsung menampilkan kategori dan pencarian lokal", () => {
    renderOffline(<FaqScreen />)
    expectOfflineReady()
    expect(screen.getByText("Pusat Bantuan")).toBeTruthy()
    expect(screen.getByText("Transaksi aman")).toBeTruthy()
    expect(screen.getByText("Akun & keamanan")).toBeTruthy()
  })

  it("daftar artikel kategori tersedia tanpa pernah online", () => {
    __setLocalSearchParams({ slug: "transaksi" })
    renderOffline(<HelpScreen />)
    expectOfflineReady()
    expect(screen.getByText("Bagaimana cara kerja transaksi aman di Kahade?")).toBeTruthy()
    expect(screen.getByText("Apa yang perlu dilakukan jika pesanan belum diterima?")).toBeTruthy()
  })

  it("isi artikel lengkap tersedia dan tidak mengirim telemetri saat offline", () => {
    __setLocalSearchParams({ slug: "transaksi", article: "cara-kerja-transaksi-aman" })
    renderOffline(<HelpScreen />)
    expectOfflineReady()
    expect(screen.getByRole("heading", { name: "Bagaimana cara kerja transaksi aman di Kahade?" })).toBeTruthy()
    expect(screen.getAllByText("Sebelum membuat transaksi").length).toBeGreaterThan(0)
    expect(screen.getByText(/Dana transaksi ditahan sesuai alur escrow Kahade/)).toBeTruthy()
    expect(helpApi.trackView).not.toHaveBeenCalled()
    expect(helpApi.submitFeedback).not.toHaveBeenCalled()
  })

  it("Syarat & Ketentuan tampil penuh dari bundle tanpa spinner", () => {
    renderOffline(<TermsScreen />)
    expectOfflineReady()
    expect(screen.getByText("Daftar Isi")).toBeTruthy()
    expect(screen.getByText("Versi 1.0")).toBeTruthy()
    expect(screen.getByText(/Syarat & Ketentuan ini merupakan perjanjian/)).toBeTruthy()
    expect(screen.queryByText(/Memuat/)).toBeNull()
  })

  it("Kebijakan Privasi tampil penuh dari bundle tanpa spinner", () => {
    renderOffline(<PrivacyPolicyScreen />)
    expectOfflineReady()
    expect(screen.getByText("Daftar Isi")).toBeTruthy()
    expect(screen.getByText("Ringkasan Utama")).toBeTruthy()
    expect(screen.getByText(/Kebijakan Privasi ini menjelaskan bagaimana/)).toBeTruthy()
    expect(screen.queryByText(/Memuat/)).toBeNull()
  })
})

describe("Data layar saat offline tanpa cache", () => {
  it("menampilkan state netral, bukan error state", () => {
    renderOffline(
      <DataScreen
        title="Daftar Transaksi"
        state={{
          loading: false,
          offlineMiss: true,
          error: null,
          refresh: () => undefined,
          reload: () => undefined,
        }}
      >
        <span>Konten yang belum tersedia</span>
      </DataScreen>,
    )
    expectOfflineReady()
    expect(screen.getByText("Data ini belum tersimpan di perangkat. Sambungkan kembali untuk memuatnya.")).toBeTruthy()
    expect(screen.queryByText("Konten yang belum tersedia")).toBeNull()
    expect(screen.queryByText(OFFLINE_ERROR_COPY)).toBeNull()
  })
})
