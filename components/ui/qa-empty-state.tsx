/**
 * Kahade — <QaEmptyState> (redesign 2026-09-27, TIM QA).
 *
 * Empty state cantik untuk Tanya Jawab: ikon ChatCircleDots, judul
 * "Belum ada pertanyaan", dan ajakan bertindak (tombol "Ajukan pertanyaan").
 * Dipakai feed Tanya Jawab publik maupun inbox Tanya Jawab saya.
 *
 * Murni presentasi — tidak menyentuh API maupun state layar.
 */
import { View, type ViewProps } from "react-native"
import { ChatCircleDots } from "phosphor-react-native"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { cn } from "@/lib/cn"
import { translate, useLanguage } from "@/lib/i18n"

export type QaEmptyStateProps = Omit<ViewProps, "children"> & {
  /** Varian copy: profil sendiri vs profil orang lain */
  isSelf?: boolean
  /** Judul kustom (default "Belum ada pertanyaan") */
  title?: string
  /** Deskripsi kustom */
  description?: string
  /** Aksi "Ajukan pertanyaan" — tanpa ini tombol CTA tidak dirender */
  onAsk?: () => void
  /** Label tombol CTA */
  askLabel?: string
  className?: string
}

export function QaEmptyState({
  isSelf = false,
  title,
  description,
  onAsk,
  askLabel,
  className,
  ...rest
}: QaEmptyStateProps) {
  useLanguage()
  return (
    <View className={cn("py-8", className)} {...rest}>
      <EmptyState
        icon={ChatCircleDots}
        title={title ?? translate("Belum ada pertanyaan")}
        description={
          description ??
          (isSelf
            ? translate("Belum ada pertanyaan dari pengguna lain.")
            : translate("Jadilah yang pertama bertanya — pertanyaan yang baik membantu semua orang."))
        }
        action={
          onAsk ? (
            <Button variant="secondary" fullWidth={false} onPress={onAsk}>
              {askLabel ?? translate("Ajukan pertanyaan")}
            </Button>
          ) : undefined
        }
      />
    </View>
  )
}
