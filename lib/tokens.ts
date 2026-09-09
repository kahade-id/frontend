/**
 * Kahade Design System — Design Tokens v2 (Soft & Presisi)
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
 * Prinsip inti: Soft. Modern. Minimalis. Presisi.
 * v2 berevolusi dari v1.1 (flat monokrom, nol shadow): basis netral hangat
 * "Kertas", satu aksen Pinus untuk momen trust/escrow, info berwarna, depth
 * lembut bertingkat (konsumsi via lib/elevation.ts — bukan utility shadow
 * generik), dan motion yang lebih kaya namun tetap disengaja per konteks.
 * Disiplin v1.1 dipertahankan: tanpa angka sembarang, kontras AA
 * terdokumentasi, semua motion punya fallback reduced-motion.
 */

// ==================================================================
// 2. COLOR SYSTEM
// ==================================================================

/** 2.1 Brand — #000000 dipakai sengaja terbatas (primary action, border-focus, ikon aktif) */
export const brand = {
  black: "#000000",
  white: "#FFFFFF",
} as const

/** 2.2 Neutral Scale — Warm "Kertas" (v2: pengganti abu dingin v1.1) */
export const gray = {
  50: "#FAF8F5", // App background tint (jarang dipakai langsung)
  100: "#F2EFE9", // Surface / card fill alternatif
  200: "#E7E2D8", // Cadangan — tidak lagi dipakai sebagai border default
  300: "#D6CFC2", // Divider sangat halus (opsional, dekoratif murni)
  400: "#B4AB99", // Border default hangat (dark chart terang)
  500: "#8A8172", // Teks disabled hangat, langkah chart dark pertama
  600: "#6E6759", // text-tertiary + border-control (light): 5.60 vs bg, 5.15 vs surface
  700: "#4A443C", // text-secondary (light): 9.62 vs bg, 8.83 vs surface
  800: "#2E2A26", // Surface elevated hangat (dark)
  900: "#211D19", // Teks utama alternatif / surface fill (dark)
  950: "#1C1917", // text-primary (light): 17.49 vs bg, 16.06 vs surface
} as const

/**
 * 2.3 Semantic Colors — v2 sedikit lebih hidup dari v1.1, tetap AA di dua mode.
 * Rasio light (text/bgSoft · fill/surface): success 4.58/3.03, danger 5.83/4.44,
 * warning 4.99/3.20, info 7.32/5.82. Dark (fill/bgSoft · fill/surface): success
 * 9.20/9.97, danger 6.20/6.28, warning 9.49/10.41, info 7.63/7.87.
 * Info v2 berwarna "Sungai" (biru sungai) — keluar dari abu monokrom v1.1.
 *
 * Dark mode: `text` SENGAJA == `fill` (bukan bug). Dokumen §2.3 hanya punya
 * satu kolom "Fill (dark)"; fill terang di atas bgSoft gelap sudah > AA di
 * semua ukuran teks, jadi tidak perlu dipisah — sama seperti keputusan
 * text-tertiary == text-secondary di dark mode.
 */
export const semantic = {
  success: {
    light: { fill: "#16A34A", text: "#15803D", bgSoft: "#EDF7F0" },
    dark: { fill: "#4ADE80", text: "#4ADE80", bgSoft: "#14251A" },
  },
  danger: {
    light: { fill: "#D92D20", text: "#B42318", bgSoft: "#FDEEEC" },
    dark: { fill: "#F87171", text: "#F87171", bgSoft: "#2A1616" },
  },
  warning: {
    light: { fill: "#DC6803", text: "#B54708", bgSoft: "#FEF4E8" },
    dark: { fill: "#FBBF24", text: "#FBBF24", bgSoft: "#2A2113" },
  },
  info: {
    light: { fill: "#1D5FB0", text: "#174E92", bgSoft: "#EBF2FA" },
    dark: { fill: "#7FB3E8", text: "#7FB3E8", bgSoft: "#131E2A" },
  },
} as const

/**
 * 2.3b Accent — satu warna matang untuk momen trust & escrow (v2 BARU).
 * "Pinus" (hijau pinus dalam): uang, aman, sukses — kosakata escrow tanpa
 * edukasi, syariah-friendly, menjauhi hijau neon fintech generik.
 *
 * Aturan pakai (disiplin, bukan dekorasi): momen/status ESCROW & TRUST
 * (dana tertahan, escrow selesai, skor trust), BUKAN CTA umum (tetap primary
 * hitam/putih) dan BUKAN status transaksi (tetap semantic). Lihat Button
 * variant "accent" dan Badge/Icon tone "accent".
 *
 * Rasio light: text/bgSoft 7.04, text/bg 8.00 (link/CTA teks), fill/surface
 * 5.97 (ikon), onFill/fill 6.50 (label tombol solid). Dark: fill/bgSoft 8.15,
 * fill/surface 8.70, onFill/fill 9.36. text == fill di dark (pola §2.3).
 */
