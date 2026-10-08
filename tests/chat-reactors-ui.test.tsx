/**
 * Audit chat E12/E13 — tampilan: daftar reaksi (siapa memberi reaksi apa),
 * ketukan chip di bubble, dan petunjuk "2/3" di baris pin.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ReactElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ThemeProvider } from "@/components/theme-provider"
import { ChatMessageBubble } from "@/components/ui/chat-message-bubble"
import { ChatPinnedBar } from "@/components/ui/chat-pinned-bar"
import { ChatReactorsSheet } from "@/components/ui/chat-reactors-sheet"
import { PortalHost, PortalProvider } from "@/components/ui/portal"
import type { ChatMessage } from "@/lib/api/chat"

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

const message = (reactions: ChatMessage["reactions"]): ChatMessage => ({
  id: "m1",
  messageType: "TEXT",
  fromUser: true,
  text: "halo",
  createdAt: "2026-10-07T08:00:00.000Z",
  reactions,
})

const sheetProps = {
  selfIds: ["USR-ME"],
  isDirect: false,
  onClose: () => undefined,
  onRemoveMine: () => undefined,
}

describe("<ChatReactorsSheet>", () => {
  it("menampilkan siapa memberi reaksi apa, dengan tab Semua + per emoji", () => {
    inTheme(
      <ChatReactorsSheet
        {...sheetProps}
        message={message([
          { emoji: "👍", count: 2, reactedByMe: true, users: [{ userId: "USR-ME" }, { userId: "USR-B", fullName: "Budi" }] },
          { emoji: "❤️", count: 1, reactedByMe: false, users: [{ userId: "USR-C", fullName: "Citra" }] },
        ])}
      />,
    )
    expect(screen.getByText("Reaksi")).toBeTruthy()
    expect(screen.getByRole("tab", { name: "Semua 3" })).toBeTruthy()
    expect(screen.getByRole("tab", { name: "👍 2" })).toBeTruthy()
    expect(screen.getByText("Budi")).toBeTruthy()
    expect(screen.getByText("Citra")).toBeTruthy()
    expect(screen.getByText("Anda")).toBeTruthy()
  })

  it("tab emoji menyaring daftar; tab awal mengikuti chip yang diketuk", () => {
    inTheme(
      <ChatReactorsSheet
        {...sheetProps}
        initialEmoji="❤️"
        message={message([
          { emoji: "👍", count: 1, reactedByMe: false, users: [{ userId: "USR-B", fullName: "Budi" }] },
          { emoji: "❤️", count: 1, reactedByMe: false, users: [{ userId: "USR-C", fullName: "Citra" }] },
        ])}
      />,
    )
    // Dibuka langsung di tab ❤️: hanya Citra.
    expect(screen.queryByText("Budi")).toBeNull()
    expect(screen.getByText("Citra")).toBeTruthy()
    fireEvent.click(screen.getByRole("tab", { name: "Semua 2" }))
    expect(screen.getByText("Budi")).toBeTruthy()
  })

  it("ketuk baris 'Anda' menarik reaksi saya", () => {
    const onRemoveMine = vi.fn()
    const m = message([{ emoji: "🙏", count: 1, reactedByMe: true, users: [{ userId: "USR-ME" }] }])
    inTheme(<ChatReactorsSheet {...sheetProps} onRemoveMine={onRemoveMine} message={m} />)
    expect(screen.getByText("Ketuk untuk menarik reaksi")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Tarik reaksi 🙏" }))
    expect(onRemoveMine).toHaveBeenCalledWith(m, "🙏")
  })

  it("DM 1:1 tanpa users dari server: lawan bicara disebut dengan namanya", () => {
    inTheme(
      <ChatReactorsSheet
        {...sheetProps}
        isDirect
        counterpartName="Toko Maju"
        message={message([{ emoji: "👍", count: 1, reactedByMe: false }])}
      />,
    )
    expect(screen.getByText("Toko Maju")).toBeTruthy()
  })

  it("ruang ramai tanpa users: 'Pengguna lain' sejumlah hitungan, nama tidak dikarang", () => {
    inTheme(
      <ChatReactorsSheet
        {...sheetProps}
        message={message([{ emoji: "👍", count: 2, reactedByMe: false }])}
      />,
    )
    expect(screen.getAllByText("Pengguna lain")).toHaveLength(2)
  })

  it("tertutup bila message null", () => {
    inTheme(<ChatReactorsSheet {...sheetProps} message={null} />)
    expect(screen.queryByText("Reaksi")).toBeNull()
  })
})

describe("chip reaksi di <ChatMessageBubble>", () => {
  const reactions = [{ emoji: "👍", count: 2, reactedByMe: false }]

  it("onShowReactions mengambil alih ketukan chip (membuka daftar, bukan mengubah reaksi)", () => {
    const onReact = vi.fn()
    const onShowReactions = vi.fn()
    inTheme(
      <ChatMessageBubble
        direction="incoming"
        text="halo"
        reactions={reactions}
        onReact={onReact}
        onShowReactions={onShowReactions}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: /👍 2/ }))
    expect(onShowReactions).toHaveBeenCalledWith("👍")
    expect(onReact).not.toHaveBeenCalled()
  })

  it("tanpa onShowReactions (layar bantuan/sengketa) ketukan chip tetap mengubah reaksi", () => {
    const onReact = vi.fn()
    inTheme(<ChatMessageBubble direction="incoming" text="halo" reactions={reactions} onReact={onReact} />)
    fireEvent.click(screen.getByRole("button", { name: /👍 2/ }))
    expect(onReact).toHaveBeenCalledWith("👍")
  })
})

describe("<ChatPinnedBar> petunjuk batas", () => {
  const pinned = message(undefined)
  const props = { message: pinned, onPress: () => undefined, onUnpin: () => undefined }

  it("batas dikenal: badge '2/3' (+ label yang bisa dibaca pembaca layar)", () => {
    inTheme(<ChatPinnedBar {...props} count={2} limit={3} />)
    expect(screen.getByText("2/3")).toBeTruthy()
    expect(screen.getByLabelText("2 dari maksimal 3 pin")).toBeTruthy()
  })

  it("batas belum dikenal: perilaku lama (angka hanya bila > 1)", () => {
    inTheme(<ChatPinnedBar {...props} count={1} />)
    expect(screen.queryByText("1")).toBeNull()
    cleanup()
    inTheme(<ChatPinnedBar {...props} count={2} />)
    expect(screen.getByText("2")).toBeTruthy()
  })
})
