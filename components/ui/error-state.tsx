/**
 * Kahade — <ErrorState> (pasangan <EmptyState> §9.12 untuk kegagalan).
 *
 * Dipakai saat konten layar/section GAGAL dimuat: jaringan putus, server
 * error, sesi kedaluwarsa. Struktur & irama identik dengan EmptyState agar
 * kedua state terasa satu keluarga; yang berbeda hanya:
 *   1. Ikon default WarningCircle dengan IconBox varian `danger` — satu-
 *      satunya tempat warna semantik muncul. Judul & deskripsi tetap
 *      text-primary/secondary (bukan merah) — §1 "tenang", pesan error tidak
 *      perlu berteriak; ikon sudah cukup memberi sinyal.
 *   2. `onRetry` merender Button secondary "Coba lagi" secara built-in
 *      karena hampir semua error state punya aksi ini; `action` slot tetap
 *      ada untuk aksi lain (mis. "Hubungi bantuan").
 *   3. `detail` (kode error / request id) tampil sebagai MonoText caption
 *      text-secondary di bawah deskripsi — data teknis presisi (§3.1),
 *      berguna saat user melapor ke support, tapi tidak menonjol.
 *
 * Default copy formal "Anda" (§12), i18n-ready lewat props.
 */
import type { ReactNode } from "react"
import { View, type ViewProps } from "react-native"
import { ArrowClockwise, WarningCircle } from "phosphor-react-native"

import { MonoText } from "@/components/ui/amount"
import { Button } from "@/components/ui/button"
import type { IconComponent } from "@/components/ui/icon"
import { IconBox } from "@/components/ui/icon-box"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"

export type ErrorStateProps = Omit<ViewProps, "children"> & {
  icon?: IconComponent
  title?: string
  description?: string
  /** Kode error / request id — tampil Mono kecil */
  detail?: string
  onRetry?: () => void
  retryLabel?: string
  /** Spinner di tombol retry saat request ulang berjalan */
  retrying?: boolean
  /** Aksi tambahan (mis. <Button variant="ghost" fullWidth={false}>) */
  action?: ReactNode
  /** Versi rapat untuk di dalam Card/Section */
  compact?: boolean
  className?: string
}

export function ErrorState({
  icon = WarningCircle,
  title = "Terjadi kesalahan",
  description = "Kami tidak dapat memuat data saat ini. Silakan coba lagi.",
  detail,
  onRetry,
  retryLabel = "Coba lagi",
  retrying = false,
  action,
  compact = false,
  className,
  ...rest
}: ErrorStateProps) {
  return (
    <View accessible={false}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      className={cn(
        "w-full items-center justify-center",
        compact ? "gap-3 py-6" : "flex-1 gap-4 py-12",
        className,
      )}
      {...rest}
    >
      <IconBox icon={icon} size={compact ? "lg" : "xl"} variant="danger" weight="regular" />

      <View className={cn("items-center max-w-[320px]", compact ? "gap-1" : "gap-2")}>
        {compact ? (
          <Text variant="body" weight={600} className="text-center">
            {title}
          </Text>
        ) : (
          <Text variant="h3" className="text-center">
            {title}
          </Text>
        )}
        {description ? (
          <Text variant={compact ? "caption" : "body"} tone="secondary" className="text-center">
            {description}
          </Text>
        ) : null}
        {detail ? (
          <MonoText tone="secondary" className="text-center text-caption" numberOfLines={1}>
            {detail}
          </MonoText>
        ) : null}
      </View>

      {onRetry || action ? (
        <View className={cn("items-center gap-2", compact ? "pt-1" : "pt-2")}>
          {onRetry ? (
            <Button
              haptic
              variant="secondary"
              size={compact ? "sm" : "md"}
              fullWidth={false}
              leftIcon={ArrowClockwise}
              loading={retrying}
              onPress={onRetry}
            >
              {retryLabel}
            </Button>
          ) : null}
          {action}
        </View>
      ) : null}
    </View>
  )
}
