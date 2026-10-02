/** QA layout: reproduksi & verifikasi 2 bug visual kronis di web build statis.
 * Bug 1 — segmented control Transaksi tertimpa teks fragmen hari ("26", "N transaksi").
 * Bug 2 — gap putih raksasa antara chip filter dan list pertama di halaman Pesan.
 *
 * Jalur: npm run build:web; npm run preview:web;
 *   QA_CHROMIUM_PATH=/path/chromium node lib/__tests__/layout-bugs-repro-check.js
 * Optional: QA_BASE_URL, QA_ARTIFACTS_DIR.
 * Fixture API via intercept — tidak pernah menyentuh backend produksi.
 * Bukan pengganti QA Android (quirk elevation/clip berbeda) — hanya alat
 * bukti geometri layout berlapis (Yoga/CSS) lintas platform.
 */
import { chromium, expect } from "@playwright/test"
import { mkdir, writeFile } from "node:fs/promises"
import { resolve } from "node:path"

const base = process.env.QA_BASE_URL || "http://127.0.0.1:8081"
const artifacts = resolve(process.env.QA_ARTIFACTS_DIR || "test-results/layout-bugs")
await mkdir(artifacts, { recursive: true })

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.QA_CHROMIUM_PATH || undefined,
  args: process.env.QA_CHROMIUM_ARGS ? JSON.parse(process.env.QA_CHROMIUM_ARGS) : ["--no-sandbox"],
})

const user = {
  id: "fixture-user",
  username: "fixture_user",
  fullName: "Fixture User",
  phoneNumber: "+628100000000",
  badges: [],
}

/** Order fixture lintas hari WIB — memicu groupOrdersByDay ("Hari ini",
 * "Kemarin", tanggal panjang "…, 26 September 2026") seperti screenshot HP. */
function makeOrder(id, createdAt, title) {
  return {
    id,
    title,
    status: "COMPLETED",
    orderValue: 150000,
    createdAt,
    myRole: "BUYER",
    buyer: { id: "fixture-user", username: "fixture_user", fullName: "Fixture User" },
    seller: { id: "seller-1", username: "fixture_seller", fullName: "Fixture Seller" },
  }
}
const orders = [
  makeOrder("order-today-1", "2026-10-02T08:00:00Z", "Pesanan hari ini 1"),
  makeOrder("order-today-2", "2026-10-02T09:00:00Z", "Pesanan hari ini 2"),
  makeOrder("order-yday-1", "2026-10-01T10:00:00Z", "Pesanan kemarin"),
  makeOrder("order-26-a", "2026-09-26T07:00:00Z", "Jastip 26 September A"),
  makeOrder("order-26-b", "2026-09-26T11:00:00Z", "Jastip 26 September B"),
]

function makeRoom(id, name, minutesAgo, extra = {}) {
  return {
    id,
    roomType: "INQUIRY",
    type: "INQUIRY",
    subject: name,
    unreadCount: 0,
    archived: false,
    updatedAt: new Date(Date.now() - minutesAgo * 60000).toISOString(),
    lastMessage: {
      id: `msg-${id}`,
      messageType: "TEXT",
      content: `Pesan terakhir ${name}`,
      createdAt: new Date(Date.now() - minutesAgo * 60000).toISOString(),
      fromUser: false,
      senderId: "fixture-owner",
    },
    otherUser: {
      userId: `owner-${id}`,
      username: `seller_${id}`,
      fullName: name,
      avatarUrl: null,
      isOnline: false,
    },
    ...extra,
  }
}
const rooms = [
  makeRoom("room-1", "Toko Serba Ada", 5),
  makeRoom("room-2", "Budi Santoso", 30),
  makeRoom("room-3", "Kurir Kilat", 90),
  makeRoom("room-4", "Etalase Kopi", 240),
  makeRoom("room-5", "Siti Aminah", 1440),
  makeRoom("room-6", "Reseller Nusantara", 2880),
]

