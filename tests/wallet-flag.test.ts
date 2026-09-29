/**
 * Test kill-switch dompet internal (Mode Tanpa Wallet Internal, BI-safe).
 *
 * Kontrak yang dikunci:
 * - Default build = MATI (fail closed) bila EXPO_PUBLIC_WALLET_ENABLED tidak
 *   di-set / bukan "true".
 * - Nilai server (bila diketahui) MENANG atas build default.
 * - Normalizer toleran: bentuk tak dikenal → null (bukan tebakan).
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest"

import {
  __resetWalletFlagForTests,
  __setWalletServerStatusForTests,
  getWalletEnabled,
  getWalletServerStatus,
  normalizeWalletStatus,
  subscribeWalletFlag,
  walletEnabledBuildDefault,
} from "@/lib/wallet-flag"

const ENV_KEY = "EXPO_PUBLIC_WALLET_ENABLED"

describe("walletEnabledBuildDefault", () => {
  const original = process.env[ENV_KEY]
  afterEach(() => {
    if (original === undefined) delete process.env[ENV_KEY]
    else process.env[ENV_KEY] = original
  })

  it("mati bila env tidak di-set (fail closed)", () => {
    delete process.env[ENV_KEY]
    expect(walletEnabledBuildDefault()).toBe(false)
  })

  it("mati untuk nilai selain \"true\"", () => {
    for (const value of ["false", "0", "yes", "1", "", "TRUE "]) {
      if (value === "TRUE ") continue // "TRUE " trims to "true" → nyala; diuji di bawah
      process.env[ENV_KEY] = value
      expect(walletEnabledBuildDefault()).toBe(false)
    }
  })

  it("nyala hanya untuk \"true\" (case-insensitive, trim)", () => {
    for (const value of ["true", "TRUE", " True "]) {
      process.env[ENV_KEY] = value
      expect(walletEnabledBuildDefault()).toBe(true)
    }
  })
})

describe("normalizeWalletStatus", () => {
  it("membaca walletEnabled boolean", () => {
    expect(normalizeWalletStatus({ walletEnabled: true })).toBe(true)
    expect(normalizeWalletStatus({ walletEnabled: false })).toBe(false)
  })

  it("membaca alias snake_case / data.* / string", () => {
    expect(normalizeWalletStatus({ wallet_enabled: true })).toBe(true)
    expect(normalizeWalletStatus({ data: { walletEnabled: false } })).toBe(false)
    expect(normalizeWalletStatus({ walletEnabled: "true" })).toBe(true)
    expect(normalizeWalletStatus({ walletEnabled: "false" })).toBe(false)
  })

  it("null untuk bentuk tak dikenal (fail closed, bukan tebakan)", () => {
    expect(normalizeWalletStatus(null)).toBeNull()
    expect(normalizeWalletStatus(undefined)).toBeNull()
    expect(normalizeWalletStatus("true")).toBeNull()
    expect(normalizeWalletStatus({})).toBeNull()
    expect(normalizeWalletStatus({ walletEnabled: 1 })).toBeNull()
    expect(normalizeWalletStatus({ walletEnabled: "yes" })).toBeNull()
  })
})

describe("getWalletEnabled", () => {
  const original = process.env[ENV_KEY]
  beforeEach(() => __resetWalletFlagForTests())
  afterEach(() => {
    __resetWalletFlagForTests()
    if (original === undefined) delete process.env[ENV_KEY]
    else process.env[ENV_KEY] = original
  })

  it("server menang atas build default (server true + env false → true)", () => {
    delete process.env[ENV_KEY]
    __setWalletServerStatusForTests(true)
    expect(getWalletEnabled()).toBe(true)
    expect(getWalletServerStatus()).toBe(true)
  })

  it("server false mematikan walau env true", () => {
    process.env[ENV_KEY] = "true"
    __setWalletServerStatusForTests(false)
    expect(getWalletEnabled()).toBe(false)
  })

  it("tanpa status server → build default", () => {
    delete process.env[ENV_KEY]
    expect(getWalletServerStatus()).toBeNull()
    expect(getWalletEnabled()).toBe(false)
    process.env[ENV_KEY] = "true"
    expect(getWalletEnabled()).toBe(true)
  })

  it("listener dipanggil saat status server berubah", () => {
    let calls = 0
    const unsubscribe = subscribeWalletFlag(() => {
      calls += 1
    })
    __setWalletServerStatusForTests(false)
    expect(calls).toBe(1)
    unsubscribe()
    __setWalletServerStatusForTests(true)
    expect(calls).toBe(1)
  })
})
