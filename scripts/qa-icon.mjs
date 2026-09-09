/**
 * Kahade — QA ikon: buktikan logo tidak terpotong oleh mask launcher mana pun.
 *
 * Jalankan: npm run qa:icon   (butuh sharp: `npm i --no-save sharp`)
 *
 * Ini BUKAN sekadar bikin gambar pratinjau. Untuk tiap bentuk mask, skrip
 * menghitung berapa piksel tinta yang hilang setelah masking. Lolos = 0,00%.
 *
 * Detail yang gampang salah: mask Android TIDAK dikenakan ke seluruh kanvas
 * 108dp. Sistem menampilkan hanya 72dp di tengah (18dp tiap sisi dipakai untuk
 * parallax/masking), lalu mask diterapkan pada 72dp itu. Jadi QA harus
 * meng-crop bagian tengah 72/108 = 66,67% dulu, baru memasang mask. Menguji
 * mask pada kanvas penuh akan memberi rasa aman yang palsu.
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

let sharp
try {
  sharp = (await import("sharp")).default
} catch {
  console.error("qa:icon butuh sharp. Jalankan: npm i --no-save sharp")
  process.exit(1)
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const { brand } = await import(join(root, "lib/tokens.ts"))

const OUT = join(root, "assets/images/__qa__")
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true })

const S = 512 // ukuran render QA

/* ── Bentuk mask launcher ────────────────────────────────────────────────
   Dinyatakan sebagai path SVG pada kotak S x S. */
const superellipse = (n, r = S / 2) => {
  const pts = []
  for (let i = 0; i <= 720; i++) {
    const t = (i / 720) * 2 * Math.PI
    const c = Math.cos(t)
    const s = Math.sin(t)
    const x = r + Math.sign(c) * Math.abs(c) ** (2 / n) * r
    const y = r + Math.sign(s) * Math.abs(s) ** (2 / n) * r
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`)
  }
  return `<polygon points="${pts.join(" ")}"/>`
}

const MASKS = {
  circle: `<circle cx="${S / 2}" cy="${S / 2}" r="${S / 2}"/>`,
  squircle: superellipse(4),
  "rounded-square": `<rect width="${S}" height="${S}" rx="${S * 0.2}" ry="${S * 0.2}"/>`,
  /* Teardrop: tiga sudut membulat penuh, sudut kanan-bawah lancip. */
  teardrop:
    `<path d="M ${S / 2} 0 A ${S / 2} ${S / 2} 0 0 1 ${S} ${S / 2} L ${S} ${S} L ${S / 2} ${S} ` +
    `A ${S / 2} ${S / 2} 0 0 1 ${S / 2} 0 Z"/>`,
  square: `<rect width="${S}" height="${S}"/>`,
}

/** Mask iOS: superellipse kontinu, kira-kira n=5 pada ikon penuh. */
const IOS_MASK = superellipse(5)

const maskAlpha = async (shape) =>
  sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" fill="#fff">${shape}</svg>`))
    .resize(S, S)
    .png()
    .toBuffer()

/**
 * Terapkan bentuk mask ke sebuah gambar.
 *
 * Memakai composite blend "dest-in" (alpha tujuan dikalikan alpha sumber) —
 * bukan joinChannel(). joinChannel MENAMBAH band, tidak mengganti alpha:
 * hasilnya sharp membuang band tambahan itu (metadata jadi 3ch,
 * hasAlpha=false) sehingga mask TIDAK pernah terpasang, sementara seluruh
 * angka tetap melaporkan "0% tinta hilang" karena yang diukur gambar yang
 * belum ter-mask. Kegagalan senyap; hanya ketahuan dari pratinjau yang
 * sudutnya masih kotak. Verifikasi dest-in: alpha sudut 0, alpha tengah 255.
 */
const applyMask = async (img, mask) =>
  sharp(img).ensureAlpha().composite([{ input: mask, blend: "dest-in" }]).png().toBuffer()

/** Hitung piksel "tinta" (putih) pada RGBA raw. */
function countInk(data, w, h) {
  let n = 0
  for (let i = 0; i < w * h; i++) {
    const a = data[i * 4 + 3]
    const lum = (data[i * 4] + data[i * 4 + 1] + data[i * 4 + 2]) / 3
    if (a > 128 && lum > 128) n++
  }
  return n
}

async function inkOf(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return countInk(data, info.width, info.height)
}

let failures = 0
const row = (label, lost, note = "") => {
  const ok = lost < 0.0005
  if (!ok) failures++
  console.log(`  ${ok ? "PASS" : "GAGAL"}  ${label.padEnd(18)} tinta hilang ${(lost * 100).toFixed(3).padStart(7)}%  ${note}`)
}

console.log("\n=== ANDROID adaptive icon ===")
console.log("mask dikenakan pada 72dp tengah dari kanvas 108dp\n")

/* Foreground di atas background hitam solid, lalu crop ke 72dp tengah. */
const VISIBLE = 72 / 108
const fgFull = await sharp(join(root, "assets/images/adaptive-icon.png")).resize(1024, 1024).toBuffer()
const composed = await sharp({
  create: { width: 1024, height: 1024, channels: 4, background: brand.black },
})
  .composite([{ input: fgFull }])
  .png()
  .toBuffer()

const cropPx = Math.round(1024 * VISIBLE)
const off = Math.round((1024 - cropPx) / 2)
const visible = await sharp(composed)
  .extract({ left: off, top: off, width: cropPx, height: cropPx })
  .resize(S, S)
  .png()
  .toBuffer()

const baseInk = await inkOf(visible)

for (const [name, shape] of Object.entries(MASKS)) {
  const alpha = await maskAlpha(shape)
  const masked = await applyMask(visible, alpha)
  const ink = await inkOf(masked)
  row(name, (baseInk - ink) / baseInk)
  await sharp(masked)
    .flatten({ background: "#808080" })
    .png()
    .toFile(join(OUT, `android-${name}.png`))
}

/* Cek geometris tambahan: apakah seluruh tinta benar-benar di dalam
   lingkaran aman 66dp? (66/72 dari area yang tampak) */
{
  const { data, info } = await sharp(visible).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const c = info.width / 2
  const safeR = (66 / 72) * (info.width / 2)
  let maxR = 0
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4
      const lum = (data[i] + data[i + 1] + data[i + 2]) / 3
      if (data[i + 3] > 128 && lum > 128) {
        const r = Math.hypot(x - c, y - c)
        if (r > maxR) maxR = r
      }
    }
  }
  const ok = maxR <= safeR
  if (!ok) failures++
  console.log(
    `\n  ${ok ? "PASS" : "GAGAL"}  safe-zone 66dp     radius tinta ${maxR.toFixed(1)} / batas ${safeR.toFixed(1)} px` +
      `  (headroom ${(((safeR - maxR) / safeR) * 100).toFixed(1)}%)`,
  )
}

