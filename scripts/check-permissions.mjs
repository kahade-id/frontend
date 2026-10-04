/**
 * Guard native permission scope against dead feature configuration.
 *
 * This is intentionally a small policy check, not a replacement for device
 * testing. Expo config plugins may add the minimum permission required by a
 * feature (for example image-picker adds camera/photo access); the check only
 * rejects capabilities with no active frontend entry point.
 */
import { readFileSync } from "node:fs"

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

if (app.ios?.infoPlist?.NSUserTrackingUsageDescription) {
  problems.push("NSUserTrackingUsageDescription aktif tanpa tracking/ATT implementation")
}

if (problems.length) {
  for (const problem of problems) console.error(`  GAGAL  ${problem}`)
  process.exit(1)
}
console.log("check-permissions: OK — native permission scope sesuai entry point aktif")
