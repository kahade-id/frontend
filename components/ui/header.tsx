/**
 * Kahade — <Header> (§9.15 Header, §9.22 Stepper di header, §6.2 layer 10).
 *
 * Bar atas layar: back (kiri) → judul (tengah) → aksi (kanan). Dipakai
 * sebagai header custom Expo Router (`header: () => <Header … />`) ATAU
 * langsung di dalam route dengan `headerShown: false`.
 *
 * Keputusan non-obvious:
 *   - Tinggi bar 56px (`h-14`) + paddingTop safe-area dari runtime inset
 *     (style, bukan className). Kolom kiri & kanan lebar tetap `w-12`
 *     (= IconButton md) x jumlah aksi supaya judul benar-benar center dan
 *     tidak bergeser saat aksi kanan berubah jumlah — kalau aksi kanan > 1,
 *     kolom kiri tetap 1 slot; judul akan sedikit off-center, itu diterima
 *     daripada memaksa lebar simetris yang membuang ruang judul.
 *   - `border-b border-border` default (pemisah border, bukan shadow §6).
 *     `transparent` mematikan border + bg untuk hero (beranda, onboarding).
 *   - Back memakai ArrowLeft (bukan CaretLeft) di semua platform — satu
 *     bahasa visual; default aksi `router.back()` dari expo-router agar
 *     pemanggil tidak perlu wiring setiap layar.
 *   - `progress` (0–1) merender <StepProgress> tepat di bawah bar — §9.22:
 *     bar tipis di header untuk alur multi-step, tanpa teks "Langkah X/Y".
 *   - Judul utama memakai H2; rute detail memakai H3 secara konsisten melalui
 *     `defaultHeaderTitleVariant`. H1 tetap milik konten body. `largeTitle`
 *     opsional merender H1 di baris kedua untuk layar utama tab.
 *   - Di web dibatasi `md:max-w-content` (§11), sejajar kolom konten.
 */
import { memo, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import { Platform, View, type LayoutChangeEvent, type ViewProps, type ViewStyle } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { ArrowLeft, X } from "phosphor-react-native"
import { usePathname, useRouter } from "expo-router"

import { IconButton } from "@/components/ui/icon-button"
import { Icon, type IconComponent } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { StepProgress } from "@/components/ui/stepper"
import { Text } from "@/components/ui/text"
import { ScreenInsetsContext } from "@/components/ui/screen"
import { useTheme } from "@/components/theme-provider"
import { elevationStyle } from "@/lib/elevation"
import { modes, tokens } from "@/lib/tokens"
import { backTargetForPath } from "@/lib/notification-routing"
import { ROUTES } from "@/lib/routes"
import { cn } from "@/lib/cn"
import { translateProp, useLanguage } from "@/lib/i18n"
import { translate } from "@/lib/i18n/translate"
import { defaultHeaderTitleVariant, headerTitleCenterPadding } from "@/lib/header-title"

/**
 * Tinggi bar Header (px) — harus sama dengan class `h-14` di bawah (skala
 * Tailwind 14 = 56px; tidak ada di `tokens.space`, jadi literal di sini adalah
 * satu-satunya sumber). Dipakai layar form untuk `keyboardVerticalOffset`
 * (KeyboardAvoiding) agar tidak ada angka 56 yang disalin di tiap screen.
 */
export const HEADER_BAR_HEIGHT = 56

/** Nama aplikasi untuk judul dokumen web — pindah ke `@/lib/app-meta`
 * (PERF-FIX bundle: file leaf tanpa import, tidak menarik rantai UI ke boot).
 * Re-export di sini menjaga kompatibilitas importer lama. */
import { APP_TITLE } from "@/lib/app-meta"
export { APP_TITLE }

/**
 * Judul dokumen web per layar (audit UI/UX 2026-09-08).
 *
 * Sebelumnya satu-satunya `document.title` di seluruh app ada di root layout
 * (`"Kahade"`), sehingga 98 halaman hasil `expo export` berbagi satu judul
 * tab: pengguna yang membuka 5 layar Kahade sekaligus melihat lima tab
 * identik, riwayat browser tidak bisa dibedakan, dan hasil share/bookmark
 * kehilangan konteks. Komentar di root layout sudah menjanjikan "judul
 * per-halaman bisa menimpanya dari layarnya" — tidak ada satu layar pun yang
 * melakukannya.
 *
 * Dipasang di <Header> karena di sanalah `title` setiap layar sudah
 * terkumpul (≈70 layar), bukan di tiap route. Native di-skip: tidak ada
 * konsep judul dokumen di sana.
 */
export function useDocumentTitle(title?: string) {
  useEffect(() => {
    if (Platform.OS !== "web") return
    document.title = title ? `${title} — ${APP_TITLE}` : APP_TITLE
    return () => {
      document.title = APP_TITLE
    }
  }, [title])
}

/**
 * Tombol ikon lingkaran untuk header (2026-10-05, revisi produk).
 *
 * Gaya kaca ala header landing kahade.id (pola Mobbin):
 * - Background #F3F4F6/64 (light) — blur 48px di web.
 * - Tanpa border, tanpa shadow — melayang bersih.
 * - Dark: padanan #1A1A1A/64.
 * Native tidak bisa blur tanpa expo-blur (ubah fingerprint) → di sana
 * semi-transparan saja; web dapat blur asli via backdrop-filter.
 */
export function HeaderCircleButton({
  icon,
  onPress,
  accessibilityLabel,
  accessibilityHint,
}: {
  icon: IconComponent
  onPress: () => void
  accessibilityLabel: string
  accessibilityHint?: string
}) {
  const { mode } = useTheme()
  const palette = modes[mode]
  const glassBg =
    mode === "light" ? "rgba(243,244,246,0.64)" : "rgba(26,26,26,0.64)"
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      haptic="light"
      onPress={onPress}
      className="h-12 w-12 items-center justify-center"
    >
      <View
        style={[
          {
            borderRadius: 999,
            backgroundColor: glassBg,
            height: 48,
            width: 48,
            alignItems: "center",
            justifyContent: "center",
          },
          Platform.OS === "web"
            ? ({ backdropFilter: "blur(48px)", WebkitBackdropFilter: "blur(48px)" } as object)
            : null,
        ]}
      >
        <Icon icon={icon} size="md" color={palette.textPrimary} />
      </View>
    </PressableScale>
  )
}

