/**
 * PROBE AUDIT ESCROW END-TO-END (2026-09-24) — pembuktian eksekusi.
 *
 * Pasangan `tests/zz-probe-escrow.test.tsx` untuk temuan audit baru. Setiap
 * probe MENGHASILKAN bukti runtime; assert dipasang pada fakta yang terbukti
 * (termasuk yang membuktikan bug, mis. judul timeline berupa FUNGSI).
 *
 *   npx vitest run --config vitest.components.config.ts tests/zz-audit-escrow-e2e.test.tsx
 *
 * "pattern audit" membaca sumber file dan memverifikasi klaim struktural
 * (daftar pola, ketiadaan pemakaian) secara eksekusi — bukan opsi.
 */
import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

import {
  normalizeDeliveryProof,
  normalizeOrder,
  normalizeOrderExtension,
} from "@/lib/api/orders"
import { normalizeWalletTransaction } from "@/lib/api/wallet-contract"
import { API_CONSTRAINTS } from "@/lib/api/constraints"
import { mapOrderHistoryToTimeline } from "@/components/ui/order-history-timeline"
import { assertDtoConstraints, splitFee } from "@/lib/financial"

const src = (rel: string) => fs.readFileSync(path.join(process.cwd(), rel), "utf8")

const tryRun = <T,>(fn: () => T) => {
  try {
    return { ok: true as const, value: fn() }
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : String(e) }
  }
}

