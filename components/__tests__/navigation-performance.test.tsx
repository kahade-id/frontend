import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const mocks = vi.hoisted(() => ({
  pathname: "/showcase",
  params: { kind: "dm", id: "alice", title: "Alice" },
  navigate: vi.fn(), replace: vi.fn(), back: vi.fn(), reselect: vi.fn(),
  dm: vi.fn(), shipment: vi.fn(),
}))
vi.mock("expo-router", () => ({
  usePathname: () => mocks.pathname,
  useRouter: () => ({ navigate: mocks.navigate }),
  useLocalSearchParams: () => mocks.params,
  router: { replace: mocks.replace, back: mocks.back },
}))
vi.mock("@/lib/i18n", () => ({ useLanguage: () => "id", translate: (text: string) => text }))
vi.mock("@/lib/haptics", () => ({ haptic: vi.fn() }))
vi.mock("@/lib/chat-unread-count", () => ({ useChatUnreadCountNumber: () => 0 }))
vi.mock("@/lib/unread-count", () => ({ useUnreadCountNumber: () => 0 }))
vi.mock("@/lib/shell-tab-reselect", () => ({ emitShellTabReselect: mocks.reselect }))
vi.mock("@/components/ui/bottom-tab-bar", () => ({
  BottomTabBar: ({ value, onChange }: { value: string; onChange: (key: string) => void }) => (
    <><output data-testid="active">{value}</output><button onClick={() => onChange("chat")}>Chat</button></>
  ),
}))
vi.mock("@/lib/guest-gate", () => ({ useGuestPathBlocked: () => false }))
vi.mock("@/lib/api", () => ({ api: { courier: { getShipmentByOrder: mocks.shipment } } }))
vi.mock("@/lib/api/chat", () => ({
  getOrCreateDm: mocks.dm,
  isDmNotAllowedError: (error: unknown) => error === "denied",
}))
vi.mock("@/lib/api/errors", () => ({ userMessage: () => "Network error" }))
vi.mock("@/components/ui/button", () => ({ Button: ({ children, onPress }: { children: ReactNode; onPress: () => void }) => <button onClick={onPress}>{children}</button> }))
vi.mock("@/components/ui/data-screen", () => ({
  DataScreen: ({ state, loadingMessage, empty }: {
    state: { loading: boolean; error: string | null; reload: () => void }
    loadingMessage: string
    empty?: { title: string; description: string } | null
  }) => <><div>{state.loading ? loadingMessage : state.error ?? empty?.title}</div><div>{empty?.description}</div><button onClick={state.reload}>Retry</button></>,
}))

import { ShellTabBar } from "@/components/ui/shell-tab-bar"
import PrepareNavigationScreen from "@/app/prepare-navigation"

beforeEach(() => {
  vi.clearAllMocks()
  mocks.pathname = "/showcase"
  mocks.params = { kind: "dm", id: "alice", title: "Alice" }
})
afterEach(() => { cleanup(); vi.useRealTimers() })

describe("optimistic shell feedback", () => {
  it("selects immediately without waiting for pathname, then rolls back a blocked navigation", () => {
    vi.useFakeTimers()
    render(<ShellTabBar />)
    fireEvent.click(screen.getByText("Chat"))
    expect(screen.getByTestId("active").textContent).toBe("chat")
    expect(mocks.navigate).toHaveBeenCalledWith("/chat")
    act(() => { vi.advanceTimersByTime(1500) })
    expect(screen.getByTestId("active").textContent).toBe("showcase")
  })
  it("reconciles with an actual route change", () => {
    const view = render(<ShellTabBar />)
    fireEvent.click(screen.getByText("Chat"))
    mocks.pathname = "/notifications"
    // New key emulates a fresh route subscription snapshot in this mock.
    view.rerender(<ShellTabBar key="route-change" />)
    expect(screen.getByTestId("active").textContent).toBe("notifications")
  })
})

describe("network resolution after navigation", () => {
  it("shows preparing while DM is pending, then replaces the shell", async () => {
    let resolve!: (room: { id: string }) => void
    mocks.dm.mockReturnValue(new Promise((done) => { resolve = done }))
    render(<PrepareNavigationScreen />)
    expect(screen.getByText("Menyiapkan percakapan…")).toBeTruthy()
    expect(mocks.replace).not.toHaveBeenCalled()
    await act(async () => { resolve({ id: "room-1" }) })
    expect(mocks.replace).toHaveBeenCalledTimes(1)
  })
  it("never redirects after back/unmount during a pending DM", async () => {
    let resolve!: (room: { id: string }) => void
    mocks.dm.mockReturnValue(new Promise((done) => { resolve = done }))
    const view = render(<PrepareNavigationScreen />)
    view.unmount()
    await act(async () => { resolve({ id: "room-1" }) })
    expect(mocks.replace).not.toHaveBeenCalled()
  })
  it("preserves the DM permission refusal", async () => {
    mocks.dm.mockRejectedValue("denied")
    render(<PrepareNavigationScreen />)
    await waitFor(() => expect(screen.getByText("Tidak bisa mengirim pesan")).toBeTruthy())
    expect(mocks.replace).not.toHaveBeenCalled()
  })
  it("keeps manual shipment fallback on the destination", async () => {
    mocks.params = { kind: "tracking", id: "order-1", title: "" }
    mocks.shipment.mockResolvedValue(null)
    render(<PrepareNavigationScreen />)
    await waitFor(() => expect(screen.getByText("Belum ada data pelacakan")).toBeTruthy())
    expect(mocks.replace).not.toHaveBeenCalled()
  })
})
