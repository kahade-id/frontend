/**
 * Item 18 (2026-09-28) — pin ruang chat: penyimpanan lokal per perangkat +
 * hapus ruang (kontrak TIM B: DELETE /v1/chat/rooms/:roomId) +
 * aturan pra-hapus client-side (canDeleteChatRoom).
 *
 * CATATAN: `@/lib/api/chat` di-stub pada `@/lib/api/client` — uncommitted
 * work tim lain di `lib/api/client.ts` (offline queue, "Item #27") saat ini
 * merusak koleksi Vitest modul itu (juga mematahkan tests/api-client.test.ts
 * yang sudah ada). Stub ini menjaga test kami independen dari WIP mereka.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/api/client", () => ({
  http: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    del: vi.fn(),
    delete: vi.fn(),
  },
  seg: (...parts: string[]) => parts.join("/"),
}))

// Import SETELAH vi.mock (hoisted otomatis oleh Vitest).
import { http } from "@/lib/api/client"
import { canDeleteChatRoom, deleteChatRoom } from "@/lib/api/chat"
import {
  __resetPinnedRoomsForTest,
  ensurePinnedLoaded,
  isRoomPinned,
  sortRoomsPinnedFirst,
  subscribePinnedRooms,
  toggleRoomPinned,
} from "@/lib/chat-pinned-rooms"
import { deleteRawItem, getRawItem, setRawItem } from "@/lib/secure-storage"

const STORAGE_KEY = "chat.pinnedRooms.v1"

beforeEach(async () => {
  vi.clearAllMocks()
  __resetPinnedRoomsForTest()
  // Storage tidak ikut di-reset oleh reset module — bersihkan eksplisit agar
  // tiap test terisolasi.
  await deleteRawItem(STORAGE_KEY)
})

describe("aturan hapus ruang chat (item 18)", () => {
  it("room DM (tanpa order) boleh dihapus", () => {
    expect(canDeleteChatRoom(null)).toBe(true)
    expect(canDeleteChatRoom(undefined)).toBe(true)
  })

  it("room transaksi hanya boleh dihapus bila order COMPLETED", () => {
    expect(canDeleteChatRoom("COMPLETED")).toBe(true)
    expect(canDeleteChatRoom("ACTIVE")).toBe(false)
    expect(canDeleteChatRoom("PENDING")).toBe(false)
    // Kontrak TIM B fail closed: CANCELLED/DISPUTED juga ditolak server (409).
    expect(canDeleteChatRoom("CANCELLED")).toBe(false)
    expect(canDeleteChatRoom("DISPUTED")).toBe(false)
  })

  it("deleteChatRoom: DELETE /v1/chat/rooms/:roomId dengan auth JWT", async () => {
    const deleteMock = vi.mocked(http.delete)
    deleteMock.mockResolvedValue({ deleted: true, roomId: "room-1", permanent: true })
    const res = await deleteChatRoom("room-1")
    expect(deleteMock).toHaveBeenCalledWith("/v1/chat/rooms/room-1", { auth: "required" })
    expect(res).toEqual({ deleted: true, roomId: "room-1", permanent: true })
  })

  it("deleteChatRoom: hasil soft delete (permanent=false) diteruskan apa adanya", async () => {
    const deleteMock = vi.mocked(http.delete)
    deleteMock.mockResolvedValue({ deleted: true, roomId: "room-2", permanent: false })
    const res = await deleteChatRoom("room-2")
    expect(res.permanent).toBe(false)
  })

  it("deleteChatRoom: error API (mis. 409) diteruskan ke pemanggil", async () => {
    const deleteMock = vi.mocked(http.delete)
    const apiErr = Object.assign(new Error("Order belum selesai"), {
      code: "CONFLICT",
      backendCode: "CHAT_ROOM_DELETE_ORDER_NOT_COMPLETED",
      status: 409,
    })
    deleteMock.mockRejectedValue(apiErr)
    await expect(deleteChatRoom("room-3")).rejects.toBe(apiErr)
  })
})

describe("pin ruang chat lokal (item 18)", () => {
  it("toggle menambah dan menghapus pin, mengembalikan state baru", async () => {
    await ensurePinnedLoaded()
    expect(isRoomPinned("room-a")).toBe(false)
    expect(await toggleRoomPinned("room-a")).toBe(true)
    expect(isRoomPinned("room-a")).toBe(true)
    expect(await toggleRoomPinned("room-a")).toBe(false)
    expect(isRoomPinned("room-a")).toBe(false)
  })

  it("subscriber diberitahu setiap perubahan pin", async () => {
    await ensurePinnedLoaded()
    const calls: number[] = []
    const unsub = subscribePinnedRooms(() => calls.push(1))
    await toggleRoomPinned("room-a")
    await toggleRoomPinned("room-a")
    unsub()
    await toggleRoomPinned("room-a")
    expect(calls).toHaveLength(2)
  })

  it("pin dipersist dan terbaca ulang dari storage (simulasi buka ulang)", async () => {
    await ensurePinnedLoaded()
    await toggleRoomPinned("room-a")
    await toggleRoomPinned("room-b")
    expect(await getRawItem(STORAGE_KEY)).not.toBeNull()
    // Simulasi buka ulang: kosongkan memory, storage tidak ikut di-reset.
    __resetPinnedRoomsForTest()
    await ensurePinnedLoaded()
    expect(isRoomPinned("room-a")).toBe(true)
    expect(isRoomPinned("room-b")).toBe(true)
  })

  it("payload rusak di storage diabaikan tanpa crash", async () => {
    await setRawItem(STORAGE_KEY, "bukan json {{{")
    __resetPinnedRoomsForTest()
    await ensurePinnedLoaded()
    expect(isRoomPinned("room-a")).toBe(false)
  })

  it("sortRoomsPinnedFirst menempatkan room terpin di atas, urutan lain stabil", async () => {
    await ensurePinnedLoaded()
    await toggleRoomPinned("b")
    await toggleRoomPinned("a")
    const rooms = [
      { id: "c", name: "C" },
      { id: "a", name: "A" },
      { id: "b", name: "B" },
    ]
    const sorted = sortRoomsPinnedFirst(rooms)
    expect(sorted.map((r) => r.id)).toEqual(["a", "b", "c"])
  })

  it("tidak mengubah array input (immutable)", async () => {
    await ensurePinnedLoaded()
    const rooms = [{ id: "x" }]
    sortRoomsPinnedFirst(rooms)
    expect(rooms).toEqual([{ id: "x" }])
  })
})
