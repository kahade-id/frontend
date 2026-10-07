/**
 * Kahade — chrome BERSAMA halaman media viewer (`/media-viewer`).
 *
 * §spek (pengecualian DARK_ALLOWLIST): seluruh halaman viewer berlatar HITAM
 * SOLID di kedua mode — foto/video/dokumen dilihat di atas scrim hitam seperti
 * pemutar media pada umumnya (konsisten dengan <ImageViewer> lama yang memakai
 * `bg-overlay`). Teks/ikon di atasnya PUTIH — satu-satunya yang terbaca di
 * atas hitam (preseden: showcase-media-gallery.tsx, +N showcase-gallery-grid).
 *
 * Isi: <ViewerScaffold> (latar + top bar), <ViewerLoading>, <ViewerError>
 * (error akurat + retry), <ViewerIconButton> (tombol ikon putih), dan
 * <ViewerBottomBar> (bilah aksi bawah).
 */
import type { ReactNode } from "react"
import { View } from "react-native"
import { ArrowLeft, WarningCircle, type Icon as PhosphorIcon } from "phosphor-react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Icon } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Spinner } from "@/components/ui/spinner"
import { Text } from "@/components/ui/text"
import { tokens } from "@/lib/tokens"
import { hitSlopToReach } from "@/lib/hit-slop"

/** Ukuran target sentuh tombol chrome (44pt, audit #1). */
const CHROME_TOUCH = 44

export function ViewerIconButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: PhosphorIcon
  label: string
  onPress: () => void
  disabled?: boolean
}) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={hitSlopToReach(CHROME_TOUCH, CHROME_TOUCH)}
      className={`items-center justify-center rounded-full bg-overlay-media p-2.5 ${disabled ? "opacity-40" : ""}`}
    >
      {/* Putih di atas scrim hitam kedua mode — lihat §spek di header file. */}
      <Icon icon={icon} size="md" color={tokens.colors.light.primaryForeground} />
    </PressableScale>
  )
}

export function ViewerScaffold({
  title,
  subtitle,
  onBack,
  backLabel = "Kembali",
  actions,
  children,
  bottomBar,
}: {
  title?: string | null
  subtitle?: string | null
  onBack: () => void
  backLabel?: string
  actions?: ReactNode
  children: ReactNode
  bottomBar?: ReactNode
}) {
  const insets = useSafeAreaInsets()
  return (
    <View className="flex-1 bg-black" style={{ paddingTop: insets.top }}>
      {/* Bilah atas: kembali + judul + aksi. */}
      <View className="flex-row items-center gap-2 px-4 py-2">
        <ViewerIconButton icon={ArrowLeft} label={backLabel} onPress={onBack} />
        <View className="min-w-0 flex-1">
          {title ? (
            <Text variant="body" weight={600} numberOfLines={1} ellipsizeMode="middle" className="text-white">
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text variant="caption" numberOfLines={1} className="text-white opacity-70">
              {subtitle}
            </Text>
          ) : null}
        </View>
        {actions}
      </View>
      <View className="min-h-0 flex-1">{children}</View>
      {bottomBar ? (
        <View style={{ paddingBottom: Math.max(insets.bottom, tokens.space[3]) }}>{bottomBar}</View>
      ) : null}
    </View>
  )
}

/** Loading full-screen: spinner putih + label (jangan layar kosong). */
export function ViewerLoading({ label }: { label: string }) {
  return (
    <View className="flex-1 items-center justify-center gap-3 px-8" accessible accessibilityRole="progressbar" accessibilityLabel={label}>
      <Spinner size="md" tone="inverse" />
      <Text variant="body" className="text-center text-white">
        {label}
      </Text>
    </View>
  )
}

/**
 * Error full-screen: ikon + judul + DESKRIPSI AKURAT + tombol coba lagi.
 * `description` wajib spesifik (jaringan? kedaluwarsa? format?) — jangan generik.
 */
export function ViewerError({
  title,
  description,
  retryLabel = "Coba lagi",
  onRetry,
}: {
  title: string
  description: string
  retryLabel?: string
  onRetry?: () => void
}) {
  return (
    <View className="flex-1 items-center justify-center gap-2 px-8">
      <View className="items-center justify-center rounded-full bg-overlay-media p-4">
        <Icon icon={WarningCircle} size="lg" color={tokens.colors.light.primaryForeground} />
      </View>
      <Text variant="body" weight={600} className="mt-2 text-center text-white">
        {title}
      </Text>
      <Text variant="body" className="text-center text-white opacity-80">
        {description}
      </Text>
      {onRetry ? (
        <PressableScale
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel={retryLabel}
          className="mt-3 rounded-full bg-white px-5 py-2.5"
        >
          <Text variant="body" weight={600} className="text-black">
            {retryLabel}
          </Text>
        </PressableScale>
      ) : null}
    </View>
  )
}
