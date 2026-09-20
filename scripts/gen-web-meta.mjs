/**
 * Add route-aware metadata to Expo's static web export.
 *
 * `app/+html.tsx` is shared by every route, while static export writes one
 * HTML document per route. This post-processing step keeps the metadata
 * generic and privacy-safe: it never fetches authenticated data or puts order
 * tokens, wallet values, usernames, or API responses into HTML.
 *
 * Run as part of `npm run build:web`, after `expo export` and before the
 * optional Firebase worker is generated.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const outDir = process.env.WEB_ROOT || join(root, "dist")
if (!existsSync(outDir)) throw new Error(`gen-web-meta: direktori ${outDir} tidak ada`)

const baseDescription =
  "Platform transaksi aman dengan escrow, dompet, dan penyelesaian pesanan dalam satu aplikasi."
const metadata = [
  { match: /^\/$/, title: "Kahade — Transaksi aman dengan escrow", description: baseDescription },
  { match: /^\/about\/?$/, title: "Tentang Kahade", description: "Kenali Kahade dan cara kami membantu transaksi berjalan lebih aman." },
  { match: /^\/contact\/?$/, title: "Hubungi Kahade", description: "Temukan kanal kontak dan bantuan resmi Kahade." },
  { match: /^\/faq\/?$/, title: "FAQ Kahade", description: "Jawaban atas pertanyaan umum tentang transaksi, escrow, dompet, dan keamanan Kahade." },
  { match: /^\/privacy-policy\/?$/, title: "Kebijakan Privasi Kahade", description: "Baca bagaimana Kahade mengelola data dan privasi pengguna." },
  { match: /^\/terms\/?$/, title: "Syarat dan Ketentuan Kahade", description: "Syarat dan ketentuan penggunaan layanan Kahade." },
  { match: /^\/help(?:\/|$)/, title: "Pusat Bantuan Kahade", description: "Panduan penggunaan Kahade dan jawaban atas kendala umum." },
  { match: /^\/order-link(?:\/|$)/, title: "Order Link — Kahade", description: "Buka tautan transaksi Kahade dengan aman." },
  { match: /^\/order(?:\/|$)/, title: "Detail order — Kahade", description: "Lihat detail order Kahade dan status escrow." },
  { match: /^\/user(?:\/|$)|^\/profile(?:\/|$)/, title: "Profil pengguna — Kahade", description: "Lihat profil publik pengguna Kahade." },
  { match: /^\/showcase(?:\/|$)/, title: "Showcase — Kahade", description: "Jelajahi showcase publik di Kahade." },
]
const canonicalRoutes = new Set(["/", "/about", "/contact", "/faq", "/privacy-policy", "/terms"])

function walk(dir) {
  const files = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...walk(full))
    else if (entry.isFile() && entry.name.endsWith(".html")) files.push(full)
  }
  return files
}

function routeFromFile(file) {
  const rel = relative(outDir, file).replaceAll("\\", "/")
  if (rel === "index.html") return "/"
  const withoutExtension = rel.replace(/\.html$/, "")
  return `/${withoutExtension.replace(/\/index$/, "")}`
}

function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
}

let changed = 0
for (const file of walk(outDir)) {
  const route = routeFromFile(file)
  const selected = metadata.find((item) => item.match.test(route))
  if (!selected) continue

  const title = escapeHtml(selected.title)
  const description = escapeHtml(selected.description)
  let html = readFileSync(file, "utf8")
  html = html.replace(/<title>[^<]*<\/title>/i, `<title>${title}</title>`)
  html = html.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/>/i,
    `<meta name="description" content="${description}" />`,
  )
  html = html.replace(
    /<meta\s+property="og:title"\s+content="[^"]*"\s*\/>/i,
    `<meta property="og:title" content="${title}" />`,
  )
  html = html.replace(
    /<meta\s+property="og:description"\s+content="[^"]*"\s*\/>/i,
    `<meta property="og:description" content="${description}" />`,
  )
  html = html.replace(
    /<meta\s+name="twitter:title"\s+content="[^"]*"\s*\/>/i,
    `<meta name="twitter:title" content="${title}" />`,
  )
  html = html.replace(
    /<meta\s+name="twitter:description"\s+content="[^"]*"\s*\/>/i,
    `<meta name="twitter:description" content="${description}" />`,
  )

  if (canonicalRoutes.has(route) && !html.includes('rel="canonical"')) {
    const canonical = `https://kahade.id${route === "/" ? "/" : route}`
    html = html.replace(
      "</head>",
      `  <link rel="canonical" href="${canonical}" />\n</head>`,
    )
    html = html.replace(
      "</head>",
      `  <meta property="og:url" content="${canonical}" />\n</head>`,
    )
  }

  writeFileSync(file, html)
  changed += 1
}

console.log(`gen-web-meta: OK — metadata diperbarui pada ${changed} dokumen static.`)