async function openPage(page) {
  page.on("pageerror", (error) => console.error("PAGEERROR:", error.message))
  await page.addInitScript(() => {
    localStorage.setItem("kahade.language.preference", "id")
    for (const key of [
      "kahade.onboarding.seen",
      "kahade.feed.orientationSeen",
      "kahade.push.rationaleSeen",
      "kahade.coachMark.qrSeen",
      "kahade.coachMark.createSeen",
      "kahade.coachMark.feedBuySeen",
      "kahade.coachMark.chatSwipeSeen",
    ])
      localStorage.setItem(key, "1")
  })
  await page.routeWebSocket("**/*", (socket) => socket.close())
  await page.route("https://api.kahade.id/**", async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const headers = {
      "access-control-allow-origin": base,
      "access-control-allow-credentials": "true",
    }
    const ok = (data) =>
      route.fulfill({
        status: 200,
        headers,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data }),
      })
    const fail = (status, message) =>
      route.fulfill({
        status,
        headers,
        contentType: "application/json",
        body: JSON.stringify({ success: false, error: { message } }),
      })
    if (request.method() === "OPTIONS")
      return route.fulfill({
        status: 204,
        headers: {
          ...headers,
          "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
          "access-control-allow-headers":
            request.headers()["access-control-request-headers"] || "authorization,content-type",
        },
      })
    if (path.includes("/socket.io/")) return fail(503, "Fixture: realtime disabled")
    if (path.endsWith("/auth/login"))
      return ok({ accessToken: "qa-memory-token", refreshToken: "qa-memory-refresh", user })
    if (path.endsWith("/auth/refresh")) return ok({ accessToken: "qa-memory-token" })
    if (path.endsWith("/auth/csrf-token")) return ok({ csrfToken: "qa-csrf" })
    if (path.endsWith("/settings/language")) return ok({ language: "id" })
    if (path.endsWith("/users/me") || path.endsWith("/users/me/profile") || path.endsWith("/profile/me"))
      return ok(user)
    if (path.endsWith("/v1/wallet"))
      return ok({ id: "qa-wallet", balance: 99000, availableBalance: 99000, escrowBalance: 0, hasPin: false })
    if (path.endsWith("/v1/orders"))
      return ok({ orders, total: orders.length, page: 1, limit: 20 })
    if (path.endsWith("/v1/chat/rooms"))
      return ok({ rooms, total: rooms.length, page: 1, limit: 20 })
    return ok({})
  })
}

/** Sesi web = refresh token (mock /auth/refresh selalu sukses → boot membentuk
 * token in-memory; layar login langsung redirect ke beranda = tanda sesi hidup). */
async function ensureSession(page) {
  await page.goto(`${base}/login`)
  await page.waitForTimeout(1500)
  if (page.url().includes("/login")) throw new Error("session was not established (still on /login)")
}

function rectOverlap(a, b) {
  if (!a || !b) return 0
  const x = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x))
  const y = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))
  return x * y
}

/** Semua node teks yang cocok, + rect-nya. */
async function textRects(page, pattern) {
  return page.evaluate((source) => {
    const re = new RegExp(source)
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    const out = []
    let node
    while ((node = walker.nextNode())) {
      const text = (node.textContent || "").trim()
      if (!text || !re.test(text)) continue
      const el = node.parentElement
      if (!el) continue
      const rect = el.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0)
        out.push({ text, rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } })
    }
    return out
  }, pattern)
}

