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

const forbiddenPlugins = [
  "expo-audio",
  "expo-background-task",
  "expo-camera",
  "expo-contacts",
  "expo-location",
  "expo-media-library",
  "@config-plugins/react-native-webrtc",
]
for (const plugin of forbiddenPlugins) {
  if (plugins.includes(plugin)) problems.push(`plugin ${plugin} tidak boleh aktif tanpa entry point frontend`)
}

const explicitPermissions = app.android?.permissions ?? []
const forbiddenPermissions = [
  "android.permission.READ_CONTACTS",
  "android.permission.ACCESS_FINE_LOCATION",
  "android.permission.ACCESS_COARSE_LOCATION",
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
