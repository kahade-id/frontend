/**
 * Test untuk section-error-boundary: klasifikasi error konektivitas.
 *
 * Error chunk-load / network harus dikenali sebagai masalah koneksi (agar
 * boundary menampilkan UI offline, bukan layar crash), sementara error kode
 * (TypeError dsb.) tidak boleh disamarkan sebagai offline.
 */
import { describe, expect, it } from "vitest"

import { isConnectivityError } from "@/lib/connectivity-error"

describe("isConnectivityError", () => {
  it("mengenali kegagalan dynamic import (chunk rute web)", () => {
    expect(
      isConnectivityError(
        new Error("Failed to fetch dynamically imported module: https://kahade.id/_expo/static/js/showcase.js"),
      ),
    ).toBe(true)
  })

  it("mengenali ChunkLoadError webpack/metro", () => {
    expect(isConnectivityError(new Error("ChunkLoadError: Loading chunk 42 failed"))).toBe(true)
    expect(isConnectivityError(new Error("Loading CSS chunk 7 failed"))).toBe(true)
  })

  it("mengenali network error generik", () => {
    expect(isConnectivityError(new Error("Network request failed"))).toBe(true)
    expect(isConnectivityError(new TypeError("Failed to fetch"))).toBe(true)
  })

  it("tidak menyamarkan error kode sebagai offline", () => {
    expect(isConnectivityError(new TypeError("Cannot read properties of undefined (reading 'map')"))).toBe(false)
    expect(isConnectivityError(new Error("Invariant violation: view config"))).toBe(false)
    expect(isConnectivityError(new Error("Session expired"))).toBe(false)
  })

  it("aman untuk nilai non-Error", () => {
    expect(isConnectivityError("Network request failed")).toBe(true)
    expect(isConnectivityError(null)).toBe(false)
    expect(isConnectivityError(undefined)).toBe(false)
  })
})
