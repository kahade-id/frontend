/**
 * Kahade — server preview untuk hasil `expo export --platform web`.
 *
 * Serve the real static export without Metro's per-request SSR overhead.
 * API calls still go to the configured HTTPS API, not to localhost in a user's browser.
 *
 * PENTING — server ini meniru Cloudflare Pages, bukan dev server SPA.
 *
 * Versi sebelumnya mengembalikan `index.html` untuk SEMUA path tanpa ekstensi.
 * Itu membuat preview terlihat sehat sementara produksi 404: Cloudflare Pages
 * tidak punya fallback semacam itu, ia menyajikan berkas statis lalu
 * menerapkan `_redirects`, dan selebihnya 404. Karena `expo export`
 * mengeluarkan rute dinamis sebagai berkas harfiah `order/[id].html`,
 * `/order/123` HANYA bekerja lewat aturan rewrite.
 *
 * Maka urutan resolusinya sengaja dibuat sama dengan Cloudflare:
 *   1. berkas persis            /foo.js
 *   2. berkas + .html           /wallet      -> wallet.html
 *   3. index di dalam folder    /docs        -> docs/index.html
 *   4. aturan dari _redirects   /order/123   -> order/[id].html   (200)
 *   5. 404
 *
 * `_headers` juga dibaca dari hasil export, sehingga `curl` lokal memberi
 * Content-Type yang sama dengan produksi — termasuk
 * apple-app-site-association yang tanpa aturan itu terkirim sebagai
 * application/octet-stream dan ditolak diam-diam oleh iOS.
 */
import { createServer } from "node:http"
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

const root = path.resolve(process.env.WEB_ROOT || "dist")
if (!existsSync(path.join(root, "index.html")))
  throw new Error("Web export missing. Run npm run build:web first.")

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
}

/* ── _redirects ──────────────────────────────────────────────────────────── */

/** [{ from: "/order/:id", to: "/order/[id].html", status: 200 }] — urut sesuai berkas. */
const redirectRules = (() => {
  const file = path.join(root, "_redirects")
  if (!existsSync(file)) return []
  return readFileSync(file, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.split(/\s+/))
    .filter((p) => p.length >= 2)
    .map(([from, to, status]) => ({ from, to, status: Number(status || 302) }))
})()

/**
 * Cocokkan pathname dengan aturan; kembalikan target dengan `:param` terisi.
 * Kecocokan PERTAMA menang — sama seperti Cloudflare.
 */
function matchRedirect(pathname) {
  const parts = pathname.split("/").filter(Boolean)
  for (const rule of redirectRules) {
    const from = rule.from.split("/").filter(Boolean)
    const splat = from[from.length - 1] === "*"
    if (!splat && from.length !== parts.length) continue
    if (splat && parts.length < from.length - 1) continue

    const params = {}
    let ok = true
    for (let i = 0; i < from.length; i++) {
      const f = from[i]
      if (f === "*") break
      if (f.startsWith(":")) {
        if (parts[i] === undefined) {
          ok = false
          break
        }
        params[f.slice(1)] = parts[i]
        continue
      }
      if (f !== parts[i]) {
        ok = false
        break
      }
    }
    if (!ok) continue

    let to = rule.to
    for (const [k, v] of Object.entries(params)) to = to.replace(`:${k}`, v)
    if (splat) to = to.replace(":splat", parts.slice(from.length - 1).join("/"))
    return { to, status: rule.status }
  }
  return null
}

/* ── _headers ────────────────────────────────────────────────────────────── */

/** [{ pattern: "/*", headers: { "X-Frame-Options": "DENY" } }] */
const headerRules = (() => {
  const file = path.join(root, "_headers")
  if (!existsSync(file)) return []
  const out = []
  let current = null
  for (const raw of readFileSync(file, "utf8").split("\n")) {
    if (!raw.trim() || raw.trim().startsWith("#")) continue
    if (!/^\s/.test(raw)) {
      current = { pattern: raw.trim(), headers: {} }
      out.push(current)
      continue
    }
    if (!current) continue
    const idx = raw.indexOf(":")
    if (idx === -1) continue
    current.headers[raw.slice(0, idx).trim()] = raw.slice(idx + 1).trim()
  }
  return out
})()

function headersFor(pathname) {
  const result = {}
  for (const rule of headerRules) {
    const p = rule.pattern
    const hit = p.endsWith("/*") ? pathname.startsWith(p.slice(0, -1)) : p === pathname
    if (hit) Object.assign(result, rule.headers)
  }
  return result
}

/* ── server ──────────────────────────────────────────────────────────────── */

const server = createServer((request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405)
    response.end()
    return
  }
  let pathname
  try {
    pathname = decodeURIComponent(new URL(request.url, "http://preview.invalid").pathname)
  } catch {
    response.writeHead(400)
    response.end()
    return
  }

  const resolve = (p) => {
    const candidate = path.resolve(root, "." + p)
    if (candidate !== root && !candidate.startsWith(root + path.sep)) return null
    return [candidate, candidate + ".html", path.join(candidate, "index.html")].find(
      (f) => existsSync(f) && statSync(f).isFile(),
    )
  }

  let target = resolve(pathname)
  let status = 200

  if (!target) {
    const rule = matchRedirect(pathname)
    if (rule) {
      if (rule.status === 301 || rule.status === 302) {
        response.writeHead(rule.status, { Location: rule.to })
        response.end()
        return
      }
      target = resolve(rule.to)
    }
  }

  // Tanpa fallback SPA: Cloudflare Pages juga 404 di sini. Menyembunyikannya
  // hanya memindahkan kegagalan ke produksi.
  if (!target) {
    const notFound = path.join(root, "+not-found.html")
    status = 404
    target = existsSync(notFound) ? notFound : null
    if (!target) {
      response.writeHead(404, { "Content-Type": "text/plain" })
      response.end("404")
      return
    }
  }

  const extension = path.extname(target)
  response.writeHead(status, {
    "Content-Type": types[extension] || "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control":
      extension === ".html"
        ? "no-cache"
        : /[a-f0-9]{16,}/.test(path.basename(target))
          ? "public, max-age=31536000, immutable"
          : "no-cache",
    ...headersFor(pathname),
  })
  if (request.method === "HEAD") response.end()
  else
    createReadStream(target)
      .on("error", () => response.destroy())
      .pipe(response)
})
server.listen(Number(process.env.PORT || 8081), "0.0.0.0", () =>
  console.log(`Kahade web preview on 0.0.0.0:${process.env.PORT || 8081}`),
)
