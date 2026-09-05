import { defineConfig } from "vitest/config"
import { fileURLToPath, URL } from "node:url"

export default defineConfig({
  resolve: {
    alias: [
      /*
       * Uji komponen berjalan di jsdom, jadi `react-native` dipetakan ke
       * `react-native-web` — implementasi yang sama dengan target web app ini.
       * Pakai regex ber-anchor, BUKAN string: alias string di Vite cocok
       * sebagai PREFIX, sehingga kunci "react-native" ikut menangkap
       * "react-native-web" dan menulisnya jadi "react-native-web-web".
       */
      { find: /^react-native$/, replacement: "react-native-web" },
      { find: /^@\//, replacement: fileURLToPath(new URL("./", import.meta.url)) },
    ],
  },
  /*
   * tsconfig memakai jsxImportSource "nativewind" (wajib untuk className di
   * komponen RN). Di bawah Vitest, runtime itu menarik `react-native` asli
   * yang masih ber-syntax Flow dan gagal di-parse Node ("Unexpected token
   * 'typeof'"). Test hanya perlu JSX biasa; className tidak diuji di sini.
   */
  esbuild: { jsx: "automatic", jsxImportSource: "react" },
  define: { __DEV__: true },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    // Default node (cepat) — berkas uji komponen memilih jsdom lewat
    // komentar `@vitest-environment jsdom` di barisnya sendiri.
    environment: "node",
    globals: false,
    restoreMocks: true,
    clearMocks: true,
  },
})
