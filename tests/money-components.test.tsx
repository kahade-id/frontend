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
import { OtpInput } from "@/components/ui/otp-input"
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

/**
 * A-03 (audit 2026-09-22) — regresi nyata yang terbukti runtime: `<OtpInput>`
 * TIDAK mengosongkan input tersembunyinya saat server menolak kode. Karena
 * `maxLength={length}` sudah tercapai, setiap ketukan digit berikutnya
 * diabaikan — pengguna harus menghapus 6 digit manual sebelum bisa mencoba
 * kode baru. Terjadi di sheet OTP penarikan (app/withdraw.tsx) dan aktivasi
 * 2FA (app/two-factor.tsx). Test ini mengunci perilaku yang benar (sama
 * dengan `<PinInput>` yang sudah punya test serupa di atas).
 */
describe("<OtpInput> menolak kode → bisa langsung diketik ulang (A-03)", () => {
  const typeCode = (code: string) => {
    const input = document.querySelector("input") as HTMLInputElement
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set
    setter?.call(input, code)
    fireEvent.input(input)
    return input
  }
  const currentValue = () => (document.querySelector("input") as HTMLInputElement).value

  it("kode pertama terkirim, input dikosongkan saat error, kode kedua terkirim", async () => {
    const onComplete = vi.fn()
    const onChange = vi.fn()
    const { rerender } = renderInTheme(
      <OtpInput length={6} onComplete={onComplete} onChange={onChange} />,
    )
    typeCode("111111")
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith("111111"))

    // Server menolak → pesan error muncul. Nilai input HARUS kosong lagi.
    rerender(wrapTheme(<OtpInput length={6} onComplete={onComplete} onChange={onChange} errorText="Kode OTP salah." />))
    await waitFor(() => expect(currentValue()).toBe(""))

    typeCode("222222")
    await waitFor(() => expect(onComplete).toHaveBeenLastCalledWith("222222"))
    expect(onComplete).toHaveBeenCalledTimes(2)
  })

  it("pesan error yang SAMA diulang pun tetap mengosongkan kode yang ditolak", async () => {
    const onComplete = vi.fn()
    const { rerender } = renderInTheme(<OtpInput length={6} onComplete={onComplete} />)
    typeCode("123456")
    await waitFor(() => expect(onComplete).toHaveBeenCalledWith("123456"))
    rerender(wrapTheme(<OtpInput length={6} onComplete={onComplete} errorText="Kode OTP salah." />))
    await waitFor(() => expect(currentValue()).toBe(""))

    // Versi lama gagal di sini: string error identik → tidak ada transisi state,
    // sehingga kode tetap penuh dan ketikan berikutnya diabaikan input native.
    typeCode("654321")
    await waitFor(() => expect(onComplete).toHaveBeenLastCalledWith("654321"))
  })
})

/**
 * A-06/H-02 (audit 2026-09-22): batas 12 digit dulu hanya ditegakkan tombol
 * digit tunggal — tombol "00" hanya memeriksa `max`, sehingga pada layar tanpa
 * `max` (top-up) satu tekanan bisa melewati batas keras dan mengirim angka di
 * luar presisi integer aman. Sekarang ketiga jalur memakai satu commit.
 */
describe("<AmountKeypad> batas panjang & presisi (A-06/H-02)", () => {
  it("'00' ditolak saat sudah 12 digit (batas keras, bukan dipotong)", () => {
    const onChange = vi.fn()
    renderInTheme(<AmountKeypad value={999_999_999_999} onChange={onChange} actionKey="00" />)
    expect(screen.getByText("999.999.999.999")).toBeTruthy()
    fireEvent.click(screen.getByText("00"))
    expect(onChange).not.toHaveBeenCalled()
  })

  it("'00' pada 11 digit: hanya SATU nol yang masuk, dan tidak pernah >12 digit", () => {
    const onChange = vi.fn()
    renderInTheme(<AmountKeypad value={12_345_678_901} onChange={onChange} actionKey="00" />)
    fireEvent.click(screen.getByText("00"))
    // 1234567890100 punya 13 digit → ditolak; fallback satu nol (perilaku lama
    // yang dipertahankan) menghasilkan 123456789010 yang MASIH 12 digit.
    expect(onChange).toHaveBeenCalledTimes(1)
    const emitted = onChange.mock.calls[0][0] as number
    expect(String(emitted)).toHaveLength(12)
    expect(emitted).toBe(123_456_789_010)
  })

  it("'00' tetap bekerja normal di bawah batas (1200)", () => {
    const onChange = vi.fn()
    renderInTheme(<AmountKeypad value={12} onChange={onChange} actionKey="00" />)
    fireEvent.click(screen.getByText("00"))
    expect(onChange).toHaveBeenLastCalledWith(1200)
  })

  it("baris nominal jadi satu elemen berlabel (F-04/A-18)", () => {
    const { rerender } = renderInTheme(<AmountKeypad value={0} onChange={() => {}} />)
    expect(screen.getByLabelText("Nominal belum diisi")).toBeTruthy()
    rerender(wrapTheme(<AmountKeypad value={1_500_000} onChange={() => {}} />))
    expect(screen.getByLabelText("Nominal Rp1.500.000")).toBeTruthy()
  })
})
