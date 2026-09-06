/**
 * Kahade — ESLint flat config.
 *
 * Repo ini TIDAK punya linter sebelumnya (tidak ada config, tidak ada
 * dependency), padahal `components/ui/toast.tsx` sudah menulis
 * `eslint-disable-next-line react-hooks/exhaustive-deps` — sebuah penanda
 * bahwa aturan hook dipercaya, tanpa ada yang menjalankannya. Akibatnya
 * pelanggaran aturan hook (dep Effect yang salah), variabel mati lintas-file,
 * dan kesalahan async umum lolos sampai review manual.
 *
 * Cakupan sengaja MINIMAL dan non-stylistic:
 *   - Aturan gaya (kutip, titik-koma, indentasi) tidak diaktifkan — Prettier
 *     tidak dipakai repo ini dan selisih gaya bukan bug.
 *   - Yang diaktifkan: kesalahan logika JavaScript, aturan React/React Hooks,
 *     import yang merujuk file/ekspor yang tidak ada, dan rawan-kesalahan RN.
 *   - `noUnusedLocals`/`noUnusedParameters` sudah ditangani `tsc` (aktif di
 *     tsconfig), jadi tidak digandakan di sini.
 */
import globals from "globals"
import tseslint from "typescript-eslint"
import reactHooks from "eslint-plugin-react-hooks"

export default tseslint.config(
  {
    ignores: [
      "node_modules/**",
      ".expo/**",
      "dist/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "docs/**",
      "assets/**",
      "public/**",
      ".expo/types/**",
      "expo-env.d.ts",
      "nativewind-env.d.ts",
    ],
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ["**/*.{ts,tsx,mjs,cjs,js}"],
  })),
  {
    files: ["**/*.{ts,tsx,mjs,cjs,js}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs["flat/recommended"].rules,
      // Kontrak repo: banyak helper sengaja memakai parameter `signal` yang
      // mungkin tak terpakai di implementasi tertentu — tsc menutup sisanya.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Pola `result as any`-ganda di lib/api/*.ts membaca snake_case fallback
      // dari response yang belum punya schema; jangan dilarang total di sini.
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    // Skrip node murni: aturan browser/react tidak relevan.
    files: ["scripts/**/*.mjs", "scripts/**/*.cjs"],
    rules: {
      "react-hooks/exhaustive-deps": "off",
    },
  },
  {
    /*
     * Berkas config Metro/Babel/Tailwind dan `lib/fonts.ts` WAJIB memakai
     * `require()` literal statis: Metro menuntut path asset yang bisa
     * diselesaikan saat bundling, dan Tailwind v3 memuat config lewat jiti
     * dengan format CJS. `import` dinamis/ESM justru membuat Metro gagal
     * menautkan asset — jadi `no-require-imports` dimatikan hanya di sini.
     */
    files: [
      "*.config.js",
      "scripts/*.cjs",
      "lib/fonts.ts",
    ],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
)