console.log("\n=== iOS icon ===\n")
{
  const icon = await sharp(join(root, "assets/images/icon.png")).resize(S, S).png().toBuffer()
  const baseIos = await inkOf(icon)
  const alpha = await maskAlpha(IOS_MASK)
  const masked = await applyMask(icon, alpha)
  row("squircle iOS", (baseIos - (await inkOf(masked))) / baseIos)
  await sharp(masked).flatten({ background: "#808080" }).png().toFile(join(OUT, "ios-squircle.png"))

  /* Alpha wajib tidak ada (App Store menolak ikon ber-alpha). */
  const meta = await sharp(join(root, "assets/images/icon.png")).metadata()
  const okAlpha = !meta.hasAlpha
  if (!okAlpha) failures++
  console.log(`  ${okAlpha ? "PASS" : "GAGAL"}  tanpa alpha        channels=${meta.channels} hasAlpha=${meta.hasAlpha}`)
  const okSize = meta.width === 1024 && meta.height === 1024
  if (!okSize) failures++
  console.log(`  ${okSize ? "PASS" : "GAGAL"}  ukuran 1024        ${meta.width}x${meta.height}`)
}

console.log("\n=== Splash ===\n")
{
  const splashPath = join(root, "assets/images/splash-icon.png")
  const meta = await sharp(splashPath).metadata()
  const okRes = meta.width >= 2000
  if (!okRes) failures++
  console.log(`  ${okRes ? "PASS" : "GAGAL"}  resolusi >= 2000   ${meta.width}x${meta.height}`)
  const okAlpha = meta.hasAlpha
  if (!okAlpha) failures++
  console.log(`  ${okAlpha ? "PASS" : "GAGAL"}  transparan         hasAlpha=${meta.hasAlpha}`)

  /* Android 12+ menggambar ikon splash pada kanvas 288dp lalu memasking apa
     pun di luar lingkaran 192dp (2/3) di tengah. Ini penyebab klasik "logo
     splash terpotong bulat" — dan tidak bisa dimatikan lewat imageWidth. */
  const { data, info } = await sharp(splashPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const c = info.width / 2
  const safeR = (192 / 288) * (info.width / 2)
  let maxR = 0
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > 8) {
        const r = Math.hypot(x - c, y - c)
        if (r > maxR) maxR = r
      }
    }
  }
  const okMask = maxR <= safeR
  if (!okMask) failures++
  console.log(
    `  ${okMask ? "PASS" : "GAGAL"}  mask 192dp A12+    radius tinta ${maxR.toFixed(1)} / batas ${safeR.toFixed(1)} px` +
      `  (headroom ${(((safeR - maxR) / safeR) * 100).toFixed(1)}%)`,
  )

  /* Ukuran tinta di splash native harus sama dengan di overlay JS. */
  const appJson = JSON.parse(readFileSync(join(root, "app.json"), "utf8"))
  const splashOpts = appJson.expo.plugins.find((p) => Array.isArray(p) && p[0] === "expo-splash-screen")?.[1]
  const tsx = readFileSync(join(root, "components/ui/animated-splash.tsx"), "utf8")
  const logoSize = Number(tsx.match(/const LOGO_SIZE = (\d+)/)?.[1])
  let minX = info.width, maxX = -1
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > 8) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
      }
    }
  }
  const inkFrac = (maxX - minX + 1) / info.width
  const nativeInkDp = inkFrac * splashOpts.imageWidth
  const jsInkDp = 0.7749 * logoSize // tinta = 77,49% dari viewBox <LogoMark>
  const okMatch = Math.abs(nativeInkDp - jsInkDp) < 1
  if (!okMatch) failures++
  console.log(
    `  ${okMatch ? "PASS" : "GAGAL"}  handoff native↔JS  tinta native ${nativeInkDp.toFixed(1)}dp vs overlay JS ${jsInkDp.toFixed(1)}dp`,
  )
}

