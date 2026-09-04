/**
 * Kahade Design System — Design Tokens v1.1
 * ------------------------------------------------------------------
 * Single source of truth untuk semua nilai visual sistem:
 * warna, mode (light/dark), tipografi, spacing, radius, border,
 * z-index, ikon, motion, dan breakpoint.
 *
 * Framework-agnostic: bisa dikonsumsi oleh
 * - tailwind.config.js (NativeWind / Tailwind web) via `toTailwindTheme()`
 * - StyleSheet / Reanimated di React Native secara langsung
 * - CSS variables di web via `toCssVariables()`
 *
 * Prinsip inti: Flat. Modern. Minimalis. Presisi.
 * Tidak ada shadow di seluruh sistem — hierarki dibentuk lewat
 * border, kontras warna, dan spacing.
 */

// ==================================================================
// 2. COLOR SYSTEM
// ==================================================================

/** 2.1 Brand — #000000 dipakai sengaja terbatas (primary action, border-focus, ikon aktif) */
export const brand = {
  black: "#000000",
  white: "#FFFFFF",
} as const

/** 2.2 Neutral Scale — Cool Gray */
export const gray = {
  50: "#F8F9FA", // App background (light)
  100: "#F1F3F5", // Surface / card fill (light)
  200: "#E9ECEF", // Cadangan — tidak lagi dipakai sebagai border default
  300: "#DEE2E6", // Divider sangat halus (opsional, dekoratif murni)
  400: "#CED4DA", // Border default (light)
  500: "#ADB5BD", // Teks disabled, placeholder
  600: "#868E96", // text-tertiary — ikon default, teks besar dekoratif (>=18px)
  700: "#495057", // text-secondary (light) / border default (dark)
  800: "#343A40", // Surface elevated (dark)
  900: "#212529", // Teks utama alternatif / surface fill (dark)
  950: "#16181B", // text-primary (light) / app background (dark, opsional)
} as const

/**
 * 2.3 Semantic Colors — didesaturasi ringan.
 * Kontras sudah AA-compliant di semua kombinasi (4.79–9.37:1).
 * Info sengaja netral (abu), bukan biru — menjaga sistem tetap monokrom.
 *
 * Dark mode: `text` SENGAJA == `fill` (bukan bug). Dokumen §2.3 hanya punya
 * satu kolom "Fill (dark)"; fill terang di atas bgSoft gelap sudah > AA di
 * semua ukuran teks, jadi tidak perlu dipisah — sama seperti keputusan
 * text-tertiary == text-secondary di dark mode.
 */
export const semantic = {
  success: {
    light: { fill: "#16A34A", text: "#15803D", bgSoft: "#F0FDF4" },
    dark: { fill: "#4ADE80", text: "#4ADE80", bgSoft: "#14251A" },
  },
  danger: {
    light: { fill: "#DC2626", text: "#B91C1C", bgSoft: "#FEF2F2" },
    dark: { fill: "#F87171", text: "#F87171", bgSoft: "#2A1616" },
  },
  warning: {
    light: { fill: "#D97706", text: "#B45309", bgSoft: "#FFFBEB" },
    dark: { fill: "#FBBF24", text: "#FBBF24", bgSoft: "#2A2113" },
  },
  info: {
    light: { fill: "#4B5563", text: "#374151", bgSoft: "#F3F4F6" },
    dark: { fill: "#9CA3AF", text: "#9CA3AF", bgSoft: "#1F2124" },
  },
} as const

/**
 * Chart / data-viz untuk kategori non-status (>2 kategori).
 * 3-step monokrom — semantic color eksklusif untuk status transaksi.
 */
export const chartMono = [gray[400], gray[600], gray[800]] as const

