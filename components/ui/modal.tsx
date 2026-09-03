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
 *   - Animasi memakai token `motion.overlay` (§8): fade + translateY + scale.
 *   - Lebar: `w-full` di dalam padding layar px-6, di-cap `md:max-w-content`
 *     dikurangi padding lewat wrapper (§11) — dialog di web lebar tetap
 *     terasa mobile, bukan dialog desktop 600px.
 *   - Radius `rounded-md` (8px) — §5: modal = md, maksimum non-pill.
 *   - Tombol Dialog di-stack vertikal (konfirmasi di atas, batal ghost di
 *     bawah): di lebar mobile dua tombol sejajar sering membuat label
 *     terpotong; stack juga menegaskan hierarki primary > ghost.
 *     Bisa diubah lewat `actionsLayout="row"` untuk dua label pendek
 *     ("Ya"/"Tidak") — batal di kiri, konfirmasi di kanan.
 *   - Kebijakan dismiss Dialog (`dismissOnBackdrop`) eksplisit tiga nilai:
 *       true  -> selalu bisa ditutup dari backdrop/back/escape
 *       false -> tidak pernah
 *       "auto" (default) -> bisa, KECUALI `destructive` atau `loading`:
 *       aksi berbahaya tidak boleh tertutup tanpa sengaja, dan saat request
 *       berjalan menutup dialog akan meninggalkan state menggantung.
 *   - Escape/Back mengikuti kebijakan yang sama — satu konsep "dismissable".
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
    outputRange: [tokens.motion.overlay.translateY, 0],
  })
  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [tokens.motion.overlay.scaleFrom, 1],
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

export type DialogActionsLayout = "stack" | "row"

export type DialogProps = Omit<
  ModalProps,
  "children" | "accessibilityLabel" | "dismissOnBackdrop"
> & {
  title: string
  /**
   * Kebijakan tutup dari backdrop/back/escape.
   * "auto" (default) = true kecuali `destructive` atau `loading`.
   */
  dismissOnBackdrop?: boolean | "auto"
  /** "stack" (default) tombol vertikal; "row" sejajar untuk label pendek */
  actionsLayout?: DialogActionsLayout
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
  dismissOnBackdrop = "auto",
  actionsLayout = "stack",
  ...modalProps
}: DialogProps) {
  const handleCancel = onCancel ?? onRequestClose
  const dismissable =
    dismissOnBackdrop === "auto" ? !destructive && !loading : dismissOnBackdrop

  const confirmButton = (
    <Button
      variant={destructive ? "destructive" : "primary"}
      loading={loading}
      onPress={onConfirm}
      className={actionsLayout === "row" ? "flex-1" : undefined}
      {...confirmButtonProps}
    >
      {confirmLabel}
    </Button>
  )
  const cancelButton = !hideCancel ? (
    <Button
      variant="ghost"
      disabled={loading}
      onPress={handleCancel}
      className={actionsLayout === "row" ? "flex-1" : undefined}
    >
      {cancelLabel}
    </Button>
  ) : null

  return (
    <Modal
      accessibilityLabel={title}
      onRequestClose={onRequestClose}
      dismissOnBackdrop={dismissable}
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

        {actionsLayout === "row" ? (
          // Row: batal kiri, konfirmasi kanan (aksi utama di posisi jempol)
          <View className="flex-row gap-2 pt-2">
            {cancelButton}
            {confirmButton}
          </View>
        ) : (
          // Stack: konfirmasi di atas, batal di bawah (hierarki primary > ghost)
          <View className="gap-2 pt-2">
            {confirmButton}
            {cancelButton}
          </View>
        )}
      </View>
    </Modal>
  )
}
