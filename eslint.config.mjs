/**
 * Kahade — ESLint flat config.
 *
 * Repo ini TIDAK punya linter sebelumnya (tidak ada config, tidak ada
 * dependency) — akibatnya pelanggaran aturan hook (dep Effect yang salah),
 * variabel mati lintas-file, dan kesalahan async umum lolos sampai review
 * manual. (Narasi lama config ini menyebut penanda `eslint-disable` di
 * `components/ui/toast.tsx`; penanda itu sudah tidak ada di source — G-09.)
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
      // Salinan referensi source backend produksi (bukan kode frontend).
      "backend/**",
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
      /*
       * Ditulis EKSPLISIT, bukan `...reactHooks.configs["flat/recommended"].rules`.
       *
       * Bentuk spread itu diam-diam TIDAK mengaktifkan apa pun: sejak
       * eslint-plugin-react-hooks v6, `configs["flat/recommended"]` adalah
       * ARRAY objek config, sehingga `.rules` di dalamnya `undefined` dan
       * spread `undefined` adalah no-op. Akibatnya `rules-of-hooks` mati di
       * seluruh repo sementara `npm run lint` tetap hijau — dan itulah yang
       * meloloskan bug produksi nyata: `app/order/[id].tsx` memanggil
       * `useUiPrefs()` + `useCallback()` SETELAH tiga early return, sehingga
       * render "order sudah tiba" memakai lebih banyak hook daripada render
       * "masih memuat". React melempar "Rendered more hooks than during the
       * previous render" dan layar jatuh ke ErrorBoundary tepat saat data
       * berhasil dimuat. Linter yang seharusnya menangkap ini tidak pernah
       * berjalan. Jangan kembalikan ke bentuk spread tanpa memeriksa bahwa
       * `reactHooks.configs[...]` adalah objek, bukan array.
       */
      "react-hooks/rules-of-hooks": "error",
      /*
       * `exhaustive-deps` sengaja OFF, bukan "warn".
       *
       * Mengaktifkannya sekarang mencetak 132 warning warisan di seluruh repo
       * (sebelumnya aturan ini tidak pernah benar-benar berjalan karena bug
       * spread di atas). Lautan warning itu menenggelamkan satu-satunya sinyal
       * yang penting di gate ini — error `rules-of-hooks`, kelas bug yang
       * menjatuhkan seluruh layar ke ErrorBoundary. Bakar dulu backlog-nya per
       * berkas, baru naikkan ke "warn" (pola ratchet yang sama dipakai
       * `check:i18n` dan `check:screens`). `scripts/**` sudah lebih dulu
       * mematikannya dengan alasan yang sama.
       */
      "react-hooks/exhaustive-deps": "off",
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
