import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const root = dirname(fileURLToPath(import.meta.url))
const stub = (name: string) => resolve(root, "tests/stubs", `${name}.ts`)

/**
 * Konfigurasi test KOMPONEN & HOOK React (file tests/*.test.tsx) — H-04.
 * Sebelumnya bernama vitest.i18n-render.config.ts dan hanya dipakai 4 test
 * render i18n; kini semua test yang merender React masuk sini (komponen
 * uang, hook data, i18n-render).
 *
 * Kenapa config terpisah (non-obvious): `vitest.config.ts` men-stub
 * `react-native` menjadi modul minimal (hanya `Platform`) karena test lapisan
 * API tidak boleh menarik runtime apa pun. Test di sini justru HARUS merender
 * komponen RN sungguhan, jadi `react-native` di-alias ke `react-native-web`
 * dan environment-nya jsdom.
 *
 * `jsxImportSource` di-set ulang ke "react": tsconfig repo memakai
 * "nativewind" (perlu plugin Babel saat build app). Di test tidak ada plugin
 * itu, dan `className` yang tersisa dilewatkan ke DOM apa adanya — tidak
 * mengubah teks yang dirender, yang jadi objek test ini.
 *
 * Paket Expo dinonaktifkan lewat stub yang sama seperti config utama; bahasa
 * perangkat tidak boleh menentukan hasil test. `@react-navigation/native`
 * di-stub agar `useIsFocused` bisa dikendalikan test (F-01/F-02) tanpa
 * NavigationContainer.
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
      "@react-navigation/native": stub("react-navigation"),
      // Modul native yang menarik berkas Flow/native react-native — tidak
      // bisa di-parse jsdom; semuanya efek perangkat, bukan objek test.
      "phosphor-react-native": `${stub("phosphor-react-native")}x`,
      "react-native-svg": `${stub("react-native-svg")}x`,
      "expo-haptics": stub("expo-haptics"),
      "expo-image": `${stub("expo-image")}x`,
      "expo-router": `${stub("expo-router")}x`,
      "expo-clipboard": stub("expo-clipboard"),
      // Sheet OS share (lib/share dari shareShowcaseById) — native EventEmitter.
      "expo-sharing": stub("expo-sharing"),
      // nativewind me-require `react-native` asli dari CJS (Flow) — stub.
      // Subpath JSX HARUS di-alias eksplisit dan DULUAN: Vitest 5 (oxc)
      // mengompilasi JSX test ke `nativewind/jsx-dev-runtime` karena
      // jsxImportSource tsconfig; lihat tests/stubs/nativewind-jsx.ts.
      "nativewind/jsx-dev-runtime": stub("nativewind-jsx"),
      "nativewind/jsx-runtime": stub("nativewind-jsx"),
      nativewind: stub("nativewind"),
      // RNGH memuat TurboModule native saat import — tidak ada di jsdom.
      "react-native-gesture-handler": `${stub("react-native-gesture-handler")}x`,
      // Safe-area juga TurboModule; stub memberi inset 0 yang deterministik
      // (D-03 — komponen baseline seperti Banner memakainya).
      "react-native-safe-area-context": `${stub("react-native-safe-area-context")}x`,
      // Reanimated menarik react-native-worklets yang memanggil TurboModule
      // saat import — alasan yang sama. Stub meng-emulasi shared value +
      // Animated.View supaya STYLE hasil animasi tetap bisa diamati test
      // (lihat docblock tests/stubs/react-native-reanimated.tsx).
      "react-native-reanimated": `${stub("react-native-reanimated")}x`,
    },
  },
  define: { __DEV__: "false" },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.tsx"],
  },
})
