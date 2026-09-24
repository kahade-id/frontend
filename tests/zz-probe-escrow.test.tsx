/**
 * PROBE AUDIT (sementara) — escrow/order end-to-end.
 * File ini dipakai untuk MEMBUKTIKAN temuan audit lewat eksekusi nyata.
 */
import { describe, it, vi } from "vitest"

vi.mock("@/lib/api/session", () => ({
  getAccessToken: () => Promise.resolve("t"),
  getRefreshToken: () => Promise.resolve(null),
  setAccessToken: () => Promise.resolve(),
  setRefreshToken: () => Promise.resolve(),
  getSessionRevision: () => 1,
  clearSession: () => Promise.resolve(),
  emitSessionExpired: () => undefined,
  getDeviceId: () => Promise.resolve("d"),
  getDeviceInfo: () => "x",
  getAppVersion: () => "0",
}))

import {
  isCancellable,
  isDisputable,
  isExtendable,
  nextOrderStatus,
  normalizeCounterpartValidation,
  normalizeInvoice,
  normalizeOrder,
  normalizePaymentStatus,
  orderPartyName,
} from "@/lib/api/orders"
import { mapOrderHistoryToTimeline } from "@/components/ui/order-history-timeline"
import { readList, readPage, unwrapResponse } from "@/lib/api/response"
import { splitFee, feeShare } from "@/components/ui/fee-breakdown"
import { addDays } from "@/components/ui/order-extension-card"
import { toEpochMs } from "@/lib/pending-actions"
import {
  formatRupiah,
  formatDateTime,
  formatDateTimeWIB,
  durationHoursParts,
  amountInputValue,
  parseRupiah,
} from "@/lib/format"
import { isOrderActive, isOrderStatus, orderStatusTone, ORDER_STATUSES } from "@/components/ui/order-status-badge"
import { ORDER_STATUS_LABELS } from "@/lib/labels/status"
import { seg, buildUrl, createIdempotencyKey } from "@/lib/api/client"
import { orderLinkStatus, orderLinkStatusMeta } from "@/lib/order-link-labels"

const log = (...a: unknown[]) => console.log("[PROBE]", ...a)
function tryRun(label: string, fn: () => unknown) {
  try {
    log(label, "=>", fn())
  } catch (e) {
    log(label, "=> THROW:", (e as Error).name, (e as Error).message)
  }
}

