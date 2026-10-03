import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

const routeState = vi.hoisted(() => ({ roomId: "room-a" }))

vi.mock("expo-router", async () => {
  const actual = await vi.importActual<typeof import("expo-router")>("expo-router")
  return {
    ...actual,
    useLocalSearchParams: () => ({ roomId: routeState.roomId }),
  }
})

vi.mock("@/components/screens/chat-room-screen", async () => {
  const React = await vi.importActual<typeof import("react")>("react")
  function MockChatRoomScreen() {
    const [draft, setDraft] = React.useState("")
    return React.createElement("input", {
      "aria-label": "Draft chat",
      value: draft,
      onChange: (event: { target: { value: string } }) => setDraft(event.target.value),
    })
  }
  return { default: MockChatRoomScreen }
})

import ChatRoomRoute from "@/app/chat/[roomId]"

// Vitest component config does not enable RTL's global auto-cleanup.
afterEach(() => {
  cleanup()
  routeState.roomId = "room-a"
})

describe("chat route room-scoped state", () => {
  it("keeps a draft for the current room, but resets it when the room id changes", async () => {
    const { rerender } = render(<ChatRoomRoute />)
    const draft = (await screen.findByRole("textbox", { name: "Draft chat" })) as HTMLInputElement

    fireEvent.change(draft, { target: { value: "draft rahasia room A" } })
    expect(draft.value).toBe("draft rahasia room A")

    // An unrelated route render for the same room must not throw the draft away.
    rerender(<ChatRoomRoute />)
    expect((screen.getByRole("textbox", { name: "Draft chat" }) as HTMLInputElement).value).toBe(
      "draft rahasia room A",
    )

    // Expo Router can update params while keeping the dynamic route mounted.
    // A new room is a new state boundary, so old text/uploads cannot follow it.
    routeState.roomId = "room-b"
    rerender(<ChatRoomRoute />)
    await waitFor(() => {
      expect((screen.getByRole("textbox", { name: "Draft chat" }) as HTMLInputElement).value).toBe("")
    })
  })
})