const resultsSummary = []
try {
  // ── Bug 1: Transaksi — teks hari menimpa SegmentedControl ────────────────
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 650 },
      locale: "id-ID",
      hasTouch: true,
      timezoneId: "Asia/Jakarta",
    })
    const page = await context.newPage()
    await openPage(page)
    await ensureSession(page)
    await page.goto(`${base}/transactions`)
    const group = page.getByRole("radiogroup", { name: "Peran transaksi" })
    await expect(group).toBeVisible({ timeout: 15000 })
    await expect(page.getByText(/\d+ transaksi/).first()).toBeVisible({ timeout: 15000 })
    await page.waitForTimeout(600)

    const segBox = await group.boundingBox()
    const counts = await textRects(page, "^\\d+ transaksi$")
    const labels = await textRects(page, "(Hari ini|Kemarin|\\d+ \\w+ 20\\d\\d)")
    const pillBoxes = await page.evaluate(() => {
      const group = document.querySelector('[role="radiogroup"]')
      if (!group) return []
      return [...group.querySelectorAll('[role="radio"]')].map((el) => {
        const r = el.getBoundingClientRect()
        return { label: el.textContent, rect: { x: r.x, y: r.y, width: r.width, height: r.height } }
      })
    })

    const overlaps = []
    for (const item of [...counts, ...labels]) {
      const area = rectOverlap(item.rect, segBox)
      if (area > 1) overlaps.push({ ...item, overlapArea: Math.round(area) })
    }
    for (const item of counts) {
      for (const pill of pillBoxes) {
        const area = rectOverlap(item.rect, pill.rect)
        if (area > 1) overlaps.push({ text: item.text, pill: pill.label, overlapArea: Math.round(area) })
      }
    }
    await page.screenshot({ path: resolve(artifacts, "bug1-transactions.png") })
    const detail = { segBox, counts: counts.slice(0, 4), labels: labels.slice(0, 4), overlaps }
    resultsSummary.push({ name: "bug1 overlap day-text vs segmented", detail })
    console.log("BUG1", JSON.stringify(detail, null, 2))
    await context.close()
  }

  // ── Bug 2: Pesan — gap chip → SelfChatEntry ──────────────────────────────
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 650 },
      locale: "id-ID",
      hasTouch: true,
      timezoneId: "Asia/Jakarta",
    })
    const page = await context.newPage()
    await openPage(page)
    await ensureSession(page)
    await page.goto(`${base}/chat`)
    const selfEntry = page.getByText("Pesan untuk diri sendiri", { exact: true }).first()
    await expect(selfEntry).toBeVisible({ timeout: 15000 })
    await page.waitForTimeout(800)

    const tablist = await page.evaluate(() => {
      const el = document.querySelector('[role="tablist"]')
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y, width: r.width, height: r.height }
    })
    const selfRect = await selfEntry.evaluate((el) => {
      // Naik ke PressableScale (row) — teks ada di dalam 2 View.
      let node = el
      for (let i = 0; i < 4 && node.parentElement; i++) node = node.parentElement
      const r = node.getBoundingClientRect()
      return { x: r.x, y: r.y, width: r.width, height: r.height, cls: node.className }
    })
    const gap =
      tablist && selfRect ? Math.round(selfRect.y - (tablist.y + tablist.height)) : null
    const probe =
      gap != null && gap > 8
        ? await page.evaluate(([x, y]) => {
            const stack = document.elementsFromPoint(x, y).slice(0, 6)
            return stack.map((el) => {
              const r = el.getBoundingClientRect()
              return `${el.tagName}.${(el.className || "").toString().slice(0, 80)} [h=${Math.round(r.height)} y=${Math.round(r.y)}]`
            })
          }, [tablist.x + tablist.width / 2, tablist.y + tablist.height + gap / 2])
        : []
    await page.screenshot({ path: resolve(artifacts, "bug2-chat.png") })
    const detail = { tablist, selfRect, gap, probe }
    resultsSummary.push({ name: "bug2 chips→self-chat gap", detail })
    console.log("BUG2", JSON.stringify(detail, null, 2))
    await context.close()
  }
} finally {
  await browser.close()
  await writeFile(resolve(artifacts, "results.json"), JSON.stringify(resultsSummary, null, 2))
}
console.log("done — artifacts:", artifacts)
