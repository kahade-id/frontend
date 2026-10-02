import type { ReactElement, ReactNode } from "react"
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  preferences: vi.fn(),
  update: vi.fn(),
  syncTimezone: vi.fn(),
  status: vi.fn(),
  regenerate: vi.fn(),
  toast: { show: vi.fn() },
}))
vi.mock("@/lib/api", async () => ({
  ...await vi.importActual<Record<string, unknown>>("@/lib/api/errors"),
  api: {
    notifications: { getNotificationPreferences: state.preferences, updateNotificationPreferences: state.update, syncQuietHoursTimezone: state.syncTimezone },
    auth: { get2faStatus: state.status, regenerateBackupCodes: state.regenerate },
  },
}))
vi.mock("@/components/ui/toast", () => ({ useToast: () => state.toast }))
vi.mock("@/lib/push-notifications", () => ({ getDevicePushPermissionGranted: async () => false }))
vi.mock("@/lib/web-push-config", () => ({ isWebPushConfigured: () => false }))
vi.mock("@/lib/web-push", () => ({ getWebPushStatus: () => ({ supported: false, permission: "default", registrationToken: null }), requestWebPushPermission: vi.fn() }))
vi.mock("@/lib/export-file", () => ({ saveBlobFile: vi.fn() }))
vi.mock("@/components/ui/keyboard-avoiding", () => ({ KeyboardAvoiding: ({ children }: { children: ReactNode }) => <div data-testid="keyboard-avoiding">{children}</div> }))
vi.mock("@/components/ui/qr-code-display", () => ({ QRCodeDisplay: () => null }))

import { ThemeProvider } from "@/components/theme-provider"
import { PortalHost, PortalProvider } from "@/components/ui/portal"
import { ApiError } from "@/lib/api/errors"
import { invalidateQueryCache } from "@/lib/use-api-query"
import { LOCAL_NOTIFICATION_KINDS, setLocalNotificationPref, getLocalNotificationPrefsSnapshot } from "@/lib/notification-local-prefs"
import { setFontScale } from "@/lib/font-scale"
import NotificationPreferencesScreen from "@/app/notification-preferences"
import AppearanceScreen from "@/app/appearance"
import TwoFactorScreen from "@/app/two-factor"

function themed(ui: ReactElement) {
  return <ThemeProvider><PortalProvider>{ui}<PortalHost /></PortalProvider></ThemeProvider>
}
const preferences = {
  orderInApp: true, orderPush: true, orderEmail: true,
  walletInApp: true, walletPush: true, walletEmail: false,
  securityInApp: true, securityPush: true, securityEmail: true,
  chatInApp: true, chatPush: true,
  disputeInApp: true, disputePush: true, disputeEmail: true,
  rankingInApp: true, rankingPush: true, marketingEmail: false,
  quietHoursEnabled: false, quietHoursStart: "22:00", quietHoursEnd: "07:00",
  quietHoursTimezone: "UTC", digestFrequency: "off",
}

