/**
 * Test render <ReceiptTicket> — kontrak visual empat varian status:
 * label header, nominal, baris label-nilai, ID transaksi mono, QR opsional,
 * tombol bagikan, tombol chat CS, kartu penerima, dan info perusahaan.
 */
import { cleanup, render, screen } from "@testing-library/react"
import type { ReactElement } from "react"
import { afterEach, describe, expect, it } from "vitest"

import { ThemeProvider } from "@/components/theme-provider"
import { DashedLine, ReceiptTicket } from "@/components/receipt/ReceiptTicket"
import { receiptDateRows, type ReceiptStatus } from "@/lib/receipt"

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
  it("nominal, baris label-nilai, dan ID transaksi tampil", () => {
    renderTicket()
    // Nominal besar diformat rupiah
    expect(screen.getByText("Rp150.000")).toBeTruthy()
    expect(screen.getByText("Penerima")).toBeTruthy()
    expect(screen.getByText("@budi")).toBeTruthy()
    expect(screen.getByText("KHD-ABC123")).toBeTruthy()
  })

  it("label 'ID Transaksi' tampil (bukan 'ID Struk')", () => {
    renderTicket()
    expect(screen.getByText("ID Transaksi")).toBeTruthy()
    expect(screen.queryByText("ID Struk")).toBeNull()
  })

  it("info perusahaan tampil persis", () => {
    renderTicket()
    expect(screen.getByText("PT Kawal Hak Dengan Aman")).toBeTruthy()
    expect(screen.getByText("NPWP 1000 0000 0827 0425")).toBeTruthy()
    expect(screen.getByText("Jl Cihideung Udik, Kec. Ciampea Kab. Bogor 16620")).toBeTruthy()
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

describe("<ReceiptTicket> chat CS & penerima", () => {
  it("tombol Chat dengan CS tampil", () => {
    renderTicket()
    expect(screen.getByText("Chat dengan CS")).toBeTruthy()
  })

  it("tombol Chat dengan CS tampil walau onShare tidak diberikan", () => {
    renderTicket()
    expect(screen.queryByText("Bagikan struk")).toBeNull()
    expect(screen.getByText("Chat dengan CS")).toBeTruthy()
  })

  it("kartu penerima menampilkan nama + info tujuan", () => {
    renderTicket({ recipient: { name: "Budi Santoso", detail: "@budi" }, rows: [] })
    expect(screen.getByText("Penerima")).toBeTruthy()
    expect(screen.getByText("Budi Santoso")).toBeTruthy()
    expect(screen.getByText("@budi")).toBeTruthy()
  })

  it("label kartu penerima bisa dikustom (Rekening tujuan)", () => {
    renderTicket({
      recipientLabel: "Rekening tujuan",
      recipient: { name: "Budi Santoso", detail: "BCA · ••••1234" },
      rows: [],
    })
    expect(screen.getByText("Rekening tujuan")).toBeTruthy()
    expect(screen.getByText("Budi Santoso")).toBeTruthy()
    expect(screen.getByText("BCA · ••••1234")).toBeTruthy()
  })

  it("kartu penerima tidak tampil bila recipient kosong", () => {
    renderTicket({ rows: [] })
    expect(screen.queryByText("Penerima")).toBeNull()
  })

  it("nama penerima kosong = placeholder netral, bukan teks palsu", () => {
    renderTicket({ recipient: { name: "  ", detail: null }, rows: [] })
    expect(screen.getByText("—")).toBeTruthy()
  })
})

describe("receiptDateRows", () => {
  it("Tanggal dan Waktu sebagai field terpisah (WIB)", () => {
    const rows = receiptDateRows("2026-09-27T10:00:00+07:00")
    expect(rows).toHaveLength(2)
    expect(rows[0].label).toBe("Tanggal")
    expect(rows[0].value).toBe("27 September 2026")
    expect(rows[1].label).toBe("Waktu")
    expect(rows[1].value).toBe("10:00 WIB")
  })

  it("fail closed: data kosong = placeholder netral", () => {
    for (const rows of [receiptDateRows(null), receiptDateRows(undefined), receiptDateRows("")]) {
      expect(rows).toHaveLength(2)
      expect(rows[0].value).toBe("—")
      expect(rows[1].value).toBe("—")
    }
  })
})

describe("<DashedLine>", () => {
  it("merender deretan dash (bukan border dashed)", () => {
    const { container } = render(wrapTheme(<DashedLine />))
    // 64 dash kecil di dalam satu baris
    expect(container.querySelectorAll("div").length).toBeGreaterThan(10)
  })
})
