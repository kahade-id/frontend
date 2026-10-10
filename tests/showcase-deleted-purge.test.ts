/**
 * CR-06 (audit etalase 2026-10-10): entri lokal "Baru dihapus" yang sudah
 * tidak ada di server (dipulihkan dari perangkat lain, dihapus permanen,
 * restorable:false) harus dipurge — dulu `mergeDeletedShowcase` hanya
 * menambah, sehingga tombol "Pulihkan" zombie gagal selamanya.
 */
import { describe, expect, it } from "vitest"

import { LOCAL_DELETED_GRACE_MS, mergeDeletedShowcase, purgeStaleLocalDeleted } from "@/lib/showcase-deleted"

const NOW = Date.parse("2026-10-10T10:00:00.000Z")
const daysAgo = (d: number) => new Date(NOW - d * 864e5).toISOString()

const local = [
  { id: "a", title: "Lokal A", deletedAt: daysAgo(2), coverUrl: "https://x/a.jpg" },
  { id: "b", title: "Lokal B (dipulihkan di HP lain)", deletedAt: daysAgo(1) },
  { id: "c", title: "Lokal C (restorable:false)", deletedAt: daysAgo(3) },
]

describe("purgeStaleLocalDeleted", () => {
  it("daftar server lengkap: entri lokal yang tidak ada / tidak restorable di server dibuang", () => {
    const kept = purgeStaleLocalDeleted(
      local,
      [
        { id: "a", restorable: true, daysRemaining: 28 },
        { id: "c", restorable: false },
      ],
      { complete: true, now: NOW },
    )
    expect(kept.map((it) => it.id)).toEqual(["a"])
  })

  it("halaman server terpotong (tidak lengkap) → tidak ada yang dipurge", () => {
    const kept = purgeStaleLocalDeleted(local, [{ id: "a", restorable: true }], { complete: false, now: NOW })
    expect(kept).toHaveLength(3)
  })

  it("entri lokal yang baru saja ditulis dipertahankan walau belum muncul di server (grace)", () => {
    const fresh = { id: "z", title: "Baru dihapus", deletedAt: new Date(NOW - LOCAL_DELETED_GRACE_MS / 2).toISOString() }
    const kept = purgeStaleLocalDeleted([...local, fresh], [], { complete: true, now: NOW })
    expect(kept.map((it) => it.id)).toEqual(["z"])
  })

  it("hasil purge + merge: tombol Pulihkan zombie tidak lagi tampil", () => {
    const server = [{ id: "a", title: "Server A", restorable: true, daysRemaining: 28 }]
    const merged = mergeDeletedShowcase(purgeStaleLocalDeleted(local, server, { complete: true, now: NOW }), server)
    expect(merged.map((e) => e.id)).toEqual(["a"])
    expect(merged[0]).toMatchObject({ title: "Server A", daysRemaining: 28, coverUrl: "https://x/a.jpg" })
  })
})
