/**
 * Audit chat C7 — matematika gestur voice note ala WhatsApp:
 * tahan → rekam, geser ATAS → kunci, geser KIRI + lepas → batal.
 */
import { describe, expect, it } from "vitest"

import {
  VOICE_AXIS_DEAD_ZONE_PX,
  VOICE_CANCEL_DISTANCE_PX,
  VOICE_DISCARD_CONFIRM_MS,
  VOICE_HOLD_MS,
  VOICE_LOCK_DISTANCE_PX,
  needsDiscardConfirm,
  resolveVoiceDrag,
  resolveVoiceRelease,
} from "@/lib/voice-note-gesture"

describe("resolveVoiceDrag", () => {
  it("di zona mati tidak ada sumbu dan tidak ada progres", () => {
    const r = resolveVoiceDrag(-(VOICE_AXIS_DEAD_ZONE_PX - 1), -3)
    expect(r).toMatchObject({ axis: "none", lockProgress: 0, cancelProgress: 0, lock: false, cancel: false })
  })

  it("geser ke atas menaikkan progres kunci sampai ambang", () => {
    const half = resolveVoiceDrag(0, -VOICE_LOCK_DISTANCE_PX / 2)
    expect(half.axis).toBe("up")
    expect(half.lockProgress).toBeCloseTo(0.5, 5)
    expect(half.lock).toBe(false)

    const full = resolveVoiceDrag(0, -VOICE_LOCK_DISTANCE_PX, "up")
    expect(full.lock).toBe(true)
    // Progres dijepit di 1 walau jari melewati ambang.
    expect(resolveVoiceDrag(0, -VOICE_LOCK_DISTANCE_PX * 3, "up").lockProgress).toBe(1)
  })

  it("geser ke kiri menaikkan progres batal sampai ambang", () => {
    const part = resolveVoiceDrag(-VOICE_CANCEL_DISTANCE_PX / 4, 0)
    expect(part.axis).toBe("left")
    expect(part.cancelProgress).toBeCloseTo(0.25, 5)
    expect(resolveVoiceDrag(-VOICE_CANCEL_DISTANCE_PX, 0, "left").cancel).toBe(true)
  })

  it("sumbu DIKUNCI sekali: ke atas lalu melenceng ke kiri tidak menaikkan progres batal", () => {
    const first = resolveVoiceDrag(-2, -VOICE_AXIS_DEAD_ZONE_PX - 4)
    expect(first.axis).toBe("up")
    // Jari kemudian bergeser jauh ke kiri sambil tetap naik sedikit.
    const drift = resolveVoiceDrag(-VOICE_CANCEL_DISTANCE_PX * 2, -20, first.axis)
    expect(drift.axis).toBe("up")
    expect(drift.cancelProgress).toBe(0)
    expect(drift.cancel).toBe(false)
  })

  it("arah yang tak bermakna (kanan/bawah) dihitung nol", () => {
    expect(resolveVoiceDrag(80, 80)).toMatchObject({ axis: "none", lockProgress: 0, cancelProgress: 0 })
    // Kembali ke tengah setelah menggeser kiri → progres kembali 0 (rekaman selamat).
    const back = resolveVoiceDrag(0, 0, "left")
    expect(back.cancelProgress).toBe(0)
    expect(back.cancel).toBe(false)
  })

  it("jari yang bergerak diagonal memilih sumbu yang lebih dominan", () => {
    expect(resolveVoiceDrag(-30, -15).axis).toBe("left")
    expect(resolveVoiceDrag(-15, -30).axis).toBe("up")
  })
})

describe("resolveVoiceRelease", () => {
  it("menahan lalu lepas = kirim; melewati ambang batal = batal", () => {
    expect(resolveVoiceRelease("holding", { cancel: false })).toBe("send")
    expect(resolveVoiceRelease("holding", { cancel: true })).toBe("cancel")
  })

  it("jari yang dikembalikan ke tengah menyelamatkan rekaman (keputusan saat lepas)", () => {
    const passed = resolveVoiceDrag(-VOICE_CANCEL_DISTANCE_PX, 0)
    expect(resolveVoiceRelease("holding", passed)).toBe("cancel")
    const returned = resolveVoiceDrag(-5, 0, passed.axis)
    expect(resolveVoiceRelease("holding", returned)).toBe("send")
  })

  it("terkunci: melepas jari TIDAK mengirim dan TIDAK membatalkan", () => {
    expect(resolveVoiceRelease("locked", { cancel: false })).toBe("keep-recording")
    expect(resolveVoiceRelease("locked", { cancel: true })).toBe("keep-recording")
  })

  it("belum menahan (tap cepat) diabaikan", () => {
    expect(resolveVoiceRelease("arming", { cancel: false })).toBe("ignore")
    expect(resolveVoiceRelease("idle", { cancel: false })).toBe("ignore")
  })
})

describe("konstanta & konfirmasi buang", () => {
  it("jeda tahan lebih lama dari tap tetapi tidak membuat pengguna menunggu", () => {
    expect(VOICE_HOLD_MS).toBeGreaterThanOrEqual(150)
    expect(VOICE_HOLD_MS).toBeLessThanOrEqual(400)
  })

  it("kedua ambang jauh melewati zona mati (tidak terpicu oleh getar jari)", () => {
    expect(VOICE_LOCK_DISTANCE_PX).toBeGreaterThan(VOICE_AXIS_DEAD_ZONE_PX * 2)
    expect(VOICE_CANCEL_DISTANCE_PX).toBeGreaterThan(VOICE_AXIS_DEAD_ZONE_PX * 2)
  })

  it("rekaman pendek dibuang tanpa konfirmasi; yang berarti meminta konfirmasi", () => {
    expect(needsDiscardConfirm(VOICE_DISCARD_CONFIRM_MS - 1)).toBe(false)
    expect(needsDiscardConfirm(VOICE_DISCARD_CONFIRM_MS)).toBe(true)
  })
})
