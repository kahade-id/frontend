/**
 * Kahade design system v2 — calm surfaces, clear hierarchy, purposeful motion.
 * NativeWind, React Native and web all resolve their values from this file.
 * Layout uses an 8pt rhythm; 4/12/20 remain compatibility micro-spacing steps.
 * Brand assets and primary actions stay monochrome; blue denotes interaction.
 */
export const brand = { black: "#000000", white: "#FFFFFF" } as const
export const gray = {
  50: "#F6F7F9", 100: "#EEF1F5", 200: "#E5E8ED", 300: "#DDE1E7",
  400: "#D7DBE2", 500: "#A3ABB8", 600: "#637083", 700: "#526075",
  800: "#323B49", 900: "#202733", 950: "#161B26",
} as const
export const semantic = {
  success: {
    light: { fill: "#168145", text: "#166534", bgSoft: "#F0FDF4" },
    dark: { fill: "#4ADE80", text: "#4ADE80", bgSoft: "#14251A" },
  },
  danger: {
    light: { fill: "#DC2626", text: "#B91C1C", bgSoft: "#FEF2F2" },
    dark: { fill: "#F87171", text: "#F87171", bgSoft: "#2A1616" },
  },
  warning: {
    light: { fill: "#B86B08", text: "#92400E", bgSoft: "#FFFBEB" },
    dark: { fill: "#FBBF24", text: "#FBBF24", bgSoft: "#2A2113" },
  },
  info: {
    light: { fill: "#245CD8", text: "#245CD8", bgSoft: "#EAF0FF" },
    dark: { fill: "#92B5FF", text: "#92B5FF", bgSoft: "#192A48" },
  },
} as const
export const chartMono = [gray[400], gray[600], gray[800]] as const
export const light = {
  background: "#FFFFFF", surface: "#F6F7F9", surfaceElevated: "#FFFFFF",
  // Decorative separators are intentionally quieter than form boundaries.
  borderDefault: "#D7DBE2", borderControl: "#7A8393", borderFocus: "#245CD8",
  borderError: "#DC2626", textPrimary: "#161B26", textSecondary: "#526075",
  textTertiary: "#637083", textDisabled: "#A3ABB8",
  primary: "#000000", primaryForeground: "#FFFFFF",
  accent: "#245CD8", accentSoft: "#EAF0FF", accentForeground: "#FFFFFF",
  overlay: "rgba(0, 0, 0, 0.4)",
} as const
export const dark = {
  background: "#101216", surface: "#191D24", surfaceElevated: "#2C323D",
  borderDefault: "#3A424F", borderControl: "#7C8799", borderFocus: "#92B5FF",
  borderError: "#F87171", textPrimary: "#F3F5F8", textSecondary: "#B1BBC9",
  textTertiary: "#A1ACBC", textDisabled: "#697383",
  primary: "#FFFFFF", primaryForeground: "#000000",
  accent: "#92B5FF", accentSoft: "#192A48", accentForeground: "#101216",
  overlay: "rgba(0, 0, 0, 0.6)",
} as const
export type ModeTokens = { readonly [K in keyof typeof light]: string }
export type ColorMode = "light" | "dark"
export const modes: Record<ColorMode, ModeTokens> = { light, dark }
export const colors = { brand, gray, semantic, chartMono, light, dark } as const

