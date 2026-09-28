/**
 * FE-IMP-4 item 21 — test riwayat pindaian (memory fallback di vitest).
 */
import { describe, expect, it } from "vitest"

import {
  addScanHistory,
  clearScanHistory,
  getScanHistory,
  removeScanHistory,
} from "@/lib/scan-history"

const entry = (raw: string) => ({
  raw,
  type: "profile" as const,
  label: "Profil Pengguna",
  detail: `@${raw}`,
})

describe("scan-history", () => {
  it("menambah item terbaru di depan dan tidak menduplikasi pindaian beruntun", async () => {
    await clearScanHistory()
    await addScanHistory(entry("budi"))
    await addScanHistory(entry("budi"))
    const items = await addScanHistory(entry("ani"))
    expect(items.map((i) => i.raw)).toEqual(["ani", "budi"])
  })

  it("menghapus satu item dan seluruh riwayat", async () => {
    await clearScanHistory()
    const items = await addScanHistory(entry("budi"))
    await removeScanHistory(items[0]!.id)
    expect(await getScanHistory()).toEqual([])
    await addScanHistory(entry("budi"))
    await clearScanHistory()
    expect(await getScanHistory()).toEqual([])
  })
})