export const accent = {
  light: { fill: "#0C6B4E", text: "#0A5C43", bgSoft: "#E8F3ED", onFill: "#FFFFFF" },
  dark: { fill: "#3ECF8E", text: "#3ECF8E", bgSoft: "#10241B", onFill: "#141210" },
} as const

/**
 * Chart / data-viz untuk kategori non-status (>2 kategori).
 * 3-step monokrom — semantic color eksklusif untuk status transaksi.
 *
 * Langkah terendah wajib >= 3:1 terhadap background (WCAG 1.4.11): batang
 * chart adalah "graphical object required to understand the content", jadi
 * pengecualian border dekoratif §6 TIDAK berlaku. Tangga dimulai dari
 * gray.600 (#6E6759 = 5.60:1 vs bg, 5.15:1 vs surface).
 *
 * `chartMono` mendeskripsikan LIGHT. Dark mode harus dibaca lewat
 * `chartMonoDark`: di atas #141210 urutannya dibalik (abu lebih terang =
 * lebih menonjol).
 */
export const chartMono = [gray[600], gray[700], gray[800]] as const

/** Padanan dark dari `chartMono` — langkah terendah gray.500 = 4.86:1 vs #141210. */
export const chartMonoDark = [gray[500], gray[400], gray[300]] as const

/** 2.4 Mode Tokens */
export const light = {
  background: "#FFFFFF",
  surface: "#F7F5F1", // card, input fill — warm paper (v2)
  surfaceElevated: "#FFFFFF", // dengan border + elevasi low/high (v2)
  /**
   * border-default: card, divider, separator — border STRUKTURAL/dekoratif.
   * Kontras vs background 1.49:1 — SENGAJA di bawah 3:1. WCAG 1.4.11 hanya
   * berlaku untuk komponen UI interaktif dan bagian yang dibutuhkan untuk
   * mengenali komponen; pembatas dekoratif dikecualikan (§6).
   * JANGAN pakai untuk outline form control — pakai `borderControl`.
   */
  borderDefault: "#D9D3C5", // gray.400 hangat
  /**
   * border-control: outline resting form control (Input, Select, DateField,
   * Checkbox, Radio, Switch off, NumberStepper, SegmentedControl, ToggleGroup
   * belum terpilih) DAN indikator state non-teks (dot PIN kosong, track
   * Slider, bintang Rating kosong). WCAG 1.4.11 non-text contrast >= 3:1:
   * #6E6759 vs #FFFFFF = 5.60:1, vs surface #F7F5F1 = 5.15:1.
   * Daftar lengkap + pengecualian: docs/audit/findings/06-non-text-contrast.md
   * Bukan untuk Button secondary (dikenali dari label) atau border kartu.
   */
  borderControl: "#6E6759", // gray.600
  borderFocus: "#000000", // fokus/aktif pada elemen interaktif
  borderError: "#D92D20", // == danger.fill
  textPrimary: "#1C1917", // 17.49 vs bg, 16.06 vs surface
  textSecondary: "#4A443C", // gray.700 — body, caption, label: 9.62/8.83
  textTertiary: "#6E6759", // gray.600 — ikon, teks besar >=18px: 5.60/5.15
  textDisabled: "#A8A29E",
  primary: "#000000",
  primaryForeground: "#FFFFFF",
  /**
   * Scrim di belakang overlay (BottomSheet, Modal, ActionSheet). Selalu hitam
   * (bukan invert seperti `primary`) karena tugasnya meredupkan konten, dan
   * di dark mode alpha dinaikkan supaya sheet tetap terpisah dari background
   * yang sudah gelap. Pakai lewat class `bg-overlay`.
   */
  overlay: "rgba(0, 0, 0, 0.4)",
  /**
   * Scrim di atas MEDIA (thumbnail, galeri). `overlay` 0.4 terlalu lemah di
   * sini: di atas foto terang ia tersusun jadi #999999, sehingga teks putih
   * hanya 2.85:1 — di bawah 3:1 objek grafis apalagi 4.5:1 teks. 0.7 memberi
   * 8.45:1 pada kasus terburuk (foto putih polos).
   */
  overlayMedia: "rgba(0, 0, 0, 0.7)",
} as const

