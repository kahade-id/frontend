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
  api.cache(true)
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
  }
}
