/**
 * Kahade — <FormSection> + <FormRow> (§4 spacing, §9.2 struktur form).
 *
 * Fieldset untuk form panjang (buat transaksi escrow, KYC, profil): judul
 * H3 + deskripsi opsional di atas, lalu kumpulan <Field>/<Input> dengan gap
 * 16px (space.4 — "gap standar antar elemen"). Antar section pemanggil cukup
 * menumpuk di <VStack gap={8}> (32px, "gap antar section").
 *
 * Kenapa komponen terpisah, bukan <Section> (section.tsx) (non-obvious):
 *   <Section> dirancang untuk konten baca (dashboard, detail) dengan aksi
 *   kanan "Lihat semua". Form punya semantik berbeda: judul + deskripsi
 *   dibaca screen reader sebagai header grup input, tidak ada aksi kanan,
 *   dan pilihan `divider` memisahkan blok dengan garis 1px (§6) alih-alih
 *   ruang saja — berguna saat dua section berturut-turut sama-sama diawali
 *   Input tanpa judul.
 *
 * <FormRow>: dua field berdampingan (mis. "Tanggal" | "Jam", "Kota" |
 * "Kode pos") dengan gap 12px. Di bawah breakpoint tetap berdampingan
 * (bukan stack) karena lebar konten mobile 24px-padding masih cukup untuk
 * dua field pendek; untuk field panjang jangan pakai FormRow.
 *
 * Keputusan non-obvious:
 *   - Judul memakai H3 (18/600), bukan Label 13/600: section adalah bagian
 *     halaman, bukan label satu kontrol. Label tetap milik <Field>.
 *   - `optional` menambah caption "(opsional)" tone secondary di judul —
 *     kebalikan dari tanda " *" required di FieldLabel. Sistem menandai
 *     yang WAJIB di level field dan yang OPSIONAL di level section, jadi
 *     tidak ada informasi yang ditulis dua kali.
 */
import type { ReactNode } from "react"
import { View, type ViewProps } from "react-native"

import { Divider } from "@/components/ui/divider"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"

export type FormSectionProps = Omit<ViewProps, "children"> & {
  title?: string
  description?: string
  /** Tandai seluruh section opsional ("(opsional)" di judul) */
  optional?: boolean
  /** Garis pemisah di ATAS section (untuk section kedua dan seterusnya) */
  divider?: boolean
  children: ReactNode
  className?: string
  /** className untuk pembungkus field (default gap-4) */
  contentClassName?: string
}

export function FormSection({
  title,
  description,
  optional = false,
  divider = false,
  children,
  className,
  contentClassName,
  ...rest
}: FormSectionProps) {
  const hasHeader = !!title || !!description

  return (
    <View className={cn("w-full gap-4", className)} {...rest}>
      {divider ? <Divider /> : null}

      {hasHeader ? (
        <View className="gap-1" accessibilityRole="header">
          {title ? (
            <Text variant="h3" tone="primary">
              {title}
              {optional ? (
                <Text variant="caption" tone="secondary">
                  {"  (opsional)"}
                </Text>
              ) : null}
            </Text>
          ) : null}
          {description ? (
            <Text variant="body" tone="secondary">
              {description}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View className={cn("w-full gap-4", contentClassName)}>{children}</View>
    </View>
  )
}

export type FormRowProps = Omit<ViewProps, "children"> & {
  children: ReactNode
  className?: string
}

/** Dua (atau lebih) field berdampingan, lebar sama, gap 12px */
export function FormRow({ children, className, ...rest }: FormRowProps) {
  return (
    <View className={cn("w-full flex-row items-start gap-3", className)} {...rest}>
      {Array.isArray(children)
        ? children.map((child, i) =>
            child == null || child === false ? null : (
              <View key={i} className="flex-1">
                {child}
              </View>
            ),
          )
        : children}
    </View>
  )
}
