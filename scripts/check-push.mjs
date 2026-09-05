/**
 * Kahade — preflight push notification.
 *
 * Jalankan: npm run check:push
 * Juga berjalan OTOMATIS di EAS Build lewat npm script `eas-build-pre-install`.
 *
 * ── Kenapa skrip ini harus ada ──
 *
 * `google-services.json` placeholder memakai `package_name: id.kahade` supaya
 * plugin Gradle `com.google.gms.google-services` tidak menolaknya ("No matching
 * client found for package name"). Konsekuensinya build tetap SUKSES dengan
 * kredensial FCM palsu: aplikasi terpasang, tampak normal, dan push Android
 * diam-diam tidak pernah sampai. Kegagalan seperti itu baru ketahuan setelah
 * rilis, dari keluhan pengguna.
 *
 * Karena itu placeholder dideteksi di sini dan build DIHENTIKAN. Komentar di
 * dalam JSON tidak cukup — tidak ada yang membacanya saat rilis jam 2 pagi.
 *
 * Hanya memakai modul bawaan Node: hook `eas-build-pre-install` berjalan
 * SEBELUM `npm install`, jadi tidak boleh ada dependensi.
 *
 * Lolos sementara (mis. build UI yang tidak butuh push):
 *   KAHADE_ALLOW_PLACEHOLDER_FCM=1 npm run check:push
 */
import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const problems = []
const notes = []
const fail = (m) => problems.push(m)
const note = (m) => notes.push(m)

const app = JSON.parse(readFileSync(join(root, "app.json"), "utf8")).expo

/* ── 1. Android: berkas FCM ─────────────────────────────────────────────── */
const gsPath = app.android?.googleServicesFile
if (!gsPath) {
  fail("app.json: android.googleServicesFile belum diisi — push Android tidak akan bekerja")
} else if (!existsSync(join(root, gsPath))) {
  fail(`app.json: android.googleServicesFile menunjuk ${gsPath} yang tidak ada`)
} else {
  const raw = readFileSync(join(root, gsPath), "utf8")
  let gs
  try {
    gs = JSON.parse(raw)
  } catch {
    fail(`${gsPath}: bukan JSON yang valid`)
  }

  if (gs) {
    const isPlaceholder =
      "__KAHADE_PLACEHOLDER__" in gs ||
      /PLACEHOLDER/i.test(raw) ||
      gs.project_info?.project_number === "000000000000"

    if (isPlaceholder) {
      fail(
        `${gsPath} MASIH PLACEHOLDER — ganti dengan berkas asli dari Firebase Console.\n` +
          "         Build akan tetap sukses dengan berkas ini, tetapi push Android tidak akan pernah sampai.\n" +
          "         Firebase Console > Project settings > Your apps > Android (id.kahade) > google-services.json",
      )
    }

    // package_name WAJIB sama; kalau beda, plugin Gradle google-services
    // menggagalkan build dengan pesan yang tidak menyebut app.json sama sekali.
    const pkgs = (gs.client ?? []).map((c) => c.client_info?.android_client_info?.package_name)
    const want = app.android?.package
    if (want && pkgs.length && !pkgs.includes(want)) {
      fail(
        `${gsPath}: tidak ada client untuk package "${want}" (ditemukan: ${pkgs.join(", ") || "tidak ada"}).\n` +
          "         Gradle akan gagal dengan \"No matching client found for package name\".",
      )
    }
  }
}

/* ── 2. iOS: entitlement push ───────────────────────────────────────────── */
const aps = app.ios?.entitlements?.["aps-environment"]
if (!aps) {
  fail("app.json: ios.entitlements['aps-environment'] belum diisi — iOS akan kena ITMS-90078 saat submit")
} else if (aps !== "development" && aps !== "production") {
  fail(`app.json: aps-environment "${aps}" tidak valid (hanya "development" atau "production")`)
} else if (aps === "production") {
  // Bukan error, tetapi hampir selalu bukan yang diinginkan — lihat catatan
  // di docs/PUSH-NOTIFICATIONS.md.
  note(
    'aps-environment = "production": build development/simulator tidak akan menerima push ' +
      "(token sandbox vs endpoint produksi). Xcode sudah mempromosikannya sendiri saat archive.",
  )
}

/* ── 3. Plugin & izin ───────────────────────────────────────────────────── */
const plugins = app.plugins ?? []
const notif = plugins.find((p) => Array.isArray(p) && p[0] === "expo-notifications")?.[1]
if (!notif) {
  fail("app.json: plugin expo-notifications tanpa opsi — icon & color notifikasi tidak akan dipakai")
} else {
  if (!notif.icon) fail("app.json: expo-notifications tanpa `icon` — Android memakai ikon launcher (buram/kotak putih)")
  else if (!existsSync(join(root, notif.icon))) fail(`app.json: notification icon ${notif.icon} tidak ada`)
  if (!notif.defaultChannel) {
    fail("app.json: expo-notifications tanpa `defaultChannel` — notifikasi FCM tanpa channel_id bisa hilang di Android 8+")
  }
}

const perms = app.android?.permissions ?? []
if (!perms.includes("android.permission.POST_NOTIFICATIONS")) {
  fail("app.json: POST_NOTIFICATIONS tidak ada — Android 13+ tidak akan menampilkan notifikasi apa pun")
}

/* ── 4. Channel di kode harus cocok dengan defaultChannel di app.json ───── */
const pushSrc = readFileSync(join(root, "lib/push-notifications.ts"), "utf8")
const declared = [...pushSrc.matchAll(/^\s*(\w+):\s*"([\w-]+)",?\s*$/gm)]
  .filter(([, , v]) => /"/.test(`"${v}"`))
const channelBlock = pushSrc.match(/export const NOTIFICATION_CHANNELS = \{([\s\S]*?)\} as const/)
if (!channelBlock) {
  fail("lib/push-notifications.ts: NOTIFICATION_CHANNELS tidak ditemukan")
} else {
  const ids = [...channelBlock[1].matchAll(/"([\w-]+)"/g)].map((m) => m[1])
  if (notif?.defaultChannel && !ids.includes(notif.defaultChannel)) {
    fail(
      `app.json defaultChannel "${notif.defaultChannel}" tidak ada di NOTIFICATION_CHANNELS ` +
        `(${ids.join(", ")}) — FCM akan menunjuk channel yang tidak pernah dibuat dan notifikasi hilang`,
    )
  }
}

/* ── Hasil ──────────────────────────────────────────────────────────────── */
for (const n of notes) console.warn(`  CATATAN  ${n}`)

if (problems.length === 0) {
  console.log("check-push: OK — konfigurasi native push siap")
  process.exit(0)
}

const bypass = process.env.KAHADE_ALLOW_PLACEHOLDER_FCM === "1"
for (const p of problems) console.error(`  ${bypass ? "DIABAIKAN" : "GAGAL"}  ${p}`)

if (bypass) {
  console.warn("\ncheck-push: DILEWATI lewat KAHADE_ALLOW_PLACEHOLDER_FCM=1. Push TIDAK akan bekerja di build ini.")
  process.exit(0)
}
console.error(`\ncheck-push: ${problems.length} masalah. Lihat docs/PUSH-NOTIFICATIONS.md.`)
process.exit(1)
