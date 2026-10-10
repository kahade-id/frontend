/**
 * Tim UX-Safety 2026-09-29 — kontrak presentasi temuan U5-008 / U5-009 /
 * U5-012 (audit UX-deep). Murni tampilan: tidak menyentuh logika
 * bayar/refund/escrow apa pun.
 *
 *  - U5-008 (REVISI audit Pesan 2026-10-10, #8): <DmSafetyBanner> — banner
 *    anti-tipu yang TAMPIL SELALU di DM tanpa orderId (kecuali lawan bicara
 *    terverifikasi), dengan CTA "Buat transaksi". Popup sekali-per-lawan-
 *    bicara (2026-10-08) dihapus: keputusan produk, peringatan tidak boleh
 *    bisa dilewati sekali ketuk lalu hilang selamanya.
 *  - U5-009: <ChatRoomListItem orderBadge> — room ber-orderId ditandai
 *    badge kecil "Terlindungi", bukan kode order mentah (dan bukan istilah
 *    internal "escrow" — lihat larangan istilah di UI, 2026-10-08).
 *  - U5-012: <OrderEscrowCard> PROCESSING (pembeli) — menyebut tenggat
 *    kirim 2 hari + jaminan auto-refund.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ReactElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ThemeProvider } from "@/components/theme-provider"
import { ChatRoomListItem } from "@/components/ui/chat-room-list-item"
import { DmSafetyBanner } from "@/components/ui/dm-safety-banner"
import { OrderEscrowCard } from "@/components/ui/order-escrow-card"
import { PortalHost, PortalProvider } from "@/components/ui/portal"
import { ToastProvider } from "@/components/ui/toast"

function renderInTheme(ui: ReactElement) {
  // <Dialog> memakai <Modal> primitif: Portal + useToast (umpan balik saat
  // overlay tidak bisa ditutup) — keduanya wajib ada di pohon test.
  return render(
    <ThemeProvider>
      <PortalProvider>
        <ToastProvider>
          {ui}
          <PortalHost />
        </ToastProvider>
      </PortalProvider>
    </ThemeProvider>,
  )
}

// Vitest tidak menyalakan `globals`, jadi auto-cleanup RTL tidak aktif.
afterEach(cleanup)

describe("U5-008 <DmSafetyBanner> (#8: permanen di DM tanpa transaksi)", () => {
  it("menampilkan peringatan + CTA Buat transaksi", () => {
    renderInTheme(<DmSafetyBanner onCreateOrder={() => {}} />)
    expect(screen.getByText("Pastikan transaksi lewat Kahade")).toBeTruthy()
    expect(screen.getByText(/Kirim uang hanya lewat transaksi di aplikasi/)).toBeTruthy()
    expect(screen.getByText("Buat transaksi")).toBeTruthy()
  })

  it("tidak punya tombol tutup/Mengerti — banner tidak bisa dilewati", () => {
    renderInTheme(<DmSafetyBanner onCreateOrder={() => {}} />)
    expect(screen.queryByText("Mengerti")).toBeNull()
    expect(screen.queryByLabelText("Tutup pesan")).toBeNull()
  })

  it("CTA memanggil onCreateOrder (jalur transaksi yang sama dengan menu ⋮)", () => {
    const onCreateOrder = vi.fn()
    renderInTheme(<DmSafetyBanner onCreateOrder={onCreateOrder} />)
    fireEvent.click(screen.getByText("Buat transaksi"))
    expect(onCreateOrder).toHaveBeenCalledTimes(1)
  })

  it("tidak menyebut istilah internal di teks yang tampil", () => {
    renderInTheme(<DmSafetyBanner onCreateOrder={() => {}} />)
    for (const banned of ["escrow", "Rekber", "rekber", "ditahan", "penahanan"]) {
      expect(screen.queryByText(new RegExp(banned, "i"))).toBeNull()
    }
  })
})

describe("U5-009 <ChatRoomListItem orderBadge>", () => {
  it("room ber-orderId menampilkan badge Terlindungi", () => {
    renderInTheme(
      <ChatRoomListItem name="Toko Maju" orderBadge onPress={() => {}} />,
    )
    expect(screen.getByText("Terlindungi")).toBeTruthy()
    // Istilah internal tidak boleh muncul di daftar percakapan.
    expect(screen.queryByText(/escrow/i)).toBeNull()
  })

  it("DM tanpa orderId tidak menampilkan badge", () => {
    renderInTheme(<ChatRoomListItem name="Budi" onPress={() => {}} />)
    expect(screen.queryByText("Terlindungi")).toBeNull()
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