// Existing bundled font files are retained: no network font dependency.
// Sans is the default, including display headings; mono is reserved for data.
export const fontFamily = { sans: "Sofia Sans", serif: "EB Garamond", mono: "JetBrains Mono" } as const
export const fontFamilyByWeight = {
  sans: { 400: "SofiaSans-Regular", 500: "SofiaSans-Medium", 600: "SofiaSans-SemiBold", 700: "SofiaSans-Bold" },
  serif: { 500: "EBGaramond-Medium" },
  mono: { 500: "JetBrainsMono-Medium", 600: "JetBrainsMono-SemiBold" },
} as const
export const fontWeight = { regular: 400, medium: 500, semibold: 600, bold: 700 } as const
export const letterSpacing = { normal: 0, mono: 0.5 } as const
export type TypeStyle = {
  fontFamily: (typeof fontFamily)[keyof typeof fontFamily]
  fontSize: number
  lineHeight: number
  fontWeight: (typeof fontWeight)[keyof typeof fontWeight]
  fontWeightDark?: (typeof fontWeight)[keyof typeof fontWeight]
  letterSpacing?: number
  fontVariantNumeric?: "tabular-nums"
}
export const typography = {
  display: { fontFamily: fontFamily.sans, fontSize: 40, lineHeight: 48, fontWeight: 600, letterSpacing: -0.8 },
  h1: { fontFamily: fontFamily.sans, fontSize: 32, lineHeight: 40, fontWeight: 700, fontWeightDark: 600, letterSpacing: -0.5, fontVariantNumeric: "tabular-nums" },
  h2: { fontFamily: fontFamily.sans, fontSize: 24, lineHeight: 32, fontWeight: 700, fontWeightDark: 600, letterSpacing: -0.3, fontVariantNumeric: "tabular-nums" },
  h3: { fontFamily: fontFamily.sans, fontSize: 20, lineHeight: 28, fontWeight: 600, fontVariantNumeric: "tabular-nums" },
  bodyLarge: { fontFamily: fontFamily.sans, fontSize: 18, lineHeight: 28, fontWeight: 400, fontVariantNumeric: "tabular-nums" },
  body: { fontFamily: fontFamily.sans, fontSize: 16, lineHeight: 24, fontWeight: 400, fontVariantNumeric: "tabular-nums" },
  caption: { fontFamily: fontFamily.sans, fontSize: 14, lineHeight: 20, fontWeight: 400, fontVariantNumeric: "tabular-nums" },
  label: { fontFamily: fontFamily.sans, fontSize: 14, lineHeight: 20, fontWeight: 600, fontVariantNumeric: "tabular-nums" },
  monoLarge: { fontFamily: fontFamily.mono, fontSize: 28, lineHeight: 40, fontWeight: 600, letterSpacing: letterSpacing.mono },
  monoBody: { fontFamily: fontFamily.mono, fontSize: 14, lineHeight: 24, fontWeight: 500, letterSpacing: letterSpacing.mono },
} as const satisfies Record<string, TypeStyle>
export type TypographyKey = keyof typeof typography

export const space = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 14: 56, 16: 64, 18: 72, 20: 80 } as const
export const layout = {
  screenPaddingX: space[6], cardPadding: space[6], cardGap: space[4],
  iconTextGap: space[2], breakpoint: 768, maxContentWidth: 560, gridColumns: 12,
} as const
export const radius = { none: 0, xs: 4, sm: 8, md: 12, full: 999 } as const
export const borderWidth = { none: 0, default: 1, control: 1, focus: 2, error: 2 } as const
export const border = {
  default: { width: borderWidth.default, light: light.borderDefault, dark: dark.borderDefault },
  control: { width: borderWidth.control, light: light.borderControl, dark: dark.borderControl },
  focus: { width: borderWidth.focus, light: light.borderFocus, dark: dark.borderFocus },
  error: { width: borderWidth.error, light: light.borderError, dark: dark.borderError },
} as const
// Borders and surface contrast establish hierarchy, rather than heavy shadows.
export const shadow = {
  none: { shadowColor: "transparent", shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 },
} as const
export const zIndex = { base: 0, sticky: 10, backdrop: 40, bottomSheet: 50, modal: 60, banner: 70 } as const
export const icon = {
  size: { xs: 16, sm: 20, md: 24, lg: 28, xl: 32 },
  weight: { default: "regular", active: "fill", activeAlt: "bold" },
  color: { light: { default: light.textTertiary, active: light.textPrimary }, dark: { default: dark.textTertiary, active: dark.textPrimary } },
  textGap: space[2],
} as const
export const motion = {
  duration: { press: 120, fast: 180, base: 240, slow: 320 },
  easing: { standard: [0.4, 0, 0.2, 1] as const, standardCss: "cubic-bezier(0.4, 0, 0.2, 1)" },
  spring: { damping: 24, stiffness: 240, mass: 1 },
  scale: { press: 0.98 }, opacity: { disabled: 0.4 },
  overlay: { enterDuration: 180, exitDuration: 140, translateY: 8, scaleFrom: 0.98, tooltipTranslateY: 4, tooltipMaxWidth: 260, tooltipMaxWidthMd: 320 },
  inlineSpinnerSize: { min: icon.size.xs, max: icon.size.sm },
} as const
export const a11y = { minHitTarget: 44 } as const
export const tokens = { colors, fontFamily, fontFamilyByWeight, fontWeight, letterSpacing, typography, space, layout, radius, borderWidth, border, shadow, zIndex, icon, motion, a11y } as const
export type Tokens = typeof tokens

