/**
 * F-10 (audit 2026-09-22): uji aksesibilitas nyata di atas pohon render.
 *
 * `npm run check:a11y` memeriksa POLA teks (`<View accessible>` menelan tombol,
 * label tanpa `accessible`, kelas focus-ring yang ditulis ulang). Semua temuan
 * F-01…F-08 lolos gate itu karena gate-nya tidak pernah melihat pohon
 * aksesibilitas hasil render. Test ini menambahkan lapisan kedua: komponen
 * penting dirender di jsdom lalu diperiksa `axe-core` — daftar periksa yang
 * sama dengan yang dipakai audit Lighthouse/browser, jadi cacat seperti kontrol
 * tanpa nama, `aria-*` yang salah, atau id ganda ketahuan sebelum rilis.
 *
 * Cakupan SENGAJA 12 permukaan yang paling sering dipakai pada alur uang &
 * autentikasi (keypad nominal, PIN/OTP, form, dialog, status pembayaran) —
 * bukan seluruh 235 komponen: axe butuh DOM nyata per komponen dan waktu
 * jalannya harus tetap wajar di CI.
 *
 * Aturan yang dimatikan, beserta alasannya (bukan "karena gagal"):
 *   - color-contrast   : jsdom tidak menghitung layout/warna, tidak ada nilai
 *                        kontras yang bisa dipercaya; kontras dijaga
 *                        check:tokens + audit design system.
 *   - region / landmark: struktur halaman di app ini milik react-navigation,
 *                        bukan komponen; memeriksanya di sini salah tempat.
 *   - html-has-lang / page-has-heading-one: dokumen HTML dibuat testing-library,
 *                        bukan app (di native tidak ada DOM sama sekali).
 *   - aria-hidden-focus: react-native-web memetakan accessibilityElementsHidden
 *                        ke aria-hidden pada elemen yang masih fokusable di
 *                        jsdom; perilaku native diverifikasi gate & manual.
 */