describe("PROBE escrow", () => {
  it("P1: gerbang status", () => {
    log("isCancellable(COMPLETED)=", isCancellable("COMPLETED"))
    log("isCancellable(IN_DELIVERY)=", isCancellable("IN_DELIVERY"))
    log("isCancellable(DELIVERED)=", isCancellable("DELIVERED"))
    log("isDisputable(WAITING_CONFIRMATION)=", isDisputable("WAITING_CONFIRMATION"))
    log("isExtendable(IN_DELIVERY)=", isExtendable("IN_DELIVERY"))
    let s: string | undefined = "PENDING_PAYMENT"
    const chain: string[] = []
    while (s && chain.length < 10) {
      chain.push(s)
      s = nextOrderStatus(s as never) as string | undefined
    }
    log("chain from PENDING_PAYMENT:", chain.join(" -> "))
  })

  it("P2: label & tone", () => {
    log("ORDER_STATUSES.length=", ORDER_STATUSES.length)
    for (const s of ["toString", "UNKNOWN"]) {
      log(`label(${s})=`, (ORDER_STATUS_LABELS as Record<string, string>)[s], "tone=", orderStatusTone(s))
    }
    log("isOrderStatus('UNKNOWN')=", isOrderStatus("UNKNOWN"))
    log("isOrderActive(DISPUTED)=", isOrderActive("DISPUTED"))
  })

  it("P3: normalizeOrder", () => {
    log("numeric id ->", JSON.stringify(normalizeOrder({ id: 123 } as never).id))
    log("kosong ->", JSON.stringify(normalizeOrder({} as never)))
  })

  it("P4: normalizePaymentStatus", () => {
    log("kosong:", JSON.stringify(normalizePaymentStatus({})))
    log("paid flag:", JSON.stringify(normalizePaymentStatus({ paid: true })))
    log("lowercase:", JSON.stringify(normalizePaymentStatus({ status: "paid" })))
  })

  it("P5: normalizeCounterpartValidation", () => {
    for (const c of [{}, { valid: false, reason: "Anda diblokir oleh pengguna ini" }, { valid: "yes" }, { isValid: true }] as unknown[]) {
      log(JSON.stringify(c), "=>", JSON.stringify(normalizeCounterpartValidation(c)))
    }
  })

  it("P6: normalizeInvoice", () => {
    tryRun("kosong", () => JSON.stringify(normalizeInvoice({}, "o1")))
    log("negatif:", JSON.stringify(normalizeInvoice({ total: "-5000", invoiceNumber: "I" }, "o1").total))
    log("desimal:", JSON.stringify(normalizeInvoice({ total: "1500.50", invoiceNumber: "I" }, "o1").total))
    log("fallback nomor:", normalizeInvoice({ total: 10, order: { id: "o9" } }, "o1").invoiceNumber)
  })

  it("P7: readPage / readList", () => {
    log("orders root:", JSON.stringify(readPage({ orders: [{ id: 1 }], total: 41, page: 1, limit: 20 }, { page: 1, limit: 20 }, ["orders"]).meta))
    log("readList({history:[]},[history]):", JSON.stringify(readList({ history: [] }, ["history"])))
    const raw = { history: [{ id: "h1" }] } as never as { data?: unknown[] }
    log("cast .data dari {history:[]} =>", raw.data)
  })

  it("P8: splitFee vs feeShare", () => {
    log("splitFee(10001,SPLIT)=", JSON.stringify(splitFee(10001, "SPLIT")))
    log("feeShare(SPLIT)=", JSON.stringify(feeShare("SPLIT")))
    log("splitFee(0.5,SPLIT)=", JSON.stringify(splitFee(0.5, "SPLIT")))
    log("splitFee(-500,BUYER)=", JSON.stringify(splitFee(-500, "BUYER")))
    const orderValue = 100_000
    const platformFee = 10_000
    const discount = 50_000
    const share = splitFee(platformFee, "SPLIT")
    const dShare = splitFee(Math.min(Math.max(discount, 0), platformFee), "SPLIT")
    log("localPays=", orderValue + share.buyer - dShare.buyer, " serverBuyerPays(mis.)=", orderValue + share.buyer - discount)
  })

  it("P9: addDays", () => {
    log("addDays(invalid,3)=", String(addDays("bukan-tanggal", 3)))
    log("addDays(nan,3)=", String(addDays(Number.NaN, 3)))
    log("addDays(2026-01-31,1)=", addDays("2026-01-31T10:00:00Z", 1).toISOString())
  })
  it("P20: nextOrderStatus prototype pollution -> title fungsi -> render crash", () => {
    for (const s of ["toString", "constructor", "valueOf", "hasOwnProperty", "UNKNOWN_STATUS"]) {
      const n = nextOrderStatus(s as never)
      log(`nextOrderStatus(${s}) typeof=`, typeof n, "value=", String(n).slice(0, 40))
    }
    const items = mapOrderHistoryToTimeline(
      [{ id: "h1", toStatus: "toString", timestamp: "3 Sep 2026, 10:00" }],
      "PROCESSING",
      { by: "oleh", actors: { BUYER: "Pembeli", SELLER: "Penjual", SYSTEM: "Sistem", ADMIN: "Admin" }, statuses: {} },
      { title: ORDER_STATUS_LABELS[nextOrderStatus("toString") as never] ?? (nextOrderStatus("toString") as never) },
    )
    log("timeline title typeof=", typeof items[items.length - 1].title)
    // React menolak child berupa fungsi ("Functions are not valid as a React
    // child") — dibuktikan saat audit dengan render nyata; di sini cukup
    // dikunci tipe title-nya harus string.
    log("title string?", typeof items[items.length - 1].title === "string")
  })

  it("P21: mapOrderHistoryToTimeline labels.statuses prototype", () => {
    const items = mapOrderHistoryToTimeline(
      [{ id: "h1", toStatus: "valueOf", timestamp: "x" }, { id: "h2", toStatus: "COMPLETED", actor: "toString", timestamp: "x" }],
      "COMPLETED",
      { by: "oleh", actors: { BUYER: "Pembeli", SELLER: "Penjual", SYSTEM: "Sistem", ADMIN: "Admin" }, statuses: {} },
    )
    log("title[0] typeof=", typeof items[0].title, "desc[1]=", items[1].description)
  })

  it("P22: orderPartyName & normalizeOrder edge", () => {
    log("orderPartyName(undefined)=", orderPartyName(undefined))
    log("orderPartyName({id:'',username:''})=", orderPartyName({ id: "", username: "" }))
    tryRun("seg('')", () => seg(""))
    tryRun("seg('..')", () => seg(".."))
    tryRun("seg('a/b')", () => seg("a/b"))
    tryRun("normalizeOrder({})", () => JSON.stringify(normalizeOrder({} as never)))
  })

  it("P23: unwrapResponse", () => {
    tryRun("success:false", () => JSON.stringify(unwrapResponse({ success: false, message: "E" })))
    tryRun("success:true data null", () => JSON.stringify(unwrapResponse({ success: true, data: null, message: "ok" })))
    tryRun("orders normal", () => JSON.stringify(unwrapResponse({ orders: [], total: 0 })))
    tryRun("data array paginated", () => JSON.stringify(unwrapResponse({ data: [1], meta: {} })))
  })

  it("P24: format & parse uang", () => {
    log("amountInputValue('1.000.50')=", amountInputValue("1.000.50"))
    log("amountInputValue('')=", amountInputValue(""))
    log("parseRupiah('10.000,50')=", parseRupiah("10.000,50"))
    log("parseRupiah('')=", parseRupiah(""))
    log("formatDateTime('bukan')=", formatDateTime("bukan"))
    log("formatDateTime('')=", formatDateTime(""))
    log("formatDateTimeWIB('')=", formatDateTimeWIB(""))
    log("formatDateTimeWIB('2026-09-24')=", formatDateTimeWIB("2026-09-24"))
    log("durationHoursParts(23)=", JSON.stringify(durationHoursParts(23)))
    log("durationHoursParts(48)=", JSON.stringify(durationHoursParts(48)))
    log("formatRupiah(1500.5)=", formatRupiah(1500.5), " formatRupiah(1500.4)=", formatRupiah(1500.4))
  })

  it("P25: pending-actions toEpochMs epoch-detik", () => {
    log("toEpochMs(1700000000)=", toEpochMs(1_700_000_000), "(detik dianggap ms -> 1970)")
    log("toEpochMs('1700000000000')=", toEpochMs("1700000000000"))
  })

  it("P26: order-link status map", () => {
    for (const s of ["ACTIVE", "ACCEPTED", "toString", "PENDING", ""]) {
      log(`orderLinkStatus(${s})=`, orderLinkStatus(s), "meta=", JSON.stringify(orderLinkStatusMeta(s)))
    }
  })

  it("P27: seg & buildUrl", () => {
    tryRun("buildUrl('/v1/orders',{status:undefined,page:1})", () => buildUrl("/v1/orders", { status: undefined, page: 1 }))
    tryRun("buildUrl('/v1/orders',{status:''})", () => buildUrl("/v1/orders", { status: "" }))
    tryRun("buildUrl('https://x')", () => buildUrl("https://evil"))
    log("idempotency uuid=", createIdempotencyKey(), createIdempotencyKey())
  })

  it("P30: adapter tanpa readList — simulasi bentuk backend", () => {
    const shapes: unknown[] = [
      { proofs: [{ id: "p1" }] },
      { data: [{ id: "p1" }] },
      [{ id: "p1" }],
    ]
    for (const shape of shapes) {
      const ps = shape as never as Array<unknown>
      try {
        const latest = ps.length === 0 ? null : [...ps][0]
        log("spread", JSON.stringify(shape).slice(0, 25), "=> ok", JSON.stringify(latest)?.slice(0, 15))
      } catch (e) {
        log("spread", JSON.stringify(shape).slice(0, 25), "=> THROW", (e as Error).message)
      }
    }
  })

  it("P31: error envelope tanpa kunci data lolos unwrapResponse", () => {
    const out = unwrapResponse({ success: false, message: "Insufficient balance" })
    log("unwrap({success:false,message}) =>", JSON.stringify(out))
    const pay = normalizePaymentStatus(out)
    log("payment-status dari envelope error =>", JSON.stringify(pay), "terminal?", ["PAID","EXPIRED","FAILED","CANCELLED"].includes(pay.status))
  })

  it("P29: isOrderStatus vs ORDER_STATUS_FILTERS vs alias", () => {
    log("isOrderStatus('UNKNOWN')=", isOrderStatus("UNKNOWN"))
    log("isOrderStatus('PENDING_PAYMENT')=", isOrderStatus("PENDING_PAYMENT"))
    log("isOrderActive('REFUNDED')=", isOrderActive("REFUNDED"))
    log("isOrderActive('EXPIRED')=", isOrderActive("EXPIRED"))
    log("isOrderActive('DISPUTED')=", isOrderActive("DISPUTED"))
  })
})
