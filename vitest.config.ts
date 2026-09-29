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
      // Login sosial Google: expo-auth-session & expo-web-browser memanggil
      // expo-modules-core (butuh global native). Lihat
      // tests/stubs/expo-auth-session.ts & tests/stubs/expo-web-browser.ts.
      "expo-auth-session": stub("expo-auth-session"),
      "expo-web-browser": stub("expo-web-browser"),
      // Login sosial Apple: expo-apple-authentication memanggil
      // expo-modules-core. Lihat tests/stubs/expo-apple-authentication.ts.
      "expo-apple-authentication": stub("expo-apple-authentication"),
      "expo-application": stub("expo-application"),
      "expo-secure-store": stub("expo-secure-store"),
      // Bahasa perangkat tidak boleh menentukan hasil test: lihat
      // tests/stubs/expo-localization.ts.
      "expo-localization": stub("expo-localization"),
      // `expo-clipboard` ditarik lib/clipboard (share etalase) — native EventEmitter.
      "expo-clipboard": stub("expo-clipboard"),
      // `expo-sharing` ditarik lib/share (sheet OS share) — native EventEmitter.
      "expo-sharing": stub("expo-sharing"),
      // `expo-location` ditarik lib/location (getAuthLocation) — kini di graf
      // impor facade API aksi sensitif; stub mengembalikan "izin ditolak".
      "expo-location": stub("expo-location"),
      // `@react-native-community/netinfo` ditarik lib/connectivity (item #27)
      // — native module tidak ada di Node; stub di atas.
      "@react-native-community/netinfo": stub("netinfo"),
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
