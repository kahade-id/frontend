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
})
