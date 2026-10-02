import { describe, expect, it } from "vitest"

import {
  isChatRoomForDmTarget,
  isSameDmAccount,
  normalizeChatRoom,
  type ChatRoom,
} from "@/lib/api/chat"

function normalizedRoom(overrides: Record<string, unknown>): ChatRoom {
  return normalizeChatRoom({
    id: "room-alice-bob",
    type: "INQUIRY",
    roomType: "INQUIRY",
    unreadCount: 0,
    updatedAt: "2026-10-02T00:00:00.000Z",
    ...overrides,
  } as unknown as ChatRoom & Record<string, unknown>)
}

describe("profile DM identity safety (Alice target, Bob viewer)", () => {
  it("keeps the canonical otherUser instead of a stale self counterpart", () => {
    const room = normalizedRoom({
      otherUser: { userId: "public-alice", username: "alice", fullName: "Alice" },
      // Legacy `counterpart` has accidentally described authenticated Bob.
      counterpart: { id: "public-bob", username: "bob", fullName: "Bob" },
    })

    expect(room.counterpart?.id).toBe("public-alice")
    expect(room.counterpart?.username).toBe("alice")
    expect(isChatRoomForDmTarget(room, { id: "public-alice", username: "alice" })).toBe(true)
    expect(isChatRoomForDmTarget(room, { id: "public-bob", username: "bob" })).toBe(false)
  })

  it("fails closed when the room only identifies the viewer, not the requested peer", () => {
    const room = normalizedRoom({
      otherUser: { userId: "public-bob", username: "bob", fullName: "Bob" },
      counterpart: { id: "public-bob", username: "bob", fullName: "Bob" },
    })

    expect(isChatRoomForDmTarget(room, { id: "public-alice", username: "alice" })).toBe(false)
  })

  it("distinguishes two accounts and identifies a self-DM target", () => {
    const alice = { id: "public-alice", username: "alice" }
    const bob = { id: "public-bob", username: "bob" }

    expect(isSameDmAccount(alice, bob)).toBe(false)
    expect(isSameDmAccount(bob, { id: "public-bob", username: "@BOB" })).toBe(true)
  })
})
