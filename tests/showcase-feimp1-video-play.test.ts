/**
 * FE-IMP-1 item 59 (strict 2026-09-28): keputusan putar/jeda video galeri.
 * Selama mode hemat data aktif, autoplay (sinyal scroll-driven) SELALU false
 * — bahkan setelah video dimuat manual. Video hanya diputar dari aksi
 * eksplisit pengguna.
 */
import { describe, expect, it } from "vitest"
import { resolveVideoShouldPlay, toggleDataSaverPlayIntent } from "@/lib/showcase-video-play"

describe("resolveVideoShouldPlay", () => {
  it("gated selalu false — belum ada sinyal apapun yang boleh memutar", () => {
    expect(
      resolveVideoShouldPlay({ gated: true, dataSaver: true, autoplaySignal: true, userPlay: true }),
    ).toBe(false)
    expect(
      resolveVideoShouldPlay({ gated: true, dataSaver: false, autoplaySignal: true, userPlay: false }),
    ).toBe(false)
  })

  it("tanpa hemat data: autoplaySignal menentukan", () => {
    expect(
      resolveVideoShouldPlay({ gated: false, dataSaver: false, autoplaySignal: true, userPlay: false }),
    ).toBe(true)
    expect(
      resolveVideoShouldPlay({ gated: false, dataSaver: false, autoplaySignal: false, userPlay: true }),
    ).toBe(false)
  })

  it("hemat data: autoplaySignal SELALU diabaikan — bahkan setelah load manual", () => {
    // Video sudah dimuat manual (gated=false) dan slide aktif (autoplaySignal
    // true), tetapi hemat data aktif dan pengguna belum mengetuk → diam.
    expect(
      resolveVideoShouldPlay({ gated: false, dataSaver: true, autoplaySignal: true, userPlay: false }),
    ).toBe(false)
  })

  it("hemat data: hanya niat eksplisit pengguna yang memutar", () => {
    expect(
      resolveVideoShouldPlay({ gated: false, dataSaver: true, autoplaySignal: false, userPlay: true }),
    ).toBe(true)
    // Niat eksplisit menang atas sinyal autoplay yang diabaikan.
    expect(
      resolveVideoShouldPlay({ gated: false, dataSaver: true, autoplaySignal: true, userPlay: true }),
    ).toBe(true)
  })
})

describe("toggleDataSaverPlayIntent", () => {
  it("video diam → ketuk memasang latch & membuka pause", () => {
    expect(toggleDataSaverPlayIntent(false)).toEqual({ latch: true, paused: false })
  })

  it("video diputar → ketuk mencabut latch & memasang pause", () => {
    expect(toggleDataSaverPlayIntent(true)).toEqual({ latch: false, paused: true })
  })
})
