import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const root = dirname(fileURLToPath(import.meta.url))
const stub = (name: string) => resolve(root, "tests/stubs", `${name}.ts`)

/**
 * Konfigurasi Vitest.
 *
 * Hanya lapisan murni yang diuji di sini (normalizer respons, helper URL,
 * fallback identitas). Tidak ada React Native runtime: modul yang menyentuh
 * `react-native` atau paket Expo native di-stub lewat alias di bawah.
 *
 * `environment: "node"` cukup — tidak ada DOM yang disentuh.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": root,
      // Paket `react-native` asli tidak bisa di-parse Node (sintaks Flow di
      // baris pertama index.js). Lapisan API hanya memakai `Platform`.
      "react-native": stub("react-native"),
      // Keempat paket ini memanggil expo-modules-core yang butuh global native
      // (`globalThis.expo.EventEmitter`) — undefined di Node. Lihat
      // tests/stubs/expo.ts.
      "expo-constants": stub("expo-constants"),
      "expo-device": stub("expo-device"),
      "expo-application": stub("expo-application"),
      "expo-secure-store": stub("expo-secure-store"),
      // Bahasa perangkat tidak boleh menentukan hasil test: lihat
      // tests/stubs/expo-localization.ts.
      "expo-localization": stub("expo-localization"),
    },
  },
  /**
   * `__DEV__` disuntik Metro/Babel saat build native. `expo-modules-core`
   * membacanya di top level, jadi tanpa definisi ini modul yang menarik Expo
   * gagal saat dikumpulkan.
   */
  define: {
    __DEV__: "false",
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
})
