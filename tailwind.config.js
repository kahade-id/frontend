/**
 * Kahade — Tailwind / NativeWind v4 config
 *
 * Catatan keputusan:
 * - `require("./lib/tokens")` menunjuk ke file .ts. Ini aman karena Tailwind
 *   v3.3+ memuat config lewat `jiti`, yang bisa mengeksekusi TypeScript tanpa
 *   build step. NativeWind (nativewind/metro) memakai loader yang sama.
 * - `theme.screens`, `theme.borderRadius`, dan `theme.boxShadow` di-OVERRIDE
 *   (bukan extend) supaya utility default Tailwind yang melanggar design
 *   system (sm/lg/xl breakpoint, rounded-lg/xl/2xl, shadow-*) tidak pernah
 *   tersedia. Sisanya masuk `theme.extend` via toTailwindTheme().
 */
const { toTailwindTheme, fontFamilyByWeight } = require("./lib/tokens")

const kahade = toTailwindTheme()

// Pisahkan bagian yang harus menggantikan default Tailwind sepenuhnya
const { screens, borderRadius, boxShadow, ...extend } = kahade

/**
 * Class font per-weight: font-sans-400 … font-sans-700, font-serif-500,
 * font-mono-500, font-mono-600.
 *
 * Alasan (non-obvious): di RN native, `font-sans font-bold` menghasilkan
 * fontFamily "Sofia Sans" + fontWeight 700 — RN TIDAK memetakannya ke file
 * SofiaSans-Bold yang di-load expo-font, jadi jatuh ke system font. Class
 * per-weight langsung menunjuk nama asset yang terdaftar. Nama diambil dari
 * tokens.ts agar tetap satu sumber kebenaran.
 */
const fontFamilyPerWeight = Object.fromEntries(
  Object.entries(fontFamilyByWeight).flatMap(([role, weights]) =>
    Object.entries(weights).map(([w, asset]) => [`${role}-${w}`, [asset]]),
  ),
)
extend.fontFamily = { ...extend.fontFamily, ...fontFamilyPerWeight }

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./lib/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],

  // `class`, bukan `media`: mode dikontrol manual lewat
  // useColorScheme().setColorScheme() + vars(toCssVariables(mode)) di root.
  darkMode: "class",

  theme: {
    // §11 — satu breakpoint saja. Tidak ada sm/lg/xl/2xl.
    screens,

    // §5 — 8px (md) adalah maksimum non-pill. rounded-lg dst. sengaja tidak ada.
    borderRadius,

    // §6 — tidak ada shadow di seluruh sistem. `shadow-none` satu-satunya class.
    boxShadow,

    extend,
  },

  plugins: [],
}
