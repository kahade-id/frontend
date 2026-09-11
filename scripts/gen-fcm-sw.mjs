/**
 * Kahade — bundle service worker FCM Web ke hasil export statis.
 *
 * Jalankan: otomatis sebagai bagian `npm run build:web`
 *   (expo export --platform web && node scripts/gen-fcm-sw.mjs)
 *
 * ── Kenapa skrip ini harus ada ──
 *
 * FCM Web mewajibkan service worker di ROOT scope (`/firebase-messaging-sw.js`).
 * `expo export` hanya menyalin `public/` apa adanya tanpa memprosesnya, jadi
 * config Firebase (yang hidup di environment build) tidak bisa di-inject ke
 * berkas statis. Skrip ini membundle `fcm-sw.template.mjs` + package `firebase`
 * dengan esbuild langsung ke `dist/`, dengan config di-inline via `define`.
 *
 * Perilaku tanpa env Firebase Web: LEWATI dengan pesan yang jelas (exit 0).
 * Build Cloudflare TIDAK BOLEH gagal hanya karena web push belum
 * dikonfigurasi — app-side (`lib/web-push.web.ts`) mendeteksi hal yang sama
 * dan menonaktifkan push dengan anggun. Kegagalan di sini berarti konfigurasi
 * salah (bukan belum ada), dan itu memang harus menggagalkan build.
 */
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { buildSync } from "esbuild"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const outDir = process.env.WEB_ROOT || join(root, "dist")

const required = {
  apiKey: "EXPO_PUBLIC_FIREBASE_API_KEY",
  authDomain: "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
  projectId: "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
  storageBucket: "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  appId: "EXPO_PUBLIC_FIREBASE_APP_ID",
}
// VAPID dipakai app-side (getToken), bukan SW — tapi keduanya harus ada
// bersamaan; VAPID hilang = konfigurasi setengah jadi = peringatkan keras.
const vapidVar = "EXPO_PUBLIC_FIREBASE_VAPID_KEY"

const missing = Object.values(required).filter((name) => !(process.env[name] ?? "").trim())
if (missing.length > 0) {
  if (missing.length < Object.keys(required).length) {
    console.error(
      `gen-fcm-sw: GAGAL — konfigurasi Firebase Web setengah jadi, belum diisi: ${missing.join(", ")}.\n` +
        "         Isi semuanya (lihat .env.example) atau kosongkan semuanya untuk menonaktifkan web push.",
    )
    process.exit(1)
  }
  console.log(
    "gen-fcm-sw: dilewati — env Firebase Web tidak diisi, web push nonaktif di build ini.",
  )
  process.exit(0)
}
if (!(process.env[vapidVar] ?? "").trim()) {
  console.error(
    `gen-fcm-sw: GAGAL — ${vapidVar} belum diisi (dibutuhkan getToken di app).\n` +
      "         Firebase Console > Project settings > Cloud Messaging > Web Push certificates.",
  )
  process.exit(1)
}

/* ── Validasi silang: projectId web vs google-services.json ─────────────── */
const webProject = (process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "").trim()
try {
  const gsPath = join(root, "google-services.json")
  if (existsSync(gsPath)) {
    const nativeProject = JSON.parse(readFileSync(gsPath, "utf8")).project_info?.project_id
    if (nativeProject && nativeProject !== webProject) {
      console.error(
        `gen-fcm-sw: GAGAL — EXPO_PUBLIC_FIREBASE_PROJECT_ID ("${webProject}") berbeda dengan ` +
          `google-services.json project_id ("${nativeProject}"). Web dan native harus satu project Firebase.`,
      )
      process.exit(1)
    }
  }
} catch (err) {
  if (err instanceof SyntaxError) {
    console.error("gen-fcm-sw: GAGAL — google-services.json bukan JSON valid.")
    process.exit(1)
  }
  throw err
}

const firebaseConfig = Object.fromEntries(
  Object.entries(required).map(([key, name]) => [key, (process.env[name] ?? "").trim()]),
)

if (!existsSync(outDir)) {
  console.error(`gen-fcm-sw: GAGAL — direktori ${outDir} tidak ada. Jalankan expo export dulu.`)
  process.exit(1)
}

buildSync({
  entryPoints: [join(root, "scripts/fcm-sw.template.mjs")],
  bundle: true,
  minify: true,
  format: "iife",
  platform: "browser",
  target: ["es2020"],
  define: { __FCM_CONFIG__: JSON.stringify(firebaseConfig) },
  outfile: join(outDir, "firebase-messaging-sw.js"),
  logLevel: "warning",
})

console.log("gen-fcm-sw: OK — dist/firebase-messaging-sw.js ditulis.")