export const dark = {
  background: "#141210", // sedikit hangat dari v1.1 (#121212)
  surface: "#1C1A16",
  /**
   * #2E2A24 vs #141210 = 1.31:1, setara dengan jarak elevated→background v1.1
   * (1.34:1). Elevated tetap butuh border-default (+ shadow high di overlay).
   */
  surfaceElevated: "#2E2A24",
  borderDefault: "#3A352D", // struktural/dekoratif — 1.54 vs bg, lihat `light`
  /** WCAG 1.4.11: #7D7668 vs #141210 = 4.15:1, vs surface #1C1A16 = 3.86:1 */
  borderControl: "#7D7668",
  borderFocus: "#FFFFFF",
  borderError: "#F87171", // == danger.fill
  textPrimary: "#F5F4F0", // 16.98 vs bg, 15.79 vs surface
  textSecondary: "#A8A29A", // 7.39 vs bg, 6.87 vs surface
  textTertiary: "#A8A29A", // sama dgn secondary — kontras di dark sudah aman
  textDisabled: "#5C5750",
  primary: "#FFFFFF", // invert di dark mode
  primaryForeground: "#000000",
  overlay: "rgba(0, 0, 0, 0.6)",
  /** Lihat `overlayMedia` di light — alasan dan aritmetika kontrasnya sama. */
  overlayMedia: "rgba(0, 0, 0, 0.7)",
} as const

export type ModeTokens = { readonly [K in keyof typeof light]: string }
export type ColorMode = "light" | "dark"

export const modes: Record<ColorMode, ModeTokens> = { light, dark }

export const colors = {
  brand,
  gray,
  semantic,
  accent,
  chartMono,
  chartMonoDark,
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
  /**
   * 2px — setengah unit dasar. Dipakai HANYA untuk celah vertikal rapat
   * judul→subjudul di dalam satu baris list (26 komponen menulisnya sebagai
   * `gap-[2px]` sebelum langkah ini ada). Bukan pengganti `1` (4px) untuk
   * gap antar elemen.
   */
  "0.5": 2,
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
  /**
   * Inset kiri divider di dalam baris list, supaya garis mulai sejajar TEKS
   * (bukan ikon/avatar). Nilainya turunan komposisi, bukan angka bebas:
   *   icon     : px-6 (24) + IconBox md (40) + gap-3 (12) = 76
   *   avatar   : px-6 (24) + Avatar sm (32) + gap-2 (8)  = 64
   *   listItem : px-4 (16) + IconBox sm (32) + gap-3 (12) = 60
   * Sebelum token ini ada, ketiganya ditulis sebagai `ml-[76px]`/`ml-[64px]`/
   * `ml-[60px]` di 10 komponen — angka turunan yang tidak bisa diverifikasi
   * dan mudah menyimpang saat ukuran leading berubah.
   */
  rowDividerInset: { icon: 76, avatar: 64, listItem: 60 },
  /** §11 Web: satu breakpoint ~768px; di atasnya konten di-cap 520px & center */
  breakpoint: 768,
  maxContentWidth: 520,
  gridColumns: 12,
} as const

// ==================================================================
// 5. RADIUS — sharp/minim rounded; v2 menambah lg khusus kartu besar
// ==================================================================

export const radius = {
  none: 0,
  xs: 4, // Badge, chip, input kecil, tooltip
  sm: 6, // Button, input — kontrol TETAP di sini (v2 tidak mengubah)
  md: 8, // Card biasa, bottom sheet handle area, modal
  /**
   * lg 12px (v2 BARU) — HANYA untuk kartu besar/hero dan sheet di web lebar.
   * Alasan dibatasi: radius besar di semua card (= "kit SaaS" generik) justru
   * menghilangkan hierarki; kontrol dan kartu biasa tetap sm/md.
   */
  lg: 12,
  full: 999, // Avatar, dot indicator, pill khusus
} as const

// ==================================================================
// 6. ELEVATION & BORDER — depth lembut bertingkat (v2)
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
  /**
   * Cincin pemisah badge/lencana yang menumpuk di atas elemen lain (seal
   * verifikasi Avatar). 2px: 1px hilang secara optis di atas foto, 3px
   * mulai memakan diameter avatar `xs`.
   */
  badge: 2,
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

