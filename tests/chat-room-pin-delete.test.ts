/**
 * Item 18 (2026-09-28) + revisi batch 43 FE-CHAT (2026-09-28): pin ruang chat
 * TERSINKRON BACKEND (GET /v1/chat/pinned, POST/DELETE …/rooms/{id}/pin) +
 * hapus ruang (kontrak TIM B: DELETE /v1/chat/rooms/:roomId) +
 * aturan pra-hapus client-side (canDeleteChatRoom).
 *
 * Storage lokal lama (`chat.pinnedRooms.v1`) tidak lagi dipakai — pin lama
 * per perangkat diabaikan (bukan dimigrasi). Kegagalan backend bersifat
 * graceful: hydrate kosong; toggle melempar agar pemanggil menampilkan toast.
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
import { deleteRawItem, setRawItem } from "@/lib/secure-storage"

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

describe("pin ruang chat tersinkron backend (batch 43)", () => {
  it("hydrate dari GET /v1/chat/pinned", async () => {
    vi.mocked(http.get).mockResolvedValue({ pinnedRooms: [{ roomId: "room-a", position: 0 }] })
    await ensurePinnedLoaded()
    expect(isRoomPinned("room-a")).toBe(true)
    expect(isRoomPinned("room-b")).toBe(false)
    expect(vi.mocked(http.get)).toHaveBeenCalledWith("/v1/chat/pinned", {
      auth: "required",
      retry: 1,
      signal: undefined,
    })
  })

  it("toggle: belum pin → POST …/pin; sudah pin → DELETE …/pin", async () => {
    vi.mocked(http.get).mockResolvedValue({ pinnedRooms: [] })
    await ensurePinnedLoaded()
    vi.mocked(http.post).mockResolvedValue({ roomId: "room-a", position: 0 })
    expect(await toggleRoomPinned("room-a")).toBe(true)
    expect(isRoomPinned("room-a")).toBe(true)
    expect(vi.mocked(http.post)).toHaveBeenCalledWith(
      "/v1/chat/rooms/room-a/pin",
      {},
      { auth: "required" },
    )
    vi.mocked(http.delete).mockResolvedValue({ unpinned: true })
    expect(await toggleRoomPinned("room-a")).toBe(false)
    expect(isRoomPinned("room-a")).toBe(false)
    expect(vi.mocked(http.delete)).toHaveBeenCalledWith("/v1/chat/rooms/room-a/pin", {
      auth: "required",
    })
  })

  it("gagal hydrate → graceful, daftar pin kosong tanpa crash", async () => {
    vi.mocked(http.get).mockRejectedValue(new Error("offline"))
    await ensurePinnedLoaded()
    expect(isRoomPinned("room-a")).toBe(false)
  })

  it("gagal toggle → melempar agar pemanggil bisa toast (tanpa fallback lokal)", async () => {
    vi.mocked(http.get).mockResolvedValue({ pinnedRooms: [] })
    await ensurePinnedLoaded()
    vi.mocked(http.post).mockRejectedValue(new Error("batas pin tercapai"))
    await expect(toggleRoomPinned("room-a")).rejects.toThrow("batas pin tercapai")
    expect(isRoomPinned("room-a")).toBe(false)
  })

  it("subscriber diberitahu setiap perubahan pin", async () => {
    vi.mocked(http.get).mockResolvedValue({ pinnedRooms: [] })
    await ensurePinnedLoaded()
    vi.mocked(http.post).mockResolvedValue({ roomId: "room-a", position: 0 })
    vi.mocked(http.delete).mockResolvedValue({ unpinned: true })
    const calls: number[] = []
    const unsub = subscribePinnedRooms(() => calls.push(1))
    await toggleRoomPinned("room-a")
    await toggleRoomPinned("room-a")
    unsub()
    await toggleRoomPinned("room-a")
    expect(calls).toHaveLength(2)
  })

  it("storage lokal lama diabaikan — bukan sumber kebenaran", async () => {
    await setRawItem(STORAGE_KEY, JSON.stringify(["room-legacy"]))
    vi.mocked(http.get).mockResolvedValue({ pinnedRooms: [] })
    __resetPinnedRoomsForTest()
    await ensurePinnedLoaded()
    expect(isRoomPinned("room-legacy")).toBe(false)
  })

  it("sortRoomsPinnedFirst menempatkan room terpin di atas (position kecil = atas), urutan lain stabil", async () => {
    vi.mocked(http.get).mockResolvedValue({
      pinnedRooms: [
        { roomId: "b", position: 1 },
        { roomId: "a", position: 0 },
      ],
    })
    await ensurePinnedLoaded()
    const rooms = [
      { id: "c", name: "C" },
      { id: "a", name: "A" },
      { id: "b", name: "B" },
    ]
    const sorted = sortRoomsPinnedFirst(rooms)
    expect(sorted.map((r) => r.id)).toEqual(["a", "b", "c"])
  })

  it("tidak mengubah array input (immutable)", async () => {
    vi.mocked(http.get).mockResolvedValue({ pinnedRooms: [] })
    await ensurePinnedLoaded()
    const rooms = [{ id: "x" }]
    sortRoomsPinnedFirst(rooms)
    expect(rooms).toEqual([{ id: "x" }])
  })
})
