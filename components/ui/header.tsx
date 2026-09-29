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
 *   - Judul H3 (18/600) bukan H1: H1 disediakan untuk judul konten di body;
 *     header adalah kerangka, bukan konten. `largeTitle` opsional merender
 *     H1 di baris kedua untuk layar utama tab (Beranda, Riwayat).
 *   - Di web dibatasi `md:max-w-content` (§11), sejajar kolom konten.
 */
import { memo, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import { Platform, View, type LayoutChangeEvent, type ViewProps, type ViewStyle } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { ArrowLeft, X } from "phosphor-react-native"
import { usePathname, useRouter } from "expo-router"

import { IconButton } from "@/components/ui/icon-button"
import { StepProgress } from "@/components/ui/stepper"
import { Text } from "@/components/ui/text"
import { ScreenInsetsContext } from "@/components/ui/screen"
import { useTheme } from "@/components/theme-provider"
import { elevationStyle } from "@/lib/elevation"
import { tokens } from "@/lib/tokens"
import { logicalParentForPath } from "@/lib/notification-routing"
import { cn } from "@/lib/cn"
import { translateProp, useLanguage } from "@/lib/i18n"
import { translate } from "@/lib/i18n/translate"

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
  /** Tampilkan garis pemisah di bawah header (default true). Tab Transaksi,
      Pesan, dan Notifikasi mematikannya atas permintaan produk (2026-09-27). */
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
   * Ukuran judul teks: "h3" (default, 18px) atau "h2" (22px, lebih besar).
   * Header tab utama (Transaksi, Pesan, Notifikasi) memakai "h2" —
   * permintaan produk 2026-09-28: judul tab lebih besar, tetap rapi di
   * kedua mode.
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
  separator = true,
  elevated = false,
  titleAlign = "center",
  titleVariant = "h3",
  safeArea,
  className,
  ...rest
}: HeaderProps) {
  const { mode: themeMode } = useTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const pathname = usePathname()
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

  const canBack = showBack ?? true
  // T5-009 (audit UI/UX intuitif 2026-09-29): fallback back sadar konteks —
  // bila stack kosong (mis. cold start dari deep link), kembali ke "layar
  // induk logis" rute ini (chat room → /chat, detail pesanan →
  // /transactions, …), bukan selalu ke Etalase.
  const handleBack =
    onBack ??
    (() =>
      router.canGoBack()
        ? router.back()
        : router.replace(logicalParentForPath(pathname)))

  const leftNode =
    left ??
    (canBack ? (
      <IconButton
        icon={backKind === "close" ? X : ArrowLeft}
        variant="ghost"
        weight={backKind === "close" ? "bold" : undefined}
        accessibilityLabel={backKind === "close" ? "Tutup" : "Kembali"}
        accessibilityHint={backKind === "close" ? "Menutup layar ini" : "Kembali ke layar sebelumnya"}
        onPress={handleBack}
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
        <View className="min-h-14 w-full flex-row items-center px-3 py-1">
          {/* Kolom kiri: lebar tetap 1 slot. Di-skip saat judul rata kiri —
              judul menempel ke tepi kiri, node kiri tampil inline. */}
          {titleAlign === "left" ? null : (
            <View style={{ width: sideWidth }} className="items-start justify-center">
              <View onLayout={handleLeftLayout}>{leftNode}</View>
            </View>
          )}

          {/*
            Kolom tengah: judul teks (default) atau slot kustom penuh lebar
            (`center` — kolom pencarian). Slot ini mengambil seluruh ruang
            sisa supaya kontrol di dalamnya tidak terdesak oleh lebar kolom
            kiri/kanan yang diukur.
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
            <View className="flex-1 items-center justify-center px-2">
              {title ? (
                <Text ellipsizeMode="tail"
                  accessibilityRole="header"
                  variant={titleVariant}
                  numberOfLines={1}
                  className="text-center"
                >
                  {title}
                </Text>
              ) : null}
            </View>
          )}

          {/* Kolom kanan: minimal 1 slot agar judul tetap center saat kosong */}
          <View style={{ width: sideWidth }} className="items-end justify-center">
            <View
              onLayout={handleRightLayout}
              className="flex-row items-center gap-1"
            >
              {right}
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