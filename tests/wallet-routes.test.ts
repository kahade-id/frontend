/**
 * Test route classifier dompet — Mode Tanpa Wallet Internal (BI-safe).
 *
 * Mengunci:
 * - `isWalletOnlyPath`: sembilan prefix layar dompet → true; `/withdraw`
 *   (legacy) & route non-dompet → false; query & segmen dinamis ditangani.
 * - `walletRouteFallback`: riwayat/detail mutasi → /transactions; sisanya →
 *   /bank-accounts.
 * - `hrefPathname`: string & objek { pathname, params }.
 * - `routeForNotificationReference` saat flag mati: target dompet ditulis
 *   ulang (tidak mendarat di layar blokir); `/withdraw` tidak disentuh;
 *   wallet nyala → tidak diubah.
 */
import { describe, expect, it, afterEach } from "vitest"

import {
  __resetWalletFlagForTests,
  __setWalletServerStatusForTests,
} from "@/lib/wallet-flag"
import {
  hrefPathname,
  isLegacyWithdrawalPath,
  isWalletOnlyPath,
  walletRouteFallback,
} from "@/lib/wallet-routes"
import { routeForNotificationReference } from "@/lib/notification-routing"

describe("isWalletOnlyPath", () => {
  it("sembilan layar dompet → true", () => {
    for (const p of [
      "/wallet",
      "/topup",
      "/transfer",
      "/receive",
      "/wallet-history",
      "/topup-history",
      "/withdraw-history",
      "/wallet-transaction",
      "/withdrawal-schedules",
    ]) {
      expect(isWalletOnlyPath(p), p).toBe(true)
    }
  })

  it("segmen dinamis & query ikut true", () => {
    expect(isWalletOnlyPath("/wallet-transaction/[txId]")).toBe(true)
    expect(isWalletOnlyPath("/wallet?id=abc")).toBe(true)
  })

  it("/withdraw (legacy) → false", () => {
    expect(isWalletOnlyPath("/withdraw")).toBe(false)
    expect(isWalletOnlyPath("/withdraw?resume=tx1")).toBe(false)
  })

  it("route non-dompet → false", () => {
    for (const p of ["/", "/transactions", "/bank-accounts", "/order/123", "/security", "/withdraw-historyX"]) {
      expect(isWalletOnlyPath(p), p).toBe(false)
    }
  })
})

describe("isLegacyWithdrawalPath", () => {
  it("hanya /withdraw (+query)", () => {
    expect(isLegacyWithdrawalPath("/withdraw")).toBe(true)
    expect(isLegacyWithdrawalPath("/withdraw?resume=x")).toBe(true)
    expect(isLegacyWithdrawalPath("/withdrawal-schedules")).toBe(false)
  })
})

describe("walletRouteFallback", () => {
  it("riwayat & detail mutasi → /transactions", () => {
    expect(walletRouteFallback("/wallet-history")).toBe("/transactions")
    expect(walletRouteFallback("/topup-history")).toBe("/transactions")
    expect(walletRouteFallback("/withdraw-history")).toBe("/transactions")
    expect(walletRouteFallback("/wallet-transaction/[txId]")).toBe("/transactions")
  })

  it("dompet/topup/transfer/receive/jadwal → /bank-accounts", () => {
    for (const p of ["/wallet", "/topup", "/transfer", "/receive", "/withdrawal-schedules"]) {
      expect(walletRouteFallback(p), p).toBe("/bank-accounts")
    }
  })
})

describe("hrefPathname", () => {
  it("string polos & ber-query", () => {
    expect(hrefPathname("/wallet")).toBe("/wallet")
    expect(hrefPathname("/wallet?id=x")).toBe("/wallet")
  })

  it("objek { pathname, params }", () => {
    expect(hrefPathname({ pathname: "/wallet-transaction/[txId]", params: { txId: "1" } } as never)).toBe(
      "/wallet-transaction/[txId]",
    )
  })
})

describe("routeForNotificationReference + kill-switch", () => {
  afterEach(() => {
    __resetWalletFlagForTests()
  })

  it("flag mati: WALLET → /bank-accounts, WALLET_TRANSACTION → /transactions", () => {
    __setWalletServerStatusForTests(false)
    expect(hrefPathname(routeForNotificationReference({ referenceType: "WALLET" })!)).toBe(
      "/bank-accounts",
    )
    const tx = routeForNotificationReference({ referenceType: "WALLET_TRANSACTION", referenceId: "t1" })!
    expect(hrefPathname(tx)).toBe("/transactions")
  })

  it("flag mati: WITHDRAW (legacy) tidak ditulis ulang", () => {
    __setWalletServerStatusForTests(false)
    const target = routeForNotificationReference({ referenceType: "WITHDRAW", referenceId: "w1" })!
    // WITHDRAW dipetakan ke detail mutasi → itu path dompet → fallback /transactions.
    // (Notifikasi penarikan legacy yang sebenarnya menaut ke /withdraw tidak ada
    // di tabel backend; layar /withdraw tetap hidup via deep-link langsung.)
    expect(hrefPathname(target)).toBe("/transactions")
  })

  it("flag mati: non-dompet tidak diubah", () => {
    __setWalletServerStatusForTests(false)
    const order = routeForNotificationReference({ referenceType: "ORDER", referenceId: "o1" })!
    expect(hrefPathname(order)).toBe("/order/[id]")
  })

  it("flag nyala: target dompet tidak diubah", () => {
    __setWalletServerStatusForTests(true)
    expect(hrefPathname(routeForNotificationReference({ referenceType: "WALLET" })!)).toBe("/wallet")
  })
})
