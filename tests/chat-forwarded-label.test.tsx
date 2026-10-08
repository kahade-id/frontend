/**
 * Audit chat H22 (cegah penipuan) — pesan hasil Teruskan diberi label
 * "Diteruskan". Penipu menyalin instruksi pembayaran dari percakapan lain
 * seolah ditulis sendiri; label membuat asal-usulnya terlihat.
 */
import { cleanup, render, screen } from "@testing-library/react"
import type { ReactElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ThemeProvider } from "@/components/theme-provider"
import { ChatMessageBubble } from "@/components/ui/chat-message-bubble"
import { ChatMessageRow, isForwardedMessage } from "@/components/ui/chat-message-row"
import { PortalHost, PortalProvider } from "@/components/ui/portal"
import type { ChatMessage } from "@/lib/api/chat"

vi.mock("@/components/ui/voice-note-player", () => ({ VoiceNotePlayer: () => null }))

afterEach(cleanup)

function inTheme(ui: ReactElement) {
  return render(
    <ThemeProvider>
      <PortalProvider>
        {ui}
        <PortalHost />
      </PortalProvider>
    </ThemeProvider>,
  )
}

const msg = (extra: Partial<ChatMessage> = {}): ChatMessage => ({
  id: "m1",
  messageType: "TEXT",
  fromUser: false,
  text: "Transfer ke rekening 1234567890",
  createdAt: new Date(2026, 9, 7, 10, 0, 0).toISOString(),
  ...extra,
})

describe("isForwardedMessage", () => {
  it("forwardedFromId ATAU forwardedFrom.id menandai pesan terusan", () => {
    expect(isForwardedMessage(msg({ forwardedFromId: "src-1" }))).toBe(true)
    expect(isForwardedMessage(msg({ forwardedFrom: { id: "src-1" } }))).toBe(true)
  })

  it("pesan biasa, kosong, atau forwardedFrom tanpa id bukan terusan", () => {
    expect(isForwardedMessage(msg())).toBe(false)
    expect(isForwardedMessage(msg({ forwardedFromId: null, forwardedFrom: null }))).toBe(false)
    expect(isForwardedMessage(msg({ forwardedFromId: "" }))).toBe(false)
  })

  it("pesan terhapus tidak membawa label", () => {
    expect(isForwardedMessage(msg({ forwardedFromId: "src-1", isDeleted: true }))).toBe(false)
  })
})

describe("<ChatMessageBubble forwarded>", () => {
  it("menampilkan 'Diteruskan' di atas isi (masuk)", () => {
    inTheme(<ChatMessageBubble direction="incoming" text="halo" forwarded />)
    expect(screen.getByText("Diteruskan")).toBeTruthy()
    expect(screen.getByTestId("message-forwarded-label")).toBeTruthy()
  })

  it("juga untuk pesan keluar milik sendiri", () => {
    inTheme(<ChatMessageBubble direction="outgoing" text="halo" forwarded />)
    expect(screen.getByText("Diteruskan")).toBeTruthy()
  })

  it("tanpa `forwarded` tidak ada label", () => {
    inTheme(<ChatMessageBubble direction="incoming" text="halo" />)
    expect(screen.queryByText("Diteruskan")).toBeNull()
  })

  it("pesan terhapus tidak menampilkan label walau forwarded=true", () => {
    inTheme(<ChatMessageBubble direction="incoming" text="x" forwarded isDeleted />)
    expect(screen.queryByText("Diteruskan")).toBeNull()
  })

  it("label ikut dibacakan pembaca layar (dalam label aksesibilitas bubble)", () => {
    inTheme(<ChatMessageBubble direction="incoming" text="halo" forwarded onLongPress={() => undefined} />)
    expect(screen.getByLabelText(/Diteruskan/)).toBeTruthy()
  })
})

describe("<ChatMessageRow> meneruskan penanda terusan ke bubble", () => {
  const handlers = {
    selecting: false,
    selected: false,
    readByCounterpart: false,
    onPress: () => undefined,
    onLongPress: () => undefined,
    onAttachmentPress: () => undefined,
  }

  it("pesan dengan forwardedFromId → label tampil", () => {
    inTheme(<ChatMessageRow {...handlers} message={msg({ forwardedFromId: "src-1" })} />)
    expect(screen.getByText("Diteruskan")).toBeTruthy()
  })

  it("pesan biasa → tanpa label", () => {
    inTheme(<ChatMessageRow {...handlers} message={msg()} />)
    expect(screen.queryByText("Diteruskan")).toBeNull()
  })
})
