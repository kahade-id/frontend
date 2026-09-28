/**
 * ST-008 (PERF-FIX 2026-09-29): verifikasi slim import inti QR.
 *
 * `components/ui/qr-code-display.tsx` mengimpor `create` langsung dari
 * `qrcode/lib/core/qrcode` (bukan entry utama `qrcode`) agar renderer
 * canvas (butuh DOM — mati di native) dan svg-tag (tidak dipakai) keluar
 * dari graf require. Test ini mengunci bahwa impor inti tersebut
 * BERPERILAKU IDENTIK dengan `QRCode.create` dari entry utama:
 * versi, ukuran matriks, dan seluruh bit modul harus sama persis untuk
 * payload dan level koreksi error yang sama.
 */
import { describe, expect, it } from "vitest"

import QRCode from "qrcode"
import { create as createQrCore } from "qrcode/lib/core/qrcode"

describe("st-008 qrcode core slim import", () => {
  it("create() inti identik dengan QRCode.create() entry utama", () => {
    const payload = "https://kahade.id/order/abc123"
    const core = createQrCore(payload, { errorCorrectionLevel: "M" })
    const full = QRCode.create(payload, { errorCorrectionLevel: "M" })

    expect(core.version).toBe(full.version)
    expect(core.modules.size).toBe(full.modules.size)
    expect(Array.from(core.modules.data)).toEqual(
      Array.from(full.modules.data),
    )
  })

  it("mendukung semua level koreksi error", () => {
    for (const ec of ["L", "M", "Q", "H"] as const) {
      const qr = createQrCore("kahade", { errorCorrectionLevel: ec })
      expect(qr.modules.size).toBeGreaterThan(0)
      expect(qr.modules.data.length).toBe(
        qr.modules.size * qr.modules.size,
      )
    }
  })

  it("payload kosong tetap melempar seperti entry utama", () => {
    // Kontrak error dipertahankan: pemanggil (<QRCodeDisplay>) mengandalkan
    // try/catch untuk fallback kotak abu.
    expect(() => createQrCore("", { errorCorrectionLevel: "M" })).toThrow()
    expect(() => QRCode.create("", { errorCorrectionLevel: "M" })).toThrow()
  })
})
