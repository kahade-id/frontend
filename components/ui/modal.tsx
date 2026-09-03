/**
 * Kahade — <Modal> (primitif) + <Dialog> (komposit) — §9.10, §10.
 *
 * Per §10, Modal/Dialog center HANYA untuk konfirmasi destruktif atau alert
 * wajib. Form pendek / pilihan / menu -> BottomSheet, bukan Modal.
 *
 *   - <Modal>  : kontainer center + backdrop + animasi + back/escape. Tidak
 *                punya opini soal isi — dipakai kalau konten custom.
 *   - <Dialog> : Modal + judul, deskripsi, ikon opsional, dua tombol
 *                (konfirmasi + batal). 95% kasus cukup pakai ini.
 *
 * Keputusan non-obvious:
 *   - Dirender lewat <Portal> supaya keluar dari ScrollView/overflow parent;
 *     `z-modal` (60) menempatkannya di atas BottomSheet (50) & di bawah
 *     Banner (70) sesuai §6.2.
 *   - Animasi: fade + translateY 8px (space.2) + scale dari 0.97 (token
 *     motion.scale.press) ke 1. §8 tidak mendefinisikan motion modal;
 *     ini mengikuti bahasa Toast (slide 8px + fade) agar konsisten.
 *   - Lebar: `w-full` di dalam padding layar px-6, di-cap `md:max-w-content`
 *     dikurangi padding lewat wrapper (§11) — dialog di web lebar tetap
 *     terasa mobile, bukan dialog desktop 600px.
 *   - Radius `rounded-md` (8px) — §5: modal = md, maksimum non-pill.
 *   - Tombol Dialog di-stack vertikal (konfirmasi di atas, batal ghost di
 *     bawah): di lebar mobile dua tombol sejajar sering membuat label
 *     terpotong; stack juga menegaskan hierarki primary > ghost.
 *   - `destructive` mengganti varian tombol konfirmasi jadi "destructive"
 *     DAN default `dismissOnBackdrop=false`: aksi berbahaya tidak boleh
 *     tertutup tanpa sengaja oleh tap di luar — user harus memilih eksplisit.
 *   - Escape/Back menutup modal (useOverlayDismissKeys) kecuali
 *     `dismissOnBackdrop=false` — dianggap satu kebijakan "dismissable".
 */
import type { ReactNode } from "react"
import { Animated, View } from "react-native"

import { Button, type ButtonProps } from "@/components/ui/button"
import { Backdrop, useOverlayDismissKeys, useOverlayPresence } from "@/components/ui/backdrop"
import { Icon, type IconComponent, type IconTone } from "@/components/ui/icon"
import { Portal } from "@/components/ui/portal"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"

// ------------------------------------------------------------------
// Modal (primitif)
// ------------------------------------------------------------------

export type ModalProps = {
  visible: boolean
  /** Diminta menutup (tap backdrop / back / escape). Parent yang set visible=false. */
  onRequestClose?: () => void
  /** Tap di backdrop menutup modal (default true) */
  dismissOnBackdrop?: boolean
  /** Dipanggil setelah animasi keluar selesai */
  onHidden?: () => void
  /** Label a11y untuk dialog (biasanya = judul) */
  accessibilityLabel?: string
  children: ReactNode
  /** className kotak konten (border/bg/padding sudah ada default) */
  className?: string
}

export function Modal({
  visible,
  onRequestClose,
  dismissOnBackdrop = true,
  onHidden,
  accessibilityLabel,
  children,
  className,
}: ModalProps) {
  const { mounted, progress } = useOverlayPresence(visible, { onHidden })
  const dismiss = dismissOnBackdrop ? onRequestClose : undefined

  useOverlayDismissKeys(visible, dismiss)

  if (!mounted) return null

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [tokens.space[2], 0],
  })
  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [tokens.motion.scale.press, 1],
  })

  return (
    <Portal>
      <View pointerEvents="box-none" className="absolute inset-0 z-modal">
        <Backdrop progress={progress} onPress={dismiss} />

        {/* Center stage — box-none agar tap di area kosong jatuh ke Backdrop */}
        <View pointerEvents="box-none" className="flex-1 items-center justify-center px-6">
          {/* Animated.View tidak di-interop NativeWind -> className di View pembungkus */}
          <View pointerEvents="box-none" className="w-full md:max-w-content">
            <Animated.View style={{ opacity: progress, transform: [{ translateY }, { scale }] }}>
              <View
                accessibilityViewIsModal
                accessibilityRole="alert"
                accessibilityLabel={accessibilityLabel}
                className={cn(
                  "w-full rounded-md border border-border bg-surface-elevated p-5",
                  className,
                )}
              >
                {children}
              </View>
            </Animated.View>
          </View>
        </View>
      </View>
    </Portal>
  )
}

// ------------------------------------------------------------------
// Dialog (komposit)
// ------------------------------------------------------------------

export type DialogTone = "neutral" | "danger" | "warning" | "success"

export type DialogProps = Omit<ModalProps, "children" | "accessibilityLabel"> & {
  title: string
  description?: string
  /** Konten tambahan di bawah deskripsi (mis. ringkasan nominal Mono) */
  children?: ReactNode
  /** Ikon Phosphor di atas judul; tone mengikuti `tone` */
  icon?: IconComponent
  tone?: DialogTone
  confirmLabel?: string
  cancelLabel?: string
  onConfirm?: () => void
  /** Default = onRequestClose */
  onCancel?: () => void
  /** Konfirmasi memakai tombol destructive + backdrop tidak menutup */
  destructive?: boolean
  /** Spinner di tombol konfirmasi; tombol batal ikut disabled */
  loading?: boolean
  /** Sembunyikan tombol batal (alert satu aksi, mis. "Sesi berakhir") */
  hideCancel?: boolean
  confirmButtonProps?: Partial<ButtonProps>
}

const iconToneOf: Record<DialogTone, IconTone> = {
  neutral: "active",
  danger: "danger",
  warning: "warning",
  success: "success",
}

export function Dialog({
  title,
  description,
  children,
  icon,
  tone = "neutral",
  confirmLabel = "Konfirmasi",
  cancelLabel = "Batal",
  onConfirm,
  onCancel,
  onRequestClose,
  destructive = false,
  loading = false,
  hideCancel = false,
  confirmButtonProps,
  dismissOnBackdrop,
  ...modalProps
}: DialogProps) {
  const handleCancel = onCancel ?? onRequestClose

  return (
    <Modal
      accessibilityLabel={title}
      onRequestClose={onRequestClose}
      // Aksi destruktif atau sedang loading: jangan bisa tertutup tak sengaja
      dismissOnBackdrop={dismissOnBackdrop ?? (!destructive && !loading)}
      {...modalProps}
    >
      <View className="gap-4">
        {icon ? (
          <View className="self-start rounded-sm border border-border p-2">
            <Icon icon={icon} size="md" tone={iconToneOf[tone]} />
          </View>
        ) : null}

        <View className="gap-2">
          <Text variant="h3">{title}</Text>
          {description ? (
            <Text variant="body" tone="secondary">
              {description}
            </Text>
          ) : null}
        </View>

        {children}

        <View className="gap-2 pt-2">
          <Button
            variant={destructive ? "destructive" : "primary"}
            loading={loading}
            onPress={onConfirm}
            {...confirmButtonProps}
          >
            {confirmLabel}
          </Button>
          {!hideCancel ? (
            <Button variant="ghost" disabled={loading} onPress={handleCancel}>
              {cancelLabel}
            </Button>
          ) : null}
        </View>
      </View>
    </Modal>
  )
}
