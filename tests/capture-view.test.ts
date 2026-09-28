/**
 * lib/capture-view.ts — lazy import react-native-view-shot.
 *
 * Kontrak:
 *  - melempar "capture-ref-missing" bila ref kosong (tidak memanggil modul);
 *  - melempar "capture-empty" bila modul mengembalikan string kosong;
 *  - meneruskan opsi (default format png, quality 1) ke captureRef;
 *  - modul hanya di-import saat dipanggil (dynamic import).
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const captureRef = vi.fn()

vi.mock("react-native-view-shot", () => ({
  captureRef: (...args: unknown[]) => captureRef(...args),
}))

import { captureView } from "@/lib/capture-view"

beforeEach(() => {
  vi.clearAllMocks()
})

describe("captureView", () => {
  it("melempar capture-ref-missing bila ref null — tanpa import modul", async () => {
    await expect(captureView(null)).rejects.toThrow("capture-ref-missing")
    expect(captureRef).not.toHaveBeenCalled()
  })

  it("melempar capture-ref-missing bila ref.current null", async () => {
    await expect(captureView({ current: null })).rejects.toThrow("capture-ref-missing")
    expect(captureRef).not.toHaveBeenCalled()
  })

  it("mengembalikan uri dan meneruskan opsi default + custom", async () => {
    captureRef.mockResolvedValue("data:image/png;base64,AAA")
    const fakeView = { __fakeView: true }
    const uri = await captureView(fakeView as never, { result: "data-uri" })
    expect(uri).toBe("data:image/png;base64,AAA")
    expect(captureRef).toHaveBeenCalledWith(
      fakeView,
      expect.objectContaining({ format: "png", quality: 1, result: "data-uri" }),
    )
  })

  it("melempar capture-empty bila modul mengembalikan string kosong", async () => {
    captureRef.mockResolvedValue("")
    await expect(captureView({} as never)).rejects.toThrow("capture-empty")
  })

  it("mendukung RefObject ({ current })", async () => {
    captureRef.mockResolvedValue("file:///tmp/x.png")
    const fakeView = { __fakeView: true }
    const uri = await captureView({ current: fakeView } as never)
    expect(uri).toBe("file:///tmp/x.png")
    expect(captureRef).toHaveBeenCalledWith(fakeView, expect.anything())
  })
})
