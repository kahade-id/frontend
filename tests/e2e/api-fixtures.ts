import type { Page, Route } from "@playwright/test"
import observed from "../fixtures/public-responses.json"

// SYNTHETIC protected responses, exclusively for browser regression tests.
// These are NOT evidence of a real account or a verified production response schema.
export async function mockApi(
  page: Page,
  options: {
    authenticated?: boolean
    protectedErrors?: boolean
    manyTransactions?: boolean
    unknownRole?: boolean
  } = {},
) {
  const state = {
    authenticated: options.authenticated ?? true,
    requests: [] as Array<{ path: string; method: string; body: unknown }>,
  }
  await page.addInitScript(() => localStorage.setItem("kahade.onboarding.seen", "1"))
  const me = {
    id: "test-viewer",
    username: "pengguna-uji",
    fullName: "Pengguna Uji",
    email: "fixture@example.test",
    emailVerified: true,
  }
  const now = "2026-09-05T02:00:00.000Z"
  const fee = {
    orderValue: 100000,
    platformFee: 5000,
    buyerPays: 105000,
    sellerReceives: 100000,
    discount: 0,
  }
  const order = {
    id: "test-order",
    title: "Pesanan Uji",
    description: "Rincian pesanan sintetis untuk pengujian",
    orderType: "SERVICE",
    status: "PENDING_PAYMENT",
    orderValue: 100000,
    feeResponsibility: "BUYER",
    deliveryDeadlineDays: 3,
    createdAt: now,
    buyer: me,
    seller: { id: "test-seller", username: "penjual-uji", fullName: "Penjual Uji" },
    ...(options.unknownRole ? {} : { myRole: "BUYER" }),
    fee,
  }
  const json = (route: Route, data: unknown, status = 200, envelope = true) =>
    route.fulfill({
      status,
      contentType: "application/json",
      headers: {
        "access-control-allow-origin": route.request().headers().origin ?? "http://127.0.0.1:8081",
        "access-control-allow-credentials": "true",
        "access-control-allow-headers":
          "content-type,authorization,x-device-id,x-device-info,x-app-version,x-platform",
        "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      },
      body: JSON.stringify(envelope ? { success: true, data, errors: null } : data),
    })
  await page.route("**/v1/**", async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const method = request.method()
    if (method === "OPTIONS") {
      await json(route, null)
      return
    }
    let body: unknown
    try {
      body = request.postDataJSON()
    } catch {
      body = null
    }
    state.requests.push({ path, method, body })
    const known: Record<string, unknown> = {
      "/v1/public/app-version": observed.appVersion,
      "/v1/public/config": observed.config,
      "/v1/public/banks": observed.banks,
      "/v1/public/fee-schedule": observed.feeSchedule,
      "/v1/public/subscription-plans": observed.plans,
      "/v1/auth/otp-methods": observed.otpMethods,
    }
    if (known[path]) {
      await json(route, known[path], 200, false)
      return
    }
    if (path === "/v1/auth/login") {
      if ((body as { password?: string })?.password === "wrong-password") {
        await json(route, observed.unauthorized, 401, false)
        return
      }
      state.authenticated = true
      await json(route, { accessToken: "synthetic-access-token-for-tests", user: me })
      return
    }
    if (path === "/v1/auth/refresh") {
      await json(
        route,
        state.authenticated
          ? { accessToken: "synthetic-access-token-for-tests" }
          : observed.unauthorized,
        state.authenticated ? 200 : 401,
        state.authenticated,
      )
      return
    }
    if (path === "/v1/auth/logout") {
      state.authenticated = false
      await json(route, null)
      return
    }
    if (path === "/v1/help-center/categories") {
      await json(route, [{ slug: "transaksi", name: "Transaksi", articleCount: 2 }])
      return
    }
    if (path === "/v1/help-center/categories/transaksi") {
      await json(route, {
        slug: "transaksi",
        name: "Transaksi",
        articles: [
          {
            id: "article-one",
            slug: "pertama",
            title: "Artikel pertama",
            content: "Isi artikel pertama.",
          },
          {
            id: "article-two",
            slug: "kedua",
            title: "Artikel kedua",
            content: "Isi lengkap artikel kedua.",
          },
        ],
      })
      return
    }
    if (path === "/v1/help-center/search") {
      await json(route, [])
      return
    }
    if (/\/help-center\/items\/.+\/view/.test(path)) {
      await json(route, null)
      return
    }
    if (!state.authenticated) {
      await json(route, observed.unauthorized, 401, false)
      return
    }
    if (options.protectedErrors) {
      await json(
        route,
        {
          success: false,
          data: null,
          errors: { code: "SERVICE_UNAVAILABLE", message: "Layanan uji sementara tidak tersedia." },
        },
        503,
        false,
      )
      return
    }
    if (path === "/v1/users/me") {
      await json(route, me)
      return
    }
    if (path === "/v1/wallet") {
      await json(route, { id: "test-wallet", balance: "100000", holdBalance: "25000" })
      return
    }
    if (path === "/v1/wallet/transactions" || /\/wallet\/(topup|withdraw)\/history/.test(path)) {
      const count = options.manyTransactions ? 120 : 2
      await json(route, {
        transactions: Array.from({ length: count }, (_, i) => ({
          id: `test-tx-${i}`,
          type: "TOPUP",
          amount: "10000",
          status: i === 0 ? "REVIEWING" : "COMPLETED",
          createdAt: now,
          referenceId: `TEST-${i}`,
        })),
        meta: { page: 1, limit: count, total: count, totalPages: 1 },
      })
      return
    }
    if (path === "/v1/wallet/payment-methods") {
      await json(route, {
        methods: [
          {
            id: "qris",
            code: "QRIS",
            name: "QRIS",
            enabled: true,
            minAmount: 10000,
            maxAmount: 50000,
            fee: { fixed: 1000, percent: 0.7 },
          },
        ],
      })
      return
    }
    if (path === "/v1/wallet/topup" && method === "POST") {
      await new Promise((resolve) => setTimeout(resolve, 200))
      await json(route, {
        paymentTxId: "test-payment",
        amount: 50000,
        method: "QRIS",
        status: "PENDING",
        qrString: "test-qr-payload",
      })
      return
    }
    if (path === "/v1/notifications/unread-count") {
      await json(route, { count: 0 })
      return
    }
    if (path === "/v1/notifications" || path === "/v1/orders") {
      await json(route, {
        data: path === "/v1/orders" ? [order] : [],
        meta: { page: 1, limit: 20, total: path === "/v1/orders" ? 1 : 0, totalPages: 1 },
      })
      return
    }
    if (path === "/v1/orders/test-order") {
      await json(route, order)
      return
    }
    if (path === "/v1/orders/test-order/history") {
      await json(route, { data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } })
      return
    }
    if (path === "/v1/orders/average-durations") {
      await json(route, {})
      return
    }
    if (path === "/v1/orders/calculate-fee") {
      await json(route, fee)
      return
    }
    if (path === "/v1/orders/validate-counterpart") {
      await json(route, { valid: true, user: order.seller })
      return
    }
    if (path === "/v1/search/suggestions") {
      await json(route, [])
      return
    }
    if (path === "/v1/search") {
      const q = url.searchParams.get("q") ?? ""
      if (q === "lama") await new Promise((resolve) => setTimeout(resolve, 800))
      await json(route, {
        users: [{ id: q, username: q, fullName: `Hasil ${q}` }],
        orders: [],
        transactions: [],
      })
      return
    }
    await json(
      route,
      {
        success: false,
        data: null,
        errors: { code: "NOT_FOUND", message: "Fixture endpoint tidak tersedia." },
      },
      404,
      false,
    )
  })
  return state
}
