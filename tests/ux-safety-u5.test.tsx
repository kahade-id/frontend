/**
 * Tim UX-Safety 2026-09-29 — kontrak presentasi temuan U5-008 / U5-009 /
 * U5-012 (audit UX-deep). Murni tampilan: tidak menyentuh logika
 * bayar/refund/escrow apa pun.
 *
 *  - U5-008 (REVISI 2026-10-08): <DmSafetyDialog> — popup anti-tipu yang
 *    tampil SEKALI per lawan bicara di DM tanpa orderId, dengan CTA "Buat
 *    transaksi". Banner permanen dihapus atas permintaan produk: peringatan
 *    yang menetap selamanya berhenti dibaca dan menyempitkan ruang chat.
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
import { DmSafetyDialog } from "@/components/ui/dm-safety-dialog"
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

describe("U5-008 <DmSafetyDialog>", () => {
  it("menampilkan peringatan + CTA Buat transaksi saat visible", () => {
    renderInTheme(
      <DmSafetyDialog visible onCreateOrder={() => {}} onDismiss={() => {}} />,
    )
    expect(screen.getByText("Pastikan transaksi lewat Kahade")).toBeTruthy()
    expect(screen.getByText(/Kirim uang hanya lewat transaksi di aplikasi/)).toBeTruthy()
    expect(screen.getByText("Buat transaksi")).toBeTruthy()
    expect(screen.getByText("Mengerti")).toBeTruthy()
  })

  it('"Mengerti" menutup popup, bukan membuka sheet transaksi', () => {
    const onDismiss = vi.fn()
    const onCreateOrder = vi.fn()
    renderInTheme(
      <DmSafetyDialog visible onCreateOrder={onCreateOrder} onDismiss={onDismiss} />,
    )
    fireEvent.click(screen.getByText("Mengerti"))
    expect(onDismiss).toHaveBeenCalledTimes(1)
    expect(onCreateOrder).not.toHaveBeenCalled()
  })

  it("CTA memanggil onCreateOrder (jalur transaksi yang sama dengan menu ⋮)", () => {
    const onCreateOrder = vi.fn()
    renderInTheme(
      <DmSafetyDialog visible onCreateOrder={onCreateOrder} onDismiss={() => {}} />,
    )
    fireEvent.click(screen.getByText("Buat transaksi"))
    expect(onCreateOrder).toHaveBeenCalledTimes(1)
  })

  it("tidak menyebut istilah internal di teks yang tampil", () => {
    renderInTheme(
      <DmSafetyDialog visible onCreateOrder={() => {}} onDismiss={() => {}} />,
    )
    for (const banned of ["escrow", "Rekber", "rekber", "ditahan", "penahanan"]) {
      expect(screen.queryByText(new RegExp(banned, "i"))).toBeNull()
    }
  })

  it("tersembunyi saat visible=false (sekali per lawan bicara)", () => {
    renderInTheme(
      <DmSafetyDialog visible={false} onCreateOrder={() => {}} onDismiss={() => {}} />,
    )
    expect(screen.queryByText("Pastikan transaksi lewat Kahade")).toBeNull()
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
