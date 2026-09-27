// @vitest-environment jsdom
/**
 * <TransactionStatusSheet> — sheet pilihan status filter tab Transaksi.
 *
 * Dibuka dari ikon funnel di header (permintaan produk 2026-09-27: filter
 * cukup funnel saja, tanpa blok chip). Mengunci:
 *   1. semua opsi dirender saat visible;
 *   2. opsi terpilih bertanda centang;
 *   3. ketuk opsi → onSelect(value) + onRequestClose (langsung diterapkan,
 *      tanpa draf — satu dimensi, seperti perilaku chip sebelumnya).
 *
 * Dijalankan dengan config komponen (repo convention):
 *   npx vitest run --config vitest.components.config.ts tests/transaction-status-sheet.test.tsx
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ReactElement } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { ThemeProvider } from "@/components/theme-provider"
import { PortalHost, PortalProvider } from "@/components/ui/portal"
import {
  TransactionStatusSheet,
  type TransactionStatusOption,
} from "@/components/ui/transaction-status-sheet"

afterEach(cleanup)

const OPTIONS: TransactionStatusOption[] = [
  { label: "Semua status", value: "ALL" },
  { label: "Aktif", value: "ACTIVE" },
  { label: "Menunggu pembayaran", value: "PENDING_PAYMENT" },
]

function renderSheet(ui: ReactElement) {
  return render(
    <ThemeProvider>
      <PortalProvider>
        {ui}
        <PortalHost />
      </PortalProvider>
    </ThemeProvider>,
  )
}

describe("<TransactionStatusSheet>", () => {
  it("merender semua opsi + centang pada nilai terpilih", () => {
    renderSheet(
      <TransactionStatusSheet
        visible
        onRequestClose={() => {}}
        options={OPTIONS}
        value="ACTIVE"
        onSelect={() => {}}
      />,
    )
    expect(screen.getByText("Semua status")).toBeTruthy()
    expect(screen.getByText("Aktif")).toBeTruthy()
    expect(screen.getByText("Menunggu pembayaran")).toBeTruthy()
    // Tepat satu centang — pada opsi terpilih.
    const checks = document.querySelectorAll('[data-icon="Check"]')
    expect(checks).toHaveLength(1)
    const selectedRow = screen.getByText("Aktif").closest("[role]")
    expect(selectedRow?.querySelector('[data-icon="Check"]')).toBeTruthy()
  })

  it("ketuk opsi → onSelect(value) lalu onRequestClose", () => {
    const onSelect = vi.fn()
    const onRequestClose = vi.fn()
    renderSheet(
      <TransactionStatusSheet
        visible
        onRequestClose={onRequestClose}
        options={OPTIONS}
        value="ALL"
        onSelect={onSelect}
      />,
    )
    fireEvent.click(screen.getByText("Menunggu pembayaran"))
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith("PENDING_PAYMENT")
    expect(onRequestClose).toHaveBeenCalledTimes(1)
  })

  it("tidak merender saat tidak visible", () => {
    renderSheet(
      <TransactionStatusSheet
        visible={false}
        onRequestClose={() => {}}
        options={OPTIONS}
        value="ALL"
        onSelect={() => {}}
      />,
    )
    expect(screen.queryByText("Semua status")).toBeNull()
  })
})