/** 2.4 Mode Tokens */
export const light = {
  background: "#FFFFFF",
  surface: "#F8F9FA", // card, input fill
  surfaceElevated: "#FFFFFF", // dengan border, karena tanpa shadow
  /**
   * border-default: card, divider, separator — border STRUKTURAL/dekoratif.
   * Kontras vs background 1.49:1 — SENGAJA di bawah 3:1. WCAG 1.4.11 hanya
   * berlaku untuk komponen UI interaktif dan bagian yang dibutuhkan untuk
   * mengenali komponen; pembatas dekoratif dikecualikan (§6 Flat, tanpa shadow).
   * JANGAN pakai untuk outline form control — pakai `borderControl`.
   */
  borderDefault: "#CED4DA", // gray.400
  /**
   * border-control: outline resting form control (Input, Checkbox, Radio,
   * Switch off, Select, Textarea, Stepper). WCAG 1.4.11 non-text contrast
   * >= 3:1: gray.600 vs #FFFFFF = 3.32:1, vs surface #F8F9FA = 3.15:1.
   */
  borderControl: "#868E96", // gray.600
  borderFocus: "#000000", // fokus/aktif pada elemen interaktif
  borderError: "#DC2626",
  textPrimary: "#16181B",
  textSecondary: "#495057", // gray.700 — body, caption, label (AA)
  textTertiary: "#868E96", // gray.600 — ikon, teks besar >=18px
  textDisabled: "#ADB5BD",
  primary: "#000000",
  primaryForeground: "#FFFFFF",
  /**
   * Scrim di belakang overlay (BottomSheet, Modal, ActionSheet). Selalu hitam
   * (bukan invert seperti `primary`) karena tugasnya meredupkan konten, dan
   * di dark mode alpha dinaikkan supaya sheet tetap terpisah dari background
   * yang sudah gelap. Pakai lewat class `bg-overlay`.
   */
  overlay: "rgba(0, 0, 0, 0.4)",
} as const

export const dark = {
  background: "#121212",
  surface: "#1A1A1A",
  /**
   * Dinaikkan dari #212121 (1.08:1 vs background — skeleton & sheet tidak
   * terbedakan). #2A2A2A vs #121212 = 1.34:1, setara dengan jarak
   * surface→background di light mode. Elevated tetap butuh border-default.
   */
  surfaceElevated: "#2A2A2A",
  borderDefault: "#3A3A3A", // struktural/dekoratif — lihat catatan di `light`
  /** WCAG 1.4.11: #6B6B6B vs #121212 = 3.52:1, vs surface #1A1A1A = 3.18:1 */
  borderControl: "#6B6B6B",
  borderFocus: "#FFFFFF",
  borderError: "#F87171",
  textPrimary: "#F5F5F5",
  textSecondary: "#A0A0A0",
  textTertiary: "#A0A0A0", // sama dgn secondary — kontras di dark sudah aman
  textDisabled: "#5C5C5C",
  primary: "#FFFFFF", // invert di dark mode
  primaryForeground: "#000000",
  overlay: "rgba(0, 0, 0, 0.6)",
} as const

export type ModeTokens = { readonly [K in keyof typeof light]: string }
export type ColorMode = "light" | "dark"

export const modes: Record<ColorMode, ModeTokens> = { light, dark }

export const colors = {
  brand,
  gray,
  semantic,
  chartMono,
  light,
  dark,
} as const

// ==================================================================
// 3. TYPOGRAPHY
// ==================================================================

/**
 * 3.1 Font Roles
 * - Sofia Sans      : UI & body (default 95% layar)
 * - EB Garamond     : Display/editorial — hero, konfirmasi besar, onboarding (terbatas)
 * - JetBrains Mono  : Data presisi — nominal uang, ID transaksi, OTP, rekening
 *
 * Semua font di-bundle offline via expo-font; tidak butuh fallback network.
 */
export const fontFamily = {
  sans: "Sofia Sans",
  serif: "EB Garamond",
  mono: "JetBrains Mono",
} as const

/**
 * Nama asset font per weight untuk expo-font / StyleSheet.
 * (RN membutuhkan family name spesifik per weight, bukan fontWeight.)
 */
export const fontFamilyByWeight = {
  sans: {
    400: "SofiaSans-Regular",
    500: "SofiaSans-Medium",
    600: "SofiaSans-SemiBold",
    700: "SofiaSans-Bold",
  },
  serif: {
    500: "EBGaramond-Medium",
  },
  mono: {
    500: "JetBrainsMono-Medium",
    600: "JetBrainsMono-SemiBold",
  },
} as const

export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const

/** Letter-spacing khusus JetBrains Mono (+0.5px di seluruh varian, termasuk OTP) */
export const letterSpacing = {
  normal: 0,
  mono: 0.5,
} as const