/**
 * Grup aksi kanan header: 2+ ikon dalam satu kartu pil kaca (2026-10-05).
 * Gaya sama dengan HeaderCircleButton: #F3F4F6/64 + blur 48px (web).
 */
export function HeaderActionGroup({ children }: { children: ReactNode }) {
  const { mode } = useTheme()
  const glassBg =
    mode === "light" ? "rgba(243,244,246,0.64)" : "rgba(26,26,26,0.64)"
  return (
    <View
      style={[
        {
          borderRadius: 999,
          backgroundColor: glassBg,
          flexDirection: "row",
          alignItems: "center",
          padding: 4,
          gap: 4,
        },
        Platform.OS === "web"
          ? ({ backdropFilter: "blur(48px)", WebkitBackdropFilter: "blur(48px)" } as object)
          : null,
      ]}
    >
      {children}
    </View>
  )
}

/**
 * Tombol ikon polos untuk di dalam HeaderActionGroup (tanpa border sendiri —
 * border sudah di kartu grup).
 */
function HeaderGroupIcon({
  icon,
  onPress,
  accessibilityLabel,
  accessibilityHint,
}: {
  icon: IconComponent
  onPress: () => void
  accessibilityLabel: string
  accessibilityHint?: string
}) {
  const { mode } = useTheme()
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      haptic="light"
      onPress={onPress}
      className="h-10 w-10 items-center justify-center"
    >
      <View style={{ borderRadius: 999, height: 40, width: 40, alignItems: "center", justifyContent: "center" }}>
        <Icon icon={icon} size="md" color={modes[mode].textPrimary} />
      </View>
    </PressableScale>
  )
}

/**
 * Upgrade otomatis aksi kanan header (2026-10-05, revisi produk):
 * - 1 IconButton → HeaderCircleButton (lingkaran solid).
 * - 2+ IconButton → HeaderActionGroup (satu kartu pil).
 * - Non-IconButton (Button teks, dsb.) → dibiarkan apa adanya.
 */
