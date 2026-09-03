/**
 * Kahade — <ShareSheetTrigger> (§9.1 Button, §9.11 Banner untuk feedback,
 * §12 Voice & Tone).
 *
 * Pembungkus tombol yang memicu **share sheet native** (lib/share.ts):
 * tautan Order Link, kode referral, pesan ajakan, atau berkas (PDF invoice).
 * Satu-satunya komponen UI yang menyentuh Share API — komponen lain
 * (<OrderLinkShareCard>, <InvoiceReceiptView>) tetap memanggil `onShare`
 * dan layar pemanggil merender <ShareSheetTrigger> atau memanggil
 * `shareContent()` sendiri.
 *
 * Dua mode render:
 *   1. Default: <Button> (variant/size/ikon ShareNetwork) dengan label.
 *   2. `iconOnly`: <IconButton> untuk header/list item.
 *   3. `children` sebagai render-prop `(share, state) => ReactNode` untuk
 *      trigger custom (mis. baris <ListItem> "Bagikan tautan").
 *
 * Keputusan non-obvious:
 *   - `payload` bisa objek ATAU fungsi `() => Promise<SharePayload>`: berkas
 *     (PDF) sering baru dibuat saat tombol ditekan (unduh -> simpan cache ->
 *     bagikan). Selama fungsi berjalan tombol `loading`, tidak bisa ditekan
 *     dua kali -> tidak ada dua sheet yang terbuka bertumpuk (§9.9).
 *   - Outcome "unavailable" (web desktop tanpa navigator.share, berkas tidak
 *     bisa dibagikan) memanggil `onUnavailable(payload)`; pemanggil biasanya
 *     jatuh ke salin tautan (lib/clipboard + Banner "Disalin"). Komponen
 *     TIDAK menyalin sendiri — agar tidak ada dua sumber kebenaran untuk
 *     feedback "Disalin".
 *   - Tidak ada Banner "Berhasil dibagikan": di Android `Share.share` selalu
 *     melapor `sharedAction` walau pengguna batal (lihat lib/share.ts).
 *     Sheet OS sudah cukup sebagai feedback; `onShared` disediakan untuk
 *     analytics, bukan UI.
 *   - Ikon default `ShareNetwork` (Phosphor) di semua platform — bukan
 *     ikon "export" ala iOS — konsisten dengan <OrderLinkShareCard>.
 *   - `haptic` default OFF (§8): berbagi bukan aksi finansial. Pemanggil
 *     boleh menyalakan untuk referral game-ish bila mau.
 */
import { ShareNetwork } from "phosphor-react-native"
import { useCallback, useState, type ReactNode } from "react"

import { Button, type ButtonProps } from "@/components/ui/button"
import { IconButton, type IconButtonProps } from "@/components/ui/icon-button"
import type { IconComponent } from "@/components/ui/icon"
import { shareContent, type ShareOutcome, type SharePayload } from "@/lib/share"

export type ShareSheetTriggerState = {
  /** Sedang menyiapkan payload / menunggu sheet OS */
  sharing: boolean
  lastOutcome: ShareOutcome | null
}

export type ShareSheetTriggerRender = (share: () => void, state: ShareSheetTriggerState) => ReactNode

export type ShareSheetTriggerProps = {
  /** Data siap bagikan, atau fungsi yang menyiapkannya saat ditekan */
  payload: SharePayload | (() => Promise<SharePayload> | SharePayload)
  /** Label tombol (default "Bagikan"); untuk `iconOnly` menjadi accessibilityLabel */
  label?: string
  icon?: IconComponent
  /** Render sebagai IconButton (header, list meta) */
  iconOnly?: boolean
  variant?: ButtonProps["variant"]
  size?: ButtonProps["size"]
  fullWidth?: boolean
  disabled?: boolean
  haptic?: ButtonProps["haptic"]
  /** Sheet tampil (Android: walau mungkin dibatalkan) */
  onShared?: (payload: SharePayload) => void
  /** Pengguna menutup sheet (iOS/web saja) */
  onDismissed?: (payload: SharePayload) => void
  /** Platform tidak bisa membagikan -> pemanggil fallback ke salin */
  onUnavailable?: (payload: SharePayload) => void
  /** Menyiapkan payload gagal (mis. unduh PDF gagal) */
  onError?: (error: unknown) => void
  /** Trigger custom; menggantikan Button/IconButton */
  children?: ShareSheetTriggerRender
  className?: string
  containerClassName?: string
  iconButtonProps?: Partial<Omit<IconButtonProps, "icon" | "accessibilityLabel" | "onPress">>
}

const DEFAULT_LABEL = "Bagikan"

export function ShareSheetTrigger({
  payload,
  label = DEFAULT_LABEL,
  icon = ShareNetwork,
  iconOnly = false,
  variant = "secondary",
  size = "md",
  fullWidth = true,
  disabled = false,
  haptic,
  onShared,
  onDismissed,
  onUnavailable,
  onError,
  children,
  className,
  containerClassName,
  iconButtonProps,
}: ShareSheetTriggerProps) {
  const [sharing, setSharing] = useState(false)
  const [lastOutcome, setLastOutcome] = useState<ShareOutcome | null>(null)

  const share = useCallback(async () => {
    if (sharing) return
    setSharing(true)
    let resolved: SharePayload | null = null
    try {
      resolved = typeof payload === "function" ? await payload() : payload
      const outcome = await shareContent(resolved)
      setLastOutcome(outcome)
      if (outcome === "shared") onShared?.(resolved)
      else if (outcome === "dismissed") onDismissed?.(resolved)
      else onUnavailable?.(resolved)
    } catch (err) {
      onError?.(err)
    } finally {
      setSharing(false)
    }
  }, [payload, sharing, onShared, onDismissed, onUnavailable, onError])

  if (children) return <>{children(share, { sharing, lastOutcome })}</>

  if (iconOnly) {
    return (
      <IconButton
        icon={icon}
        accessibilityLabel={label}
        variant={variant === "primary" ? "primary" : "ghost"}
        size={size}
        loading={sharing}
        disabled={disabled}
        haptic={haptic}
        onPress={share}
        className={className}
        containerClassName={containerClassName}
        {...iconButtonProps}
      />
    )
  }

  return (
    <Button
      variant={variant}
      size={size}
      fullWidth={fullWidth}
      leftIcon={icon}
      loading={sharing}
      disabled={disabled}
      haptic={haptic}
      onPress={share}
      accessibilityHint="Membuka menu bagikan perangkat"
      className={className}
      containerClassName={containerClassName}
    >
      {label}
    </Button>
  )
}
