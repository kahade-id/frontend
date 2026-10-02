/** Static-export QA with intercepted APIs, never production mutations.
 * npm run build:web; npm run preview:web; node lib/__tests__/uiux-batch3-browser-check.js
 * Optional QA_BASE_URL, QA_CHROMIUM_PATH, QA_CHROMIUM_ARGS (JSON), QA_ARTIFACTS_DIR.
 * Native keyboard/codecs and installed runtime compatibility still need device QA.
 */
import { chromium, expect } from "@playwright/test"
import { mkdir, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
const base = process.env.QA_BASE_URL || "http://127.0.0.1:8081"
const artifacts = resolve(process.env.QA_ARTIFACTS_DIR || "test-results/uiux-batch3")
await mkdir(artifacts, { recursive: true })
const browser = await chromium.launch({ headless: true, executablePath: process.env.QA_CHROMIUM_PATH || undefined, args: process.env.QA_CHROMIUM_ARGS ? JSON.parse(process.env.QA_CHROMIUM_ARGS) : undefined })
const results = []
const user = { id: "fixture-user", username: "fixture_user", fullName: "Fixture User", phoneNumber: "+628100000000", badges: [] }
const work = {
  id: "fixture-work", title: "Karya fixture", description: "Fixture UI/UX batch 3",
  author: { userId: "fixture-owner", username: "fixture_seller", fullName: "Fixture Seller", badges: [] },
  images: [{ id: "fixture-image", kind: "image", imageUrl: "https://api.kahade.id/batch3-qa.png", sortOrder: 0 }, { id: "fixture-video", kind: "video", imageUrl: "https://api.kahade.id/batch3-qa.mp4", thumbnailUrl: "https://api.kahade.id/batch3-qa.png", sortOrder: 1 }],
  priceMin: 0, priceMax: 0, likeCount: 4, commentCount: 0, viewCount: 1, isLiked: false, isOwner: false, createdAt: "2026-10-02T01:00:00Z", updatedAt: "2026-10-02T01:00:00Z",
}
const prefs = { chatInApp: true, chatPush: true, securityInApp: true, securityPush: true, digestFrequency: "off", quietHoursEnabled: false }
async function check(name, target, authenticated, callback, options = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 650 }, locale: "id-ID", hasTouch: true, timezoneId: "UTC" })
  const page = await context.newPage(), errors = []
  const state = { authenticated: false, triggerSent: false, likes: 0, paymentCalls: 0, ...options }
  page.on("pageerror", error => errors.push(error.message))
  await page.addInitScript(() => {
    localStorage.setItem("kahade.language.preference", "id")
    for (const key of ["kahade.onboarding.seen", "kahade.feed.orientationSeen", "kahade.push.rationaleSeen", "kahade.coachMark.qrSeen", "kahade.coachMark.createSeen", "kahade.coachMark.feedBuySeen", "kahade.coachMark.chatSwipeSeen"]) localStorage.setItem(key, "1")
  })
  await page.routeWebSocket("**/*", socket => socket.close())
  await page.route("https://api.kahade.id/**", async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    const headers = { "access-control-allow-origin": base, "access-control-allow-credentials": "true" }
    const ok = data => route.fulfill({ status: 200, headers, contentType: "application/json", body: JSON.stringify({ success: true, data }) })
    const fail = (status, message) => route.fulfill({ status, headers, contentType: "application/json", body: JSON.stringify({ success: false, error: { message } }) })
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { ...headers, "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS", "access-control-allow-headers": request.headers()["access-control-request-headers"] || "authorization,content-type" } })
    if (path.endsWith("batch3-qa.png")) return route.fulfill({ status: 200, headers, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=", "base64") })
    // Hold the download to test player stability, not video codecs.
    if (path.endsWith("batch3-qa.mp4")) return new Promise(() => {})
    if (path.includes("/socket.io/")) return fail(503, "Fixture: realtime disabled")
    if (path.endsWith("/auth/login")) { state.authenticated = true; return ok({ accessToken: "qa-memory-token", refreshToken: "qa-memory-refresh", user }) }
    if (path.endsWith("/auth/refresh")) return state.authenticated ? ok({ accessToken: "qa-memory-token" }) : fail(401, "Fixture guest")
    if (path.endsWith("/settings/language")) return ok({ language: "id" })
    if (path.endsWith("/auth/csrf-token")) return ok({ csrfToken: "qa-csrf" })
    if (path.endsWith("/auth/otp-trigger")) return ok({ refCode: "abc123def456", triggerText: "abc123def456", whatsappUrl: "https://wa.me/6285786035715?text=abc123def456", expiresInSeconds: 600, expiresAt: new Date(Date.now() + 600000).toISOString() })
    if (path.includes("/auth/otp-trigger/status/")) return ok({ status: state.triggerSent ? "COMPLETED" : "WAITING", purpose: "login" })
    if (path.endsWith("/auth/verify-otp")) return fail(400, "Invalid OTP code")
    if (path.endsWith("/auth/2fa/status")) return ok({ enabled: true, backupCodesRemaining: 1 })
    if (path.endsWith("/notifications/preferences")) return state.preferencesError ? fail(503, "Fixture preference failure") : ok(request.method() === "PUT" ? { ...prefs, ...request.postDataJSON() } : prefs)
    if (path === "/v1/wallet") { if (state.walletGate) await state.walletGate; return ok({ id: "qa-wallet", balance: 0, availableBalance: 0, escrowBalance: 0, hasPin: state.hasPin ?? false }) }
    if (path.endsWith("/dana-payment-status")) { state.paymentCalls++; return ok({ status: state.paymentStatus || "UNKNOWN" }) }
    if (path.endsWith("/users/me") || path.endsWith("/users/me/profile") || path.endsWith("/profile/me")) return ok(user)
    if (path.endsWith("/showcase/feed")) return ok({ items: [work], hasMore: false, nextCursor: null, limit: 20, sort: "latest" })
    if (path.endsWith("/showcase/fixture-work/like")) { state.likes++; return ok({ liked: true, likeCount: 5 }) }
    if (path.endsWith("/showcase/fixture-work/comments")) return ok({ items: [], data: [], total: 0, page: 1, limit: 20, hasNext: false })
    if (path.endsWith("/showcase/fixture-work")) return ok(work)
    if (path.endsWith("/ratings")) return ok({ items: [], data: [], total: 0, page: 1, limit: 20, distribution: { "1": 0, "2": 0, "3": 0, "4": 1, "5": 1 }, averageRating: 4.5 })
    if (path.endsWith("/chat/rooms/fixture-room/messages")) return ok({ items: Array.from({ length: 35 }, (_, i) => ({ id: `qa-message-${i}`, messageType: "TEXT", content: `Pesan fixture ${i}`, fromUser: false, senderId: "fixture-owner", createdAt: new Date(Date.parse("2026-10-02T01:00:00Z") + i * 60000).toISOString() })), nextCursor: null })
    if (path.endsWith("/chat/rooms/fixture-room")) return ok({ id: "fixture-room", unreadCount: 0, roomType: "INQUIRY", updatedAt: work.updatedAt, otherUser: { userId: "fixture-owner", username: "fixture_seller", fullName: "Fixture Seller", isOnline: true } })
    return ok({})
  })
  try {
    await page.goto(`${base}${authenticated ? `/login?next=${encodeURIComponent(target)}` : target}`)
    if (authenticated) { await page.locator("input").nth(0).fill("fixture_user"); await page.locator("input").nth(1).fill("test-password"); await page.getByRole("button", { name: "Masuk", exact: true }).click() }
    await callback(page, state)
    expect(errors).toEqual([])
    results.push({ name, passed: true }); console.log(`PASS ${name}`)
  } catch (error) {
    results.push({ name, passed: false, error: error.message }); console.error(`FAIL ${name}: ${error.message.slice(0, 600)}`)
    await page.screenshot({ path: resolve(artifacts, `${results.length}-failure.png`) }).catch(() => {})
  } finally { await context.close() }
}
try {
  await check("A6 phone login stays collapsed", "/login?method=phone", false, async page => {
    await expect(page.locator("input")).toHaveCount(2); await page.getByRole("button", { name: "Masuk dengan WhatsApp", exact: true }).click(); await expect(page.locator("input")).toHaveCount(3)
  })
  await check("A5 missing migration token has an exit", "/phone-migration", false, async page => {
    await expect(page.getByText("Sesi migrasi tidak valid. Silakan masuk kembali.", { exact: true })).toBeVisible(); await page.getByRole("link", { name: "Kembali ke Masuk" }).click(); await expect(page).toHaveURL(/\/login$/)
  })
  await check("A1 forged success without ID remains unknown", "/payment/finish?status=success", true, async (page, state) => {
    await expect(page.getByText("Status pembayaran belum diketahui", { exact: true })).toBeVisible(); await expect(page.getByRole("button", { name: "Cek status di Transaksi" })).toBeVisible(); expect(state.paymentCalls).toBe(0); await expect(page.getByText("Pembayaran berhasil", { exact: true })).toHaveCount(0)
  })
  await check("A1 unknown backend status has API retry", "/payment/finish?orderId=fixture-order&status=success", true, async (page, state) => {
    await expect(page.getByText("Status pembayaran belum diketahui", { exact: true })).toBeVisible(); await page.getByRole("button", { name: "Cek status pembayaran" }).click(); await expect.poll(() => state.paymentCalls).toBe(2)
  }, { paymentStatus: "NOT_RECOGNIZED" })
  await check("A1 API overrides forged redirect", "/payment/finish?orderId=fixture-order&status=failed", true, async page => { await expect(page.getByText("Pembayaran berhasil", { exact: true })).toBeVisible() }, { paymentStatus: "SUCCESS" })
  await check("B5 Appearance scrolls on small viewport", "/appearance", true, async page => {
    await expect(page.getByText("Ukuran teks", { exact: true })).toBeVisible()
    const scroller = await page.getByText("Contoh judul label", { exact: true }).evaluate(node => { for (let el = node.parentElement; el; el = el.parentElement) if (["auto", "scroll"].includes(getComputedStyle(el).overflowY) && el.scrollHeight > el.clientHeight) { const result = { height: el.clientHeight, content: el.scrollHeight }; el.scrollTop = el.scrollHeight; return result }; return null })
    expect(scroller?.content).toBeGreaterThan(scroller?.height || Infinity); await expect(page.getByText("Contoh judul label", { exact: true })).toBeInViewport(); await page.getByRole("button", { name: "Perbesar ukuran teks" }).click(); await expect(page.getByText("105%", { exact: true })).toBeVisible()
  })
  await check("B1 legacy route redirects to unified settings", "/notification-settings", true, async page => {
    await expect(page.getByText("Perangkat ini", { exact: true })).toBeVisible(); await expect(page.getByText("Server", { exact: true })).toBeVisible(); await expect(page).toHaveURL(/\/notification-preferences$/); await expect(page.getByRole("switch", { name: "Chat", exact: true })).toBeVisible()
  })
  await check("B1 local section survives server failure", "/notification-preferences", true, async page => {
    await expect(page.getByText("Perangkat ini", { exact: true })).toBeVisible(); await page.getByRole("switch", { name: "Chat", exact: true }).click(); await expect(page.getByRole("button", { name: "Coba lagi", exact: true })).toBeVisible()
  }, { preferencesError: true })
  for (const hasPin of [false, true]) {
    let release; const gate = new Promise(done => { release = done })
    await check(`B6 neutral PIN title -> hasPin=${hasPin}`, "/change-pin", true, async page => {
      await expect(page.getByRole("heading", { name: "PIN dompet", exact: true })).toBeVisible(); await expect(page.getByRole("heading", { name: "Ubah PIN", exact: true })).toHaveCount(0); release(); await expect(page.getByRole("heading", { name: hasPin ? "Ubah PIN" : "Buat PIN", exact: true })).toBeVisible()
    }, { hasPin, walletGate: gate }); release()
  }
  await check("B13 confirmation reachable in keyboard-sized viewport", "/two-factor", true, async page => {
    await page.getByRole("button", { name: "Buat ulang kode", exact: true }).click(); await expect(page.locator('input[type="password"]')).toBeVisible(); await page.setViewportSize({ width: 390, height: 360 }); const confirm = page.getByRole("button", { name: "Buat Kode Baru", exact: true }); await confirm.scrollIntoViewIfNeeded(); await expect(confirm).toBeInViewport(); const box = await confirm.boundingBox(); expect(box.y + box.height).toBeLessThanOrEqual(361)
  })
  await check("B8/B2 WhatsApp -> OTP rejection preserves code", "/login?method=phone", false, async (page, state) => {
    await page.getByRole("button", { name: "Masuk dengan WhatsApp", exact: true }).click(); await page.locator("input").nth(2).fill("81234567890"); await page.getByRole("button", { name: "Minta kode verifikasi" }).click(); await expect(page.getByText("abc123def456", { exact: true })).toBeVisible(); state.triggerSent = true; await page.getByRole("button", { name: "Saya sudah kirim pesan" }).click(); const input = page.locator('input[inputmode="numeric"]').first(); await expect(page).toHaveURL(/\/verify-otp$/); await input.fill("123456"); await page.getByRole("button", { name: "Verifikasi", exact: true }).click(); await expect(page.getByText(/Kode salah atau sudah kedaluwarsa/)).toBeVisible(); await expect(input).toHaveValue("123456")
  })
  await check("B7/B11/B12 chat focus geometry, scroll and searches", "/chat/fixture-room", true, async page => {
    const input = page.getByRole("textbox", { name: "Tulis pesan", exact: true }); await expect(input).toBeVisible()
    const geometry = () => input.evaluate(node => { const box = node.parentElement, rect = box.getBoundingClientRect(), style = getComputedStyle(box); return { height: rect.height, width: rect.width, padding: style.paddingLeft, border: style.borderTopWidth } })
    await page.getByRole("button", { name: "Cari pesan termuat", exact: true }).focus(); const before = await geometry(); await input.focus(); await input.fill("Draft tetap tersimpan"); expect(await geometry()).toEqual(before); await page.mouse.wheel(0, -400); await expect(input).toBeFocused(); await expect(input).toHaveValue("Draft tetap tersimpan")
    await page.getByRole("button", { name: "Cari pesan termuat", exact: true }).click(); await expect(page.getByPlaceholder("Cari pesan termuat", { exact: true })).toBeVisible(); await page.getByRole("button", { name: "Tutup pencarian", exact: true }).click(); await page.getByRole("button", { name: "Opsi percakapan", exact: true }).click(); await expect(page.getByText("Cari semua pesan", { exact: true })).toBeVisible(); await expect(page.getByText("Telusuri seluruh riwayat di server", { exact: true })).toBeVisible()
  })
  for (const mode of ["pointer", "touch"]) await check(`B14/C1 ${mode} cross-modal like once, no inline follow`, "/showcase?kind=latest", true, async (page, state) => {
    const surface = page.getByRole("button", { name: "Lihat foto 1 dari 2", exact: true }); await expect(surface).toBeVisible(); await expect(page.getByRole("button", { name: "Ikuti", exact: true })).toHaveCount(0)
    const box = await surface.boundingBox(), x = box.x + box.width / 2, y = box.y + box.height / 2
    const tap = () => mode === "touch" ? page.touchscreen.tap(x, y) : page.mouse.click(x, y)
    await tap(); await page.getByRole("button", { name: "Tutup pratinjau", exact: true }).waitFor({ state: "visible" }); await tap(); await expect.poll(() => state.likes).toBe(1)
  })
  await check("B3 mixed-media original index; stable video player", "/showcase?kind=latest", true, async page => {
    await page.getByRole("button", { name: "Lihat video: Karya fixture", exact: true }).click(); await expect(page.getByRole("button", { name: "Tutup pratinjau", exact: true })).toBeVisible(); const video = page.locator('video[src*="batch3-qa.mp4"]').last(); await expect(video).toBeVisible(); const playerView = await video.elementHandle(); await expect(page.getByRole("button", { name: "Putar/jeda video", exact: true })).toBeVisible(); expect(await playerView.evaluate(node => node.isConnected)).toBe(true)
  })
  await check("B4 guest report is login-only", "/showcase/fixture-work", false, async page => {
    await page.getByRole("button", { name: "Laporkan", exact: true }).click(); await expect(page.getByRole("button", { name: "Masuk untuk melaporkan", exact: true })).toBeVisible(); await expect(page.getByText("Alasan Laporan", { exact: true })).toHaveCount(0); await expect(page.getByRole("radio")).toHaveCount(0)
  })
} finally { await browser.close(); await writeFile(resolve(artifacts, "results.json"), JSON.stringify(results, null, 2)) }
console.log(`${results.filter(row => row.passed).length}/${results.length} browser checks passed`)
if (results.some(row => !row.passed)) process.exitCode = 1
