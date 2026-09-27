/**
 * Kahade — config plugin: App Shortcuts / pintasan launcher (item #30).
 *
 * Menambahkan 3 static shortcut:
 *   - Pindai QR  → kahade://scan   (app/scan.tsx)
 *   - Chat      → kahade://chat   (app/(tabs)/chat.tsx)
 *   - Top-Up    → kahade://topup  (app/topup.tsx)
 *
 * Android: menulis `res/xml/shortcuts.xml` + `<meta-data
 * android.app.shortcuts>` di MainActivity (pola resmi Android 7.1+).
 * iOS: `UIApplicationShortcutItems` statis di Info.plist dengan
 * `UIApplicationShortcutItemURL` — sistem membuka URL-nya, lalu Expo Router
 * me-route ke layar yang sesuai.
 *
 * PENTING — BUTUH BUILD NATIVE BARU (APK/IPA): config plugin hanya berjalan
 * saat `expo prebuild` / EAS build. OTA tidak bisa mengubah manifest,
 * Info.plist, atau resource XML. Jangan klaim shortcut aktif sebelum APK
 * baru di-build & diuji di perangkat nyata.
 *
 * Keterbatasan yang disengaja:
 *   - Ikon shortcut memakai `@mipmap/ic_launcher` (ikon aplikasi) — Android
 *     butuh drawable untuk tiap shortcut; menggambar glyph QR/chat/dompet
 *     sebagai vector manual rawan salah render di semua density. Ikon
 *     berbeda per shortcut = follow-up desain, bukan blokir rilis.
 *   - Label statis Bahasa Indonesia (bukan @string): shortcut launcher
 *     mengikuti locale sistem via resource — di luar cakupan item ini.
 */
const {
  withAndroidManifest,
  withDangerousMod,
  withInfoPlist,
  AndroidConfig,
} = require("@expo/config-plugins")
const fs = require("fs")
const path = require("path")

const SCHEME = "kahade"

const SHORTCUTS = [
  {
    id: "kahade-scan",
    shortLabel: "Pindai QR",
    longLabel: "Pindai QR Code",
    route: "scan",
    iosIcon: "UIApplicationShortcutIconTypeSearch",
  },
  {
    id: "kahade-chat",
    shortLabel: "Chat",
    longLabel: "Buka Chat",
    route: "chat",
    iosIcon: "UIApplicationShortcutIconTypeCompose",
  },
  {
    id: "kahade-topup",
    shortLabel: "Top-Up",
    longLabel: "Top-Up Saldo",
    route: "topup",
    iosIcon: "UIApplicationShortcutIconTypeAdd",
  },
]

function shortcutsXml(packageName) {
  const items = SHORTCUTS.map(
    (s) => `  <shortcut
      android:shortcutId="${s.id}"
      android:enabled="true"
      android:icon="@mipmap/ic_launcher"
      android:shortcutShortLabel="${s.shortLabel}"
      android:shortcutLongLabel="${s.longLabel}">
    <intent
        android:action="android.intent.action.VIEW"
        android:targetPackage="${packageName}"
        android:targetClass="${packageName}.MainActivity"
        android:data="${SCHEME}://${s.route}" />
  </shortcut>`,
  ).join("\n")
  return `<?xml version="1.0" encoding="utf-8"?>\n<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">\n${items}\n</shortcuts>\n`
}

/** Android: tulis res/xml/shortcuts.xml ke proyek native. */
const withShortcutsXml = (config) =>
  withDangerousMod(config, [
    "android",
    async (config) => {
      const packageName =
        config.android?.package || config.ios?.bundleIdentifier || "id.kahade"
      const xmlDir = path.join(
        config.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "res",
        "xml",
      )
      await fs.promises.mkdir(xmlDir, { recursive: true })
      await fs.promises.writeFile(
        path.join(xmlDir, "shortcuts.xml"),
        shortcutsXml(packageName),
        "utf8",
      )
      return config
    },
  ])

/** Android: daftarkan shortcuts.xml di MainActivity via meta-data. */
const withShortcutsManifest = (config) =>
  withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest
    const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(manifest)
    const META_NAME = "android.app.shortcuts"
    mainActivity["meta-data"] = mainActivity["meta-data"] || []
    const exists = mainActivity["meta-data"].some(
      (m) => m.$ && m.$["android:name"] === META_NAME,
    )
    if (!exists) {
      mainActivity["meta-data"].push({
        $: { "android:name": META_NAME, "android:resource": "@xml/shortcuts" },
      })
    }
    return config
  })

/** iOS: quick actions statis — sistem membuka UIApplicationShortcutItemURL. */
const withIosQuickActions = (config) =>
  withInfoPlist(config, (config) => {
    config.modResults.UIApplicationShortcutItems = SHORTCUTS.map((s) => ({
      UIApplicationShortcutItemType: `${config.ios?.bundleIdentifier || "id.kahade"}.${s.id}`,
      UIApplicationShortcutItemTitle: s.shortLabel,
      UIApplicationShortcutItemSubtitle: s.longLabel,
      UIApplicationShortcutItemIconType: s.iosIcon,
      UIApplicationShortcutItemURL: `${SCHEME}://${s.route}`,
    }))
    return config
  })

module.exports = function withAppShortcuts(config) {
  config = withShortcutsXml(config)
  config = withShortcutsManifest(config)
  config = withIosQuickActions(config)
  return config
}
