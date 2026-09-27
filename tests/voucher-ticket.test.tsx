/**
 * Test render komponen voucher gaya tiket (rev. 2026-09-27) — satu bahasa
 * dengan struk <ReceiptTicket>: <TicketShell> + <TicketDivider> (notch
 * perforasi, watermark, garis putus-putus).
 *
 * Mengunci kontrak visual:
 * - <VoucherCard>: Badge status AKTIF (hijau) / TERPAKAI (abu) /
 *   KEDALUWARSA (merah), diskon besar (25% / Rp50.000), kode Mono uppercase
 *   + tombol salin, expiry jelas, CTA Pakai / tanda terpilih.
 * - <VoucherRedeemBox>: state terpasang = tiket mini (kode + "Terpasang" +
 *   "-Rp10.000", perforasi, hapus); idle menormalkan kode ("abc 123" ->
 *   "ABC123") sebelum onApply.
 * - <VoucherUsageListItem>: tiket kompak riwayat — kode Mono, Badge
 *   "Terpakai", hemat "+Rp25.000", meta order/waktu.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ReactElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ThemeProvider } from "@/components/theme-provider"
import { VoucherCard, type VoucherStatus } from "@/components/ui/voucher-card"
import { normalizeVoucherCode, VoucherRedeemBox } from "@/components/ui/voucher-redeem-box"
import { TicketDivider } from "@/components/ui/voucher-ticket"
import { VoucherUsageListItem } from "@/components/ui/voucher-usage-list-item"

function wrapTheme(ui: ReactElement) {
  return <ThemeProvider>{ui}</ThemeProvider>
}

function renderCard(props: Partial<React.ComponentProps<typeof VoucherCard>> = {}) {
  return render(
    wrapTheme(
      <VoucherCard
        code="hemat50"
        title="Diskon ongkir"
        description="Potongan ongkos kirim semua ekspedisi"
        discountType="PERCENTAGE"
        discountValue={25}
        minOrderValue={100000}
        expiresAt="27 Sep 2026, 23.59"
        {...props}
      />,
    ),
  )
}

afterEach(cleanup)

describe("<VoucherCard> badge status", () => {
  const cases: Array<[VoucherStatus, string]> = [
    ["active", "Aktif"],
    ["used", "Terpakai"],
    ["expired", "Kedaluwarsa"],
  ]
  for (const [status, label] of cases) {
    it(`status ${status} menampilkan badge "${label}"`, () => {
      renderCard({ status })
      expect(screen.getByText(label)).toBeTruthy()
    })
  }
})

describe("<VoucherCard> konten tiket", () => {
  it("diskon persen besar + kode uppercase + syarat + expiry tampil", () => {
    renderCard()
    expect(screen.getByText("25%")).toBeTruthy()
    expect(screen.getByText("HEMAT50")).toBeTruthy()
    expect(screen.getByText("Diskon ongkir")).toBeTruthy()
    expect(screen.getByText(/Min\. transaksi Rp100\.000/)).toBeTruthy()
    expect(screen.getByText(/Berlaku s\.d\. 27 Sep 2026/)).toBeTruthy()
  })

  it("diskon nominal tampil sebagai rupiah besar", () => {
    renderCard({ discountType: "FIXED", discountValue: 50000 })
    expect(screen.getByText("Rp50.000")).toBeTruthy()
  })

  it("tombol salin memanggil onCopyCode", () => {
    const onCopyCode = vi.fn()
    renderCard({ onCopyCode })
    fireEvent.click(screen.getByLabelText("Salin kode voucher"))
    expect(onCopyCode).toHaveBeenCalledTimes(1)
  })

  it("tombol salin tidak dirender bila onCopyCode tidak diberikan", () => {
    renderCard()
    expect(screen.queryByLabelText("Salin kode voucher")).toBeNull()
  })

  it("CTA Pakai tampil bila onUse diberikan dan belum terpilih", () => {
    const onUse = vi.fn()
    renderCard({ onUse })
    fireEvent.click(screen.getByText("Pakai"))
    expect(onUse).toHaveBeenCalledTimes(1)
  })

  it("mode terpilih: CTA hilang, ikon Terpilih tampil", () => {
    renderCard({ selected: true, onUse: () => {} })
    expect(screen.queryByText("Pakai")).toBeNull()
    expect(screen.getByLabelText("Terpilih")).toBeTruthy()
  })

  it("disabled menampilkan alasan, kartu tetap terbaca", () => {
    renderCard({ disabled: true, disabledReason: "Min. transaksi belum tercapai", onUse: () => {} })
    expect(screen.getByText("Min. transaksi belum tercapai")).toBeTruthy()
    expect(screen.getByText("HEMAT50")).toBeTruthy()
  })
})

describe("<VoucherRedeemBox>", () => {
  it("normalizeVoucherCode: spasi dibuang, huruf jadi kapital", () => {
    expect(normalizeVoucherCode("abc 123")).toBe("ABC123")
    expect(normalizeVoucherCode("  Hemat50 ")).toBe("HEMAT50")
  })

  it("idle: kode dinormalkan sebelum onApply", () => {
    const onApply = vi.fn()
    render(wrapTheme(<VoucherRedeemBox onApply={onApply} />))
    fireEvent.change(screen.getByLabelText("Kode voucher"), { target: { value: "abc 123" } })
    fireEvent.click(screen.getByText("Pakai"))
    expect(onApply).toHaveBeenCalledWith("ABC123")
  })

  it("errorText tampil di bawah input", () => {
    render(wrapTheme(<VoucherRedeemBox onApply={() => {}} errorText="Kode tidak berlaku" />))
    expect(screen.getByText("Kode tidak berlaku")).toBeTruthy()
  })

  it("terpasang: tiket mini dengan kode, badge, nominal, dan hapus", () => {
    const onRemove = vi.fn()
    render(
      wrapTheme(
        <VoucherRedeemBox
          applied={{ code: "HEMAT50", title: "Diskon ongkir", discount: 10000 }}
          onApply={() => {}}
          onRemove={onRemove}
        />,
      ),
    )
    expect(screen.getByText("HEMAT50")).toBeTruthy()
    expect(screen.getByText("Terpasang")).toBeTruthy()
    expect(screen.getByText("-Rp10.000")).toBeTruthy()
    expect(screen.getByText("Hapus untuk mengganti kode")).toBeTruthy()
    fireEvent.click(screen.getByLabelText("Hapus voucher"))
    expect(onRemove).toHaveBeenCalledTimes(1)
  })
})

describe("<VoucherUsageListItem>", () => {
  function renderItem(props: Partial<React.ComponentProps<typeof VoucherUsageListItem>> = {}) {
    return render(
      wrapTheme(
        <VoucherUsageListItem
          title="Diskon ongkir"
          code="hemat50"
          savedAmount={25000}
          orderId="ord_1234567890abcdef"
          usedAt="26 Sep 2026, 10.00"
          {...props}
        />,
      ),
    )
  }

  it("tiket kompak: kode, badge Terpakai, hemat, meta tampil", () => {
    renderItem()
    expect(screen.getByText("HEMAT50")).toBeTruthy()
    expect(screen.getByText("Terpakai")).toBeTruthy()
    expect(screen.getByText("Diskon ongkir")).toBeTruthy()
    expect(screen.getByText("+Rp25.000")).toBeTruthy()
    expect(screen.getByText(/26 Sep 2026/)).toBeTruthy()
  })

  it("tap tiket memanggil onPress", () => {
    const onPress = vi.fn()
    renderItem({ onPress })
    fireEvent.click(screen.getByText("Diskon ongkir"))
    expect(onPress).toHaveBeenCalledTimes(1)
  })
})

describe("<TicketDivider>", () => {
  it("merender garis putus-putus (deretan dash, bukan border dashed)", () => {
    const { container } = render(wrapTheme(<TicketDivider />))
    expect(container.querySelectorAll("div").length).toBeGreaterThan(10)
  })
})