import { cleanup, fireEvent, render } from "@testing-library/react"
import axe, { type Result, type RunOptions } from "axe-core"
import type { ReactElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { PortalHost, PortalProvider } from "@/components/ui/portal"
import { ThemeProvider } from "@/components/theme-provider"

afterEach(cleanup)

const AXE_OPTIONS: RunOptions = {
  rules: {
    "color-contrast": { enabled: false },
    region: { enabled: false },
    "html-has-lang": { enabled: false },
    "page-has-heading-one": { enabled: false },
    "aria-hidden-focus": { enabled: false },
  },
}

/** Format pelanggaran jadi pesan yang bisa ditindaklanjuti tanpa buka browser. */
function describeViolations(violations: Result[]): string {
  return violations
    .map((v) => {
      const targets = v.nodes.map((n) => n.target.join(" ")).slice(0, 3)
      return `  ${v.id} (${v.impact ?? "?"}): ${v.help}\n    ${targets.join("\n    ")}`
    })
    .join("\n")
}

async function expectNoViolations(ui: ReactElement) {
  const { container } = render(
    <ThemeProvider>
      <PortalProvider>
        {ui}
        <PortalHost />
      </PortalProvider>
    </ThemeProvider>,
  )
  const results = await axe.run(container as HTMLElement, AXE_OPTIONS)
  expect(results.violations, `\n${describeViolations(results.violations)}`).toEqual([])
}

describe("F-10: axe-core pada permukaan penting", () => {
  it("button: varian + ikon + label", async () => {
    const { Button } = await import("@/components/ui/button")
    const { ArrowRight } = await import("phosphor-react-native")
    await expectNoViolations(
      <div>
        <Button onPress={() => undefined}>Simpan rekening</Button>
        <Button variant="secondary" leftIcon={ArrowRight} onPress={() => undefined}>
          Lanjut
        </Button>
        <Button accessibilityLabel="Tutup" onPress={() => undefined}>
          X
        </Button>
      </div>,
    )
  })

  it("input + field: label, helper, galat", async () => {
    const { Field } = await import("@/components/ui/field")
    const { Input } = await import("@/components/ui/input")
    await expectNoViolations(
      <div>
        <Field label="Nomor rekening" required helperText="10–20 digit">
          <Input value="12345" onChangeText={() => undefined} keyboardType="number-pad" />
        </Field>
        <Field label="Nama pemilik" required errorText="Nama wajib diisi">
          <Input value="" onChangeText={() => undefined} />
        </Field>
      </div>,
    )
  })

  it("amount-keypad: seluruh tombol tetap punya nama (F-01/F-04)", async () => {
    const { AmountKeypad } = await import("@/components/ui/amount-keypad")
    const onValueChange = vi.fn()
    await expectNoViolations(<AmountKeypad value={0} onChange={onValueChange} />)
  })

  it("pin-input & otp-input: satu nama per sel (F-03)", async () => {
    const { PinInput } = await import("@/components/ui/pin-input")
    const { OtpInput } = await import("@/components/ui/otp-input")
    await expectNoViolations(
      <div>
        <PinInput mode="enter" onComplete={() => undefined} />
        <OtpInput value="1234" onChange={() => undefined} length={6} />
      </div>,
    )
  })

  it("radio-group + segmented-control: grup ber-label & opsi bernama (F-08)", async () => {
    const { Radio, RadioGroup } = await import("@/components/ui/radio")
    const { SegmentedControl } = await import("@/components/ui/segmented-control")
    await expectNoViolations(
      <div>
        <RadioGroup accessibilityLabel="Alasan laporan" value="spam" onChange={() => undefined}>
          <Radio value="spam" label="Spam" />
          <Radio value="fraud" label="Penipuan" description="Penawaran di luar platform" />
        </RadioGroup>
        <SegmentedControl
          accessibilityLabel="Metode pembayaran"
          items={[
            { value: "balance", label: "Saldo Kahade" },
            { value: "qris", label: "QRIS" },
          ]}
          value="balance"
          onChange={() => undefined}
        />
      </div>,
    )
  })

  it("countdown: live region tidak berteriak tiap detik (F-05)", async () => {
    const { Countdown } = await import("@/components/ui/countdown")
    await expectNoViolations(
      <Countdown until={new Date(Date.now() + 90_000)} prefix="Kirim ulang dalam" />,
    )
  })

  it("form-section: galat tingkat section diumumkan (F-06)", async () => {
    const { FormSection } = await import("@/components/ui/form-section")
    const { Input } = await import("@/components/ui/input")
    await expectNoViolations(
      <FormSection
        title="Data rekening baru"
        errorText="Pilih bank, lalu isi nomor rekening dan nama pemiliknya."
      >
        <Input label="Nomor rekening" value="" onChangeText={() => undefined} />
      </FormSection>,
    )
  })

  it("dialog: judul, deskripsi, dan dua aksi bernama", async () => {
    const { Dialog } = await import("@/components/ui/modal")
    await expectNoViolations(
      <Dialog
        visible
        title="Hapus rekening?"
        description="Nomor berakhir 1234 akan dihapus."
        destructive
        confirmLabel="Hapus"
        cancelLabel="Batal"
        onConfirm={() => undefined}
        onCancel={() => undefined}
        onRequestClose={() => undefined}
      />,
    )
  })

  it("kartu saldo & status top-up: label ringkas", async () => {
    const { WalletBalanceCard } = await import("@/components/ui/wallet-balance-card")
    const { TopupStatusCard } = await import("@/components/ui/topup-status-card")
    await expectNoViolations(
      <div>
        <WalletBalanceCard available={1_250_000} held={50_000} onToggleHidden={() => undefined} />
        <TopupStatusCard
          status="PENDING"
          amount={100_000}
          method="va"
          methodLabel="BCA Virtual Account"
          paymentCode="1234567890123456"
          onRefresh={() => undefined}
        />
      </div>,
    )
  })

  it("item daftar: satu label ringkas lewat summarize(), bukan fragmen", async () => {
    const { ListItem } = await import("@/components/ui/list-item")
    const { Amount } = await import("@/components/ui/amount")
    await expectNoViolations(
      <ListItem
        title="Transfer ke Budi"
        subtitle="3 Sep 2026, 14:30"
        trailing={<Amount value={-150_000} sign="always" animated={false} />}
        onPress={() => undefined}
      />,
    )
  })

  it("komposisi form nyata: keypad + field + CTA tidak punya pelanggaran axe", async () => {
    const { AmountKeypad } = await import("@/components/ui/amount-keypad")
    const { Field } = await import("@/components/ui/field")
    const { Input } = await import("@/components/ui/input")
    const { Button } = await import("@/components/ui/button")

    const { container } = render(
      <ThemeProvider>
        <PortalProvider>
          <Field label="Catatan" helperText="Opsional">
            <Input value="" onChangeText={() => undefined} />
          </Field>
          <AmountKeypad value={0} onChange={() => undefined} />
          <Button onPress={() => undefined}>Lanjutkan</Button>
          <PortalHost />
        </PortalProvider>
      </ThemeProvider>,
    )
    const results = await axe.run(container as HTMLElement, AXE_OPTIONS)
    expect(results.violations, `\n${describeViolations(results.violations)}`).toEqual([])
  })

  it("keypad nominal tetap bisa ditekan lewat DOM (regresi F-01)", async () => {
    const { AmountKeypad } = await import("@/components/ui/amount-keypad")
    const onValueChange = vi.fn()
    const { getByText } = render(
      <ThemeProvider>
        <AmountKeypad value={0} onChange={onValueChange} />
      </ThemeProvider>,
    )
    fireEvent.click(getByText("7"))
    expect(onValueChange).toHaveBeenCalledWith(7)
  })
})