export type TypeStyle = {
  fontFamily: (typeof fontFamily)[keyof typeof fontFamily]
  fontSize: number
  lineHeight: number
  fontWeight: (typeof fontWeight)[keyof typeof fontWeight]
  /** Weight override di dark mode (H1/H2 turun satu tingkat, 700 -> 600) */
  fontWeightDark?: (typeof fontWeight)[keyof typeof fontWeight]
  letterSpacing?: number
  /** Angka dalam Sofia Sans pakai tabular figures agar rapi di list/tabel */
  fontVariantNumeric?: "tabular-nums"
}

/** 3.2 Type Scale — spacious line-height, fixed (tidak mengikuti Dynamic Type OS) */
export const typography = {
  display: {
    fontFamily: fontFamily.serif,
    fontSize: 34,
    lineHeight: 42,
    fontWeight: 500,
  },
  h1: {
    fontFamily: fontFamily.sans,
    fontSize: 28,
    lineHeight: 36,
    fontWeight: 700,
    fontWeightDark: 600,
    fontVariantNumeric: "tabular-nums",
  },
  h2: {
    fontFamily: fontFamily.sans,
    fontSize: 22,
    lineHeight: 30,
    fontWeight: 700,
    fontWeightDark: 600,
    fontVariantNumeric: "tabular-nums",
  },
  h3: {
    fontFamily: fontFamily.sans,
    fontSize: 18,
    lineHeight: 26,
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
  },
  bodyLarge: {
    fontFamily: fontFamily.sans,
    fontSize: 16,
    lineHeight: 26,
    fontWeight: 400,
    fontVariantNumeric: "tabular-nums",
  },
  body: {
    fontFamily: fontFamily.sans,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: 400,
    fontVariantNumeric: "tabular-nums",
  },
  caption: {
    fontFamily: fontFamily.sans,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: 400, // boleh 500 untuk penekanan ringan
    fontVariantNumeric: "tabular-nums",
  },
  label: {
    fontFamily: fontFamily.sans,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: 600, // jangan ALL CAPS — cukup weight 600 + ukuran kecil
    fontVariantNumeric: "tabular-nums",
  },
  monoLarge: {
    fontFamily: fontFamily.mono,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: 600,
    letterSpacing: letterSpacing.mono,
  },
  monoBody: {
    fontFamily: fontFamily.mono,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 500,
    letterSpacing: letterSpacing.mono,
  },
} as const satisfies Record<string, TypeStyle>

export type TypographyKey = keyof typeof typography

// ==================================================================
// 4. SPACING & LAYOUT
// ==================================================================

/** Base unit 4px. Density: Spacious. */
export const space = {
  0: 0,
  1: 4, // Gap ikon-teks rapat
  2: 8, // Gap internal komponen kecil
  3: 12, // Padding input vertikal
  4: 16, // Gap standar antar elemen
  5: 20, // Card padding default
  6: 24, // Screen padding horizontal
  8: 32, // Gap antar section
  10: 40, // Padding card besar / hero
  12: 48, // Jarak antar blok konten besar
  16: 64, // Top spacing layar penuh (splash, empty state)
} as const

export const layout = {
  screenPaddingX: space[6], // 24px kiri-kanan
  cardPadding: space[5], // 20px semua sisi
  cardGap: space[3], // 12px antar card dalam list
  iconTextGap: space[2], // 8px ikon ke teks
  /** §11 Web: satu breakpoint ~768px; di atasnya konten di-cap 520px & center */
  breakpoint: 768,
  maxContentWidth: 520,
  gridColumns: 12,
} as const

// ==================================================================
// 5. RADIUS — sharp/minim rounded, 8px adalah maksimum non-pill
// ==================================================================

export const radius = {
  none: 0,
  xs: 4, // Badge, chip, input kecil, tooltip
  sm: 6, // Button, input
  md: 8, // Card, bottom sheet handle area, modal — MAKSIMUM non-pill
  full: 999, // Avatar, dot indicator, pill khusus
} as const

// ==================================================================
// 6. ELEVATION & BORDER — tidak ada shadow di seluruh sistem
// ==================================================================