/* Pratinjau splash pada layar 1080x2340 (xxhdpi, 360x780dp) — untuk memeriksa
   proporsi & ketajaman dengan mata, bukan hanya angka. */
{
  const W = 1080
  const H = 2340
  const DENSITY = 3 // xxhdpi
  const appJson = JSON.parse(readFileSync(join(root, "app.json"), "utf8"))
  const opts = appJson.expo.plugins.find((p) => Array.isArray(p) && p[0] === "expo-splash-screen")[1]
  const boxPx = opts.imageWidth * DENSITY
  const logo = await sharp(join(root, "assets/images/splash-icon.png"))
    .resize(boxPx, boxPx, { kernel: "lanczos3" })
    .png()
    .toBuffer()
  await sharp({ create: { width: W, height: H, channels: 4, background: brand.black } })
    .composite([{ input: logo, left: Math.round((W - boxPx) / 2), top: Math.round((H - boxPx) / 2) }])
    .png()
    .toFile(join(OUT, "splash-preview.png"))
  console.log(`\nPratinjau splash: assets/images/__qa__/splash-preview.png (${W}x${H}, logo ${boxPx}px)`)
}

/* Lembar kontak semua bentuk, untuk diperiksa mata. */
{
  const names = [...Object.keys(MASKS).map((n) => `android-${n}.png`), "ios-squircle.png"]
  const cell = 200
  const gap = 16
  const cols = names.length
  const sheet = sharp({
    create: {
      width: cols * cell + (cols + 1) * gap,
      height: cell + 2 * gap,
      channels: 4,
      background: "#808080",
    },
  })
  const tiles = await Promise.all(
    names.map(async (n, i) => ({
      input: await sharp(join(OUT, n)).resize(cell, cell).png().toBuffer(),
      left: gap + i * (cell + gap),
      top: gap,
    })),
  )
  await sheet.composite(tiles).png().toFile(join(OUT, "contact-sheet.png"))
  console.log(`\nPratinjau: assets/images/__qa__/contact-sheet.png (${names.join(", ")})`)
}

console.log(failures === 0 ? "\nSemua cek ikon LULUS.\n" : `\n${failures} cek GAGAL.\n`)
process.exit(failures === 0 ? 0 : 1)
