import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const root = dirname(fileURLToPath(import.meta.url))
const stub = (name: string) => resolve(root, "tests/stubs", `${name}.ts`)

/**
 * Konfigurasi KHUSUS test render i18n (file tests/*.test.tsx).
 *
 * Kenapa config terpisah (non-obvious): `vitest.config.ts` menstubs
 * `react-native` menjadi modul minimal (hanya `Platform`) karena test lapisan
 * API tidak boleh menarik runtime apa pun. Test ini justru HARUS merender
 * komponen RN sungguhan, jadi `react-native` di-alias ke `react-native-web`
 * dan environment-nya jsdom.
 *
 * `jsxImportSource` di-set ulang ke "react": tsconfig repo memakai
 * "nativewind" (perlu plugin Babel saat build app). Di test tidak ada plugin
 * itu, dan `className` yang tersisa dilewatkan ke DOM apa adanya — tidak
 * mengubah teks yang dirender, yang jadi objek test ini.
 *
 * Paket Expo dinonaktifkan lewat stub yang sama seperti config utama; bahasa
 * perangkat tidak boleh menentukan hasil test.
 */
export default defineConfig({
  esbuild: { jsx: "automatic", jsxImportSource: "react" },
  resolve: {
    alias: {
      "@": root,
      "react-native": "react-native-web",
      "expo-constants": stub("expo-constants"),
      "expo-device": stub("expo-device"),
      "expo-application": stub("expo-application"),
      "expo-secure-store": stub("expo-secure-store"),
      "expo-localization": stub("expo-localization"),
    },
  },
  define: { __DEV__: "false" },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.tsx"],
  },
})
