/**
 * UI POLISH chat 2026-09-27 — badge verified.
 *
 * Kontrak presentasi & interaksi yang dikunci (TANPA logika/API):
 *  a. Foto profil di chat TIDAK me-render badge verified overlay —
 *     <ChatRoomHeader> tidak lagi memberi `verified` ke <Avatar>, dan avatar
 *     di bubble chat memang tidak pernah ber-badge. Badge hanya tampil di
 *     SAMPING nama pengirim.
 *  b. Nama pengirim TETAP menampilkan badge verified — header via
 *     <VerifiedName>; bubble via seal di samping `senderName`
 *     (<ChatMessageRow> meneruskan `sealTier` lawan bicara ke bubble).
 *
 * <VerifiedSeal> membuka <BottomSheet> (butuh <PortalProvider>) — semua render
 * di sini dibungkus provider portal + tema.
 */
import { cleanup, render, screen } from "@testing-library/react"
import type { ReactElement } from "react"
import { afterEach, describe, expect, it } from "vitest"

import { ThemeProvider } from "@/components/theme-provider"
import { PortalHost, PortalProvider } from "@/components/ui/portal"
import { ChatRoomHeader } from "@/components/ui/chat-room-header"
import { ChatMessageBubble } from "@/components/ui/chat-message-bubble"
import { ChatMessageRow } from "@/components/ui/chat-message-row"
import type { ChatMessage } from "@/lib/api/chat"

// Vitest tidak menyalakan `globals`, jadi auto-cleanup RTL tidak aktif.
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

/** Jumlah ikon SealCheck yang ter-render (stub phosphor → span data-icon). */
function sealCheckCount(container: HTMLElement): number {
  return container.querySelectorAll('[data-icon="SealCheck"]').length
}

describe("<ChatRoomHeader>: badge verified", () => {
  it("(a) foto profil TIDAK me-render badge verified overlay", () => {
    const { container } = renderInTheme(
      <ChatRoomHeader
        name="Toko Maju"
        verified
        sealTier="blue"
        status="Online"
        onBack={() => undefined}
      />,
    )
    // Overlay badge di Avatar memakai testID ini — harus tidak ada.
    expect(screen.queryByTestId("avatar-verified-badge")).toBeNull()
    expect(container.querySelector('[data-testid="avatar-verified-badge"]')).toBeNull()
  })

  it("(b) nama lawan bicara TETAP menampilkan badge verified di sampingnya", () => {
    const { container } = renderInTheme(
      <ChatRoomHeader
        name="Toko Maju"
        verified
        sealTier="blue"
        status="Online"
        onBack={() => undefined}
      />,
    )
    // Tepat satu seal: di samping nama (bukan di foto).
    expect(sealCheckCount(container)).toBe(1)
    // Seal punya label aksesibilitas "Akun … Terverifikasi".
    expect(screen.getByLabelText(/terverifikasi/i)).toBeTruthy()
    // Nama tetap tampil.
    expect(screen.getByText("Toko Maju")).toBeTruthy()
  })

  it("tanpa verifikasi → tidak ada seal sama sekali", () => {
    const { container } = renderInTheme(
      <ChatRoomHeader name="Toko Maju" status="Online" onBack={() => undefined} />,
    )
    expect(sealCheckCount(container)).toBe(0)
    expect(screen.queryByTestId("avatar-verified-badge")).toBeNull()
  })
})

describe("<ChatMessageBubble>: badge verified di samping nama pengirim", () => {
  const base = {
    direction: "incoming" as const,
    text: "Halo, barangnya ready?",
    avatarName: "Toko Maju",
    senderName: "Toko Maju",
  }

  it("(a) avatar bubble TIDAK ber-badge overlay", () => {
    renderInTheme(<ChatMessageBubble {...base} senderSealTier="blue" />)
    expect(screen.queryByTestId("avatar-verified-badge")).toBeNull()
  })

  it("(b) seal tampil di samping nama pengirim bila senderSealTier diisi", () => {
    const { container } = renderInTheme(
      <ChatMessageBubble {...base} senderSealTier="blue" />,
    )
    expect(sealCheckCount(container)).toBe(1)
    expect(screen.getByLabelText(/terverifikasi/i)).toBeTruthy()
    expect(screen.getByText("Toko Maju")).toBeTruthy()
  })

  it("tanpa senderSealTier → nama polos, tanpa seal", () => {
    const { container } = renderInTheme(<ChatMessageBubble {...base} />)
    expect(sealCheckCount(container)).toBe(0)
    expect(screen.queryByLabelText(/terverifikasi/i)).toBeNull()
  })
})

describe("<ChatMessageRow>: meneruskan sealTier lawan bicara ke bubble", () => {
  const message: ChatMessage = {
    id: "m1",
    messageType: "TEXT",
    fromUser: false,
    text: "Halo, barangnya ready?",
    createdAt: new Date(2026, 8, 27, 14, 32, 5).toISOString(),
  }
  const handlers = {
    selecting: false,
    selected: false,
    readByCounterpart: false,
    onPress: () => undefined,
    onLongPress: () => undefined,
    onAttachmentPress: () => undefined,
  }

  it("seal tampil di samping nama pengirim; avatar tanpa overlay", () => {
    const { container } = renderInTheme(
      <ChatMessageRow
        message={message}
        {...handlers}
        counterpart={{ name: "Toko Maju", avatarUrl: null, sealTier: "gold" }}
      />,
    )
    expect(screen.queryByTestId("avatar-verified-badge")).toBeNull()
    expect(sealCheckCount(container)).toBe(1)
    expect(screen.getByLabelText(/terverifikasi/i)).toBeTruthy()
  })

  it("tanpa sealTier → tidak ada seal (tidak merusak baris biasa)", () => {
    const { container } = renderInTheme(
      <ChatMessageRow
        message={message}
        {...handlers}
        counterpart={{ name: "Toko Maju", avatarUrl: null }}
      />,
    )
    expect(sealCheckCount(container)).toBe(0)
    expect(screen.getByText("Halo, barangnya ready?")).toBeTruthy()
  })
})
