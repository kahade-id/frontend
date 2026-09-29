/**
 * Tim UX-Safety 2026-09-29 — kontrak presentasi temuan U5-008 / U5-009 /
 * U5-012 (audit UX-deep). Murni tampilan: tidak menyentuh logika
 * bayar/refund/escrow apa pun.
 *
 *  - U5-008: <DmEscrowWarning> — banner anti-tipu persisten di DM tanpa
 *    orderId, dengan CTA "Buat transaksi".
 *  - U5-009: <ChatRoomListItem orderBadge> — room ber-orderId ditandai
 *    badge kecil "Escrow", bukan kode order mentah.
 *  - U5-012: <OrderEscrowCard> PROCESSING (pembeli) — menyebut tenggat
 *    kirim 2 hari + jaminan auto-refund.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ReactElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ThemeProvider } from "@/components/theme-provider"
import { ChatRoomListItem } from "@/components/ui/chat-room-list-item"
import { DmEscrowWarning } from "@/components/ui/dm-escrow-warning"
import { OrderEscrowCard } from "@/components/ui/order-escrow-card"

function renderInTheme(ui: ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>)
}

// Vitest tidak menyalakan `globals`, jadi auto-cleanup RTL tidak aktif.
afterEach(cleanup)

describe("U5-008 <DmEscrowWarning>", () => {
  it("menampilkan peringatan escrow + CTA Buat transaksi", () => {
    renderInTheme(<DmEscrowWarning onCreateOrder={() => {}} />)
    expect(screen.getByText("Chat ini belum dilindungi escrow")).toBeTruthy()
    expect(
      screen.getByText(/Jangan kirim uang langsung ke siapa pun/),
    ).toBeTruthy()
    expect(screen.getByText("Buat transaksi")).toBeTruthy()
  })

  it("CTA memanggil onCreateOrder (jalur escrow yang sama dengan menu ⋮)", () => {
    const onCreateOrder = vi.fn()
    renderInTheme(<DmEscrowWarning onCreateOrder={onCreateOrder} />)
    fireEvent.click(screen.getByText("Buat transaksi"))
    expect(onCreateOrder).toHaveBeenCalledTimes(1)
  })
})

describe("U5-009 <ChatRoomListItem orderBadge>", () => {
  it("room ber-orderId menampilkan badge Escrow", () => {
    renderInTheme(
      <ChatRoomListItem name="Toko Maju" orderBadge onPress={() => {}} />,
    )
    expect(screen.getByText("Escrow")).toBeTruthy()
  })

  it("DM tanpa orderId tidak menampilkan badge", () => {
    renderInTheme(<ChatRoomListItem name="Budi" onPress={() => {}} />)
    expect(screen.queryByText("Escrow")).toBeNull()
  })
})

describe("U5-012 <OrderEscrowCard> PROCESSING (pembeli)", () => {
  it("menyebut tenggat 2 hari + dana kembali otomatis", () => {
    renderInTheme(
      <OrderEscrowCard status="PROCESSING" amount={100_000} myRole="BUYER" />,
    )
    // FE-090: satu kalimat — jaminan auto-refund 2 hari digabung dengan
    // em-dash (bukan kalimat terpisah).
    expect(
      screen.getByText(
        /kembali otomatis bila penjual tidak kirim dalam 2 hari\./,
      ),
    ).toBeTruthy()
  })

  it("penjual PROCESSING tidak mendapat copy tenggat pembeli", () => {
    renderInTheme(
      <OrderEscrowCard status="PROCESSING" amount={100_000} myRole="SELLER" />,
    )
    expect(screen.queryByText(/tidak kirim dalam 2 hari/)).toBeNull()
  })
})
