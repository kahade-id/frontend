/**
 * Kahade — Babel config (NativeWind v4, dokumentasi terbaru per Jan 2026).
 *
 * Urutan penting:
 * 1. `babel-preset-expo` dengan `jsxImportSource: "nativewind"` — supaya JSX
 *    dikompilasi memakai runtime NativeWind (ini yang membuat `className`
 *    bekerja di komponen RN tanpa wrapper `styled()` seperti di v2).
 * 2. `nativewind/babel` — di v4 ini hanya preset ringan; transformasi utama
 *    sudah pindah ke Metro (withNativeWind).
 *
 * Tidak perlu lagi `react-native-reanimated/plugin` di sini jika memakai
 * Expo SDK 50+ (sudah termasuk di babel-preset-expo).
 */
module.exports = function (api) {
  // PERF-FIX (bundle): kunci cache mencakup versi phosphor-react-native +
  // NODE_ENV. Plugin `babel-phosphor-imports` membaca filesystem paket
  // tersebut (fs.existsSync per ikon), sehingga `api.cache(true)` murni
  // berisiko memakai transform basi setelah upgrade/downgrade paket atau
  // ganti env (dev vs production).
  const phosphorVersion = require("phosphor-react-native/package.json").version
  api.cache.using(() => `${phosphorVersion}:${process.env.NODE_ENV ?? "development"}`)
  return {
    plugins: [require.resolve("./scripts/babel-phosphor-imports.cjs")],
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
  }
}
