/**
 * Audit chat I23 — rute /chat/[roomId]: selama chunk layar dimuat yang tampil
 * shimmer berbentuk percakapan (bukan area kosong), dan error render di ruang
 * ditangkap boundary tingkat-rute dengan UI berpenjelasan + Coba lagi.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@/components/screens/chat-room-screen", async () => {
  // Chunk lambat: shimmer harus terlihat sampai modul selesai dimuat.
  await new Promise((resolve) => setTimeout(resolve, 80))
  const React = await vi.importActual<typeof import("react")>("react")
  return { default: () => React.createElement("p", null, "Layar ruang chat siap") }
})

import ChatRoomRoute, { ErrorBoundary } from "@/app/chat/[roomId]"
import { ThemeProvider } from "@/components/theme-provider"
import { __setLocalSearchParams } from "@/tests/stubs/expo-router"

afterEach(cleanup)

describe("rute chat: fallback saat chunk dimuat", () => {
  it("menampilkan shimmer berbentuk percakapan, lalu layar ruang", async () => {
    __setLocalSearchParams({ roomId: "room-1" })
    render(
      <ThemeProvider>
        <ChatRoomRoute />
      </ThemeProvider>,
    )
    // Seketika setelah dibuka — bukan kosong.
    expect(screen.getByTestId("chat-thread-skeleton")).toBeTruthy()
    expect(await screen.findByText("Layar ruang chat siap")).toBeTruthy()
    expect(screen.queryByTestId("chat-thread-skeleton")).toBeNull()
  })
})

describe("rute chat: ErrorBoundary tingkat-rute", () => {
  it("error render di ruang → UI berpenjelasan + Coba lagi memanggil retry", () => {
    const retry = vi.fn()
    render(
      <ThemeProvider>
        <ErrorBoundary error={new Error("render gagal")} retry={retry} />
      </ThemeProvider>,
    )
    expect(screen.getByRole("alert")).toBeTruthy()
    expect(screen.getByText("Halaman tidak dapat ditampilkan")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: /Coba lagi/ }))
    expect(retry).toHaveBeenCalledTimes(1)
  })
})