/**
 * 6.1 Border Roles — 4 role terpisah (fix collision "border-strong" di v1.0;
 * `control` ditambahkan di audit #6 untuk WCAG 1.4.11).
 *
 * - default : card, divider, separator (struktural, dikecualikan dari 1.4.11)
 * - control : outline resting form control — wajib >= 3:1 vs background
 * - focus   : fokus/aktif elemen interaktif
 * - error   : validasi error
 */
export const borderWidth = {
  none: 0,
  default: 1,
  control: 1,
  focus: 1.5,
  error: 1.5,
} as const

export const border = {
  default: {
    width: borderWidth.default,
    light: light.borderDefault,
    dark: dark.borderDefault,
  },
  control: {
    width: borderWidth.control,
    light: light.borderControl,
    dark: dark.borderControl,
  },
  focus: {
    width: borderWidth.focus,
    light: light.borderFocus,
    dark: dark.borderFocus,
  },
  error: {
    width: borderWidth.error,
    light: light.borderError,
    dark: dark.borderError,
  },
} as const

/** Tidak ada shadow — export eksplisit untuk mencegah pemakaian tidak sengaja */
export const shadow = {
  none: {
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
} as const

/** 6.2 Layering / Z-index */
export const zIndex = {
  base: 0, // Konten & scroll
  sticky: 10, // Sticky header / Bottom Tab Bar
  backdrop: 40,
  bottomSheet: 50,
  modal: 60, // Modal / Dialog
  banner: 70, // Di atas modal — status/error kritikal harus tetap terlihat
} as const

// ==================================================================
// 7. ICONOGRAPHY — Phosphor Icons
// ==================================================================

export const icon = {
  size: {
    xs: 16,
    sm: 20,
    md: 24, // default
    lg: 28,
    xl: 32,
  },
  /** Weight Phosphor: default Regular, aktif/selected Fill atau Bold */
  weight: {
    default: "regular",
    active: "fill",
    activeAlt: "bold",
  },
  /** Warna ikon default = text-tertiary; aktif = text-primary / primary */
  color: {
    light: { default: light.textTertiary, active: light.textPrimary },
    dark: { default: dark.textTertiary, active: dark.textPrimary },
  },
  textGap: space[2], // 8px
} as const

// ==================================================================
// 8. MOTION & ANIMATION
// ==================================================================

export const motion = {
  duration: {
    press: 150, // Button press (satu-satunya exception cepat)
    fast: 250,
    base: 300, // Page transition push
    slow: 350,
  },
  /** cubic-bezier(0.4, 0, 0.2, 1) */
  easing: {
    standard: [0.4, 0, 0.2, 1] as const,
    standardCss: "cubic-bezier(0.4, 0, 0.2, 1)",
  },
  /** Reanimated withSpring config untuk bottom sheet & settle pull-to-refresh */
  spring: {
    damping: 20,
    stiffness: 200,
    mass: 1,
  },
  scale: {
    press: 0.97, // Button pressed
  },
  opacity: {
    disabled: 0.4, // Button disabled — opacity, bukan token solid
  },
  /**
   * Overlay non-sheet (Modal/Dialog, Tooltip, Popover). §8 hanya mendefinisikan
   * spring untuk Bottom Sheet; overlay yang muncul "di tempat" (bukan dari tepi
   * layar) memakai fade + geser kecil + scale, meminjam bahasa Button press
   * (scale 0.97) supaya satu kosakata gerak. Durasi masuk `fast` (250ms) dan
   * keluar lebih singkat: keluar harus terasa segera setelah user memutuskan.
   */
  overlay: {
    enterDuration: 250,
    exitDuration: 200,
    translateY: 8, // = space[2]
    scaleFrom: 0.97, // = scale.press
    /** Tooltip: geser lebih kecil karena elemennya kecil dan dekat trigger */
    tooltipTranslateY: 4,
    tooltipMaxWidth: 260,
  },
  /** Spinner inline/pagination: monokrom text-tertiary, 16–20px */
  inlineSpinnerSize: { min: icon.size.xs, max: icon.size.sm },
} as const

// ==================================================================
// 9. AKSESIBILITAS
// ==================================================================

/**
 * Konstanta a11y non-visual. BUKAN token CSS: tidak ikut ke tailwind.config /
 * global.css (audit #12 tidak perlu menyinkronkannya). Dipakai lewat
 * `lib/hit-slop.ts` untuk menghitung `hitSlop`, dan sebagai rujukan angka di
 * komentar/komponen (mis. range-slider, text-link).
 */
export const a11y = {
  /**
   * Target sentuh minimum (audit #1): 44pt mengikuti iOS HIG; Android 48dp
   * dicapai komponen yang perlu lewat slop tambahan (Checkbox, Radio,
   * IconButton sm). Kelas Tailwind padanannya: `min-h-11 min-w-11` (44px).
   */
  minHitTarget: 44,
} as const

// ==================================================================
// AGGREGATE
// ==================================================================

export const tokens = {
  colors,
  fontFamily,
  fontFamilyByWeight,
  fontWeight,
  letterSpacing,
  typography,
  space,
  layout,
  radius,
  borderWidth,
  border,
  shadow,
  zIndex,
  icon,
  motion,
  a11y,
} as const

export type Tokens = typeof tokens

// ==================================================================
// ADAPTERS
// ==================================================================

const px = (n: number) => `${n}px`

/**
 * Konversi ke `theme.extend` untuk tailwind.config.js (NativeWind & web).
 *
 * Mode-aware tokens (background, surface, text-*, border-*, primary)
 * memakai CSS variables agar dark mode bisa di-switch via class/`vars()`
 * NativeWind. Gunakan `toCssVariables()` untuk mengisi nilainya.
 *
 * @example
 * // tailwind.config.js
 * const { toTailwindTheme } = require("./lib/tokens")
 * module.exports = { theme: { extend: toTailwindTheme() } }
 */
export function toTailwindTheme() {
  return {
    colors: {
      black: brand.black,
      white: brand.white,
      gray,
      // Mode-aware (CSS variables)
      background: "var(--color-background)",
      surface: {
        DEFAULT: "var(--color-surface)",
        elevated: "var(--color-surface-elevated)",
      },
      border: {
        DEFAULT: "var(--color-border-default)",
        control: "var(--color-border-control)",
        focus: "var(--color-border-focus)",
        error: "var(--color-border-error)",
      },
      text: {
        primary: "var(--color-text-primary)",
        secondary: "var(--color-text-secondary)",
        tertiary: "var(--color-text-tertiary)",
        disabled: "var(--color-text-disabled)",
      },
      primary: {
        DEFAULT: "var(--color-primary)",
        foreground: "var(--color-primary-foreground)",
      },
      overlay: "var(--color-overlay)",
      success: {
        DEFAULT: "var(--color-success-fill)",
        text: "var(--color-success-text)",
        soft: "var(--color-success-soft)",
      },
      danger: {
        DEFAULT: "var(--color-danger-fill)",
        text: "var(--color-danger-text)",
        soft: "var(--color-danger-soft)",
      },
      warning: {
        DEFAULT: "var(--color-warning-fill)",
        text: "var(--color-warning-text)",
        soft: "var(--color-warning-soft)",
      },
      info: {
        DEFAULT: "var(--color-info-fill)",
        text: "var(--color-info-text)",
        soft: "var(--color-info-soft)",
      },
    },
    fontFamily: {
      sans: [fontFamily.sans, "system-ui", "sans-serif"],
      serif: [fontFamily.serif, "Georgia", "serif"],
      mono: [fontFamily.mono, "ui-monospace", "monospace"],
    },
    // Utility type-scale (text-h1, text-body, …) HANYA membawa size + lineHeight
    // (+ letterSpacing untuk mono). Weight TIDAK disertakan: di RN weight sudah
    // implisit di file font (font-sans-700), dan fontWeight "700" di atas file
    // Bold memicu faux-bold di Android. Weight dark-mode H1/H2 (700 -> 600)
    // ditangani komponen Text lewat `dark:font-sans-600`.
    fontSize: Object.fromEntries(
      Object.entries(typography).map(([key, t]) => {
        const opts: Record<string, string> = {
          lineHeight: px(t.lineHeight),
        }
        if ("letterSpacing" in t && t.letterSpacing) {
          opts.letterSpacing = px(t.letterSpacing)
        }
        return [key, [px(t.fontSize), opts]]
      }),
    ) as Record<TypographyKey, [string, Record<string, string>]>,
    letterSpacing: {
      mono: px(letterSpacing.mono),
    },
    spacing: Object.fromEntries(
      Object.entries(space).map(([k, v]) => [k, px(v)]),
    ) as Record<keyof typeof space, string>,
    borderRadius: {
      none: px(radius.none),
      xs: px(radius.xs),
      sm: px(radius.sm),
      md: px(radius.md),
      DEFAULT: px(radius.sm),
      full: px(radius.full),
    },
    borderWidth: {
      DEFAULT: px(borderWidth.default),
      0: "0px",
      focus: px(borderWidth.focus),
      error: px(borderWidth.error),
    },
    boxShadow: { none: "none", DEFAULT: "none" },
    zIndex: Object.fromEntries(
      Object.entries(zIndex).map(([k, v]) => [k, String(v)]),
    ) as Record<keyof typeof zIndex, string>,
    maxWidth: {
      content: px(layout.maxContentWidth),
    },
    screens: {
      md: px(layout.breakpoint),
    },
    transitionDuration: {
      press: `${motion.duration.press}ms`,
      fast: `${motion.duration.fast}ms`,
      DEFAULT: `${motion.duration.base}ms`,
      slow: `${motion.duration.slow}ms`,
    },
    transitionTimingFunction: {
      DEFAULT: motion.easing.standardCss,
      standard: motion.easing.standardCss,
    },
    scale: {
      press: String(motion.scale.press),
    },
    opacity: {
      disabled: String(motion.opacity.disabled),
    },
  }
}

/**
 * CSS variables per mode — untuk `:root` / `.dark` di web,
 * atau `vars()` di NativeWind.
 *
 * @example
 * // NativeWind
 * import { vars } from "nativewind"
 * <View style={vars(toCssVariables("dark"))} />
 */
export function toCssVariables(mode: ColorMode): Record<string, string> {
  const m = modes[mode]
  return {
    "--color-background": m.background,
    "--color-surface": m.surface,
    "--color-surface-elevated": m.surfaceElevated,
    "--color-border-default": m.borderDefault,
    "--color-border-control": m.borderControl,
    "--color-border-focus": m.borderFocus,
    "--color-border-error": m.borderError,
    "--color-text-primary": m.textPrimary,
    "--color-text-secondary": m.textSecondary,
    "--color-text-tertiary": m.textTertiary,
    "--color-text-disabled": m.textDisabled,
    "--color-primary": m.primary,
    "--color-primary-foreground": m.primaryForeground,
    "--color-overlay": m.overlay,
    "--color-success-fill": semantic.success[mode].fill,
    "--color-success-text": semantic.success[mode].text,
    "--color-success-soft": semantic.success[mode].bgSoft,
    "--color-danger-fill": semantic.danger[mode].fill,
    "--color-danger-text": semantic.danger[mode].text,
    "--color-danger-soft": semantic.danger[mode].bgSoft,
    "--color-warning-fill": semantic.warning[mode].fill,
    "--color-warning-text": semantic.warning[mode].text,
    "--color-warning-soft": semantic.warning[mode].bgSoft,
    "--color-info-fill": semantic.info[mode].fill,
    "--color-info-text": semantic.info[mode].text,
    "--color-info-soft": semantic.info[mode].bgSoft,
  }
}

/**
 * Resolve type style ke object siap pakai di RN `StyleSheet` / web CSS,
 * dengan weight yang sudah disesuaikan untuk dark mode (H1/H2 -> 600).
 */
export function getTypeStyle(key: TypographyKey, mode: ColorMode = "light") {
  const t = typography[key]
  const weight =
    mode === "dark" && "fontWeightDark" in t && t.fontWeightDark
      ? t.fontWeightDark
      : t.fontWeight
  return {
    fontFamily: t.fontFamily,
    fontSize: t.fontSize,
    lineHeight: t.lineHeight,
    fontWeight: String(weight) as "400" | "500" | "600" | "700",
    letterSpacing: "letterSpacing" in t ? t.letterSpacing ?? 0 : 0,
  }
}

export default tokens
