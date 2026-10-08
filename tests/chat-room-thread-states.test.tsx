/**
 * Audit chat I23 + I24 — diuji pada layar ruang chat ASLI (komponen
 * `ChatRoomScreen` sungguhan; hanya jaringan/realtime/perekam yang di-stub).
 *
 * I23: membuka ruang TIDAK boleh menghasilkan layar kosong tanpa penjelasan:
 *      shimmer → pesan | kosong | galat+coba lagi | ruang hilang | rute rusak.
 * I24: menambah satu pesan TIDAK me-render ulang baris pesan lain.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { ChatMessage } from "@/lib/api/chat"

const h = vi.hoisted(() => ({
  getChatMessages: vi.fn(),
  sendChatMessage: vi.fn(),
  getChatRoom: vi.fn(),
  markChatRoomRead: vi.fn(),
  handlers: { current: null as null | Record<string, (...args: unknown[]) => void> },
  rowRenders: new Map<string, number>(),
}))

vi.mock("@/lib/api/chat", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/chat")>("@/lib/api/chat")
  return {
    ...actual,
    getChatMessages: h.getChatMessages,
    sendChatMessage: h.sendChatMessage,
    getChatRoom: h.getChatRoom,
    markChatRoomRead: h.markChatRoomRead,
    getPinnedMessages: vi.fn(async () => []),
    getReadReceipts: vi.fn(async (roomId: string) => ({ roomId, receipts: [] })),
    getRoomPresence: vi.fn(async () => ({ online: false, lastSeenAt: null })),
    sendChatTyping: vi.fn(async () => ({ sent: true })),
  }
})

vi.mock("@/lib/realtime/use-chat-room", () => ({
  useChatRoomRealtime: (_roomId: string, handlers: Record<string, (...args: unknown[]) => void>) => {
    h.handlers.current = handlers
    return { healthy: true, sendTyping: vi.fn() }
  },
}))

// Penghitung render per baris pesan: membungkus ChatMessageRow dengan `memo`
// (perbandingan dangkal yang sama dengan komponen asli) — hanya render yang
// benar-benar terjadi (prop berubah) yang tercatat.
vi.mock("@/components/ui/chat-message-row", async () => {
  const React = await vi.importActual<typeof import("react")>("react")
  const actual = await vi.importActual<typeof import("@/components/ui/chat-message-row")>(
    "@/components/ui/chat-message-row",
  )
  const Counting = React.memo(function CountingRow(props: { message: { id: string } }) {
    h.rowRenders.set(props.message.id, (h.rowRenders.get(props.message.id) ?? 0) + 1)
    return React.createElement(actual.ChatMessageRow as never, props as never)
  })
  return { ...actual, ChatMessageRow: Counting }
})

vi.mock("@/components/ui/voice-note-player", () => ({ VoiceNotePlayer: () => null }))
vi.mock("expo-document-picker", () => ({ getDocumentAsync: vi.fn() }))
// expo-file-system menarik expo-modules-core (global native) — bukan objek test ini.
vi.mock("expo-file-system", () => ({ File: class {}, Paths: {} }))
// expo-audio menarik `expo` asli (butuh modul native) — perekam bukan objek test ini.
vi.mock("expo-audio", () => ({
  RecordingPresets: { HIGH_QUALITY: {} },
  getRecordingPermissionsAsync: vi.fn(async () => ({ granted: true, canAskAgain: true })),
  requestRecordingPermissionsAsync: vi.fn(async () => ({ granted: true })),
  setAudioModeAsync: vi.fn(async () => undefined),
  useAudioPlayer: () => ({}),
  useAudioPlayerStatus: () => ({}),
  useAudioRecorder: () => ({ prepareToRecordAsync: vi.fn(), record: vi.fn(), stop: vi.fn() }),
  useAudioRecorderState: () => ({ isRecording: false, durationMillis: 0 }),
}))

import { ThemeProvider } from "@/components/theme-provider"
import ChatRoomScreen from "@/components/screens/chat-room-screen"
import { ToastProvider } from "@/components/ui/toast"
import { PortalHost, PortalProvider } from "@/components/ui/portal"
import { ApiError } from "@/lib/api/errors"
import { __setLocalSearchParams } from "@/tests/stubs/expo-router"
import { resetUiPrefsForTest } from "@/lib/ui-prefs"

const at = (minute: number) => new Date(2026, 9, 7, 9, minute).toISOString()
const message = (id: string, minute: number, extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id,
  messageType: "TEXT",
  fromUser: minute % 2 === 0,
  text: `Isi pesan ${id}`,
  createdAt: at(minute),
  ...extra,
})
const room = { id: "room-1", unreadCount: 0, counterpart: { id: "u2", name: "Budi", username: "budi" } }

function mount() {
  return render(
    <ThemeProvider>
      <ToastProvider>
        <PortalProvider>
          <ChatRoomScreen />
          <PortalHost />
        </PortalProvider>
      </ToastProvider>
    </ThemeProvider>,
  )
}

beforeEach(() => {
  resetUiPrefsForTest()
  h.rowRenders.clear()
  h.handlers.current = null
  __setLocalSearchParams({ roomId: "room-1" })
  h.getChatRoom.mockResolvedValue(room)
  h.markChatRoomRead.mockResolvedValue(undefined)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe("membuka ruang: selalu ada keadaan yang jelas (audit chat I23)", () => {
  it("memuat → shimmer berbentuk percakapan, lalu pesan tampil dan penutup posisi lepas", async () => {
    let resolve!: (page: unknown) => void
    h.getChatMessages.mockReturnValue(new Promise((r) => (resolve = r)))
    mount()
    // Segera setelah dibuka: BUKAN layar kosong.
    expect(screen.getByTestId("chat-thread-loading")).toBeTruthy()
    expect(screen.getByTestId("chat-thread-skeleton")).toBeTruthy()

    await act(async () => resolve({ items: [message("m1", 1), message("m2", 2)], nextCursor: null }))
    expect(await screen.findByText("Isi pesan m2")).toBeTruthy()
    expect(screen.queryByTestId("chat-thread-loading")).toBeNull()
    // Penutup posisi dilepas sendiri (tidak menggantung).
    await waitFor(() => expect(screen.queryByTestId("chat-thread-positioning")).toBeNull(), { timeout: 3000 })
    expect(screen.getByText("Isi pesan m1")).toBeTruthy()
  })

  it("tanpa pesan → ilustrasi + panduan (bukan kosong)", async () => {
    h.getChatMessages.mockResolvedValue({ items: [], nextCursor: null })
    mount()
    expect(await screen.findByTestId("chat-empty-thread")).toBeTruthy()
    expect(screen.getByText("Belum ada pesan")).toBeTruthy()
    expect(screen.queryByTestId("chat-thread-positioning")).toBeNull()
  })

  it("gagal memuat → pesan galat + Coba lagi; Coba lagi memuat ulang dan menampilkan pesan", async () => {
    h.getChatMessages.mockRejectedValueOnce(new Error("jaringan putus"))
    h.getChatMessages.mockResolvedValue({ items: [message("m1", 1)], nextCursor: null })
    mount()
    expect(await screen.findByTestId("chat-thread-error")).toBeTruthy()
    expect(screen.getByText("Gagal memuat")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: /Coba lagi/ }))
    expect(await screen.findByText("Isi pesan m1")).toBeTruthy()
    expect(screen.queryByTestId("chat-thread-error")).toBeNull()
    expect(h.getChatMessages).toHaveBeenCalledTimes(2)
  })

  it("ruang dihapus (404) → keadaan sendiri dengan jalan kembali", async () => {
    h.getChatMessages.mockRejectedValue(new ApiError({ message: "Tidak ditemukan", code: "NOT_FOUND", status: 404 }))
    mount()
    expect(await screen.findByTestId("chat-thread-gone")).toBeTruthy()
    expect(screen.getByText("Percakapan tidak tersedia")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Kembali ke daftar chat" })).toBeTruthy()
  })

  it("rute tanpa roomId → dijelaskan, tidak shimmer selamanya dan tidak menembak API", async () => {
    __setLocalSearchParams({})
    mount()
    expect(await screen.findByTestId("chat-thread-invalid")).toBeTruthy()
    expect(screen.getByText("Tautan percakapan ini tidak valid.")).toBeTruthy()
    expect(h.getChatMessages).not.toHaveBeenCalled()
  })

  it("markChatRoomRead menggantung → pesan TETAP tampil (dulu shimmer menunggu request itu)", async () => {
    h.getChatMessages.mockResolvedValue({ items: [message("m1", 1)], nextCursor: null })
    h.markChatRoomRead.mockReturnValue(new Promise(() => {})) // tidak pernah selesai
    mount()
    expect(await screen.findByText("Isi pesan m1")).toBeTruthy()
    expect(screen.queryByTestId("chat-thread-loading")).toBeNull()
    await waitFor(() => expect(screen.queryByTestId("chat-thread-positioning")).toBeNull(), { timeout: 3000 })
    // Composer tidak ikut terkunci menunggu request itu (loading padam begitu pesan ada).
    const input = screen.getByRole("textbox", { name: "Tulis pesan" }) as HTMLTextAreaElement
    expect(input.readOnly).toBe(false)
    expect(input.disabled).toBe(false)
  })

  it("memuat terlalu lama → penjelasan + Coba lagi muncul di bawah shimmer", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    h.getChatMessages.mockReturnValue(new Promise(() => {}))
    mount()
    expect(screen.queryByTestId("chat-thread-slow")).toBeNull()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12_500)
    })
    expect(screen.getByTestId("chat-thread-slow")).toBeTruthy()
    expect(screen.getByText("Masih memuat percakapan. Periksa koneksi internet Anda.")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Coba lagi" })).toBeTruthy()
  })
})

describe("menambah pesan tidak me-render ulang baris lain (audit chat I24)", () => {
  it("pesan realtime baru: baris lama TIDAK di-render ulang, baris baru dirender sekali", async () => {
    const initial = ["a", "b", "c", "d", "e"].map((id, i) => message(id, i + 1))
    h.getChatMessages.mockResolvedValue({ items: initial, nextCursor: null })
    mount()
    expect(await screen.findByText("Isi pesan e")).toBeTruthy()
    await waitFor(() => expect(screen.queryByTestId("chat-thread-positioning")).toBeNull(), { timeout: 3000 })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
    const before = new Map(h.rowRenders)
    expect(before.size).toBe(5)

    await act(async () => {
      h.handlers.current?.onMessage?.({ id: "f", messageType: "TEXT", fromUser: false, content: "Pesan baru F", createdAt: at(6) })
    })
    expect(await screen.findByText("Pesan baru F")).toBeTruthy()

    // Baris baru dirender; baris lama tidak.
    expect(h.rowRenders.get("f")).toBe(1)
    for (const id of ["a", "b", "c", "d"]) {
      expect(h.rowRenders.get(id), `baris ${id} tidak boleh di-render ulang`).toBe(before.get(id))
    }
    // Pesan terakhir sebelumnya mendapat `previous` yang sama; baris baru-lah satu-satunya
    // yang membawa `previous` baru. (e tidak berubah: previous-nya tetap d.)
    expect(h.rowRenders.get("e")).toBe(before.get("e"))
  })

  it("kirim lewat composer: bubble optimistis muncul, baris lama TIDAK di-render ulang — juga saat server membalas", async () => {
    const initial = ["a", "b", "c", "d", "e"].map((id, i) => message(id, i + 1))
    h.getChatMessages.mockResolvedValue({ items: initial, nextCursor: null })
    let resolveSend!: (sent: unknown) => void
    h.sendChatMessage.mockReturnValue(new Promise((r) => (resolveSend = r)))
    mount()
    expect(await screen.findByText("Isi pesan e")).toBeTruthy()
    await waitFor(() => expect(screen.queryByTestId("chat-thread-positioning")).toBeNull(), { timeout: 3000 })
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50))
    })
    const before = new Map(h.rowRenders)

    fireEvent.change(screen.getByRole("textbox", { name: "Tulis pesan" }), {
      target: { value: "Halo Budi" },
    })
    fireEvent.click(await screen.findByRole("button", { name: "Kirim pesan" }))

    // Optimistis: tampil seketika (server belum membalas).
    expect(await screen.findByText("Halo Budi")).toBeTruthy()
    for (const id of ["a", "b", "c", "d", "e"]) {
      expect(h.rowRenders.get(id), `baris ${id} (saat optimistis)`).toBe(before.get(id))
    }

    // Server membalas: bubble diganti IN-PLACE; baris lain tetap tidak disentuh.
    await act(async () => {
      resolveSend({
        id: "srv-1",
        messageType: "TEXT",
        fromUser: true,
        text: "Halo Budi",
        createdAt: at(7),
      })
      await new Promise((r) => setTimeout(r, 30))
    })
    for (const id of ["a", "b", "c", "d", "e"]) {
      expect(h.rowRenders.get(id), `baris ${id} (setelah server membalas)`).toBe(before.get(id))
    }
    // Tepat satu bubble (tanpa dobel — audit B4).
    expect(screen.getAllByText("Halo Budi")).toHaveLength(1)
  })

  it("pemisah hari-lah yang menempel di atas saat digulir — bukan header 'muat sebelumnya' atau sebuah bubble", async () => {
    // Dua hari (di masa lalu tetap → label tanggal), tiga bubble: baris = [hari1, a, b, hari2, c].
    const day = (d: number, minute: number, id: string) =>
      message(id, minute, { createdAt: new Date(2026, 0, d, 9, minute).toISOString() })
    h.getChatMessages.mockResolvedValue({
      items: [day(5, 1, "a"), day(5, 2, "b"), day(6, 3, "c")],
      nextCursor: "older",
    })
    mount()
    expect(await screen.findByText("Isi pesan c")).toBeTruthy()

    const isSticky = (node: HTMLElement) => {
      for (let el: HTMLElement | null = node; el; el = el.parentElement) {
        if (getComputedStyle(el).position === "sticky") return true
      }
      return false
    }
    const stickyHeadings = screen.getAllByRole("heading").filter((el) => isSticky(el))
    expect(stickyHeadings.length, "kedua pemisah hari harus menempel").toBe(2)
    for (const id of ["a", "b", "c"]) {
      expect(isSticky(screen.getByText(`Isi pesan ${id}`)), `bubble ${id} tidak boleh menempel`).toBe(false)
    }
  })
})