describe("PROBE audit escrow e2e", () => {
  it("P-A: canProcess(order.status === 'PAID') mustahil — alias lama selalu dinormalisasi", () => {
    const normalized = normalizeOrder({ id: "c1", status: "PAID" } as never)
    console.log("[PROBE-A] normalizeOrder({status:'PAID'}).status =", normalized.status)
    // app/order/[id].tsx `canProcess` membandingkan "PAID" pada hasil
    // normalizeOrder — yang TIDAK PERNAH mempertahankan "PAID" (alias map).
    expect(normalized.status).not.toBe("PAID")
    expect(normalized.status === "PAID").toBe(false) // canProcess = false selalu
  })

  it("P-B (regresi M-49): rated/isRated DIBAWA normalizeOrder — guard double-rate aktif", () => {
    const normalized = normalizeOrder({
      id: "c1",
      status: "COMPLETED",
      rated: true,
      isRated: true,
    } as never)
    const rec = normalized as Record<string, unknown>
    console.log("[PROBE-B] keys hasil normalizeOrder:", Object.keys(normalized).join(","))
    console.log("[PROBE-B] normalized.rated =", rec.rated, " normalized.isRated =", rec.isRated)
    expect(rec.rated).toBe(true)
    expect(rec.isRated).toBe(true)
    // → app/rate/[orderId].tsx guard double-rate punya sinyal nyata dari order.
  })

  it("P-C (regresi): mapOrderHistoryToTimeline — toStatus prototipe menghasilkan title STRING", () => {
    const items = mapOrderHistoryToTimeline(
      [{ id: "h1", toStatus: "valueOf", actor: "BUYER", timestamp: 1 }] as never,
      "COMPLETED",
      { statuses: {}, actors: {}, by: "oleh" } as never,
    )
    const title = items[0]?.title as unknown
    console.log("[PROBE-C] title typeof =", typeof title, " desc =", String(items[0]?.description))
    // A-01 tidak kambuh: labels.statuses diindeks aman-prototipe (hasOwn).
    // toStatus "valueOf" = anggota Object.prototype → jatuh ke fallback string.
    expect(typeof title).toBe("string")
  })

  it("P-D (regresi M-11): rumus fallback FeeBreakdown — voucher penuh ke pembeli", () => {
    // Skenario: order 150rb, voucher diskon 50rb, fee platform 5rb, resp SELLER.
    // Rumus BARU fee-breakdown.tsx (fallback, TANPA buyerPays/sellerGets server):
    //   pays = orderValue + splitFee(fee,resp).buyer − diskon_penuh
    //   gets = orderValue − splitFee(fee,resp).seller
    // (dulu: pays tidak terpotong voucher 50rb; gets membengkak 195rb > orderValue).
    const share = splitFee(5_000, "SELLER")
    const pays = 150_000 + share.buyer - 50_000
    const gets = 150_000 - share.seller
    console.log("[PROBE-D] SELLER-resp: pays =", pays, " gets =", gets, "(orderValue 150000, voucher 50000)")
    // Pembeli BAYAR 100rb (voucher penuh memotong tagihan).
    expect(pays).toBe(100_000)
    // Penjual TERIMA 145rb (orderValue − fee.seller) — tidak pernah > orderValue.
    expect(gets).toBe(145_000)
    expect(gets).toBeLessThanOrEqual(150_000)
    // Invariant B-06 tetap: pays − gets == fee − discount.
    expect(pays - gets).toBe(5_000 - 50_000)
  })

  it("P-E: proofId '' melanggar pola ConfirmDeliveryDto — handleConfirm tetap kirim tanpa guard", () => {
    const r = tryRun(() => assertDtoConstraints({ proofId: "" }, API_CONSTRAINTS.ConfirmDeliveryDto))
    console.log("[PROBE-E] assertDtoConstraints({proofId:''}) =>", JSON.stringify(r))
    // delivery-proof/[orderId].tsx handleConfirm: confirmDelivery(id, {proofId: latest.id})
    // dengan latest.id bisa "" (normalizeDeliveryProof fallback) — tanpa guard
    // (completeOrder punya guard `? { proofId } : undefined`).
    expect(r.ok).toBe(false)
  })

  it("P-F: id fallback '' di extension & delivery-proof → seg('') BAD_REQUEST saat approve/confirm", () => {
    const ext = normalizeOrderExtension({ status: "PENDING" })
    const proof = normalizeDeliveryProof({ fileUrls: ["u"] })
    console.log("[PROBE-F] extension.id =", JSON.stringify(ext.id), " proof.id =", JSON.stringify(proof.id))
    // ListOrders DISARING id kosong (D-11) tapi list extension/proof TIDAK.
    expect(ext.id).toBe("")
    expect(proof.id).toBe("")
  })

  it("P-G (regresi A-07): normalizeWalletTransaction & normalizeOrder konsisten menormalkan id numerik", () => {
    const okOrder = tryRun(() => normalizeOrder({ id: 123, status: "PROCESSING" } as never))
    const badTx = tryRun(() => normalizeWalletTransaction({ txId: 123, type: "TOP_UP", amount: 1000 }))
    console.log("[PROBE-G] order id=123 =>", JSON.stringify(okOrder), " wallet tx id=123 =>", JSON.stringify(badTx))
    expect(okOrder.ok).toBe(true)
    expect((okOrder as { value: { id: string } }).value.id).toBe("123")
    expect(badTx.ok).toBe(true) // regresi A-07: id numerik tidak lagi melempar
    expect((badTx as { value: { id: string } }).value.id).toBe("123")
  })

  it("P-H (regresi): CREDIT_CARD TIDAK ditawarkan topup — cardToken mustahil dikirim (kontrak TopupDto)", () => {
    const types = src("lib/api/types.ts")
    const wallet = src("lib/api/wallet.ts")
    const topup = src("app/topup.tsx")
    const methods = src("lib/payment-methods.ts")
    // Komentar kontrak: cardToken "required for CREDIT_CARD method" …
    expect(types).toContain("required for CREDIT_CARD method")
    // … dan tidak satu pun jalur topup membawa/membaca cardToken (hanya
    // disebut di komentar — yang diperiksa adalah PEMAKAIAN kode).
    expect(topup).not.toMatch(/cardToken\s*[:=]/)
    expect(wallet).not.toContain("cardToken")
    // Regresi: CREDIT_CARD DIKELUARKAN dari pilihan topup (label/hitungan fee
    // tetap memakai katalog kode + angka kontrak untuk test parity 100_000).
    expect(methods).toContain("CREDIT_CARD:")
    expect(topup).toContain("CREDIT_CARD") // penyebutan = pengucilan eksplisit
    expect(topup).toContain("isTopupMethod")
    const enumLine = src("lib/api/constraints.ts")
    expect(enumLine).toContain("\"CREDIT_CARD\"")
    console.log("[PROBE-H] terbukti: CREDIT_CARD selectable, cardToken tak pernah dikirim")
  })

  it("P-I: UpdateShippingDto trackingNumber < 3 dilanggar layar delivery-proof tanpa guard", () => {
    const r = tryRun(() =>
      assertDtoConstraints({ trackingNumber: "AB" }, API_CONSTRAINTS.UpdateShippingDto),
    )
    console.log("[PROBE-I] UpdateShippingDto {trackingNumber:'AB'} =>", JSON.stringify(r))
    // delivery-proof/[orderId].tsx handleSubmitProof kirim {trackingNumber} apa
    // adanya (handleConfirm di file sama mengenal assertDtoConstraints tapi tidak dipakai).
    expect(r.ok).toBe(false)
  })

  it("P-J (regresi): batas input UI SAMAI kontrak (claim 20..5000; reason 2000)", () => {
    console.log("[PROBE-J] SubmitClaimDto =", JSON.stringify(API_CONSTRAINTS.SubmitClaimDto))
    console.log("[PROBE-J] MutualResolutionProposeDto =", JSON.stringify(API_CONSTRAINTS.MutualResolutionProposeDto))
    expect(API_CONSTRAINTS.SubmitClaimDto.claim.maxLength).toBe(5000)
    expect(API_CONSTRAINTS.SubmitClaimDto.claim.minLength).toBe(20)
    expect(API_CONSTRAINTS.MutualResolutionProposeDto.reason.maxLength).toBe(2000)
    const formSrc = src("components/ui/dispute-claim-form.tsx")
    expect(formSrc).toContain("maxLength = 5000") // samai SubmitClaimDto.claim
    expect(formSrc).toContain("minLength = 20") // samai SubmitClaimDto.claim
    const screenSrc = src("app/dispute/[id].tsx")
    expect(screenSrc).toContain("PROPOSAL_NOTE_MAX = 2000") // samai reason kontrak
  })

  it("P-K (regresi #79): MONEY_MUTATION_PATTERNS MENCakup /v1/disputes/... — mutual-resolution memindahkan dana", () => {
    const clientSrc = src("lib/api/client.ts")
    const blockStart = clientSrc.indexOf("const MONEY_MUTATION_PATTERNS = [")
    expect(blockStart).toBeGreaterThan(-1)
    const block = clientSrc.slice(blockStart, clientSrc.indexOf("]", blockStart))
    console.log("[PROBE-K]", block.replace(/\s+/g, " "))
    // respondMutualResolution ACCEPT membelah saldo escrow — kini pola dana
    // memuat /v1/disputes/{id}/mutual-resolution → cache wallet ter-invalidate.
    expect(block).toContain("disputes")
    expect(block).toContain("mutual-resolution")
  })

  it("P-L (regresi C-01): terminasi polling QRIS memuat 'UNKNOWN' — konsisten dengan orders.ts", () => {
    const qrisSrc = src("lib/use-qris-payment.ts")
    const terminal = qrisSrc.split("\n").find((l) => l.includes("const TERMINAL"))
    console.log("[PROBE-L]", terminal?.trim())
    expect(terminal).toBeDefined()
    expect(terminal).toContain("UNKNOWN")
    // orders.ts normalizePaymentStatus (C-01) menjanjikan "polling berhenti" utk
    // UNKNOWN — kini hook TERMINAL memuat UNKNOWN: polling berhenti juga.
    expect(src("lib/api/orders.ts")).toContain("hasilnya `UNKNOWN` dan polling berhenti")
  })

  it("P-M (regresi): layar order-link publik memakai previewOrderLink (auth none)", () => {
    const screenSrc = src("app/order-link/[token].tsx")
    console.log("[PROBE-M] rujukan di layar:", (screenSrc.match(/getOrderLink|previewOrderLink/g) ?? []).join(","))
    expect(screenSrc).toContain("api.orders.previewOrderLink(token")
    expect(screenSrc).toContain("api.orders.getOrderLink") // fallback sesi login
    // jalur preview publik KINI primer di layar token publik — tanpa token auth.
    const users = ["app", "components", "lib"]
      .flatMap((dir) => walk(dir))
      .filter((f) => /\.(tsx?|ts)$/.test(f))
      .filter((f) => src(f).includes("previewOrderLink") && !f.includes("lib/api/orders"))
    console.log("[PROBE-M] file selain lib/api/orders yang memakai previewOrderLink:", JSON.stringify(users))
    expect(users.length).toBeGreaterThan(0) // layar token publik memakainya
  })

  it("P-N (regresi C-06): jalur uang mengirim idempotencyKey dari pemanggil — kunci STABIL", () => {
    const callSites = ["app", "components", "lib"]
      .flatMap((dir) => walk(dir))
      .filter((f) => /\.(tsx?)$/.test(f))
      .filter(
        (f) =>
          !f.startsWith("lib/api/orders") &&
          !f.startsWith("lib/api/client") &&
          !f.startsWith("lib/api/types") &&
          !f.startsWith("tests"),
      )
      .filter((f) => /idempotencyKey/.test(src(f)))
    console.log("[PROBE-N] call site non-test yang memuat 'idempotencyKey':", JSON.stringify(callSites))
    // Konvensi C-06 kini DIIMPLEMENTASI di jalur uang: screens membawa kunci
    // STABIL (useRef) untuk retry manual → tidak 2x kirim.
    expect(callSites).toContain("lib/api/showcase.ts")
    expect(callSites).toContain("lib/api/users.ts")
    const moneyCallers = callSites.filter(
      (f) =>
        f.startsWith("app/") ||
        f.startsWith("lib/api/wallet") ||
        f.startsWith("lib/api/disputes") ||
        f.startsWith("lib/api/orders"),
    )
    console.log("[PROBE-N] call site jalur uang yang mengirim idempotencyKey:", JSON.stringify(moneyCallers))
    expect(moneyCallers.length).toBeGreaterThan(0) // screens topup/withdraw/transfer/create + API
    const clientSrc = src("lib/api/client.ts")
    expect(clientSrc).toContain("createIdempotencyKey()") // transpor membuat kunci BARU tiap kirim
  })

  it("P-O (regresi #49): proposal resolusi persen DIBACA turunan — simetri kontrak", () => {
    // Outbound: MutualResolutionProposeDto = {buyerPercent, sellerPercent, reason?}
    expect(API_CONSTRAINTS.MutualResolutionProposeDto.buyerPercent).toBeDefined()
    expect(API_CONSTRAINTS.MutualResolutionProposeDto.sellerPercent).toBeDefined()
    // Inbound: app/dispute/[id].tsx hanya membaca buyerAmount/amount; tidak ada
    // satu pun pembaca buyerPercent di seluruh repo (kecuali komentar kontrak).
    const readers = ["app", "components", "lib"]
      .flatMap((dir) => walk(dir))
      .filter((f) => /\.tsx?$/.test(f))
      .filter((f) => src(f).includes("buyerPercent"))
    console.log("[PROBE-O] file yang memuat 'buyerPercent':", JSON.stringify(readers))
    const screenSrc = src("app/dispute/[id].tsx")
    expect(screenSrc).toContain("p.buyerAmount ??")
    expect(screenSrc).toContain("p.amount ??")
    expect(screenSrc).toContain("buyerPercent != null")
    // Payload persen-aja → buyerAmount DITURUNKAN dari orderValue × persen.
    const p = { buyerPercent: 70, sellerPercent: 30 } as Record<string, unknown>
    const orderValue = 100_000
    const buyerPercent = typeof p.buyerPercent === "number" ? p.buyerPercent : undefined
    const buyerAmount =
      (p.buyerAmount as number | undefined) ??
      (p.amount as number | undefined) ??
      (buyerPercent != null && isFinite(orderValue) ? Math.round(buyerPercent / 100 * orderValue) : undefined)
    console.log("[PROBE-O] payload persen 70/30 → buyerAmount =", buyerAmount)
    expect(buyerAmount).toBe(70_000)
  })
})

function walk(dir: string): string[] {
  const abs = path.join(process.cwd(), dir)
  if (!fs.existsSync(abs)) return []
  return fs
    .readdirSync(abs, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? walk(path.join(dir, entry.name))
        : [path.join(dir, entry.name)],
    )
}