const px = (n: number) => `${n}px`
const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
/** Runtime mode values, inherited by both NativeWind views and portals. */
export function toCssVariables(mode: ColorMode): Record<string, string> {
  const result = Object.fromEntries(Object.entries(modes[mode]).map(([key, value]) => [`--color-${kebab(key)}`, value]))
  for (const [name, byMode] of Object.entries(semantic)) {
    result[`--color-${name}-fill`] = byMode[mode].fill
    result[`--color-${name}-text`] = byMode[mode].text
    result[`--color-${name}-soft`] = byMode[mode].bgSoft
  }
  return result
}
/** Tailwind v3 / NativeWind adapter. Keep every public v1 utility available. */
export function toTailwindTheme() {
  return {
    colors: {
      black: brand.black, white: brand.white, gray,
      background: "var(--color-background)",
      surface: { DEFAULT: "var(--color-surface)", elevated: "var(--color-surface-elevated)" },
      border: { DEFAULT: "var(--color-border-default)", control: "var(--color-border-control)", focus: "var(--color-border-focus)", error: "var(--color-border-error)" },
      text: { primary: "var(--color-text-primary)", secondary: "var(--color-text-secondary)", tertiary: "var(--color-text-tertiary)", disabled: "var(--color-text-disabled)" },
      primary: { DEFAULT: "var(--color-primary)", foreground: "var(--color-primary-foreground)" },
      accent: { DEFAULT: "var(--color-accent)", soft: "var(--color-accent-soft)", foreground: "var(--color-accent-foreground)" },
      overlay: "var(--color-overlay)",
      success: { DEFAULT: "var(--color-success-fill)", text: "var(--color-success-text)", soft: "var(--color-success-soft)" },
      danger: { DEFAULT: "var(--color-danger-fill)", text: "var(--color-danger-text)", soft: "var(--color-danger-soft)" },
      warning: { DEFAULT: "var(--color-warning-fill)", text: "var(--color-warning-text)", soft: "var(--color-warning-soft)" },
      info: { DEFAULT: "var(--color-info-fill)", text: "var(--color-info-text)", soft: "var(--color-info-soft)" },
    },
    fontFamily: { sans: [fontFamily.sans, "system-ui", "sans-serif"], serif: [fontFamily.serif, "Georgia", "serif"], mono: [fontFamily.mono, "ui-monospace", "monospace"] },
    fontSize: Object.fromEntries(Object.entries(typography).map(([key, t]) => {
      const opts: Record<string, string> = { lineHeight: px(t.lineHeight) }
      if ("letterSpacing" in t) opts.letterSpacing = px(t.letterSpacing)
      return [key, [px(t.fontSize), opts]]
    })) as Record<TypographyKey, [string, Record<string, string>]>,
    letterSpacing: { mono: px(letterSpacing.mono) },
    spacing: Object.fromEntries(Object.entries(space).map(([k, v]) => [k, px(v)])) as Record<keyof typeof space, string>,
    borderRadius: { none: px(radius.none), xs: px(radius.xs), sm: px(radius.sm), md: px(radius.md), DEFAULT: px(radius.sm), full: px(radius.full) },
    borderWidth: { DEFAULT: px(borderWidth.default), 0: "0px", focus: px(borderWidth.focus), error: px(borderWidth.error) },
    boxShadow: { none: "none", DEFAULT: "none" },
    zIndex: Object.fromEntries(Object.entries(zIndex).map(([k, v]) => [k, String(v)])) as Record<keyof typeof zIndex, string>,
    maxWidth: { content: px(layout.maxContentWidth) }, screens: { md: px(layout.breakpoint) },
    transitionDuration: { press: `${motion.duration.press}ms`, fast: `${motion.duration.fast}ms`, DEFAULT: `${motion.duration.base}ms`, slow: `${motion.duration.slow}ms` },
    transitionTimingFunction: { DEFAULT: motion.easing.standardCss, standard: motion.easing.standardCss },
    scale: { press: String(motion.scale.press) }, opacity: { disabled: String(motion.opacity.disabled) },
  }
}
export function getTypeStyle(key: TypographyKey, mode: ColorMode = "light") {
  const t = typography[key]
  const weight = mode === "dark" && "fontWeightDark" in t ? t.fontWeightDark : t.fontWeight
  return { fontFamily: t.fontFamily, fontSize: t.fontSize, lineHeight: t.lineHeight, fontWeight: String(weight) as "400" | "500" | "600" | "700", letterSpacing: "letterSpacing" in t ? t.letterSpacing : 0 }
}
export default tokens
