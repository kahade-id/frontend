/**
 * Kahade — Font registry & type-safe helpers.
 *
 * Satu-satunya tempat yang menyentuh file font fisik. Semua nama di sini
 * diturunkan dari `fontFamilyByWeight` di tokens.ts, sehingga:
 *   - key di `fontAssets` == string yang dipakai `fontFamily` di StyleSheet
 *   - typo nama font / weight yang tidak tersedia = compile error, bukan
 *     fallback diam-diam ke system font saat runtime.
 *
 * Kenapa helper ini perlu (non-obvious):
 *   RN TIDAK mem-resolve `fontFamily: "Sofia Sans"` + `fontWeight: "700"`
 *   ke file SofiaSans-Bold. Font yang di-load expo-font hanya bisa dipakai
 *   lewat nama registrasinya (mis. "SofiaSans-Bold") — ini berlaku di native
 *   MAUPUN web (expo-font web mendaftarkan @font-face dengan nama key).
 *   `resolveFontFamily()` memetakan (family, weight) -> nama asset.
 *
 * Offline: semua `require()` di-bundle Metro ke binary. Tidak ada CDN/network.
 */
import {
  fontFamily,
  fontFamilyByWeight,
  typography,
  type ColorMode,
  type TypographyKey,
} from "@/lib/tokens"

/* -------------------------------------------------------------------------- */
/* Types diturunkan dari tokens                                                */
/* -------------------------------------------------------------------------- */

export type FontRole = keyof typeof fontFamilyByWeight // "sans" | "serif" | "mono"

/** Weight yang valid untuk suatu role (mis. serif hanya 500) */
export type FontWeightFor<R extends FontRole> = keyof (typeof fontFamilyByWeight)[R]

/** Union semua nama asset: "SofiaSans-Regular" | ... | "JetBrainsMono-SemiBold" */
export type FontAssetName = {
  [R in FontRole]: (typeof fontFamilyByWeight)[R][keyof (typeof fontFamilyByWeight)[R]]
}[FontRole]

/* -------------------------------------------------------------------------- */
/* Asset map — dikonsumsi useFonts()                                           */
/* -------------------------------------------------------------------------- */

/**
 * `satisfies Record<FontAssetName, number>` memaksa 7 key ini PERSIS sama
 * dengan tokens: kurang satu, atau salah ketik satu huruf, langsung gagal
 * type-check. `require()` harus literal statis agar Metro bisa bundle.
 */
export const fontAssets = {
  "SofiaSans-Regular": require("../assets/fonts/SofiaSans-Regular.ttf"),
  "SofiaSans-Medium": require("../assets/fonts/SofiaSans-Medium.ttf"),
  "SofiaSans-SemiBold": require("../assets/fonts/SofiaSans-SemiBold.ttf"),
  "SofiaSans-Bold": require("../assets/fonts/SofiaSans-Bold.ttf"),
  "EBGaramond-Medium": require("../assets/fonts/EBGaramond-Medium.ttf"),
  "JetBrainsMono-Medium": require("../assets/fonts/JetBrainsMono-Medium.ttf"),
  "JetBrainsMono-SemiBold": require("../assets/fonts/JetBrainsMono-SemiBold.ttf"),
} satisfies Record<FontAssetName, number>

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Nama asset untuk role + weight. Hanya kombinasi yang ADA di tokens yang
 * lolos type-check: `font("serif", 700)` -> error di compile time.
 *
 * @example fontFamily: font("mono", 600) // "JetBrainsMono-SemiBold"
 */
export function font<R extends FontRole, W extends FontWeightFor<R>>(
  role: R,
  weight: W,
): (typeof fontFamilyByWeight)[R][W] {
  return fontFamilyByWeight[role][weight]
}

type CssFamily = (typeof fontFamily)[keyof typeof fontFamily]
type NumericWeight = 400 | 500 | 600 | 700

const roleByCssFamily = Object.fromEntries(
  (Object.keys(fontFamily) as FontRole[]).map((role) => [fontFamily[role], role]),
) as Record<CssFamily, FontRole>

/**
 * Terjemahkan (CSS family, weight) -> { fontFamily: "<nama asset>" }.
 *
 * SEMUA platform memakai nama asset (mis. "SofiaSans-Bold"), termasuk web.
 * Alasan (non-obvious): expo-font di web mendaftarkan `@font-face` dengan
 * `font-family` = KEY yang diberikan ke `useFonts()` (= nama asset), bukan
 * "Sofia Sans". Jadi `{ fontFamily: "Sofia Sans", fontWeight: "700" }` tidak
 * akan match face mana pun di web dan jatuh ke system font. Karena weight
 * sudah implisit di file, kita sengaja TIDAK mengembalikan `fontWeight` —
 * di Android, fontWeight "700" di atas file yang sudah Bold memicu faux-bold.
 *
 * Kalau weight tidak tersedia untuk family itu (mis. serif 700), kita
 * fallback ke weight terdekat yang ada dan beri warning di dev — bukan
 * silent fail — supaya ketahuan saat development.
 */
export function resolveFontFamily(
  family: CssFamily,
  weight: NumericWeight,
): { fontFamily: string } {
  const role = roleByCssFamily[family]
  const table = fontFamilyByWeight[role] as Partial<Record<NumericWeight, string>>
  const exact = table[weight]
  if (exact) return { fontFamily: exact }

  const available = (Object.keys(table).map(Number) as NumericWeight[]).sort(
    (a, b) => Math.abs(a - weight) - Math.abs(b - weight),
  )
  const nearest = available[0]
  if (__DEV__) {
    console.warn(
      `[kahade/fonts] ${family} tidak punya weight ${weight}; fallback ke ${nearest}.`,
    )
  }
  return { fontFamily: table[nearest] as string }
}

/**
 * Versi platform-aware dari `getTypeStyle()` di tokens.ts — dipakai untuk
 * StyleSheet di komponen <Text>. Weight dark-mode (H1/H2 -> 600) ikut
 * ter-resolve ke file font yang benar.
 *
 * REMINDER untuk komponen Text nanti (§3 — type scale FIXED):
 *   set `allowFontScaling={false}` di komponen Text wrapper, karena default RN
 *   adalah `true` dan akan mengikuti Dynamic Type OS. Cukup di satu wrapper,
 *   jangan disebar ke tiap pemakaian.
 */
export function getNativeTypeStyle(key: TypographyKey, mode: ColorMode = "light") {
  const t = typography[key]
  const weight = (
    mode === "dark" && "fontWeightDark" in t && t.fontWeightDark
      ? t.fontWeightDark
      : t.fontWeight
  ) as NumericWeight

  return {
    ...resolveFontFamily(t.fontFamily, weight),
    fontSize: t.fontSize,
    lineHeight: t.lineHeight,
    letterSpacing: "letterSpacing" in t ? t.letterSpacing ?? 0 : 0,
  }
}

/*
 * Catatan NativeWind: class per-weight (`font-sans-700`, `font-mono-600`, …)
 * didefinisikan di tailwind.config.js langsung dari tokens.ts — bukan dari
 * file ini — karena file ini meng-import `react-native` yang tidak bisa
 * dieksekusi saat Tailwind memuat config di Node.
 */
