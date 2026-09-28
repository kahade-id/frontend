/**
 * Redesign detail order 2026-09-27 — mengunci kontrak tampilan komponen baru.
 *
 * Yang diuji (pohon render + teks; API tidak ditembak):
 *  1. <OrderStatusHero>: hierarki STATUS → JUDUL → ID TRANSAKSI → TANGGAL /
 *     WAKTU; label "ID Transaksi", "Tanggal", "Waktu" tampil TERPISAH;
 *     tombol salin memanggil onCopyId.
 *  2. <OrderJourney>: me-render 5 tahap + timestamp dari buildOrderJourney.
 *  3. <OrderProductCard>: judul, chip tipe, dan NILAI TRANSAKSI TEPAT —
 *     tidak mengarang foto/varian/jumlah.
 *  4. <OrderDetailActions>: hanya me-render aksi yang diminta (gerbang milik
 *     pemanggil); tombol Bayar terkunci bila buyerPays null (M-30); countdown
 *     auto-release tampil bila diberikan.
 *  5. <OrderEscrowCard>: menyebut PT Kawal Hak Dengan Aman; copy sesuai status.
 *  6. <OrderHelpCard>: tombol CS memanggil onContactSupport.
 *  7. <OrderRatingReminder>: tidak me-render apa pun bila visible=false.
 *
 * Dijalankan dengan config komponen (repo convention):
 *   npx vitest run --config vitest.components.config.ts tests/order-detail-redesign.test.tsx
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ThemeProvider } from "@/components/theme-provider"
import { OrderDetailActions, OrderRatingReminder } from "@/components/order-detail-actions"
import { OrderEscrowCard } from "@/components/ui/order-escrow-card"
import { OrderHelpCard } from "@/components/ui/order-help-card"
import {
  mapOrderHistoryToTimeline,
  type OrderHistoryEntry,
} from "@/components/ui/order-history-timeline"
import { OrderJourney } from "@/components/ui/order-journey"
import { OrderPartiesCard } from "@/components/ui/order-parties-card"
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

  it("menampilkan label ID Transaksi, Tanggal, dan Waktu secara terpisah", () => {
    renderWithTheme(<OrderStatusHero {...props} />)
    expect(screen.getByText("ID Transaksi")).toBeTruthy()
    expect(screen.getByText("Tanggal")).toBeTruthy()
    expect(screen.getByText("Waktu")).toBeTruthy()
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
    expect(screen.getByText("Perjalanan order")).toBeTruthy()
    expect(screen.getByText("Order dibuat")).toBeTruthy()
    expect(screen.getByText("Dibayar ke escrow")).toBeTruthy()
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

describe("<OrderPartiesCard>", () => {
  it("menampilkan pembeli & penjual dengan penanda Anda sesuai peran", () => {
    renderWithTheme(
      <OrderPartiesCard
        buyer={{ username: "pembeli1", displayName: "Pembeli Satu" } as never}
        seller={{ username: "penjual1", displayName: "Penjual Satu" } as never}
        myRole="BUYER"
        onOpenProfile={noop}
      />,
    )
    expect(screen.getByText("Pembeli")).toBeTruthy()
    expect(screen.getByText("Penjual")).toBeTruthy()
    expect(screen.getByText("Anda")).toBeTruthy()
  })
})

describe("<OrderDetailActions>", () => {
  const baseProps = {
    canPay: false,
    canConfirm: false,
    canShip: false,
    canReviewDelivery: false,
    canRate: false,
    canViewProof: false,
    canReturn: false,
    buyerPays: null as number | null,
    shippingRequired: true,
    canReturnPrimary: false,
    submitting: false,
    status: "WAITING_PAYMENT",
    myRole: "BUYER" as const,
    autoRelease: null,
    shippingCountdown: null,
    onPay: noop,
    onAccept: noop,
    onReject: noop,
    onShipping: noop,
    onDeliveryProof: noop,
    onComplete: noop,
    onRate: noop,
    onReturn: noop,
    onReload: noop,
  }

  it("hanya me-render aksi yang diminta — tidak memutuskan sendiri", () => {
    renderWithTheme(<OrderDetailActions {...baseProps} />)
    const text = document.body.textContent ?? ""
    expect(text).not.toMatch(/bayar/i)
    expect(text).not.toMatch(/terima pesanan/i)
  })

  it("tombol Bayar terkunci (label Bayar —) bila buyerPays null", () => {
    renderWithTheme(<OrderDetailActions {...baseProps} canPay buyerPays={null} />)
    // M-30: selama nominal belum terlihat, label menampilkan "—" — bukan
    // angka yang lebih kecil. Prop `disabled={buyerPays == null}` dikunci di
    // sumber komponen (tidak ada sinyal DOM yang andal di RNW).
    expect(screen.getByRole("button", { name: "Bayar —" })).toBeTruthy()
  })

  it("tombol Bayar menampilkan nominal tepat bila buyerPays ada", () => {
    renderWithTheme(<OrderDetailActions {...baseProps} canPay buyerPays={255000} />)
    expect(screen.getByRole("button", { name: /bayar/i }).textContent).toMatch(/255\.000/)
  })

  it("countdown auto-release tampil bila diberikan", () => {
    renderWithTheme(
      <OrderDetailActions
        {...baseProps}
        autoRelease={{ secondsLeft: 3600, at: "2026-09-28T10:00:00+07:00" }}
      />,
    )
    expect(screen.getByText(/dana akan cair otomatis/i)).toBeTruthy()
  })

  it("aksi penjual: terima/tolak, kirim, unggah bukti", () => {
    const onAccept = vi.fn()
    renderWithTheme(
      <OrderDetailActions {...baseProps} canConfirm canShip onAccept={onAccept} />,
    )
    expect(screen.getByRole("button", { name: /terima pesanan/i })).toBeTruthy()
    expect(screen.getByRole("button", { name: /tolak pesanan/i })).toBeTruthy()
    expect(screen.getByRole("button", { name: /isi resi pengiriman/i })).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: /terima pesanan/i }))
    expect(onAccept).toHaveBeenCalledTimes(1)
  })

  it("item 31: tombol rilis escrow bernama 'Konfirmasi terima'", () => {
    renderWithTheme(<OrderDetailActions {...baseProps} canReviewDelivery />)
    expect(screen.getByRole("button", { name: "Konfirmasi terima" })).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/Tandai selesai/)
  })

  it("item 34: area aksi kosong → hint langkah berikutnya per status × peran", () => {
    const { rerender } = renderWithTheme(
      <OrderDetailActions {...baseProps} status="WAITING_CONFIRMATION" myRole="SELLER" />,
    )
    expect(document.body.textContent).toMatch(/menunggu penjual mengonfirmasi|konfirmasi order ini/i)

    rerender(
      <ThemeProvider>
        <OrderDetailActions {...baseProps} status="WAITING_PAYMENT" myRole="SELLER" />
      </ThemeProvider>,
    )
    expect(document.body.textContent).toMatch(/menunggu pembeli membayar/i)
  })

  it("item 35: countdown memakai label kontekstual Batas kirim / Batas konfirmasi", () => {
    renderWithTheme(
      <OrderDetailActions
        {...baseProps}
        shippingCountdown={{
          kind: "countdown",
          secondsLeft: 3600,
          at: "2026-09-28T10:00:00+07:00",
        }}
      />,
    )
    expect(screen.getByText("Batas kirim")).toBeTruthy()

    renderWithTheme(
      <OrderDetailActions
        {...baseProps}
        shippingCountdown={null}
        autoRelease={{ secondsLeft: 7200, at: "2026-09-29T10:00:00+07:00" }}
        myRole="BUYER"
        status="IN_DELIVERY"
      />,
    )
    expect(screen.getByText("Batas konfirmasi")).toBeTruthy()
    // Item 45: pembeli masih bisa sengketa sampai tenggat.
    expect(document.body.textContent).toMatch(/masih bisa memeriksa barang/i)
  })

  it("item 46: 'Ajukan retur' primer bila canReturnPrimary", () => {
    const onReturn = vi.fn()
    renderWithTheme(
      <OrderDetailActions {...baseProps} canReturnPrimary onReturn={onReturn} />,
    )
    fireEvent.click(screen.getByRole("button", { name: "Ajukan retur" }))
    expect(onReturn).toHaveBeenCalledTimes(1)
  })
})

describe("<OrderEscrowCard>", () => {
  it("menyebut PT Kawal Hak Dengan Aman dan menyesuaikan copy per status", () => {
    const { rerender } = renderWithTheme(
      <OrderEscrowCard status="WAITING_PAYMENT" amount={250000} myRole="BUYER" />,
    )
    expect(document.body.textContent).toMatch(/PT Kawal Hak Dengan Aman/)
    // Item 33: pra-bayar — dana BELUM ditahan, copy jujur mengatakannya.
    expect(screen.getByText(/dana akan ditahan di escrow/i)).toBeTruthy()
    expect(document.body.textContent).toMatch(/Dana akan ditahan setelah Anda membayar/)

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

  it("WAITING_CONFIRMATION untuk penjual: dana ditahan SETELAH pembeli membayar", () => {
    renderWithTheme(
      <OrderEscrowCard status="WAITING_CONFIRMATION" amount={250000} myRole="SELLER" />,
    )
    expect(document.body.textContent).toMatch(/Dana akan ditahan setelah pembeli membayar/)
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

describe("<OrderHelpCard> & <OrderRatingReminder>", () => {  it("tombol Hubungi CS memanggil onContactSupport", () => {
    const onContactSupport = vi.fn()
    renderWithTheme(<OrderHelpCard onContactSupport={onContactSupport} />)
    fireEvent.click(screen.getByRole("button", { name: /hubungi cs/i }))
    expect(onContactSupport).toHaveBeenCalledTimes(1)
  })

  it("rating reminder tidak me-render apa pun bila visible=false", () => {
    const { container } = renderWithTheme(
      <OrderRatingReminder visible={false} onRate={noop} onSnooze={noop} />,
    )
    expect(container.textContent).toBe("")
  })

  it("rating reminder tampil dengan jendela 7 hari bila visible", () => {
    const onSnooze = vi.fn()
    renderWithTheme(<OrderRatingReminder visible onRate={noop} onSnooze={onSnooze} />)
    expect(screen.getByText(/7 hari/i)).toBeTruthy()
    // Item 39: copy formal "Anda" (bukan "ulasanmu").
    expect(document.body.textContent).toMatch(/ulasan Anda/i)
    fireEvent.click(screen.getByRole("button", { name: /ingatkan nanti/i }))
    expect(onSnooze).toHaveBeenCalledTimes(1)
  })
})
