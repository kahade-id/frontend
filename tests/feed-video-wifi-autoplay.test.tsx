/**
 * PERF-FIX (NP-002): video autoplay HANYA saat WiFi; loop default MATI.
 *
 * Semantik (keputusan user): WiFi-only, fail-closed.
 * - isAutoplayAllowedByConnection: true HANYA untuk "wifi" (case-insensitive);
 *   seluler, ethernet, vpn, unknown, none, null/undefined → false.
 * - shouldGateVideoAutoplay: gerbang murni — autoplay diblokir kecuali
 *   wifiAllowed ATAU userInitiatedPlay ATAU userPlayOverride.
 * - Hook useWifiAutoplayAllowed diuji lewat `lib/connectivity` dengan stub
 *   NetInfo (`tests/stubs/netinfo`): `__setNetInfoState` + `initConnectivity`
 *   per skenario, modul di-reset agar state tidak bocor antar test.
 */
import { renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { isAutoplayAllowedByConnection, shouldGateVideoAutoplay } from "@/components/ui/feed-video"

/** Muat ulang connectivity + feed-video dengan tipe koneksi dari stub NetInfo. */
async function renderWifiHookWithConnection(type: string | null) {
  vi.resetModules()
  const netinfo = await import("@react-native-community/netinfo")
  ;(netinfo as unknown as { __setNetInfoState: (s: object) => void }).__setNetInfoState({
    type: type ?? "unknown",
    isConnected: type === "none" ? false : true,
    isInternetReachable: true,
  })
  const connectivity = await import("@/lib/connectivity")
  connectivity.initConnectivity()
  // initConnectivity mengisi snapshot lewat NetInfo.fetch() (async).
  await waitFor(() => expect(connectivity.getConnectionType()).toBe(type ?? "unknown"))
  const feedVideo = await import("@/components/ui/feed-video")
  return renderHook(() => feedVideo.useWifiAutoplayAllowed())
}

/** Hook tanpa initConnectivity — snapshot null (fail-closed). */
async function renderWifiHookUninitialized() {
  vi.resetModules()
  const feedVideo = await import("@/components/ui/feed-video")
  return renderHook(() => feedVideo.useWifiAutoplayAllowed())
}

describe("isAutoplayAllowedByConnection (NP-002) — WiFi-only, fail-closed", () => {
  it("mengizinkan autoplay HANYA saat WiFi", () => {
    expect(isAutoplayAllowedByConnection("wifi")).toBe(true)
    expect(isAutoplayAllowedByConnection("WIFI")).toBe(true)
  })

  it("memblokir autoplay di seluler / wimax / ethernet / vpn / unknown / none / other", () => {
    for (const t of ["cellular", "wimax", "ethernet", "vpn", "unknown", "none", "other", "bluetooth"]) {
      expect(isAutoplayAllowedByConnection(t)).toBe(false)
    }
  })

  it("fail-closed bila tipe koneksi tidak diketahui", () => {
    expect(isAutoplayAllowedByConnection(null)).toBe(false)
    expect(isAutoplayAllowedByConnection(undefined)).toBe(false)
  })
})

describe("shouldGateVideoAutoplay (NP-002)", () => {
  const base = { shouldPlay: true, wifiAllowed: false, userInitiatedPlay: false, userPlayOverride: false }

  it("membuka gerbang (tidak gate) saat WiFi", () => {
    expect(shouldGateVideoAutoplay({ ...base, wifiAllowed: true })).toBe(false)
  })

  it("mengunci gerbang saat seluler tanpa niat eksplisit", () => {
    expect(shouldGateVideoAutoplay(base)).toBe(true)
  })

  it("melewati gerbang bila userInitiatedPlay (ketuk eksplisit / viewer dibuka)", () => {
    expect(shouldGateVideoAutoplay({ ...base, userInitiatedPlay: true })).toBe(false)
  })

  it("melewati gerbang bila user mengetuk tombol putar (override sesi)", () => {
    expect(shouldGateVideoAutoplay({ ...base, userPlayOverride: true })).toBe(false)
  })

  it("tidak pernah gate bila shouldPlay=false", () => {
    expect(shouldGateVideoAutoplay({ ...base, shouldPlay: false })).toBe(false)
    expect(shouldGateVideoAutoplay({ ...base, shouldPlay: false, wifiAllowed: true })).toBe(false)
  })
})

describe("useWifiAutoplayAllowed (NP-002)", () => {
  it("true saat WiFi", async () => {
    const { result } = await renderWifiHookWithConnection("wifi")
    expect(result.current).toBe(true)
  })

  it("false saat seluler", async () => {
    const { result } = await renderWifiHookWithConnection("cellular")
    expect(result.current).toBe(false)
  })

  it("false saat ethernet / vpn / unknown / none — WiFi-only", async () => {
    for (const t of ["ethernet", "vpn", "unknown", "none"]) {
      const { result } = await renderWifiHookWithConnection(t)
      expect(result.current).toBe(false)
    }
  })

  it("false bila connectivity belum di-init (snapshot null) — fail-closed", async () => {
    const { result } = await renderWifiHookUninitialized()
    expect(result.current).toBe(false)
  })
})
