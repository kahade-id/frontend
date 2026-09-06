/**
 * Kahade — <ResultState> layar hasil (§1.4 "editorial trust di momen penting").
 *
 * Layar penuh setelah aksi besar selesai: dana berhasil ditahan escrow,
 * pembayaran gagal, KYC terkirim. Ini SALAH SATU dari sedikit tempat EB
 * Garamond (Display) diizinkan — "layar konfirmasi besar" §3.1 — maka judul
 * default memakai variant `display`. Set `editorial={false}` untuk hasil
 * minor (mis. "Rekening tersimpan") agar kembali ke H1 Sofia Sans.
 *
 * Struktur: IconBox status → judul → deskripsi → slot `children` (biasanya
 * <Amount size="large"> + <KeyValueList> ringkasan) → aksi. Warna semantik
 * HANYA di IconBox (§2.3: status transaksi) — judul tetap text-primary.
 *
 * Keputusan non-obvious:
 *   - `flex-1` + `justify-center` supaya konten terpusat vertikal saat menjadi
 *     satu-satunya anak <Screen>, dengan aksi di `footer` Screen (sticky)
 *     ATAU lewat prop `actions` bila layar tidak memakai footer.
 *   - `py-16` (space.16) = "top spacing layar penuh" §4.
 *   - Tidak ada confetti/ilustrasi: §1.6 satu titik kejutan per layar sudah
 *     dipakai oleh tipografi editorial.
 */
import type { ReactNode } from "react"
import { View, type ViewProps } from "react-native"
import { CheckCircle, Clock, WarningCircle, XCircle } from "phosphor-react-native"

import type { IconComponent } from "@/components/ui/icon"
import { IconBox, type IconBoxVariant } from "@/components/ui/icon-box"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"

export type ResultStatus = "success" | "danger" | "warning" | "pending"

export type ResultStateProps = Omit<ViewProps, "children"> & {
  status: ResultStatus
  title: string
  description?: string
  /** Override ikon default per status */
  icon?: IconComponent
  /** Judul EB Garamond Display (default) — false = H1 Sofia Sans */
  editorial?: boolean
  /** Ringkasan di bawah deskripsi: Amount besar, KeyValueList, dll. */
  children?: ReactNode
  /** Tombol aksi bila layar tidak memakai footer Screen */
  actions?: ReactNode
  className?: string
}

const defaultIcon: Record<ResultStatus, IconComponent> = {
  success: CheckCircle,
  danger: XCircle,
  warning: WarningCircle,
  pending: Clock,
}

const boxVariant: Record<ResultStatus, IconBoxVariant> = {
  success: "success",
  danger: "danger",
  warning: "warning",
  pending: "surface",
}

export function ResultState({
  status,
  title,
  description,
  icon,
  editorial = true,
  children,
  actions,
  className,
  ...rest
}: ResultStateProps) {
  return (
    <View accessible={false}
      accessibilityRole="summary"
      accessibilityLiveRegion="polite"
      className={cn("flex-1 w-full items-center justify-center gap-8 py-16", className)}
      {...rest}
    >
      <IconBox icon={icon ?? defaultIcon[status]} size="xl" variant={boxVariant[status]} weight="fill" />

      <View className="items-center gap-3 max-w-[360px]">
        <Text variant={editorial ? "display" : "h1"} className="text-center">
          {title}
        </Text>
        {description ? (
          <Text variant="bodyLarge" tone="secondary" className="text-center">
            {description}
          </Text>
        ) : null}
      </View>

      {children ? <View className="w-full items-center gap-4">{children}</View> : null}

      {actions ? <View className="w-full gap-2 pt-4">{actions}</View> : null}
    </View>
  )
}
