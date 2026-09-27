/**
 * Test render <ReceiptTicket> — kontrak visual empat varian status:
 * label header, nominal, baris label-nilai, ID struk mono, QR opsional,
 * dan tombol bagikan.
 */
import { cleanup, render, screen } from "@testing-library/react"
import type { ReactElement } from "react"
import { afterEach, describe, expect, it } from "vitest"

import { ThemeProvider } from "@/components/theme-provider"
import { DashedLine, ReceiptTicket } from "@/components/receipt/ReceiptTicket"
import type { ReceiptStatus } from "@/lib/receipt"

function wrapTheme(ui: ReactElement) {
  return <ThemeProvider>{ui}</ThemeProvider>
}

function renderTicket(props: Partial<React.ComponentProps<typeof ReceiptTicket>> = {}) {
  return render(
    wrapTheme(
      <ReceiptTicket
        status="SUCCESS"
        title="Transfer Dana"
        amount={150000}
        rows={[
          { label: "Penerima", value: "@budi" },
          { label: "Catatan", value: "Bayar kopi" },
        ]}
        receiptId="KHD-ABC123"
        {...props}
      />,
    ),
  )
}

afterEach(cleanup)

describe("<ReceiptTicket> varian status", () => {
  const cases: Array<[ReceiptStatus, string]> = [
    ["SUCCESS", "BERHASIL"],
    ["PENDING", "DIPROSES"],
    ["FAILED", "GAGAL"],
    ["REFUND", "REFUND"],
  ]
  for (const [status, label] of cases) {
    it(`status ${status} menampilkan label "${label}"`, () => {
      renderTicket({ status })
      expect(screen.getByText(label)).toBeTruthy()
    })
  }
})

describe("<ReceiptTicket> konten", () => {
  it("nominal, baris label-nilai, dan ID struk tampil", () => {
    renderTicket()
    // Nominal besar diformat rupiah
    expect(screen.getByText("Rp150.000")).toBeTruthy()
    expect(screen.getByText("Penerima")).toBeTruthy()
    expect(screen.getByText("@budi")).toBeTruthy()
    expect(screen.getByText("KHD-ABC123")).toBeTruthy()
  })

  it("QR tidak dirender bila qrDataUrl kosong (tanpa crash)", () => {
    renderTicket({ qrDataUrl: null })
    expect(screen.queryByLabelText("Kode QR verifikasi keaslian struk")).toBeNull()
  })

  it("QR dirender bila qrDataUrl ada", () => {
    renderTicket({ qrDataUrl: "data:image/png;base64,AAA" })
    expect(screen.getByLabelText("Kode QR verifikasi keaslian struk")).toBeTruthy()
    expect(screen.getByText("Pindai untuk verifikasi keaslian struk")).toBeTruthy()
  })

  it("tombol bagikan tampil bila onShare diberikan", () => {
    renderTicket({ onShare: () => {} })
    expect(screen.getByText("Bagikan struk")).toBeTruthy()
  })

  it("tombol bagikan hilang bila onShare tidak diberikan", () => {
    renderTicket()
    expect(screen.queryByText("Bagikan struk")).toBeNull()
  })
})

describe("<DashedLine>", () => {
  it("merender deretan dash (bukan border dashed)", () => {
    const { container } = render(wrapTheme(<DashedLine />))
    // 64 dash kecil di dalam satu baris
    expect(container.querySelectorAll("div").length).toBeGreaterThan(10)
  })
})