function upgradeRightActions(node: ReactNode): ReactNode {
  const buttons: ReactNode[] = []
  const others: ReactNode[] = []

  const collect = (n: ReactNode): void => {
    if (Array.isArray(n)) {
      n.forEach(collect)
      return
    }
    if (n && typeof n === "object" && "type" in n) {
      const el = n as { type: unknown; props?: Record<string, unknown> }
      // Fragment / View pembungkus → telusuri anaknya.
      if (el.type === Symbol.for("react.fragment") || (typeof el.type === "string" && el.type === "View")) {
        collect((el.props?.children ?? null) as ReactNode)
        return
      }
      if (el.type === IconButton) {
        buttons.push(el as ReactNode)
        return
      }
    }
    others.push(n)
  }
  collect(node)

  if (buttons.length === 0) return node

  const toCircle = (b: ReactNode, grouped: boolean) => {
    const el = b as {
      props: {
        icon: IconComponent
        onPress?: () => void
        accessibilityLabel?: string
        accessibilityHint?: string
      }
    }
    const p = el.props
    if (!p?.icon || typeof p.onPress !== "function") return b
    return grouped ? (
      <HeaderGroupIcon
        icon={p.icon}
        onPress={p.onPress}
        accessibilityLabel={p.accessibilityLabel ?? "Aksi"}
        accessibilityHint={p.accessibilityHint}
      />
    ) : (
      <HeaderCircleButton
        icon={p.icon}
        onPress={p.onPress}
        accessibilityLabel={p.accessibilityLabel ?? "Aksi"}
        accessibilityHint={p.accessibilityHint}
      />
    )
  }

  if (buttons.length === 1 && others.length === 0) {
    return toCircle(buttons[0], false)
  }
  // Campuran / banyak: grup ikon dalam satu kartu pil, sisanya tetap.
  return (
    <>
      {buttons.length > 0 ? (
        <HeaderActionGroup>
          {buttons.map((b, i) => (
            <View key={i}>{toCircle(b, true)}</View>
          ))}
        </HeaderActionGroup>
      ) : null}
      {others}
    </>
  )
}

export type HeaderProps = Omit<ViewProps, "children"> & {
  title?: string
  /** H1 di baris kedua (layar utama tab) */
  largeTitle?: string
  /** Tampilkan tombol back (default true kalau ada `onBack` atau router bisa back) */
  showBack?: boolean
  /** "back" = ArrowLeft, "close" = X (layar modal/alur yang bisa dibatalkan) */
  backKind?: "back" | "close"
  onBack?: () => void
  /** Node kustom di kiri (mengganti tombol back), mis. <Logo size="sm" /> */
  left?: ReactNode
  /**
   * Isi kolom tengah — MENGGANTIKAN judul teks, mis. kolom pencarian yang
   * hidup di header (permintaan produk 2026-09-26).
   *
   * `title` tetap dibaca untuk judul dokumen web (`useDocumentTitle`), jadi
   * layar yang memakai `center` tetap mengirimkan judulnya — hanya tidak
   * merender teks itu di baris bar.
   */
  center?: ReactNode
  /** Aksi kanan — kirim <IconButton variant="ghost"> */
  right?: ReactNode
  /** 0–1: bar progres tipis di bawah header (§9.22) */
  progress?: number
  /** Tanpa border & bg — untuk hero */
  transparent?: boolean
  /** Tampilkan garis pemisah di bawah header (default false 2026-10-05:
      tombol kaca melayang tidak butuh separator; nyalakan manual bila perlu). */
  separator?: boolean
  /** Bayangan lembut di bawah header saat konten di-scroll — efek elevasi
      dinamis (permintaan produk 2026-09-27). Pasangan `useScrollElevation`. */
  elevated?: boolean
  /**
   * Rata judul teks: "center" (default) atau "left". Dipakai header tab
   * utama (Transaksi, Pesan, Notifikasi — permintaan produk 2026-09-28):
   * kolom kiri di-skip, node kiri (back/X) tampil inline sebelum judul,
   * judul menempel ke tepi kiri. Diabaikan bila `center` diisi.
   */
  titleAlign?: "left" | "center"
  /**
   * Override ukuran judul: main/list/form default H2, layar detail otomatis H3.
   * Gunakan hanya bila konteks visual rute tidak mengikuti klasifikasi standar.
   */
  titleVariant?: "h2" | "h3"
  /** Safe area top ikut dipadding (default true; false bila SafeAreaView di luar) */
  safeArea?: boolean
  className?: string
}

