/**
 * Test murni — diagnostik laporan bug (F10).
 */
import { describe, expect, it } from "vitest"

import {
  collectDiagnosticItems,
  diagnosticsBlockHeader,
  renderDiagnosticsBlock,
} from "@/lib/support-diagnostics"

describe("collectDiagnosticItems", () => {
  it("mengembalikan item wajib + opsional", () => {
    const items = collectDiagnosticItems()
    expect(items.length).toBeGreaterThanOrEqual(4)
    const required = items.filter((i) => !i.removable)
    const optional = items.filter((i) => i.removable)
    expect(required.length).toBeGreaterThan(0)
    expect(optional.length).toBeGreaterThan(0)
    // Semua punya label & value.
    for (const i of items) {
      expect(i.label.length).toBeGreaterThan(0)
      expect(i.value.length).toBeGreaterThan(0)
    }
  })

  it("versi aplikasi & OS tidak bisa dihapus (wajib untuk diagnosis)", () => {
    const items = collectDiagnosticItems()
    const app = items.find((i) => i.id === "app-version")
    const os = items.find((i) => i.id === "os")
    expect(app?.removable).toBe(false)
    expect(os?.removable).toBe(false)
  })
})

describe("renderDiagnosticsBlock", () => {
  it("me-render blok berdelimitasi dengan semua item", () => {
    const items = collectDiagnosticItems()
    const block = renderDiagnosticsBlock(items)
    expect(block).toContain(diagnosticsBlockHeader())
    for (const i of items) {
      expect(block).toContain(i.label)
      expect(block).toContain(i.value)
    }
  })

  it("item yang dihapus pengguna tidak ikut ter-render", () => {
    const items = collectDiagnosticItems().filter((i) => i.id !== "device-model")
    const block = renderDiagnosticsBlock(items)
    expect(block).not.toContain("Model perangkat")
  })
})
