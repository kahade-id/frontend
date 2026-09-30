/**
 * Kahade — Font registry & type-safe helpers.
 *
 * Satu-satunya tempat yang menyentuh file font fisik. Semua nama di sini
 * diturunkan dari `fontFamilyByWeight` di tokens.ts, sehingga:
 *   - key di peta font (`fontAssetsBlocking`/`fontAssetsDeferred`) == string
 *     yang dipakai `fontFamily` di StyleSheet
 *   - typo nama font / weight yang tidak tersedia = compile error, bukan
 *     fallback diam-diam ke system font saat runtime.
 *
 * Kenapa helper ini perlu (non-obvious):
 *   RN TIDAK mem-resolve `fontFamily: "Plus Jakarta Sans"` + `fontWeight: "700"`
 *   ke file PlusJakartaSans-Bold. Font yang di-load expo-font hanya bisa dipakai
 *   lewat nama registrasinya (mis. "PlusJakartaSans-Bold") — ini berlaku di native
 *   MAUPUN web (expo-font web mendaftarkan @font-face dengan nama key).
 *   `resolveFontFamily()` memetakan (family, weight) -> nama asset.
 *
 * Offline: semua `require()` di-bundle Metro ke binary. Tidak ada CDN/network.
 */
import {
  fontFamily,
  fontFamilyByWeight,
  fontFamilyItalicByWeight,
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

/** Union semua nama asset: "PlusJakartaSans-Regular" | ... | "AzeretMono-SemiBold" (+ varian italic) */
export type FontAssetName =
  | {
      [R in FontRole]: (typeof fontFamilyByWeight)[R][keyof (typeof fontFamilyByWeight)[R]]
    }[FontRole]
  | (typeof fontFamilyItalicByWeight)[keyof typeof fontFamilyItalicByWeight]

/* -------------------------------------------------------------------------- */
/* Asset map — dikonsumsi useFonts()                                           */
/* -------------------------------------------------------------------------- */

/**
 * `satisfies Record<FontAssetName, number>` memaksa key ini PERSIS sama
 * dengan tokens: kurang satu, atau salah ketik satu huruf, langsung gagal
 * type-check. `require()` harus literal statis agar Metro bisa bundle.
 *
 * ST-003 (PERF-FIX 2026-09-29) + FE-073: peta awalnya dipecah dua — KRITIS
 * (Regular/Medium → blocking di splash) dan TANGGUH (SemiBold/Bold +
 * EBGaramond 392KB + AzeretMono → lazy setelah first paint).
 *
 * REVISI 2026-09-30 (keputusan kualitas user): SEMUA font kembali blocking.
 * Alasan: user mengeluh teks "ga enak dilihat" — heading yang "melompat"
 * (FOUT) saat SemiBold/Bold lazy-load memperparah persepsi itu. Semua file
 * di-bundle lokal (±51–95KB per file, total <1MB); tambahan waktu splash
 * minimal dan sepadan dengan kualitas. Lazy split DIHAPUS — sejarahnya
 * dicatat di sini agar tidak diulang tanpa alasan.
 * Pengecekan exhaustiveness tetap di `allFontAssets`; dua peta turunan
 * dijamin mencakup semua key lewat `satisfies`.
 */
const allFontAssets = {
  "PlusJakartaSans-Regular": require("../assets/fonts/PlusJakartaSans-Regular.ttf"),
  "PlusJakartaSans-Medium": require("../assets/fonts/PlusJakartaSans-Medium.ttf"),
  "PlusJakartaSans-SemiBold": require("../assets/fonts/PlusJakartaSans-SemiBold.ttf"),
  "PlusJakartaSans-Bold": require("../assets/fonts/PlusJakartaSans-Bold.ttf"),
  "PlusJakartaSans-Italic": require("../assets/fonts/PlusJakartaSans-Italic.ttf"),
  "PlusJakartaSans-BoldItalic": require("../assets/fonts/PlusJakartaSans-BoldItalic.ttf"),
  "EBGaramond-Medium": require("../assets/fonts/EBGaramond-Medium.ttf"),
  "AzeretMono-Medium": require("../assets/fonts/AzeretMono-Medium.ttf"),
  "AzeretMono-SemiBold": require("../assets/fonts/AzeretMono-SemiBold.ttf"),
} satisfies Record<FontAssetName, number>

/**
 * REVISI 2026-09-30 — SEMUA font blocking (keputusan kualitas user, lihat
 * komentar di `allFontAssets`). `fontAssetsDeferred` dipertahankan sebagai
 * peta KOSONG agar call-site `Font.loadAsync(fontAssetsDeferred)` tidak
 * perlu diubah — tapi tidak ada lagi font yang lazy.
 */
export const fontAssetsBlocking = {
  "PlusJakartaSans-Regular": allFontAssets["PlusJakartaSans-Regular"],
  "PlusJakartaSans-Medium": allFontAssets["PlusJakartaSans-Medium"],
  "PlusJakartaSans-SemiBold": allFontAssets["PlusJakartaSans-SemiBold"],
  "PlusJakartaSans-Bold": allFontAssets["PlusJakartaSans-Bold"],
  "PlusJakartaSans-Italic": allFontAssets["PlusJakartaSans-Italic"],
  "PlusJakartaSans-BoldItalic": allFontAssets["PlusJakartaSans-BoldItalic"],
  "EBGaramond-Medium": allFontAssets["EBGaramond-Medium"],
  "AzeretMono-Medium": allFontAssets["AzeretMono-Medium"],
  "AzeretMono-SemiBold": allFontAssets["AzeretMono-SemiBold"],
} as const

/**
 * ST-003 + FE-073 (2026-09-29): font lazy — dimuat setelah first paint.
 * REVISI 2026-09-30: dikosongkan (semua blocking, keputusan kualitas user).
 * Peta dipertahankan agar kode pemuat deferred tidak perlu diubah.
 */
export const fontAssetsDeferred = {} as const

// Verifikasi compile-time: gabungan kedua subset == semua key tokens.
const _exhaustive: Record<FontAssetName, number> = {
  ...fontAssetsBlocking,
  ...fontAssetsDeferred,
}
void _exhaustive

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Nama asset untuk role + weight. Hanya kombinasi yang ADA di tokens yang
 * lolos type-check: `font("serif", 700)` -> error di compile time.
 *
 * @example fontFamily: font("mono", 600) // "AzeretMono-SemiBold"
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
 * Nama asset italic untuk weight yang diminta. Hanya 400 & 700 yang punya
 * file fisik — weight lain fallback ke yang terdekat (500/600 → 400),
 * dengan warning di dev seperti `resolveFontFamily`.
 *
 * Dipakai via prop `italic` di <Text> — JANGAN set `fontStyle: "italic"`
 * manual (faux italic sintetis OS) bila file italic tersedia.
 */
export function italicFont(weight: NumericWeight): string {
  const table = fontFamilyItalicByWeight as Partial<Record<NumericWeight, string>>
  const exact = table[weight]
  if (exact) return exact
  const available = (Object.keys(table).map(Number) as NumericWeight[]).sort(
    (a, b) => Math.abs(a - weight) - Math.abs(b - weight),
  )
  const nearest = available[0]
  if (__DEV__) {
    console.warn(`[kahade/fonts] italic tidak punya weight ${weight}; fallback ke ${nearest}.`)
  }
  return table[nearest] as string
}

/**
 * Terjemahkan (CSS family, weight) -> { fontFamily: "<nama asset>" }.
 *
 * SEMUA platform memakai nama asset (mis. "PlusJakartaSans-Bold"), termasuk web.
 * Alasan (non-obvious): expo-font di web mendaftarkan `@font-face` dengan
 * `font-family` = KEY yang diberikan ke `useFonts()` (= nama asset), bukan
 * "Plus Jakarta Sans". Jadi `{ fontFamily: "Plus Jakarta Sans", fontWeight: "700" }` tidak
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
 * Keputusan aksesibilitas (§3, sinkron dengan components/ui/text.tsx): <Text>
 * wrapper SENGAJA mengikuti Dynamic Type OS (`allowFontScaling`), tetapi
 * dibatasi `maxFontSizeMultiplier={2}` agar layout tidak pecah saat pengguna
 * memakai ukuran teks sistem yang sangat besar. Keduanya di-set sekali di
 * wrapper — cukup di satu tempat, jangan disebar ke tiap pemakaian.
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
