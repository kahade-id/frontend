/** UIUX-118: tiap bubble chat menampilkan timestamp-nya sendiri. */
import { cleanup, render, screen } from "@testing-library/react"
import type { ReactElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ThemeProvider } from "@/components/theme-provider"
import { ChatMessageRow } from "@/components/ui/chat-message-row"
import { PortalHost, PortalProvider } from "@/components/ui/portal"
import type { ChatMessage } from "@/lib/api/chat"
import { formatTime } from "@/lib/format"

vi.mock("@/components/ui/voice-note-player", () => ({ VoiceNotePlayer: () => null }))

afterEach(cleanup)

function renderInTheme(ui: ReactElement) {
  return render(
    <ThemeProvider>
      <PortalProvider>
        {ui}
        <PortalHost />
      </PortalProvider>
    </ThemeProvider>,
  )
}

describe("<ChatMessageRow>: timestamp setiap bubble", () => {
  it("menampilkan jam pada semua pesan dalam grup menit yang sama", () => {
    const first: ChatMessage = {
      id: "first",
      messageType: "TEXT",
      fromUser: false,
      text: "Pesan pertama",
      createdAt: new Date(2026, 9, 3, 14, 32, 5).toISOString(),
    }
    const second: ChatMessage = {
      id: "second",
      messageType: "TEXT",
      fromUser: false,
      text: "Pesan kedua",
      createdAt: new Date(2026, 9, 3, 14, 32, 45).toISOString(),
    }
    const handlers = {
      selecting: false,
      selected: false,
      readByCounterpart: false,
      onPress: () => undefined,
      onLongPress: () => undefined,
      onAttachmentPress: () => undefined,
    }

    renderInTheme(
      <>
        <ChatMessageRow message={first} {...handlers} />
        <ChatMessageRow message={second} previous={first} {...handlers} />
      </>,
    )

    expect(screen.getAllByText(formatTime(first.createdAt))).toHaveLength(2)
  })

  it("menampilkan status antrean chat secara langsung pada bubble", () => {
    const message: ChatMessage = {
      id: "queued-message",
      messageType: "TEXT",
      fromUser: true,
      text: "Saya menunggu koneksi.",
      createdAt: new Date(2026, 9, 3, 14, 32, 5).toISOString(),
      sendStatus: "queued",
    }
    renderInTheme(
      <ChatMessageRow
        message={message}
        selecting={false}
        selected={false}
        readByCounterpart={false}
        onPress={() => undefined}
        onLongPress={() => undefined}
        onAttachmentPress={() => undefined}
      />,
    )

    expect(screen.getByText("Menunggu koneksi")).toBeTruthy()
  })

  it("menggunakan label netral pada pesan yang menunggu retry", () => {
    const message: ChatMessage = {
      id: "not-sent-message",
      messageType: "TEXT",
      fromUser: true,
      text: "Pesan tetap tersimpan.",
      createdAt: new Date(2026, 9, 3, 14, 32, 5).toISOString(),
      sendStatus: "failed",
    }
    renderInTheme(
      <ChatMessageRow
        message={message}
        selecting={false}
        selected={false}
        readByCounterpart={false}
        onPress={() => undefined}
        onLongPress={() => undefined}
        onAttachmentPress={() => undefined}
        onRetry={() => undefined}
      />,
    )

    expect(screen.getByText("Belum terkirim")).toBeTruthy()
    expect(screen.queryByText("Gagal terkirim")).toBeNull()
  })

  it("menambahkan label mikro Dibaca pada pesan keluar yang sudah dibaca", () => {
    const message: ChatMessage = {
      id: "read-message",
      messageType: "TEXT",
      fromUser: true,
      text: "Sudah saya kirim",
      createdAt: new Date(2026, 9, 3, 14, 32, 5).toISOString(),
    }
    renderInTheme(
      <ChatMessageRow
        message={message}
        selecting={false}
        selected={false}
        readByCounterpart
        onPress={() => undefined}
        onLongPress={() => undefined}
        onAttachmentPress={() => undefined}
      />,
    )

    expect(screen.getByText("Dibaca")).toBeTruthy()
  })
})
