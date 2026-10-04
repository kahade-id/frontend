/**
 * Guard native permission scope against dead feature configuration.
 *
 * This is intentionally a small policy check, not a replacement for device
 * testing. Expo config plugins may add the minimum permission required by a
 * feature (for example image-picker adds camera/photo access); the check only
 * rejects capabilities with no active frontend entry point.
 *
 * Sejak 2026-10-04 skrip ini juga memeriksa arah sebaliknya — lihat blok
 * "izin fitur aktif: siapa yang memasok, siapa yang memblokir" di bawah:
 * daftar deklarasi di app.json TIDAK bisa menambal izin yang dihapus plugin
 * lain lewat `tools:node="remove"`, jadi yang diperiksa adalah pemasok dan
 * pemblokir izin, bukan hanya isi daftar.
 */
import { existsSync, readFileSync } from "node:fs"

const app = JSON.parse(readFileSync(new URL("../app.json", import.meta.url), "utf8")).expo
const plugins = app.plugins.map((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin))
const problems = []

// expo-location DICABUT dari daftar larangan (auth-rework 2026-09-26):
// pencatatan lokasi presisi saat login/registrasi/reset-password adalah entry
// point aktif (lib/location.ts → getAuthLocation, dipanggil semua endpoint
// auth). Izin lokasi = bagian dari kontrak keamanan akun, bukan dead config.
// expo-camera DICABUT dari daftar larangan (fix build production 2026-10-01):
// pemindai QR adalah entry point aktif (components/scan-screen.tsx →
// CameraView/useCameraPermissions/scanFromURLAsync, dirute dari
// app/scan.tsx; tombol QR di bottom navbar). Guard ini sempat menggagalkan
// build production karena hanya mencocokkan nama plugin tanpa memverifikasi
// pemakaian aktual.
// expo-audio DICABUT dari daftar larangan (upgrade SDK 58, 2026-10-03):
// voice note chat adalah entry point aktif — perekam dirender di
// components/screens/chat-room-screen.tsx (<VoiceNoteRecorder>) dan pemutarnya
// di components/ui/chat-message-row.tsx (<VoiceNotePlayer>), keduanya memakai
// useAudioRecorder/useAudioPlayer dari expo-audio. Sebelumnya guard ini lolos
// hanya karena audio berjalan lewat expo-av (kini dihapus di SDK 58); kasus ini
// persis seperti expo-camera — nama plugin dicocokkan tanpa memverifikasi
// pemakaian aktual.
const forbiddenPlugins = [
  "expo-background-task",
  "expo-contacts",
  "expo-media-library",
  "@config-plugins/react-native-webrtc",
]
for (const plugin of forbiddenPlugins) {
  if (plugins.includes(plugin)) problems.push(`plugin ${plugin} tidak boleh aktif tanpa entry point frontend`)
}

const explicitPermissions = app.android?.permissions ?? []
// ACCESS_FINE_LOCATION / ACCESS_COARSE_LOCATION DICABUT dari larangan
// (alasan sama seperti expo-location di atas): dideklarasikan eksplisit di
// app.json untuk pencatatan lokasi auth. Keduanya tetap dilarang BILA tidak
// ada pemakaian — penjagaannya kini implisit lewat lib/location.ts.
const forbiddenPermissions = [
  "android.permission.READ_CONTACTS",
  "android.permission.RECORD_AUDIO",
  "android.permission.MODIFY_AUDIO_SETTINGS",
  "android.permission.READ_MEDIA_IMAGES",
  "android.permission.READ_MEDIA_VIDEO",
  "android.permission.READ_EXTERNAL_STORAGE",
  "android.permission.WRITE_EXTERNAL_STORAGE",
  "android.permission.USE_FINGERPRINT",
  "android.permission.WAKE_LOCK",
  "android.permission.RECEIVE_BOOT_COMPLETED",
]
for (const permission of forbiddenPermissions) {
  if (explicitPermissions.includes(permission)) problems.push(`permission ${permission} masih dideklarasikan eksplisit`)
}