/**
 * 6.2 Shadow scale — "terangkat lembut", bukan drop tebal (v2 BARU).
 * Konsumsi SELALU via `elevationStyle()` dari lib/elevation.ts — satu titik
 * yang me-resolve warna/opacity per mode + boxShadow web + elevation Android.
 * Jangan tulis `shadow*`/`elevation`/`boxShadow` manual di komponen, dan
 * jangan pernah tempel level yang sama ke semua card (anti "kit SaaS"):
 *   - flat/none : list row, divider, input resting — struktural, border saja.
 *   - low       : kartu interaktif resting, chip terpilih.
 *   - medium    : toast, FAB, popover/dropdown.
 *   - high      : bottom sheet, modal/dialog.
 *
 * Warna shadow warm-tinted (#1C1917) di light agar menyatu dengan netral
 * Kertas; di dark menghitam (#000000) karena shadow berwarna tak terlihat di
 * atas background gelap — di dark, BORDER tetap pemisah utama, shadow hanya
 * penguat. Opacity dark = light + 0.28 (low 0.34 / medium 0.38 / high 0.44):
 * tanpa boost, shadow iOS lenyap total di atas #141210. Android tidak bisa
 * mewarnai shadow (selalu netral) — opacity dijaga kecil agar tidak kotor.
 */
export const shadow = {
  none: {
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  color: {
    light: "#1C1917",
    dark: "#000000",
  },
  low: {
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    shadowOpacity: { light: 0.06, dark: 0.34 },
    elevation: 2,
  },
  medium: {
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 16,
    shadowOpacity: { light: 0.1, dark: 0.38 },
    elevation: 4,
  },
  high: {
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 32,
    shadowOpacity: { light: 0.16, dark: 0.44 },
    elevation: 8,
  },
} as const

/** Level elevasi untuk `elevationStyle()` — "flat" == shadow.none. */
export type ElevationLevel = "flat" | "low" | "medium" | "high"

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
    /**
     * moment 800 (v2 BARU) — signature moments yang memang harus DITONTON:
     * ring mengisi, angka count-up. Bukan untuk transisi rutin (terlalu lama).
     */
    moment: 800,
  },
  /**
   * Tiga kurva sesuai tujuan (v2): masuk soft-decelerate, keluar cepat,
   * standard untuk transisi rutin. Pasangan Css untuk web/framer.
   */
  easing: {
    standard: [0.4, 0, 0.2, 1] as const,
    standardCss: "cubic-bezier(0.4, 0, 0.2, 1)",
    /** easeOutCubic — konten masuk, reveal, expand. */
    enter: [0.33, 1, 0.68, 1] as const,
    enterCss: "cubic-bezier(0.33, 1, 0.68, 1)",
    /** easeInCubic — konten keluar; keluar harus terasa segera. */
    exit: [0.32, 0, 0.67, 0] as const,
    exitCss: "cubic-bezier(0.32, 0, 0.67, 0)",
  },
  /** Konfigurasi spring bersama untuk bottom sheet dan settle pull-to-refresh. */
  spring: {
    damping: 20,
    stiffness: 200,
    mass: 1,
  },
  /**
   * Spring playful (v2 BARU) — overshoot halus untuk momen yang layak terasa
   * ekspresif: unlock badge, toast masuk, sukses OTP/PIN, thumb slider aktif.
   * JANGAN dipakai untuk bottom sheet & settle pull-to-refresh (utilitarian).
   */
  springPlayful: {
    damping: 14,
    stiffness: 170,
    mass: 0.9,
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
    tooltipMaxWidthMd: 320,
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
      "overlay-media": "var(--color-overlay-media)",
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
      // Aksen v2 (Pinus) — momen trust & escrow. Lihat §2.3b untuk aturan pakai.
      accent: {
        DEFAULT: "var(--color-accent-fill)",
        text: "var(--color-accent-text)",
        soft: "var(--color-accent-soft)",
        foreground: "var(--color-accent-foreground)",
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
      lg: px(radius.lg),
      DEFAULT: px(radius.sm),
      full: px(radius.full),
    },
    borderWidth: {
      DEFAULT: px(borderWidth.default),
      0: "0px",
      focus: px(borderWidth.focus),
      error: px(borderWidth.error),
      badge: px(borderWidth.badge),
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
      moment: `${motion.duration.moment}ms`,
    },
    transitionTimingFunction: {
      DEFAULT: motion.easing.standardCss,
      standard: motion.easing.standardCss,
      enter: motion.easing.enterCss,
      exit: motion.easing.exitCss,
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
    "--color-overlay-media": m.overlayMedia,
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
    "--color-accent-fill": accent[mode].fill,
    "--color-accent-text": accent[mode].text,
    "--color-accent-soft": accent[mode].bgSoft,
    "--color-accent-foreground": accent[mode].onFill,
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
