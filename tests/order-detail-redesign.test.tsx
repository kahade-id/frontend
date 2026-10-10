/**
 * Redesign detail order 2026-09-30 (permintaan produk: SEBERSIH website Apple).
 *
 * Yang diuji (pohon render + teks; API tidak ditembak):
 *  1. <OrderStatusHero>: hierarki STATUS → JUDUL → ID TRANSAKSI → TANGGAL /
 *     WAKTU; label "ID Transaksi", "Tanggal", "Waktu" tampil TERPISAH;
 *     tombol salin memanggil onCopyId.
 *  2. <OrderJourney>: me-render 5 tahap + timestamp dari buildOrderJourney.
 *  3. <OrderProductCard>: judul, chip tipe, dan NILAI TRANSAKSI TEPAT —
 *     tidak mengarang foto/varian/jumlah.
 *  4. <OrderCounterpartyCard>: SATU lawan transaksi — pembeli hanya melihat
 *     penjual, penjual hanya melihat pembeli.
 *  5. <OrderDetailInfo>: info kontekstual (badge peran, countdown, hint,
 *     galat nominal) — TIDAK me-render tombol aksi.
 *  6. <OrderFooterActions>: bottom navbar — Chat selalu ada; CTA hanya yang
 *     diminta; tombol Bayar terkunci bila buyerPays null (M-30).
 *  7. <OrderPaymentBreakdown>: collapsible — header selalu menampilkan total
 *     + caret buka/tutup.
 *  8. <OrderEscrowCard>: menyebut PT Kawal Hak Dengan Aman; copy sesuai status.
 *  9. <OrderHelpCard>: tombol CS memanggil onContactSupport.
 *  10. <OrderRatingReminder>: tidak me-render apa pun bila visible=false.
 *
 * Dijalankan dengan config komponen (repo convention):
 *   npx vitest run --config vitest.components.config.ts tests/order-detail-redesign.test.tsx
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ThemeProvider } from "@/components/theme-provider"
import { OrderDetailInfo, OrderRatingReminder } from "@/components/order-detail-actions"
import { OrderFooterActions } from "@/components/order-footer-actions"
import { OrderEscrowCard } from "@/components/ui/order-escrow-card"
import {
  mapOrderHistoryToTimeline,
  type OrderHistoryEntry,
} from "@/components/ui/order-history-timeline"
import { OrderJourney } from "@/components/ui/order-journey"
import { OrderCounterpartyCard } from "@/components/ui/order-counterparty-card"
import { OrderPaymentBreakdown } from "@/components/ui/order-payment-breakdown"
import { OrderProductCard } from "@/components/ui/order-product-card"
import { OrderStatusHero } from "@/components/ui/order-status-hero"
import { buildOrderJourney } from "@/lib/order-journey"

afterEach(cleanup)

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>)
}

const noop = () => {}

describe("<OrderStatusHero>", () => {
  const props = {
    status: "WAITING_PAYMENT",
    title: "Jasa desain logo",
    transactionId: "ORD-20260927-0001",
    createdAt: "2026-09-27T10:00:00+07:00",
    copied: false,
    onCopyId: vi.fn(),
  }

  it("menampilkan label ID Transaksi dan tanggal-waktu gabungan", () => {
    renderWithTheme(<OrderStatusHero {...props} />)
    expect(screen.getByText("ID Transaksi")).toBeTruthy()
    // FE-002: tanggal + waktu digabung satu baris ("27 September 2026 · 03:00 WIB"
    // di UTC / "10:00 WIB" di WIB), bukan dua label terpisah — lebih ringkas.
    expect(document.body.textContent).toMatch(/27 September 2026/)
    expect(document.body.textContent).toMatch(/[0-9]{2}:[0-9]{2} WIB/)
    expect(screen.getByText("ORD-20260927-0001")).toBeTruthy()
    expect(screen.getByText("Jasa desain logo")).toBeTruthy()
  })

  it("tombol salin memanggil onCopyId dan mencerminkan state copied", () => {
    const onCopyId = vi.fn()
    const { rerender } = renderWithTheme(
      <OrderStatusHero {...props} onCopyId={onCopyId} copied={false} />,
    )
    fireEvent.click(screen.getByRole("button", { name: /salin id transaksi/i }))
    expect(onCopyId).toHaveBeenCalledTimes(1)
    rerender(
      <ThemeProvider>
        <OrderStatusHero {...props} onCopyId={onCopyId} copied />
      </ThemeProvider>,
    )
    expect(
      screen.getByRole("button", { name: /id transaksi disalin/i }),
    ).toBeTruthy()
  })
})

describe("<OrderJourney>", () => {
  it("me-render lima tahap dengan timestamp dari buildOrderJourney", () => {
    const steps = buildOrderJourney({
      status: "IN_DELIVERY",
      createdAt: "2026-09-20T10:00:00+07:00",
      paidAt: "2026-09-21T09:00:00+07:00",
      completedAt: null,
      history: [{ toStatus: "IN_DELIVERY", createdAt: "2026-09-22T14:00:00+07:00" }],
    })
    renderWithTheme(<OrderJourney steps={steps} />)
    // FE-092: judul visual "Perjalanan order" dihapus — timeline status
    // sudah self-explanatory; label aksesibilitas dipertahankan.
    expect(
      screen.getByRole("list", { name: /perjalanan pesanan/i }),
    ).toBeTruthy()
    expect(screen.getByText("Order dibuat")).toBeTruthy()
    expect(screen.getByText("Dibayar ke Kahade")).toBeTruthy()
    expect(screen.getByText("Dikirim penjual")).toBeTruthy()
    expect(screen.getByText("Diterima pembeli")).toBeTruthy()
    expect(screen.getByText("Dana cair ke penjual")).toBeTruthy()
  })

  it("tidak me-render apa pun bila steps kosong", () => {
    const { container } = renderWithTheme(<OrderJourney steps={[]} />)
    expect(container.textContent).toBe("")
  })
})

describe("<OrderProductCard>", () => {
  it("menampilkan judul, tipe, dan nilai transaksi tepat — tanpa mengarang foto/varian/jumlah", () => {
    renderWithTheme(
      <OrderProductCard
        title="Jasa desain logo"
        description="Logo minimalis 2 revisi"
        orderType="SERVICE"
        orderValue={250000}
      />,
    )
    expect(screen.getByText("Jasa desain logo")).toBeTruthy()
    expect(screen.getByText("Logo minimalis 2 revisi")).toBeTruthy()
    expect(screen.getByText("Nilai transaksi")).toBeTruthy()
    // Nilai tepat dari backend — bukan angka yang dihitung ulang.
    expect(screen.getByText(/250\.000/)).toBeTruthy()
    const text = document.body.textContent ?? ""
    expect(text).not.toMatch(/varian/i)
    expect(text).not.toMatch(/jumlah/i)
  })
})

describe("<OrderCounterpartyCard>", () => {
  const buyer = { username: "pembeli1", fullName: "Pembeli Satu" } as never
  const seller = { username: "penjual1", fullName: "Penjual Satu" } as never

  it("pembeli HANYA melihat penjual", () => {
    renderWithTheme(
      <OrderCounterpartyCard buyer={buyer} seller={seller} myRole="BUYER" onOpenProfile={noop} />,
    )
    expect(screen.getByText("Penjual")).toBeTruthy()
    expect(screen.getByText("Penjual Satu")).toBeTruthy()
    expect(screen.getByText("@penjual1")).toBeTruthy()
    // Lawan transaksi TIDAK tampil.
    const text = document.body.textContent ?? ""
    expect(text).not.toMatch(/pembeli1/i)
    expect(text).not.toMatch(/Pembeli Satu/)
  })

  it("penjual HANYA melihat pembeli", () => {
    renderWithTheme(
      <OrderCounterpartyCard buyer={buyer} seller={seller} myRole="SELLER" onOpenProfile={noop} />,
    )
    expect(screen.getByText("Pembeli")).toBeTruthy()
    expect(screen.getByText("Pembeli Satu")).toBeTruthy()
    expect(screen.getByText("@pembeli1")).toBeTruthy()
    const text = document.body.textContent ?? ""
    expect(text).not.toMatch(/penjual1/i)
    expect(text).not.toMatch(/Penjual Satu/)
  })

  it("klik kartu membuka profil lawan transaksi", () => {
    const onOpenProfile = vi.fn()
    renderWithTheme(
      <OrderCounterpartyCard
        buyer={buyer}
        seller={seller}
        myRole="BUYER"
        onOpenProfile={onOpenProfile}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: /lihat profil penjual/i }))
    expect(onOpenProfile).toHaveBeenCalledWith("penjual1")
  })
})

describe("<OrderDetailInfo>", () => {
  const baseProps = {
    status: "WAITING_PAYMENT",
    myRole: "BUYER" as const,
    hasPrimaryAction: false,
    autoReleaseAt: null,
    shippingCountdownInput: null,
    confirmCountdownInput: null,
  }

  it("hanya me-render info — TIDAK ada tombol aksi di badan layar", () => {
    renderWithTheme(<OrderDetailInfo {...baseProps} />)
    const text = document.body.textContent ?? ""
    // Badge peran tampil sebagai info.
    expect(screen.getByText("Pembeli")).toBeTruthy()
    expect(text).not.toMatch(/bayar sekarang/i)
    expect(text).not.toMatch(/konfirmasi terima/i)
  })

  it("countdown auto-release tampil bila diberikan", () => {
    // FE-001: layar hanya meneruskan string `at` yang stabil; detik hitung
    // mundur dihitung per tick di dalam <AutoReleaseCountdownBox>.
    const future = new Date(Date.now() + 3600_000).toISOString()
    renderWithTheme(<OrderDetailInfo {...baseProps} autoReleaseAt={future} />)
    expect(screen.getByText("Batas konfirmasi")).toBeTruthy()
    expect(screen.getByText(/dana cair otomatis/i)).toBeTruthy()
  })

  it("item 34: tanpa aksi primer → hint langkah berikutnya per status × peran", () => {
    const { rerender } = renderWithTheme(
      <OrderDetailInfo {...baseProps} status="WAITING_CONFIRMATION" myRole="SELLER" />,
    )
    expect(document.body.textContent).toMatch(/konfirmasi pesanan ini/i)

    rerender(
      <ThemeProvider>
        <OrderDetailInfo {...baseProps} status="WAITING_PAYMENT" myRole="SELLER" />
      </ThemeProvider>,
    )
    expect(document.body.textContent).toMatch(/menunggu pembeli membayar/i)
  })

  it("galat nominal pembayaran + tombol muat ulang", () => {
    const onReloadPayAmount = vi.fn()
    renderWithTheme(
      <OrderDetailInfo
        {...baseProps}
        payAmountMissing
        onReloadPayAmount={onReloadPayAmount}
      />,
    )
    expect(screen.getByText("Rincian biaya belum tersedia")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Coba lagi" }))
    expect(onReloadPayAmount).toHaveBeenCalledTimes(1)
  })
})

describe("<OrderFooterActions> (bottom navbar)", () => {
  const baseProps = {
    canPay: false,
    canConfirm: false,
    canShip: false,
    canReviewDelivery: false,
    canRate: false,
    canReturnPrimary: false,
    buyerPays: null as number | null | undefined,
    shippingRequired: true,
    submitting: false,
    chatBusy: false,
    onPay: noop,
    onAccept: noop,
    onReject: noop,
    onShipping: noop,
    onComplete: noop,
    onRate: noop,
    onReturn: noop,
    onOpenChat: noop,
  }

  it("Chat selalu tampil; CTA hanya yang diminta", () => {
    renderWithTheme(<OrderFooterActions {...baseProps} />)
    expect(screen.getByRole("button", { name: /chat dengan lawan transaksi/i })).toBeTruthy()
    const text = document.body.textContent ?? ""
    expect(text).not.toMatch(/bayar/i)
    expect(text).not.toMatch(/terima pesanan/i)
  })

  it("chat memanggil handler", () => {
    const onOpenChat = vi.fn()
    renderWithTheme(<OrderFooterActions {...baseProps} onOpenChat={onOpenChat} />)
    fireEvent.click(screen.getByRole("button", { name: /chat dengan lawan transaksi/i }))
    expect(onOpenChat).toHaveBeenCalledTimes(1)
  })

  it("tombol Bayar terkunci (label Bayar —) bila buyerPays null", () => {
    renderWithTheme(<OrderFooterActions {...baseProps} canPay buyerPays={null} />)
    // M-30: selama nominal belum terlihat, label menampilkan "—" — bukan
    // angka yang lebih kecil. Prop `disabled={buyerPays == null}` dikunci di
    // sumber komponen (tidak ada sinyal DOM yang andal di RNW).
    expect(screen.getByRole("button", { name: "Bayar —" })).toBeTruthy()
  })

  it("tombol Bayar menampilkan nominal tepat bila buyerPays ada", () => {
    renderWithTheme(<OrderFooterActions {...baseProps} canPay buyerPays={255000} />)
    expect(screen.getByRole("button", { name: /bayar/i }).textContent).toMatch(/255\.000/)
  })

  it("aksi penjual: terima/tolak muncul BERSAMA; kirim pesanan; konfirmasi terima; ulasan; retur", () => {
    const onAccept = vi.fn()
    const onReturn = vi.fn()
    renderWithTheme(
      <OrderFooterActions
        {...baseProps}
        canConfirm
        canShip
        canReviewDelivery
        canRate
        canReturnPrimary
        onAccept={onAccept}
        onReturn={onReturn}
      />,
    )
    expect(screen.getByRole("button", { name: /terima pesanan/i })).toBeTruthy()
    expect(screen.getByRole("button", { name: /tolak pesanan/i })).toBeTruthy()
    expect(screen.getByRole("button", { name: /isi resi pengiriman/i })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Konfirmasi terima" })).toBeTruthy()
    expect(screen.getByRole("button", { name: /beri ulasan/i })).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/Tandai selesai/)
    fireEvent.click(screen.getByRole("button", { name: /terima pesanan/i }))
    expect(onAccept).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole("button", { name: "Ajukan retur" }))
    expect(onReturn).toHaveBeenCalledTimes(1)
  })
})

describe("<OrderPaymentBreakdown> (collapsible)", () => {
  const feeProps = {
    orderValue: 250000,
    feeAmount: 5000,
    feeResponsibility: "BUYER" as const,
    buyerPays: 255000,
    sellerGets: 245000,
  }

  it("header selalu menampilkan total — pembeli melihat yang dibayar", () => {
    renderWithTheme(<OrderPaymentBreakdown {...feeProps} role="BUYER" />)
    // Header: label + total (accessible name memuat total); isi: tabel
    // invoice (default terbuka).
    expect(screen.getByText("Rincian pembayaran")).toBeTruthy()
    expect(
      screen.getByRole("button", { name: /rincian pembayaran, total rp255\.000/i }),
    ).toBeTruthy()
    expect(screen.getByText("Nilai transaksi")).toBeTruthy()
  })

  it("penjual melihat total yang diterima", () => {
    renderWithTheme(<OrderPaymentBreakdown {...feeProps} role="SELLER" />)
    expect(
      screen.getByRole("button", { name: /rincian pembayaran, total rp245\.000/i }),
    ).toBeTruthy()
  })

  it("caret/header membuka-menutup isi", () => {
    renderWithTheme(<OrderPaymentBreakdown {...feeProps} role="BUYER" />)
    const header = screen.getByRole("button", { name: /rincian pembayaran/i })
    // Default terbuka → klik menutup.
    fireEvent.click(header)
    expect(document.body.textContent).not.toMatch(/Nilai transaksi/)
    // Klik lagi → terbuka kembali.
    fireEvent.click(header)
    expect(screen.getByText("Nilai transaksi")).toBeTruthy()
  })

  it("defaultOpen=false: isi tersembunyi, total tetap terlihat", () => {
    renderWithTheme(
      <OrderPaymentBreakdown {...feeProps} role="BUYER" defaultOpen={false} />,
    )
    expect(
      screen.getByRole("button", { name: /rincian pembayaran, total rp255\.000/i }),
    ).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/Nilai transaksi/)
  })
})

describe("<OrderEscrowCard>", () => {
  it("menyesuaikan copy per status (FE-090: satu kalimat)", () => {
    const { rerender } = renderWithTheme(
      <OrderEscrowCard status="WAITING_PAYMENT" amount={250000} myRole="BUYER" />,
    )
    // Item 33: pra-bayar — dana BELUM ditahan, copy jujur mengatakannya.
    expect(
      screen.getByText(
        /Dana disimpan aman oleh Kahade setelah Anda membayar, sampai Anda mengonfirmasi penerimaan\./,
      ),
    ).toBeTruthy()

    rerender(
      <ThemeProvider>
        <OrderEscrowCard status="DISPUTED" amount={250000} myRole="BUYER" />
      </ThemeProvider>,
    )
    expect(screen.getByText(/dibekukan sementara/i)).toBeTruthy()

    rerender(
      <ThemeProvider>
        <OrderEscrowCard status="COMPLETED" amount={250000} myRole="SELLER" />
      </ThemeProvider>,
    )
    // Judul + badan sama-sama mengandung frasa — keduanya harus tampil.
    expect(screen.getAllByText(/telah diteruskan/i)).toHaveLength(2)
  })

  it("WAITING_CONFIRMATION untuk penjual: dana disimpan SETELAH pembeli membayar", () => {
    renderWithTheme(
      <OrderEscrowCard status="WAITING_CONFIRMATION" amount={250000} myRole="SELLER" />,
    )
    expect(document.body.textContent).toMatch(
      /Dana disimpan aman oleh Kahade setelah pembeli membayar/,
    )
  })
})

describe("mapOrderHistoryToTimeline (item 44)", () => {
  const labels = {
    by: "oleh",
    actors: {
      BUYER: "Pembeli",
      SELLER: "Penjual",
      SYSTEM: "Sistem",
      ADMIN: "Admin Kahade",
    },
    statuses: {},
  }
  const baseEntry: OrderHistoryEntry = {
    id: "h1",
    fromStatus: "IN_DELIVERY",
    toStatus: "COMPLETED",
    actor: "SYSTEM",
    timestamp: "28 Sep 2026, 10:00",
  }
  const toItems = (entries: OrderHistoryEntry[]) =>
    mapOrderHistoryToTimeline(entries, "COMPLETED", labels)

  it("entri sistem tanpa catatan mendapat alasan manusiawi", () => {
    const items = toItems([baseEntry])
    expect(items).toHaveLength(1)
    expect(items[0].description).toMatch(/oleh sistem/i)
    expect(items[0].description).toMatch(/dikonfirmasi otomatis setelah tenggat habis/i)
  })

  it("entri sistem EXPIRED → 'tenggat habis tanpa sengketa'", () => {
    const items = mapOrderHistoryToTimeline(
      [{ ...baseEntry, fromStatus: "IN_DELIVERY", toStatus: "EXPIRED" }],
      "EXPIRED",
      labels,
    )
    expect(items[0].description).toMatch(/tenggat habis tanpa sengketa/i)
  })

  it("catatan asli tidak ditimpa alasan bawaan", () => {
    const items = toItems([{ ...baseEntry, note: "dibayar via QRIS" }])
    expect(items[0].description).toMatch(/dibayar via QRIS/)
    expect(items[0].description).not.toMatch(/tenggat habis/i)
  })

  it("aktor bukan sistem tanpa catatan tetap 'oleh X' saja", () => {
    const items = toItems([{ ...baseEntry, actor: "BUYER" }])
    expect(items[0].description).toMatch(/oleh pembeli/i)
    expect(items[0].description).not.toMatch(/tenggat habis/i)
  })
})

describe("<OrderRatingReminder>", () => {
  it("rating reminder tidak me-render apa pun bila visible=false", () => {
    const { container } = renderWithTheme(
      <OrderRatingReminder visible={false} onRate={noop} onSnooze={noop} />,
    )
    expect(container.textContent).toBe("")
  })

  it("rating reminder tampil dengan jendela 7 hari bila visible", () => {
    const onSnooze = vi.fn()
    renderWithTheme(<OrderRatingReminder visible onRate={noop} onSnooze={onSnooze} />)
    // FE-029: satu caption jendela ulasan, bukan dua kalimat persuasif.
    expect(screen.getByText(/Maksimal 7 hari setelah transaksi selesai\./)).toBeTruthy()
    expect(screen.getByRole("button", { name: "Beri ulasan" })).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: /ingatkan nanti/i }))
    expect(onSnooze).toHaveBeenCalledTimes(1)
  })
})
