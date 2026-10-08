/**
 * Audit chat D11 — mengetuk kutipan balasan.
 *
 * Baris meneruskan `replyToId` DAN apakah asal kutipan sudah dihapus
 * (`replyTo.isDeleted`), supaya layar bisa menjelaskan "Pesan asli telah
 * dihapus" alih-alih mencoba melompat/memuat riwayat untuk pesan yang sudah
 * tidak ada. Teks pratinjau kutipan yang terhapus juga lewat terjemahan.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ReactElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ThemeProvider } from "@/components/theme-provider"
import { ChatMessageRow } from "@/components/ui/chat-message-row"
import { PortalHost, PortalProvider } from "@/components/ui/portal"
import type { ChatMessage } from "@/lib/api/chat"

vi.mock("@/components/ui/voice-note-player", () => ({ VoiceNotePlayer: () => null }))

afterEach(cleanup)

function renderRow(ui: ReactElement) {
  return render(
    <ThemeProvider>
      <PortalProvider>
        {ui}
        <PortalHost />
      </PortalProvider>
    </ThemeProvider>,
  )
}

const handlers = {
  selecting: false,
  selected: false,
  readByCounterpart: false,
  onPress: () => undefined,
  onLongPress: () => undefined,
  onAttachmentPress: () => undefined,
}

function reply(replyTo: NonNullable<ChatMessage["replyTo"]>): ChatMessage {
  return {
    id: "m-reply",
    messageType: "TEXT",
    fromUser: true,
    text: "Siap, hari ini ya",
    replyToId: replyTo.id,
    replyTo,
    createdAt: new Date(2026, 9, 7, 10, 0, 0).toISOString(),
  }
}

describe("ketuk kutipan balasan", () => {
  it("meneruskan replyToId dengan deleted=false untuk asal yang masih ada", () => {
    const onQuotePress = vi.fn()
    renderRow(
      <ChatMessageRow
        {...handlers}
        onQuotePress={onQuotePress}
        message={reply({ id: "orig", content: "Kapan dikirim?", messageType: "TEXT", senderName: "Budi" })}
      />,
    )
    fireEvent.click(screen.getByText("Kapan dikirim?"))
    expect(onQuotePress).toHaveBeenCalledTimes(1)
    expect(onQuotePress).toHaveBeenCalledWith("orig", { deleted: false })
  })

  it("asal yang sudah dihapus: pratinjau 'Pesan ini telah dihapus' dan deleted=true", () => {
    const onQuotePress = vi.fn()
    renderRow(
      <ChatMessageRow
        {...handlers}
        onQuotePress={onQuotePress}
        message={reply({ id: "orig", content: null, messageType: "TEXT", isDeleted: true, senderName: "Budi" })}
      />,
    )
    fireEvent.click(screen.getByText("Pesan ini telah dihapus"))
    expect(onQuotePress).toHaveBeenCalledWith("orig", { deleted: true })
  })

  it("tanpa handler, kutipan tidak bisa diketuk (tombol tidak dirender)", () => {
    renderRow(
      <ChatMessageRow
        {...handlers}
        message={reply({ id: "orig", content: "Kapan dikirim?", messageType: "TEXT" })}
      />,
    )
    expect(screen.queryByRole("button", { name: /Lihat pesan yang dibalas/ })).toBeNull()
  })
})
