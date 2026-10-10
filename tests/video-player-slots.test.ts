/**
 * FD-01 (audit etalase 2026-10-10): slot player video tidak boleh bocor.
 *
 * Bug lama: pemohon yang unmount sebelum kebagian slot meninggalkan resolver
 * di antrean; `release` berikutnya menaikkan hitungan untuk player yang sudah
 * tidak ada → hitungan macet di batas dengan nol player nyata → tidak ada
 * video yang bisa diputar lagi sampai app di-restart.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  MAX_CONCURRENT_VIDEO_PLAYERS,
  acquireVideoPlayerSlot,
  releaseVideoPlayerSlot,
  resetVideoPlayerSlotsForTests,
  videoPlayerSlotStats,
  waitForVideoPlayerSlot,
} from "@/lib/video-player-slots"

beforeEach(() => {
  resetVideoPlayerSlotsForTests()
})

describe("slot player video", () => {
  it("memberi slot sampai batas, lalu menolak", () => {
    for (let i = 0; i < MAX_CONCURRENT_VIDEO_PLAYERS; i += 1) expect(acquireVideoPlayerSlot()).toBe(true)
    expect(acquireVideoPlayerSlot()).toBe(false)
    expect(videoPlayerSlotStats()).toEqual({ active: MAX_CONCURRENT_VIDEO_PLAYERS, waiting: 0 })
  })

  it("pemohon yang menunggu dapat slot SINKRON saat ada yang melepas; hitungan tetap di batas", () => {
    acquireVideoPlayerSlot()
    acquireVideoPlayerSlot()
    const granted = vi.fn()
    waitForVideoPlayerSlot(granted)
    expect(videoPlayerSlotStats().waiting).toBe(1)

    releaseVideoPlayerSlot()
    expect(granted).toHaveBeenCalledTimes(1)
    expect(videoPlayerSlotStats()).toEqual({ active: MAX_CONCURRENT_VIDEO_PLAYERS, waiting: 0 })
  })

  it("pemohon yang sudah cancel DILEWATI — slot tidak dihitung untuk player yang sudah unmount (bug FD-01)", () => {
    acquireVideoPlayerSlot()
    acquireVideoPlayerSlot()
    const stale = vi.fn()
    const cancel = waitForVideoPlayerSlot(stale)
    cancel() // player viewer ditutup sebelum kebagian slot
    expect(videoPlayerSlotStats().waiting).toBe(0)

    releaseVideoPlayerSlot() // kartu feed di-unmount
    expect(stale).not.toHaveBeenCalled()
    // Versi lama: active tetap 2 di sini (bocor). Sekarang turun ke 1.
    expect(videoPlayerSlotStats().active).toBe(1)
    expect(acquireVideoPlayerSlot()).toBe(true)
  })

  it("dua pemohon basi berturut-turut tidak pernah mematikan semua video", () => {
    acquireVideoPlayerSlot()
    acquireVideoPlayerSlot()
    waitForVideoPlayerSlot(vi.fn())()
    waitForVideoPlayerSlot(vi.fn())()
    releaseVideoPlayerSlot()
    releaseVideoPlayerSlot()
    expect(videoPlayerSlotStats()).toEqual({ active: 0, waiting: 0 })
    expect(acquireVideoPlayerSlot()).toBe(true)
  })

  it("pemohon basi di depan antrean dilewati, pemohon hidup di belakangnya tetap dilayani", () => {
    acquireVideoPlayerSlot()
    acquireVideoPlayerSlot()
    const cancelStale = waitForVideoPlayerSlot(vi.fn())
    const live = vi.fn()
    waitForVideoPlayerSlot(live)
    cancelStale()

    releaseVideoPlayerSlot()
    expect(live).toHaveBeenCalledTimes(1)
    expect(videoPlayerSlotStats()).toEqual({ active: MAX_CONCURRENT_VIDEO_PLAYERS, waiting: 0 })
  })

  it("cancel setelah slot diberikan = no-op; pemegang wajib release sendiri", () => {
    acquireVideoPlayerSlot()
    acquireVideoPlayerSlot()
    const granted = vi.fn()
    const cancel = waitForVideoPlayerSlot(granted)
    releaseVideoPlayerSlot()
    expect(granted).toHaveBeenCalledTimes(1)
    cancel()
    expect(videoPlayerSlotStats().active).toBe(MAX_CONCURRENT_VIDEO_PLAYERS)
    releaseVideoPlayerSlot()
    expect(videoPlayerSlotStats().active).toBe(MAX_CONCURRENT_VIDEO_PLAYERS - 1)
  })

  it("release tanpa pemegang tidak pernah negatif", () => {
    releaseVideoPlayerSlot()
    expect(videoPlayerSlotStats().active).toBe(0)
  })
})
