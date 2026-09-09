#!/usr/bin/env node
/**
 * Kahade — verifikasi endpoint terhadap backend HIDUP.
 *
 * `npm run check:api` membuktikan setiap pemanggilan adapter cocok dengan
 * method/path yang terdokumentasi. Tool itu sendiri menulis:
 * "This is NOT authenticated endpoint verification." Skrip ini menutup
 * celah tersebut: ia benar-benar mengirim request ke backend dan merekam
 * apa yang kembali.
 *
 * ── KESELAMATAN (baca sebelum menjalankan) ─────────────────────────────
 * Backend yang dituju bisa saja PRODUCTION. Karena itu:
 *
 *   1. Default HANYA `GET`. Tidak ada mutasi yang terkirim kecuali Anda
 *      menulis `--allow=post,put,patch` secara eksplisit.
 *   2. `DELETE` TIDAK PERNAH ikut walaupun `--allow=delete` ditulis,
 *      kecuali disertai `--i-know-this-is-destructive`.
 *   3. Endpoint yang ditandai berisiko di BLOCKLIST di bawah selalu
 *      dilewati, apa pun flag-nya.
 *
 * Jalankan terhadap backend lokal (`docker compose up` di repo backend)
 * kecuali Anda memang berniat memverifikasi production.
 *
 * ── CARA PAKAI ─────────────────────────────────────────────────────────
 *   export KAHADE_API_URL=http://localhost:3000
 *   export KAHADE_TOKEN=<access token>            # atau pakai --login
 *   node scripts/verify-live-api.mjs                        # GET saja
 *   node scripts/verify-live-api.mjs --login user pass      # login dulu
 *   node scripts/verify-live-api.mjs --allow=post           # + mutasi POST
 *   node scripts/verify-live-api.mjs --params fixtures.json # isi param manual
 *   node scripts/verify-live-api.mjs --out docs/audit/live-api.json
 *
 * ── PARAMETER PATH ─────────────────────────────────────────────────────
 * Banyak path butuh ID nyata (`/v1/orders/{orderId}`). Skrip mengumpulkannya
 * sendiri ("panen"): setiap respons JSON yang berhasil dipindai, nilai di
 * bawah kunci berbentuk `id` / `*Id` dicatat sebagai kandidat. Ini heuristik
 * — bila sebuah ID tidak ketemu, endpoint-nya ditandai `SKIP_PARAM`, bukan
 * dianggap gagal. Isi `--params` untuk menimpanya secara pasti.
 *
 * ── KELUAR ─────────────────────────────────────────────────────────────
 * Ringkasan per kelas status di stdout + rekaman lengkap (status, durasi,
 * kunci respons) ke `--out`. Exit 1 bila ada `ERROR` (5xx) atau `AUTH_FAIL`,
 * sehingga bisa dipasang di CI.
 */
import fs from "node:fs"
import path from "node:path"

// ------------------------------------------------------------------
// Argumen
// ------------------------------------------------------------------
const argv = process.argv.slice(2)
const opt = {
  allow: new Set(["get"]),
  destructive: false,
  params: {},
  out: null,
  login: null,
  concurrency: 4,
  only: null,
  verbose: false,
}
for (let i = 0; i < argv.length; i++) {
  const a = argv[i]
  if (a === "--allow") opt.allow = new Set(String(argv[++i]).toLowerCase().split(","))
  else if (a === "--i-know-this-is-destructive") opt.destructive = true
  else if (a === "--params") opt.params = JSON.parse(fs.readFileSync(argv[++i], "utf8"))
  else if (a === "--out") opt.out = argv[++i]
  else if (a === "--login") opt.login = [argv[++i], argv[++i]]
  else if (a === "--concurrency") opt.concurrency = Number(argv[++i])
  else if (a === "--only") opt.only = argv[++i]
  else if (a === "--verbose" || a === "-v") opt.verbose = true
  else if (a === "--help" || a === "-h") {
    console.log(fs.readFileSync(new URL(import.meta.url), "utf8").split("*/")[0].replace(/^\/\*\*/, ""))
    process.exit(0)
  } else {
    console.error(`Argumen tidak dikenal: ${a}`)
    process.exit(2)
  }
}

