/**
 * Kahade — generator aset brand (app icon, adaptive icon, splash).
 *
 * Jalankan: npm run gen:brand   (butuh sharp: `npm i --no-save sharp`)
 *
 * sharp SENGAJA tidak masuk package.json: ia paket native ~100 MB dan skrip ini
 * hanya jalan saat logo berubah. PNG hasilnya di-commit, jadi CI dan build
 * tidak pernah membutuhkannya.
 *
 * ── Kenapa semua ukuran dihitung dari BOUNDING BOX TINTA, bukan dari kanvas ──
 *
 * assets/brand/logo.svg punya viewBox 1024x1024, tetapi tintanya hanya mengisi
 * 77,5% dari kotak itu DAN tidak berada di tengah — margin atas 8,4% sedangkan
 * bawah 14,7%. Kalau ikon dibuat dengan sekadar men-scale seluruh viewBox,
 * hasilnya logo yang terlihat naik ke atas dan padding tepi yang tidak sama di
 * empat sisi. Itulah yang membuat ikon terasa "miring" atau "kepotong".
 * Maka: ukur tinta dulu, lalu tempatkan tinta itu sendiri di pusat kanvas.
 *
 * ── Safe zone Android (kenapa logonya jauh lebih kecil dari ikon iOS) ──
 *
 * Adaptive icon punya kanvas foreground 108dp, tetapi launcher bebas memakai
 * mask apa pun (lingkaran, squircle, rounded square, teardrop). Yang DIJAMIN
 * selalu terlihat hanyalah lingkaran diameter 66dp di tengah.
 *
 * Diukur dari logo ini: radius tinta terjauh dari pusat = 99,8% dari radius
 * sudut bounding box-nya — artinya bentuknya memang mengisi sudut, tidak ada
 * ruang gratis. Jadi agar tidak pernah terpotong oleh mask lingkaran, seluruh
 * tinta harus muat DI DALAM lingkaran 66dp itu:
 *
 *     radius_tinta <= (66/108) * kanvas / 2
 *
 * Untuk logo persegi, itu memberi lebar tinta ~46,9dp dari 108dp (43,5%
 * kanvas). Terlihat kecil dibanding ikon iOS, dan itu wajar: 46,9dp adalah
 * ~65% dari area 72dp yang benar-benar tampak setelah masking, sejalan dengan
 * keyline Material. Memperbesarnya berarti menerima logo terpotong di sebagian
 * launcher.
 *
 * ── iOS ──
 *
 * iOS menerapkan mask squircle sendiri ke ikon 1024x1024, jadi PNG-nya harus
 * persegi penuh tanpa sudut membulat buatan dan TANPA alpha (App Store menolak
 * ikon ber-alpha). Padding 9% dari tepi menjaga tinta tidak menyentuh area
 * yang dipangkas mask.
 */
import { existsSync, mkdirSync } from "node:fs"
import { dirname } from "node:path"

let sharp
try {
  sharp = (await import("sharp")).default
} catch {
  console.error("gen:brand butuh sharp. Jalankan: npm i --no-save sharp")
  process.exit(1)
}

/* Warna diambil dari token yang SUDAH ada — tidak ada hex baru di file ini.
   `brand.black` / `brand.white` (lib/tokens.ts §2.1) dipilih, bukan
   `light.primary`, karena ikon & splash konstan di light maupun dark: ia tidak
   boleh ikut ter-invert seperti token per-mode. */
import { fileURLToPath } from "node:url"
import { join } from "node:path"
const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const { brand } = await import(join(root, "lib/tokens.ts"))
const BG = brand.black

const SRC_WHITE = "assets/brand/logo-white.svg"
const OUT_DIR = "assets/images"

/** Resolusi kerja untuk mengukur & memotong tinta. Tinggi supaya downscale ke
 *  ukuran target selalu berupa pengecilan (tajam), bukan pembesaran (blur). */
const WORK = 4096

/** Ambang alpha: piksel di bawah ini dianggap anti-alias, bukan tinta. */
const ALPHA_MIN = 8

async function renderWork() {
  return sharp(SRC_WHITE, { density: 600, limitInputPixels: false })
    .resize(WORK, WORK, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()
}

async function inkBox(pngBuffer) {
  const { data, info } = await sharp(pngBuffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: w, height: h } = info
  let minX = w, minY = h, maxX = -1, maxY = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > ALPHA_MIN) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  const box = { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  let maxR = 0
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (data[(y * w + x) * 4 + 3] > ALPHA_MIN) {
        const r = Math.hypot(x - cx, y - cy)
        if (r > maxR) maxR = r
      }
    }
  }
  return { ...box, maxR }
}

/**
 * Tempatkan tinta di tengah kanvas dengan lebar tinta = `inkWidth` px.
 * Tinta dipotong dulu dari render kerja, jadi yang dipusatkan adalah tinta
 * itu sendiri — bukan viewBox yang isinya memang tidak simetris.
 */
