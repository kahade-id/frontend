/**
 * Audit chat 2026-10-08 (standar WhatsApp/Telegram) — pratinjau draft di
 * daftar percakapan.
 *
 * Kontrak yang dikunci:
 *   a. `draftText` menggantikan preview pesan terakhir dengan prefix "Draf:".
 *   b. Prioritas preview: mengetik… > draft > pesan terakhir.
 *   c. Draft kosong/whitespace tidak menampilkan baris draft.
 *   d. Prefix "Draf:" memakai tone bahaya (perhatian) dan nama draft ikut
 *      dibacakan pembaca layar.
 */
import { cleanup, render, screen } from "@testing-library/react"
import type { ReactElement } from "react"
import { afterEach, describe, expect, it } from "vitest"

import { ThemeProvider } from "@/components/theme-provider"
import { ChatRoomListItem } from "@/components/ui/chat-room-list-item"
import { PortalHost, PortalProvider } from "@/components/ui/portal"

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

const BASE = {
  name: "Budi",
  lastMessage: { text: "Pesan terakhir", fromSelf: false },
  time: "14:32",
  unreadCount: 0,
}

describe("<ChatRoomListItem>: pratinjau draft", () => {
  it("draft menggantikan preview pesan terakhir dengan prefix Draf:", () => {
    renderInTheme(<ChatRoomListItem {...BASE} draftText="ketikan belum terkirim" />)
    expect(screen.getByText("Draf:")).toBeTruthy()
    expect(screen.getByText("ketikan belum terkirim")).toBeTruthy()
    expect(screen.queryByText("Pesan terakhir")).toBeNull()
  })

  it("tanpa draft, preview tetap pesan terakhir", () => {
    renderInTheme(<ChatRoomListItem {...BASE} />)
    expect(screen.queryByText("Draf")).toBeNull()
    expect(screen.getByText("Pesan terakhir")).toBeTruthy()
  })

  it("draft whitespace dianggap tidak ada", () => {
    renderInTheme(<ChatRoomListItem {...BASE} draftText="   " />)
    expect(screen.queryByText("Draf")).toBeNull()
    expect(screen.getByText("Pesan terakhir")).toBeTruthy()
  })

  it("mengetik… mengungguli draft (sinyal hidup)", () => {
    renderInTheme(<ChatRoomListItem {...BASE} typing draftText="ketikan" />)
    expect(screen.getByText("mengetik…")).toBeTruthy()
    expect(screen.queryByText("ketikan")).toBeNull()
    expect(screen.queryByText("Draf")).toBeNull()
  })

  it("label aksesibilitas menyebut isi draft", () => {
    renderInTheme(<ChatRoomListItem {...BASE} draftText="halo" />)
    // react-native-web meneruskan accessibilityLabel → aria-label.
    const label = screen
      .getAllByLabelText(/halo/)
      .map((el) => el.getAttribute("aria-label") ?? "")
      .join(" ")
    expect(label).toContain("Draf")
    expect(label).toContain("halo")
  })
})
