/**
 * Kahade — Metro config.
 * `withNativeWind` mengompilasi global.css via Tailwind saat bundling dan
 * menyuntikkan hasilnya ke native (sebagai StyleSheet) dan web (sebagai CSS).
 *
 * Pastikan app.json memakai `"web": { "bundler": "metro" }` agar target web
 * juga lewat pipeline ini (bukan webpack).
 */
const { getDefaultConfig } = require("expo/metro-config")
const { withNativeWind } = require("nativewind/metro")

const config = getDefaultConfig(__dirname)

module.exports = withNativeWind(config, {
  input: "./global.css",
  // Path config Tailwind eksplisit agar tidak ambigu saat monorepo
  configPath: "./tailwind.config.js",
  /**
   * inlineRem 16 (polish 2026-10-10): NativeWind default-nya 14, sehingga
   * setiap kelas rem bawaan Tailwind yang TIDAK ada di skala token
   * (h-14, min-h-11, w-20, gap-1.5, py-2.5, …) dikompilasi ×14 di native:
   * h-14 → 49px (web 56), min-h-11 → 38.5px (web 44, target sentuh iOS),
   * w-20 → 70px (web 80). Dokumentasi & tes komponen seluruhnya memakai
   * nilai 16-based; 16 menyamakan native dengan web dan niat desain.
   * Diverifikasi tidak mengubah fingerprint runtime (metro.config.js bukan
   * sumber @expo/fingerprint), jadi aman untuk OTA.
   */
  inlineRem: 16,
})