async function composeCentered({ work, ink, canvas, inkWidth, background }) {
  const scale = inkWidth / ink.width
  const targetW = Math.round(ink.width * scale)
  const targetH = Math.round(ink.height * scale)

  const mark = await sharp(work)
    .extract({ left: ink.left, top: ink.top, width: ink.width, height: ink.height })
    .resize(targetW, targetH, { fit: "fill", kernel: "lanczos3" })
    .png()
    .toBuffer()

  let base = sharp({
    create: {
      width: canvas,
      height: canvas,
      channels: 4,
      background: background ?? { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([
    {
      input: mark,
      left: Math.round((canvas - targetW) / 2),
      top: Math.round((canvas - targetH) / 2),
    },
  ])

  return { pipeline: base, targetW, targetH, scale }
}

function report(name, canvas, w, h, extra = "") {
  const pct = ((w / canvas) * 100).toFixed(2)
  console.log(`  ${name.padEnd(34)} kanvas ${canvas}  tinta ${w}x${h} (${pct}%)  ${extra}`)
}

async function main() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })
  const work = await renderWork()
  const ink = await inkBox(work)

  console.log("Tinta terukur pada render kerja " + WORK + "px:")
  console.log(
    `  bbox ${ink.width}x${ink.height} di (${ink.left},${ink.top})  radius maks ${ink.maxR.toFixed(1)}`,
  )
  console.log()
  console.log("Menulis aset:")

  /* 1. iOS / ikon utama — 1024, latar hitam solid, TANPA alpha, padding 9%. */
  {
    const canvas = 1024
    const padding = 0.09
    const inkWidth = Math.round(canvas * (1 - 2 * padding))
    const { pipeline, targetW, targetH } = await composeCentered({
      work,
      ink,
      canvas,
      inkWidth,
      background: BG,
    })
    await pipeline.flatten({ background: BG }).removeAlpha().png().toFile(`${OUT_DIR}/icon.png`)
    report("icon.png (iOS + fallback)", canvas, targetW, targetH, `padding ${(padding * 100).toFixed(0)}%`)
  }

  /* 2. Android adaptive foreground — tinta muat penuh di lingkaran aman 66dp.
   *    SAFE_MARGIN menyisakan 4% jarak ke garis batas. Tanpa itu tinta
   *    menyentuh persis tepi lingkaran, dan anti-aliasing saja sudah cukup
   *    untuk membuatnya melewati batas — qa:icon menolak headroom 0%. */
  {
    const canvas = 1024
    const SAFE_MARGIN = 0.96
    const safeR = (66 / 108) * (canvas / 2) * SAFE_MARGIN
    const scale = safeR / ink.maxR
    const inkWidth = Math.round(ink.width * scale)
    const { pipeline, targetW, targetH } = await composeCentered({ work, ink, canvas, inkWidth })
    await pipeline.png().toFile(`${OUT_DIR}/adaptive-icon.png`)
    const dp = ((targetW / canvas) * 108).toFixed(1)
    report("adaptive-icon.png (foreground)", canvas, targetW, targetH, `${dp}dp / 108dp, safe circle 66dp`)
  }

  /* 3. Splash — kanvas SPLASH_CANVAS_SCALE x kotak logo.
   *
   *    Android 12+ menggambar windowSplashScreenAnimatedIcon pada 288dp DAN
   *    memasking apa pun di luar lingkaran 192dp di tengahnya (dokumentasi
   *    Android: "App icon without an icon background: 288x288 dp and fit
   *    within a circle 192 dp in diameter. Everything outside the circle
   *    turns invisible"). `imageWidth` di app.json TIDAK mengubah ini —
   *    diuji: imageWidth 72 maupun 200 sama-sama menghasilkan drawable 288dp.
   *    Jadi kalau logo digambar memenuhi kanvas, ia akan terpotong lingkaran.
   *
   *    Maka logo ditempatkan pada 1/SPLASH_CANVAS_SCALE kanvas, meniru persis
   *    kotak <LogoMark size={LOGO_SIZE}> di <AnimatedSplash>. Dengan
   *    imageWidth = LOGO_SIZE * SPLASH_CANVAS_SCALE, tinta tampil pada ukuran
   *    dp yang identik di splash native (iOS & Android) dan di overlay JS —
   *    logo tidak melompat saat serah terima, dan jauh di dalam lingkaran
   *    192dp. Framing dalam kotak sengaja dibiarkan apa adanya (bukan
   *    dipusatkan ke tinta) supaya sama persis dengan <LogoMark>. */
  {
    const canvas = 2048
    const SPLASH_CANVAS_SCALE = 4
    const box = canvas / SPLASH_CANVAS_SCALE
    const logo = await sharp(SRC_WHITE, { density: 600, limitInputPixels: false })
      .resize(box, box, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer()
    await sharp({
      create: { width: canvas, height: canvas, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([{ input: logo, left: (canvas - box) / 2, top: (canvas - box) / 2 }])
      .png()
      .toFile(`${OUT_DIR}/splash-icon.png`)
    const inkPx = Math.round(ink.width * (box / WORK))
    report("splash-icon.png", canvas, inkPx, Math.round(ink.height * (box / WORK)),
      `kotak logo 1/${SPLASH_CANVAS_SCALE} kanvas, imageWidth harus ${72 * SPLASH_CANVAS_SCALE}`)
  }

  console.log()
  console.log("Selesai. Jalankan `npm run qa:icon` untuk pratinjau mask Android + iOS.")
}

await main()