const BASE = (process.env.KAHADE_API_URL ?? "http://localhost:3000").replace(/\/+$/, "")
let TOKEN = process.env.KAHADE_TOKEN ?? ""

/**
 * Endpoint yang TIDAK BOLEH dipanggil otomatis apa pun flag-nya: menghapus
 * data, membatalkan transaksi, atau memicu pengiriman dana/OTP ke pihak ketiga.
 */
const BLOCKLIST = [
  /^DELETE /,
  /^POST \/v1\/wallet\/withdraw/,
  /^POST \/v1\/wallet\/topup/,
  /^POST \/v1\/auth\/2fa\/(disable|request-disable)/,
  /^POST \/v1\/users\/me\/avatar$/,
  /^POST \/v1\/subscriptions\/cancel/,
  /^POST \/v1\/orders\/links\/[^/]+\/cancel/,
  /^POST \/v1\/notifications\/(delete-read|unregister-device)/,
  /^POST \/v1\/upload\/cleanup/,
]

// ------------------------------------------------------------------
// Sumber operasi: spec mobile (terverifikasi sinkron dengan backend)
// ------------------------------------------------------------------
const SPEC_PATH = "docs/api/kahade-api-mobile.json"
if (!fs.existsSync(SPEC_PATH)) {
  console.error(`Spec tidak ditemukan: ${SPEC_PATH} — jalankan dari root repo frontend.`)
  process.exit(2)
}
const spec = JSON.parse(fs.readFileSync(SPEC_PATH, "utf8"))

/** Auth mode tiap adapter, dibaca dari lib/api/*.ts (bukan dari spec). */
function readAuthModes() {
  const modes = new Map()
  const dir = "lib/api"
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".ts")) continue
    const src = fs.readFileSync(path.join(dir, file), "utf8")
    const re = /http\.(get|post|put|patch|delete)\s*(?:<[^;]*?>)?\s*\(\s*[`"']([^`"']+)[`"'][\s\S]{0,240}?\)/g
    for (const m of src.matchAll(re)) {
      const method = m[1]
      const raw = m[2]
      const normalized = "/" + raw.replace(/^\//, "").replace(/\$\{[^}]*\}/g, "{X}")
      const am = m[0].match(/auth:\s*"(\w+)"/)
      modes.set(`${method} ${normalized}`, am ? am[1] : "optional")
    }
  }
  return modes
}
const AUTH = readAuthModes()

const VERBS = ["get", "post", "put", "patch", "delete"]
const operations = []
for (const [p, node] of Object.entries(spec.paths)) {
  for (const verb of VERBS) {
    if (!node[verb]) continue
    operations.push({
      method: verb,
      path: p,
      summary: node[verb].summary ?? node[verb].operationId ?? "",
      auth: AUTH.get(`${verb} /${p.replace(/^\//, "").replace(/\{[^}]*\}/g, "{X}")}`) ?? "?",
      bodyRequired: Boolean(node[verb].requestBody?.required),
      params: (node[verb].parameters ?? []).filter((q) => q.in === "path").map((q) => q.name),
    })
  }
}

// ------------------------------------------------------------------
// Panen ID dari respons list
// ------------------------------------------------------------------
const harvested = new Map() // nama param (lowercase) -> Set nilai
function harvest(value, keyPath = "") {
  if (Array.isArray(value)) {
    for (const v of value) harvest(v, keyPath)
    return
  }
  if (!value || typeof value !== "object") return
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === "string" && /^[A-Za-z0-9_-]{6,64}$/.test(v) && /(^|_)id$|Id$/i.test(k)) {
      const key = k.toLowerCase()
      if (!harvested.has(key)) harvested.set(key, new Set())
      harvested.get(key).add(v)
    }
    if (v && typeof v === "object") harvest(v, `${keyPath}.${k}`)
  }
}
/** Cari nilai untuk `{orderId}`: cocok persis dulu, lalu longgar lewat segmen path. */
function resolveParam(name, urlPath) {
  if (opt.params[name] !== undefined) return String(opt.params[name])
  const lower = name.toLowerCase()
  if (harvested.has(lower)) return [...harvested.get(lower)][0]
  // cocokkan dengan segmen path: {orderId} di /v1/orders/{orderId} -> panen "id"
  const seg = urlPath.split("/").filter(Boolean).slice(-2)[0] ?? ""
  const hint = seg.replace(/s$/, "").toLowerCase()
  for (const [k, set] of harvested) {
    if (k === "id" && hint && urlPath.toLowerCase().includes(hint)) return [...set][0]
  }
  if (harvested.has("id")) return [...harvested.get("id")][0]
  return null
}