/* ── Izin fitur aktif: siapa yang memasok, siapa yang memblokir ───────────
 *
 * Baris di `android.permissions` TIDAK bisa dipakai untuk menambal izin yang
 * dihapus plugin lain. `expo-image-picker` dengan `microphonePermission: false`
 * memanggil `withBlockedPermissions`, yang menulis
 *   <uses-permission android:name="android.permission.RECORD_AUDIO"
 *                     tools:node="remove"/>
 * ke AndroidManifest; manifest merger menaati perintah hapus itu, sehingga
 * RECORD_AUDIO hilang dari APK walaupun app.json mendeklarasikannya eksplisit.
 * Itu sebabnya deklarasi eksplisit RECORD_AUDIO di app.json tidak pernah
 * membuat mikrofon bisa diminta: yang salah bukan deklarasinya, melainkan
 * plugin yang memblokir izinnya. Kasus nyata ini juga alasan pemeriksaan di
 * sini berbunyi "pemasok + pemblokir", bukan sekadar daftar larangan:
 *   1. plugin memblokir izin yang masih dipakai fitur aktif → GAGAL;
 *   2. izin tidak lagi dipasok plugin mana pun (mis. `recordAudioAndroid:
 *      false`) → GAGAL.
 * Keduanya gagal SENYAP di perangkat — dialog izin tidak pernah muncul dan
 * perekaman ditolak tanpa pesan yang berguna — jadi build harus berhenti di
 * sini, bukan setelah rilis.
 */
const pluginOptions = (name) => {
  const entry = (app.plugins ?? []).find((plugin) =>
    (Array.isArray(plugin) ? plugin[0] : plugin) === name,
  )
  return Array.isArray(entry) ? entry[1] ?? {} : {}
}

// Menandai pemakaian NYATA di source, bukan sekadar keberadaan file: komentar
// di atas skrip ini mencatat dua build yang gagal karena guard hanya
// mencocokkan nama tanpa memverifikasi pemakaian aktual.
const sourceUses = (file, marker) => {
  const fileUrl = new URL(`../${file}`, import.meta.url)
  return existsSync(fileUrl) && readFileSync(fileUrl, "utf8").includes(marker)
}

const voiceNotesActive = sourceUses("components/ui/voice-note-recorder.tsx", "useAudioRecorder")
const imagePicker = pluginOptions("expo-image-picker")

// `*Permission: false` pada expo-image-picker berarti BLOKIR izin dari
// manifest (tools:node="remove"), bukan "jangan tambahkan". Hanya boleh
// dipakai kalau fitur yang membutuhkan izin itu sudah tidak ada di source.
const blockedByImagePicker = [
  {
    option: "microphonePermission",
    permission: "android.permission.RECORD_AUDIO",
    feature: "voice note chat (components/ui/voice-note-recorder.tsx)",
    active: voiceNotesActive,
  },
  {
    option: "cameraPermission",
    permission: "android.permission.CAMERA",
    feature: "pemindai QR (components/scan-screen.tsx)",
    active: sourceUses("components/scan-screen.tsx", "useCameraPermissions"),
  },
]
for (const blocked of blockedByImagePicker) {
  if (imagePicker[blocked.option] === false && blocked.active) {
    problems.push(
      `plugin expo-image-picker memakai ${blocked.option}:false — ${blocked.permission} dihapus dari manifest (tools:node="remove") padahal ${blocked.feature} masih aktif`,
    )
  }
}

// RECORD_AUDIO tidak boleh dideklarasikan eksplisit (daftar larangan di atas),
// jadi satu-satunya pemasok izin itu di manifest adalah plugin expo-audio.
if (voiceNotesActive) {
  const audio = pluginOptions("expo-audio")
  if (!plugins.includes("expo-audio")) {
    problems.push("plugin expo-audio tidak aktif — RECORD_AUDIO tidak akan ditambahkan ke manifest padahal voice note aktif")
  } else if (audio.recordAudioAndroid === false) {
    problems.push("plugin expo-audio memakai recordAudioAndroid:false — RECORD_AUDIO tidak akan ditambahkan ke manifest padahal voice note aktif")
  }
}

if (app.ios?.infoPlist?.NSUserTrackingUsageDescription) {
  problems.push("NSUserTrackingUsageDescription aktif tanpa tracking/ATT implementation")
}

if (problems.length) {
  for (const problem of problems) console.error(`  GAGAL  ${problem}`)
  process.exit(1)
}
console.log("check-permissions: OK — native permission scope sesuai entry point aktif")
