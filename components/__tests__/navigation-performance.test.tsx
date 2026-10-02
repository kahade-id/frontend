import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const mocks = vi.hoisted(() => ({
  pathname: "/showcase",
  params: { kind: "dm", id: "alice" },
  navigate: vi.fn(), replace: vi.fn(), back: vi.fn(), reselect: vi.fn(),
  dm: vi.fn(), room: vi.fn(), targetProfile: vi.fn(), viewerProfile: vi.fn(), shipment: vi.fn(),
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
vi.mock("@/lib/api", () => ({
  api: {
    courier: { getShipmentByOrder: mocks.shipment },
    users: {
      getUserByUsername: mocks.targetProfile,
      getMeCached: mocks.viewerProfile,
    },
    chat: { getChatRoom: mocks.room },
  },
}))
vi.mock("@/lib/api/chat", () => ({
  getOrCreateDm: mocks.dm,
  isDmNotAllowedError: (error: unknown) => error === "denied",
  isSameDmAccount: (target: { id?: string | null; username?: string | null }, viewer: { id?: string | null; username?: string | null }) =>
    Boolean((target.id && viewer.id && target.id === viewer.id) ||
      (target.username && viewer.username && target.username.toLowerCase() === viewer.username.toLowerCase())),
  isChatRoomForDmTarget: (room: any, target: { id?: string | null; username: string }) => {
    if (!room?.id || room.orderId) return false
    const peer = room.otherUser ?? room.counterpart
    return Boolean(peer && peer.username?.toLowerCase() === target.username.toLowerCase() &&
      (!target.id || !peer.userId || peer.userId === target.id) &&
      (!target.id || !peer.id || peer.id === target.id))
  },
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
  mocks.params = { kind: "dm", id: "alice" }
  mocks.targetProfile.mockResolvedValue({ id: "user-alice", username: "alice" })
  mocks.viewerProfile.mockResolvedValue({ id: "internal-bob", userId: "user-bob", username: "bob" })
  mocks.dm.mockResolvedValue({
    id: "room-alice-bob",
    type: "INQUIRY",
    otherUser: { userId: "user-alice", username: "alice" },
    counterpart: { id: "user-alice", username: "alice" },
  })
  mocks.room.mockResolvedValue({
    id: "room-alice-bob",
    type: "INQUIRY",
    otherUser: { userId: "user-alice", username: "alice" },
    counterpart: { id: "user-alice", username: "alice" },
  })
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
  it("opens Alice's DM from Bob's account without putting the display name in the route", async () => {
    render(<PrepareNavigationScreen />)
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledTimes(1))
    expect(mocks.targetProfile).toHaveBeenCalledWith("alice", expect.any(AbortSignal))
    expect(mocks.viewerProfile).toHaveBeenCalledWith(expect.any(AbortSignal))
    const destination = mocks.replace.mock.calls[0]?.[0] as {
      pathname: string
      params: Record<string, string>
    }
    expect(destination.pathname).toBe("/chat/[roomId]")
    expect(destination.params.roomId).toBe("room-alice-bob")
    expect(destination.params).not.toHaveProperty("title")
  })
  it("blocks a request whose resolved profile is the authenticated viewer", async () => {
    mocks.params = { kind: "dm", id: "bob" }
    mocks.targetProfile.mockResolvedValue({ id: "user-bob", username: "bob" })
    render(<PrepareNavigationScreen />)
    await waitFor(() => expect(screen.getByText("Tidak bisa mengirim pesan")).toBeTruthy())
    expect(mocks.dm).not.toHaveBeenCalled()
    expect(mocks.replace).not.toHaveBeenCalled()
  })
  it("does not open or expose a room whose counterpart is not Alice", async () => {
    const wrongRoom = {
      id: "room-bob-self",
      type: "INQUIRY",
      otherUser: { userId: "user-bob", username: "bob" },
      counterpart: { id: "user-bob", username: "bob" },
    }
    mocks.dm.mockResolvedValue(wrongRoom)
    mocks.room.mockResolvedValue(wrongRoom)
    render(<PrepareNavigationScreen />)
    await waitFor(() => expect(screen.getByText(/Percakapan tidak cocok/i)).toBeTruthy())
    expect(mocks.room).toHaveBeenCalledWith("room-bob-self", expect.any(AbortSignal))
    expect(mocks.replace).not.toHaveBeenCalled()
  })
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
    mocks.params = { kind: "tracking", id: "order-1" }
    mocks.shipment.mockResolvedValue(null)
    render(<PrepareNavigationScreen />)
    await waitFor(() => expect(screen.getByText("Belum ada data pelacakan")).toBeTruthy())
    expect(mocks.replace).not.toHaveBeenCalled()
  })
})