// ------------------------------------------------------------------
// HTTP
// ------------------------------------------------------------------
async function request(method, url, body) {
  const started = Date.now()
  const headers = { accept: "application/json" }
  if (TOKEN) headers.authorization = `Bearer ${TOKEN}`
  if (body !== undefined) headers["content-type"] = "application/json"
  let status = 0
  let payload = null
  let text = ""
  try {
    const res = await fetch(url, {
      method: method.toUpperCase(),
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    status = res.status
    text = await res.text()
    try {
      payload = JSON.parse(text)
    } catch {
      payload = null
    }
  } catch (err) {
    return { status: 0, ms: Date.now() - started, error: String(err?.message ?? err), payload: null }
  }
  return { status, ms: Date.now() - started, payload, raw: payload ? undefined : text.slice(0, 200) }
}

function classify(op, res) {
  if (res.error) return "NETWORK"
  const s = res.status
  if (s >= 200 && s < 300) return "OK"
  if (s === 401 || s === 403) return "AUTH_FAIL"
  if (s === 404 && op.params.length) return "SKIP_PARAM" // id panen tidak cocok
  if (s === 404) return "NOT_FOUND"
  if (s === 400 || s === 422) return "BAD_REQUEST"
  if (s === 429) return "RATE_LIMITED"
  if (s >= 500) return "ERROR"
  return `HTTP_${s}`
}

async function login(user, pass) {
  const res = await request("post", `${BASE}/v1/auth/login`, {
    identifier: user,
    password: pass,
  })
  const token =
    res.payload?.accessToken ?? res.payload?.data?.accessToken ?? res.payload?.token ?? null
  if (!token) {
    console.error(`Login gagal (status ${res.status}). Isi KAHADE_TOKEN manual.`)
    console.error(JSON.stringify(res.payload ?? res.raw ?? res.error).slice(0, 400))
    process.exit(2)
  }
  TOKEN = token
  console.log("Login berhasil, token disimpan untuk sesi ini.\n")
}

// ------------------------------------------------------------------
// Jalankan
// ------------------------------------------------------------------
function isAllowed(op) {
  const key = `${op.method.toUpperCase()} ${op.path}`
  if (BLOCKLIST.some((re) => re.test(key))) return "BLOCKED"
  if (op.method === "delete" && !opt.destructive) return "BLOCKED"
  if (!opt.allow.has(op.method)) return "SKIPPED"
  return "RUN"
}

const results = []
async function runOne(op) {
  const verdict = isAllowed(op)
  if (verdict !== "RUN") {
    results.push({ ...op, verdict, status: null })
    return
  }
  const filled = []
  let url = op.path
  for (const name of op.params) {
    const v = resolveParam(name, op.path)
    if (!v) {
      results.push({ ...op, verdict: "SKIP_PARAM", status: null, missing: name })
      return
    }
    filled.push(`${name}=${v}`)
    url = url.replace(`{${name}}`, encodeURIComponent(v))
  }
  const body = op.bodyRequired ? (opt.params.__body?.[`${op.method} ${op.path}`] ?? {}) : undefined
  const res = await request(op.method, `${BASE}${url}`, body)
  if (res.payload) harvest(res.payload)
  const cls = classify(op, res)
  results.push({
    ...op,
    verdict: cls,
    status: res.status,
    ms: res.ms,
    filled,
    keys: res.payload && typeof res.payload === "object" ? Object.keys(res.payload).slice(0, 12) : undefined,
    error: res.error,
    snippet: res.raw,
  })
  if (opt.verbose || cls === "ERROR" || cls === "AUTH_FAIL") {
    console.log(`  ${cls.padEnd(11)} ${String(res.status).padEnd(4)} ${op.method.toUpperCase()} ${op.path}`)
  }
}

async function main() {
  console.log(`Backend : ${BASE}`)
  console.log(`Spec    : ${SPEC_PATH} (${operations.length} operasi)`
  )
  console.log(`Metode  : ${[...opt.allow].join(", ")}${opt.destructive ? " + DELETE" : ""}`)
  console.log("")

  if (opt.login) await login(opt.login[0], opt.login[1])
  else if (!TOKEN) console.log("PERINGATAN: tanpa token — endpoint terlindung akan 401.\n")

  const wanted = operations.filter((op) => !opt.only || op.path.includes(opt.only))

  /**
   * DUA FASE, dan ini penting. Kalau semua operasi dilepas bersamaan, endpoint
   * berparam (`/v1/orders/{orderId}`) bisa dieksekusi SEBELUM endpoint list
   * (`/v1/orders`) sempat dipanen — hasilnya SKIP_PARAM palsu yang seolah-olah
   * "ID tidak ada" padahal hanya urutannya salah. Jadi: selesaikan dulu semua
   * GET tanpa param (sumber ID), baru jalankan sisanya.
   */
  const rank = (o) => (o.method === "get" && o.params.length === 0 ? 0 : o.method === "get" ? 1 : 2)
  const phases = [wanted.filter((o) => rank(o) === 0), wanted.filter((o) => rank(o) !== 0)]

  async function runAll(queue) {
    let i = 0
    async function worker() {
      while (i < queue.length) {
        const op = queue[i++]
        await runOne(op)
      }
    }
    await Promise.all(Array.from({ length: Math.max(1, opt.concurrency) }, worker))
  }
  for (const phase of phases) await runAll(phase)

  // ── ringkasan
  const tally = new Map()
  for (const r of results) tally.set(r.verdict, (tally.get(r.verdict) ?? 0) + 1)
  console.log("\n── Ringkasan ─────────────────────────────")
  for (const [k, v] of [...tally].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(12)} ${v}`)
  }

  const problems = results.filter((r) => ["ERROR", "AUTH_FAIL", "NETWORK"].includes(r.verdict))
  if (problems.length) {
    console.log("\n── Perlu ditindak ────────────────────────")
    for (const p of problems.slice(0, 30)) {
      console.log(`  ${p.verdict.padEnd(10)} ${p.method.toUpperCase()} ${p.path} → ${p.status ?? p.error}`)
    }
  }

  const skipped = results.filter((r) => r.verdict === "SKIP_PARAM")
  if (skipped.length) {
    console.log(`\n${skipped.length} endpoint dilewati karena ID tidak ditemukan.`)
    console.log("Isi lewat --params, contoh:")
    const sample = {}
    for (const s of skipped.slice(0, 8)) for (const n of s.params) sample[n] = "<id>"
    console.log(`  ${JSON.stringify(sample)}`)
  }

  if (opt.out) {
    fs.mkdirSync(path.dirname(opt.out), { recursive: true })
    fs.writeFileSync(
      opt.out,
      JSON.stringify({ generatedAt: new Date().toISOString(), base: BASE, results }, null, 2) + "\n",
    )
    console.log(`\nRekaman: ${opt.out}`)
  }

  process.exit(problems.length ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(2)
})
