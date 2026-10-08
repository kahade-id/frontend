/**
 * Audit chat I23 — layar kosong saat membuka ruang: SETIAP kombinasi
 * (hasRoomId, loading, error, roomGone, rowCount) harus memetakan ke tepat satu
 * keadaan bertampilan jelas. Tidak ada cabang "tidak ada".
 */
import { describe, expect, it } from "vitest"

import {
  THREAD_LOADING_TIMEOUT_MS,
  resolveThreadState,
  type ThreadState,
  type ThreadStateInput,
} from "@/lib/chat-thread-state"

const base: ThreadStateInput = {
  hasRoomId: true,
  loading: false,
  error: null,
  roomGone: false,
  rowCount: 0,
}

describe("resolveThreadState — keadaan yang dilaporkan pengguna", () => {
  it("baru dibuka: shimmer (bukan layar kosong)", () => {
    expect(resolveThreadState({ ...base, loading: true })).toBe("loading")
  })

  it("selesai memuat dengan pesan → tampil", () => {
    expect(resolveThreadState({ ...base, rowCount: 5 })).toBe("ready")
  })

  it("selesai memuat tanpa pesan → ruang kosong BERPENJELASAN (bukan kosong tanpa makna)", () => {
    expect(resolveThreadState(base)).toBe("empty")
  })

  it("gagal memuat → galat + coba lagi", () => {
    expect(resolveThreadState({ ...base, error: "Gagal" })).toBe("error")
  })

  it("rute tanpa roomId → dijelaskan, tidak shimmer selamanya", () => {
    // Bug lama: fetchMessages return diam-diam saat !roomId sehingga loading=true menetap.
    expect(resolveThreadState({ ...base, hasRoomId: false, loading: true })).toBe("invalid")
    expect(resolveThreadState({ ...base, hasRoomId: false })).toBe("invalid")
  })

  it("ruang dihapus (404) → keadaan sendiri, bukan galat yang bisa dicoba ulang", () => {
    expect(resolveThreadState({ ...base, roomGone: true })).toBe("gone")
    expect(resolveThreadState({ ...base, roomGone: true, loading: true })).toBe("gone")
  })
})

describe("resolveThreadState — prioritas", () => {
  it("pesan yang sudah ada MENANG atas shimmer/galat (jangan menutupi percakapan)", () => {
    expect(resolveThreadState({ ...base, rowCount: 3, loading: true })).toBe("ready")
    expect(resolveThreadState({ ...base, rowCount: 3, error: "x" })).toBe("ready")
    expect(resolveThreadState({ ...base, rowCount: 3, roomGone: true })).toBe("ready")
  })

  it("muat-ulang setelah galat menampilkan shimmer (error dibersihkan saat mulai)", () => {
    expect(resolveThreadState({ ...base, error: "x", loading: true })).toBe("loading")
  })
})

describe("resolveThreadState — total", () => {
  it("64 kombinasi boolean + jumlah baris: selalu salah satu dari 7 keadaan", () => {
    const valid = new Set<ThreadState>(["invalid", "loading", "error", "gone", "empty", "ready"])
    let combos = 0
    for (const hasRoomId of [true, false])
      for (const loading of [true, false])
        for (const error of [null, "gagal"])
          for (const roomGone of [true, false])
            for (const timedOut of [true, false])
              for (const rowCount of [0, 7]) {
                combos += 1
                expect(
                  valid.has(resolveThreadState({ hasRoomId, loading, error, roomGone, timedOut, rowCount })),
                ).toBe(true)
              }
    expect(combos).toBe(64)
  })

  it("batas tunggu muat awal = 10 dtk (permintaan produk Bug 2)", () => {
    expect(THREAD_LOADING_TIMEOUT_MS).toBe(10_000)
  })
})

describe("resolveThreadState — timeout muat awal (Bug 2, 2026-10-08)", () => {
  it("memuat melewati 10 dtk tanpa data → galat (bukan shimmer selamanya)", () => {
    expect(resolveThreadState({ ...base, loading: true, timedOut: true })).toBe("error")
  })

  it("sebelum timeout tetap shimmer (timeout belum menyala)", () => {
    expect(resolveThreadState({ ...base, loading: true, timedOut: false })).toBe("loading")
  })

  it("respons terlambat yang membawa pesan MENANG atas timeout", () => {
    expect(resolveThreadState({ ...base, loading: true, timedOut: true, rowCount: 3 })).toBe("ready")
  })

  it("ruang hilang (404) tetap keadaan sendiri, bukan galat timeout", () => {
    expect(resolveThreadState({ ...base, roomGone: true, timedOut: true })).toBe("gone")
  })
})