beforeEach(() => {
  vi.clearAllMocks()
  invalidateQueryCache()
  for (const kind of LOCAL_NOTIFICATION_KINDS) setLocalNotificationPref(kind, true)
  setFontScale(1)
  state.preferences.mockResolvedValue(preferences)
  state.update.mockImplementation(async (dto) => ({ ...preferences, ...dto }))
  state.status.mockResolvedValue({ enabled: true, backupCodesRemaining: 1 })
  state.regenerate.mockResolvedValue({ backupCodes: ["test-code"] })
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe("B1 — notification settings are one independent device + server screen", () => {
  it.each(["loading", "error"])("device toggles remain usable while the server is %s", async (mode) => {
    if (mode === "loading") state.preferences.mockReturnValue(new Promise(() => {}))
    else state.preferences.mockRejectedValue(new ApiError({ code: "NETWORK", message: "unreachable" }))
    render(themed(<NotificationPreferencesScreen />))
    await act(async () => {})
    expect(screen.getByText("Perangkat ini")).toBeTruthy()
    expect(screen.getByText("Server")).toBeTruthy()
    const chat = screen.getByRole("switch", { name: "Chat" })
    expect(getLocalNotificationPrefsSnapshot().chat).toBe(true)
    fireEvent.click(chat)
    expect(getLocalNotificationPrefsSnapshot().chat).toBe(false)
    expect(getLocalNotificationPrefsSnapshot().chat).toBe(false)
    expect(state.update).not.toHaveBeenCalled()
    expect(screen.getByRole("switch", { name: "Etalase" })).toBeTruthy()
    if (mode === "error") expect(screen.getByRole("button", { name: "Coba lagi" })).toBeTruthy()
  })
  it("retains the matrix, digest and quiet hours; local toggles never call the server", async () => {
    render(themed(<NotificationPreferencesScreen />))
    const serverChat = await screen.findByRole("switch", { name: "Pesan, Di aplikasi" })
    expect(screen.getByText("Ringkasan notifikasi")).toBeTruthy()
    expect(screen.getByText("Jangan ganggu")).toBeTruthy()
    fireEvent.click(screen.getByRole("switch", { name: "Chat" }))
    expect(state.update).not.toHaveBeenCalled()
    fireEvent.click(serverChat)
    await act(async () => {})
    expect(state.update).toHaveBeenCalledWith({ chatInApp: false })
    fireEvent.click(serverChat)
    await act(async () => {})
    expect(state.update).toHaveBeenLastCalledWith({ chatInApp: true })
  })
  it("server failure rolls back only the changed server toggle, not device preferences", async () => {
    state.update.mockRejectedValue(new ApiError({ code: "NETWORK", message: "unreachable" }))
    render(themed(<NotificationPreferencesScreen />))
    const serverChat = await screen.findByRole("switch", { name: "Pesan, Di aplikasi" })
    fireEvent.click(screen.getByRole("switch", { name: "Chat" }))
    fireEvent.click(serverChat)
    await act(async () => {})
    fireEvent.click(serverChat)
    await act(async () => {})
    expect(state.update).toHaveBeenLastCalledWith({ chatInApp: false })
    expect(getLocalNotificationPrefsSnapshot().chat).toBe(false)
    expect(state.toast.show).toHaveBeenCalledWith(expect.objectContaining({ tone: "danger" }))
  })
})

describe("B5 — appearance controls remain interactive in the scroll screen", () => {
  it("keeps light/dark/system, font controls and the live preview", () => {
    render(themed(<AppearanceScreen />))
    expect(screen.getByText("Mengikuti pengaturan terang/gelap perangkat Anda.")).toBeTruthy()
    expect(screen.getByText("Ukuran teks")).toBeTruthy()
    expect(screen.getByText("100%")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Perbesar ukuran teks" }))
    expect(screen.getByText("105%")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Atur ulang" }))
    expect(screen.getByText("100%")).toBeTruthy()
  })
})

describe("B13 — actual backup regeneration screen opens keyboard-aware, scrollable confirmation", () => {
  it("requires password+authenticator code inside the keyboard-avoiding dialog", async () => {
    const { container } = render(themed(<TwoFactorScreen />))
    fireEvent.click(await screen.findByRole("button", { name: "Buat ulang kode" }))
    expect(screen.getByRole("button", { name: "Buat Kode Baru" })).toBeTruthy()
    const avoiding = screen.getByRole("button", { name: "Buat Kode Baru" }).closest('[data-testid="keyboard-avoiding"]') as HTMLElement
    const fields = avoiding.querySelectorAll("input")
    expect(fields).toHaveLength(2)
    expect(within(avoiding).getByRole("button", { name: "Buat Kode Baru" })).toBeTruthy()
    const password = container.ownerDocument.querySelector('input[type="password"]') as HTMLInputElement
    fireEvent.change(password, { target: { value: "test-password" } })
    const otp = avoiding.querySelector('input[inputmode="numeric"]') as HTMLInputElement
    fireEvent.change(otp, { target: { value: "123456" } })
    fireEvent.click(screen.getByRole("button", { name: "Buat Kode Baru" }))
    await act(async () => {})
    expect(state.regenerate).toHaveBeenCalledWith({ password: "test-password", code: "123456" })
  })
})
