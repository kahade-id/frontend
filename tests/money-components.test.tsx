/**
 * H-04 (audit 2026-09-20): config kedua kini dipakai SEMUA test komponen,
 * dimulai dari komponen uang seperti saran audit — Amount, AmountKeypad,
 * PinInput, TopupStatusCard. Yang dikunci adalah kontrak yang kelihatan
 * pengguna: format nominal, clamp min/max saat mengetik, penyelesaian PIN
 * 6 digit, dan kartu status top-up (label status + VA terkelompok).
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ThemeProvider } from "@/components/theme-provider"
import { Amount } from "@/components/ui/amount"
import { AmountKeypad } from "@/components/ui/amount-keypad"
import { PinInput } from "@/components/ui/pin-input"
import { TopupStatusCard } from "@/components/ui/topup-status-card"

/**
 * Icon/Spinner membaca tema lewat context — semua render dibungkus
 * ThemeProvider (sinkron; children langsung dirender).
 */
function wrapTheme(ui: ReactElement) {
  return <ThemeProvider>{ui}</ThemeProvider>
}

function renderInTheme(ui: ReactElement) {
  return render(wrapTheme(ui))
}

// Vitest tidak menyalakan `globals`, jadi auto-cleanup RTL tidak aktif —
// tanpa ini, DOM test sebelumnya ikut ter-query.
afterEach(cleanup)

describe("<Amount>", () => {
  it("merender nominal format rupiah (tanpa animasi count-up)", () => {
    renderInTheme(<Amount value={1_500_000} animated={false} />)
    expect(screen.getByText("Rp1.500.000")).toBeTruthy()
  })

  it("hidden → bullet + label aksesibilitas, bukan nominal", () => {
    renderInTheme(<Amount value={1_500_000} animated={false} hidden />)
    expect(screen.getByText("Rp••••••••")).toBeTruthy()
    expect(
      screen.getByLabelText("Nominal disembunyikan, ketuk ikon mata untuk menampilkan"),
    ).toBeTruthy()
    expect(screen.queryByText("Rp1.500.000")).toBeNull()
  })

  it("sign & compact mengikuti prop (mutasi saldo vs label chart)", () => {
    renderInTheme(<Amount value={50_000} animated={false} sign="always" />)
    expect(screen.getByText("+Rp50.000")).toBeTruthy()
    renderInTheme(<Amount value={-50_000} animated={false} sign="never" />)
    expect(screen.getByText("-Rp50.000")).toBeTruthy()
    renderInTheme(<Amount value={1_500_000} animated={false} compact />)
    expect(screen.getByText("Rp1,5 jt")).toBeTruthy()
  })
})

describe("<AmountKeypad>", () => {
  it("ketikan digit memanggil onChange dengan nilai terkumpul", () => {
    const onChange = vi.fn()
    const { rerender } = renderInTheme(<AmountKeypad value={0} onChange={onChange} />)
    fireEvent.click(screen.getByText("5"))
    expect(onChange).toHaveBeenLastCalledWith(5)

    rerender(wrapTheme(<AmountKeypad value={5} onChange={onChange} />))
    fireEvent.click(screen.getByText("0"))
    expect(onChange).toHaveBeenLastCalledWith(50)
  })

  it("max menolak ketikan yang melewatinya (uang tidak boleh over-limit diam-diam)", () => {
    const onChange = vi.fn()
    renderInTheme(<AmountKeypad value={35} onChange={onChange} max={40} />)
    fireEvent.click(screen.getByText("9")) // 359 > 40 → ditolak
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText("0")) // 350 > 40 → ditolak juga
    expect(onChange).not.toHaveBeenCalled()
  })

  it("nominal tampil terkelompok; chip preset mengirim nilai penuh", () => {
    const onChange = vi.fn()
    renderInTheme(<AmountKeypad value={100_000} onChange={onChange} presets={[100_000]} />)
    expect(screen.getByText("100.000")).toBeTruthy()
    fireEvent.click(screen.getByText("Rp100 rb"))
    expect(onChange).toHaveBeenLastCalledWith(100_000)
  })
})

describe("<PinInput>", () => {
  it("6 digit → onComplete dengan PIN lengkap", async () => {
    const onComplete = vi.fn()
    renderInTheme(<PinInput mode="enter" onComplete={onComplete} />)
    for (const d of ["1", "2", "3", "4", "5", "6"]) fireEvent.click(screen.getByText(d))
    // finish sengaja ditunda ~1 frame agar dot terakhir terlihat terisi
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith("123456"), { timeout: 2000 })
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it("digit ke-7 diabaikan (panjang tetap 6)", async () => {
    const onComplete = vi.fn()
    renderInTheme(<PinInput mode="enter" length={6} onComplete={onComplete} />)
    for (const d of ["1", "2", "3", "4", "5", "6", "7"]) fireEvent.click(screen.getByText(d))
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith("123456"), { timeout: 2000 })
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it("errorText tampil dan mengosongkan input → ketik ulang mengirim PIN baru", async () => {
    const onComplete = vi.fn()
    const { rerender } = renderInTheme(<PinInput mode="enter" onComplete={onComplete} />)
    for (const d of ["1", "1", "1", "1", "1", "1"]) fireEvent.click(screen.getByText(d))
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith("111111"), { timeout: 2000 })

    rerender(wrapTheme(<PinInput mode="enter" onComplete={onComplete} errorText="PIN salah" />))
    expect(screen.getByText("PIN salah")).toBeTruthy()

    for (const d of ["2", "2", "2", "2", "2", "2"]) fireEvent.click(screen.getByText(d))
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith("222222"), { timeout: 2000 })
  })
})

describe("<TopupStatusCard>", () => {
  it("PENDING + VA: label status, nominal, dan nomor VA terkelompok", () => {
    renderInTheme(
      <TopupStatusCard
        status="PENDING"
        amount={150_000}
        method="VIRTUAL_ACCOUNT_BCA"
        methodLabel="BCA Virtual Account"
        paymentCode="1234567890"
      />,
    )
    expect(screen.getByText("Menunggu pembayaran")).toBeTruthy()
    expect(screen.getByText("BCA Virtual Account")).toBeTruthy()
    expect(screen.getByText("Rp150.000")).toBeTruthy()
    expect(screen.getByText("Nomor Virtual Account")).toBeTruthy()
    expect(screen.getByText("1234 5678 90")).toBeTruthy()
  })

  it("SUCCESS menampilkan pesan diterima + saldo, tanpa blok VA", () => {
    renderInTheme(
      <TopupStatusCard
        status="SUCCESS"
        amount={150_000}
        method="VIRTUAL_ACCOUNT_BCA"
        methodLabel="BCA Virtual Account"
        paymentCode="1234567890"
      />,
    )
    expect(screen.getByText("Pembayaran diterima")).toBeTruthy()
    expect(screen.queryByText("Nomor Virtual Account")).toBeNull()
  })

  it("method null/tak dikenal tidak merobohkan kartu (TypeError → fallback redirect)", () => {
    renderInTheme(
      <TopupStatusCard
        status="PENDING"
        amount={50_000}
        // backend pernah mengirim null — kartunya harus tetap render
        method={null as unknown as string}
        methodLabel="Metode"
      />,
    )
    expect(screen.getByText("Menunggu pembayaran")).toBeTruthy()
    expect(screen.getByText("Rp50.000")).toBeTruthy()
  })
})
