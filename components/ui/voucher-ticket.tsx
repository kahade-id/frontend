/**
 * Kahade — chrome tiket bersama untuk voucher: <TicketShell> + <TicketDivider>.
 *
 * Dipakai <VoucherCard>, <VoucherRedeemBox> (state terpasang), dan
 * <VoucherUsageListItem> supaya voucher tampil satu bahasa dengan struk
 * <ReceiptTicket>: notch perforasi kiri-kanan, watermark logo, garis
 * putus-putus sebagai pemisah "potongan tiket".
 *
 * Keputusan non-obvious:
 *   - <Notch> & <Watermark> dipakai ulang dari ReceiptTicket (bukan
 *     diduplikasi) — satu sumber kebenaran bentuk perforasi & watermark.
 *   - Notch dirender di <TicketDivider>, bukan di tengah kartu: perforasi
 *     tiket memisahkan "badan" (nilai/syarat) dari "potongan" (kode/aksi),
 *     jadi lubang sejajar dengan garis putus-putus.
 *   - `notchColor` default = warna background page per mode — sama seperti
 *     ReceiptTicket; kirim eksplisit bila tiket ditaruh di atas surface lain.
 *   - Shadow tetap elevationStyle("low") (bukan class shadow-*), radius
 *     rounded-lg, font weight lewat kelas font-sans/font-mono — aturan
 *     design system yang sama dengan struk.
 *   - `onPress` (kompatibilitas API Card lama) dibungkus PressableScale
 *     (feedback scale, UX-TCH-010).
 */
import type { ReactNode } from "react"
import { View, type ViewProps } from "react-native"

import { useTheme } from "@/components/theme-provider"
import { DashedLine, Notch, Watermark } from "@/components/receipt/ReceiptTicket"
import { PressableScale } from "@/components/ui/pressable-scale"
import { elevationStyle } from "@/lib/elevation"
import { tokens } from "@/lib/tokens"
import { cn } from "@/lib/cn"

export type TicketShellProps = Omit<ViewProps, "children"> & {
  children: ReactNode
  /** Seluruh tiket bisa ditekan (menggantikan `onPress` milik Card). */
  onPress?: () => void
  className?: string
}

export function TicketShell({
  children,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  className,
  ...rest
}: TicketShellProps) {
  const { mode } = useTheme()
  const card = (
    <View
      accessible={!onPress && !!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      className={cn("rounded-lg border border-border bg-surface-elevated", className)}
      style={elevationStyle("low", mode)}
      {...rest}
    >
      <Watermark />
      {children}
    </View>
  )
  if (!onPress) return card
  return (
    // UX-TCH-010: PressableScale — kartu yang bisa diketuk memberi feedback
    // scale saat ditekan (sebelumnya Pressable polos, terasa "mati").
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
    >
      {card}
    </PressableScale>
  )
}

/**
 * Pemisah "potongan tiket": garis putus-putus + notch perforasi di
 * kiri-kanan. Ditaruh full-bleed di antara dua seksi ber-padding supaya
 * notch tepat memotong border kartu.
 */
export function TicketDivider({
  notchColor,
  className,
}: {
  notchColor?: string
  className?: string
}) {
  const { mode } = useTheme()
  const holes = notchColor ?? tokens.colors[mode].background
  return (
    <View accessible={false} className={className}>
      <DashedLine />
      <Notch side="left" color={holes} />
      <Notch side="right" color={holes} />
    </View>
  )
}