// FE-064 (audit 2026-09-29): di-memo — header me-render di SETIAP layar dan
// menjadi korban re-render parent (polling, keystroke). Prop `left`/`right`
// berupa node inline dari pemanggil tetap menggagalkan bail-out per layar;
// stabilkan di layar yang disentuh temuan lain bila relevan.
export const Header = memo(function Header({
  title,
  largeTitle,
  showBack,
  backKind = "back",
  onBack,
  left,
  center,
  right,
  progress,
  transparent = false,
  separator = false,
  elevated = false,
  titleAlign = "center",
  titleVariant: titleVariantOverride,
  safeArea,
  className,
  ...rest
}: HeaderProps) {
  const { mode: themeMode } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const pathname = usePathname()
  const titleVariant = titleVariantOverride ?? defaultHeaderTitleVariant(pathname)
  const providedInsets = useContext(ScreenInsetsContext)
  // largeTitle (H1 konten) lebih mewakili layar daripada title bar bila ada.
  // Judul TAB web adalah satu-satunya teks yang tidak lewat <Text> di sini,
  // jadi Header berlangganan bahasa + menerjemahkan sendiri.
  useLanguage()
  useDocumentTitle(translateProp(largeTitle ?? title))
  const [leftWidth, setLeftWidth] = useState(0)
  const [rightWidth, setRightWidth] = useState(0)
  // PERF-FIX (TIM1-P2): onLayout stabil + guard nilai sama — Header dipakai
  // hampir semua layar; tanpa guard, rotasi/font-scale memicu setState →
  // re-render header tiap perubahan layout.
  const handleLeftLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width
    setLeftWidth((prev) => (prev === w ? prev : w))
  }, [])
  const handleRightLayout = useCallback((e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width
    setRightWidth((prev) => (prev === w ? prev : w))
  }, [])
  const sideWidth = Math.max(tokens.space[12], leftWidth, rightWidth)
  /**
   * Judul center presisi (permintaan produk 2026-10-08): padding kiri ==
   * kanan == sisi terlebar, sehingga judul (kotak selebar baris) tetap tepat
   * di tengah LEBAR LAYAR PENUH — bukan di tengah sisa ruang antar kolom,
   * yang bergeser saat jumlah ikon kiri ≠ kanan. Lihat
   * `headerTitleCenterPadding` untuk alasan matematisnya.
   */
  const titleCenterPadding = headerTitleCenterPadding(leftWidth, rightWidth, tokens.space[12])

  /**
   * 2026-10-08 (temuan #17): tombol kembali yang TIDAK PERNAH no-op.
   *
   * Tiga keadaan:
   *  1. ada riwayat            → `router.back()` (perilaku lama).
   *  2. stack kosong + induk   → `replace` ke induk logis (T5-009).
   *  3. stack kosong + TANPA induk yang berbeda (layar hub seperti /faq,
   *     /wallet, /disputes, /chat yang induknya diri sendiri) → beranda.
   *
   * Keadaan 3 dulu `replace()` ke rute yang sama: tombol terlihat, dipencet,
   * dan tidak terjadi apa-apa — persis keluhan "tombol back nyangkut".
   */
  const backTarget = backTargetForPath(pathname)
  const handleBack =
    onBack ??
    (() =>
      router.canGoBack()
        ? router.back()
        : router.replace((backTarget ?? ROUTES.home) as never))
  /**
   * Visibilitas tombol SENGAJA tidak diubah: `router.canGoBack()` yang dibaca
   * saat render bisa saja belum stabil (navigator belum selesai menetap),
   * dan menyembunyikan tombol yang seharusnya ada jauh lebih buruk daripada
   * tombol yang bekerja. Jadi tombol tetap tampil seperti sebelumnya — yang
   * diperbaiki adalah AKSINYA (lihat `handleBack` di atas): ia tidak pernah
   * lagi berujung pada `replace()` ke rute yang sama.
   */
  const canBack = showBack ?? true

  const leftNode =
    left ??
    (canBack ? (
      <HeaderCircleButton
        icon={backKind === "close" ? X : ArrowLeft}
        onPress={handleBack}
        accessibilityLabel={backKind === "close" ? "Tutup" : "Kembali"}
        accessibilityHint={backKind === "close" ? "Menutup layar ini" : "Kembali ke layar sebelumnya"}
      />
    ) : null)

  return (
    <View
      className={cn(
        "z-sticky w-full items-center",
        transparent ? "bg-transparent" : "bg-background",
        !transparent && separator && "border-b border-border",
        className,
      )}
      style={[
        (safeArea ?? !providedInsets.top) ? { paddingTop: insets.top } : undefined,
        // Efek scroll: bayangan lembut tapi KASATMATA saat konten lewat di
        // bawah header — "terangkat" dari konten. Level "low" (opacity 5.5%)
        // terbukti tidak terlihat di web (laporan user 2026-09-28); "medium"
        // tetap lembut (blur 18px) namun cukup pekat untuk dibaca sebagai
        // bayangan. Bukan border — separator statis tetap tidak dipakai.
        elevated && !transparent ? elevationStyle("medium", themeMode) : undefined,
        // Web-only (laporan user 2026-09-28: shadow tidak muncul di web).
        // Root cause: class `z-sticky` hanya memberi z-index — tanpa
        // `position`, CSS mengabaikan z-index, sehingga header tidak
        // membentuk stacking context dan box-shadow-nya TERTUTUP oleh
        // background konten di bawahnya (paint order normal-flow: sibling
        // yang datang belakangan menutup shadow sibling sebelumnya).
        // `position: relative` web-only mengaktifkan z-index → shadow tampil
        // di atas konten. Native TIDAK disentuh — shadow di sana sudah benar.
        // backdropFilter sengaja tidak dipakai: background header opaque,
        // jadi blur backdrop tidak memberi efek visual apa pun.
        elevated && !transparent && Platform.OS === "web"
          ? ({ position: "relative" } as ViewStyle)
          : undefined,
      ]}
      {...rest}
    >
      <View className="w-full md:max-w-content">
        <View className="relative min-h-14 w-full flex-row items-center px-5 py-2">
          {/* Kolom kiri: lebar tetap 1 slot. Di-skip saat judul rata kiri —
              judul menempel ke tepi kiri, node kiri tampil inline. */}
          {titleAlign === "left" ? null : (
            <View style={{ width: sideWidth }} className="items-start justify-center">
              <View onLayout={handleLeftLayout}>{leftNode}</View>
            </View>
          )}

          {/*
            Kolom tengah: `center` (slot kustom penuh lebar — kolom pencarian)
            mengambil seluruh ruang sisa; mode judul center hanya menyisakan
            SPACER flex-1 karena teksnya digambar absolut di bawah (center
            presisi); mode rata kiri merender node kiri + judul inline.
          */}
          {center ? (
            <View className="flex-1 flex-row items-center">{center}</View>
          ) : titleAlign === "left" ? (
            /* Judul rata kiri: node kiri (back/X) inline sebelum judul. */
            <View className="flex-1 flex-row items-center justify-start gap-1 px-2">
              {leftNode}
              {title ? (
                <Text ellipsizeMode="tail"
                  accessibilityRole="header"
                  variant={titleVariant}
                  numberOfLines={1}
                  className="flex-1 text-left"
                >
                  {title}
                </Text>
              ) : null}
            </View>
          ) : (
            <View className="flex-1" />
          )}

          {/*
            Judul CENTER PRESISI: absolut 0 → lebar baris, sehingga titik
            tengahnya adalah titik tengah baris (dan layar) — TIDAK lagi
            bergantung pada lebar kolom kiri/kanan. `paddingLeft ==
            paddingRight` (sisi terlebar) menjaga titik tengah itu apa pun
            isi aksi di kedua sisi; `pointerEvents="none"` supaya tidak
            menelan sentuhan tombol (judul boleh memanjang sampai area
            tombol saat teksnya sangat panjang).
            Diletakkan SEBELUM kolom kanan agar urutan baca screen reader
            tetap kiri → judul → aksi.
          */}
          {!center && titleAlign === "center" && title ? (
            <View
              pointerEvents="none"
              className="absolute inset-y-0 left-0 right-0 items-center justify-center"
              style={{ paddingLeft: titleCenterPadding, paddingRight: titleCenterPadding }}
            >
              <Text ellipsizeMode="tail"
                accessibilityRole="header"
                variant={titleVariant}
                numberOfLines={1}
                className="text-center"
              >
                {title}
              </Text>
            </View>
          ) : null}

          {/* Kolom kanan: minimal 1 slot agar judul tetap center saat kosong */}
          <View style={{ width: sideWidth }} className="items-end justify-center">
            <View
              onLayout={handleRightLayout}
              className="flex-row items-center gap-1"
            >
              {upgradeRightActions(right)}
            </View>
          </View>
        </View>

        {largeTitle ? (
          <View className="px-5 pb-4 pt-1">
            {/* Role hanya pada node teks; role ganda di wrapper + anak membuat
                VoiceOver/TalkBack membacakan judul dua kali. */}
            <Text variant="h1" accessibilityRole="header">{largeTitle}</Text>
          </View>
        ) : null}
      </View>

      {progress != null ? (
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityValue={{ now: Math.round(progress * 100), min: 0, max: 100 }}
          accessibilityLabel={translate("Progres {x} persen", { x: Math.round(progress * 100) })}
          className="w-full"
        >
          {/* Parent wajib full-width: Header memakai items-center, sehingga
              `w-full` pada anak saja tidak punya containing width di web/RN. */}
          <StepProgress value={progress} className="w-full" />
        </View>
      ) : null}
    </View>
  )
})