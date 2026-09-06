/**
 * Kahade — <FooterBar> area CTA sticky di bawah layar (§4, §6, §11).
 *
 * Isi standar untuk slot `footer` <Screen> atau dipasang sendiri di layar
 * tab (yang tidak memakai Screen footer). Pola paling sering di alur escrow:
 * ringkasan nominal di kiri ("Total" + Amount) dan Button di kanan/bawah.
 *
 * Keputusan non-obvious:
 *   - Pemisah dari body `border-t border-border` (§6, bukan shadow),
 *     bg-background agar konten yang scroll di belakangnya terpotong bersih.
 *   - Padding `px-6 pt-4` (screen padding) + paddingBottom = max(space.4,
 *     inset.bottom) dari runtime (style), supaya di device tanpa home
 *     indicator tetap ada 16px dan di device dengan indicator tidak dobel.
 *     `safeArea={false}` bila parent sudah menangani inset (Screen edges).
 *   - `summary`: label caption text-secondary + nilai (biasanya <Amount
 *     size="large">) di baris atas tombol; ditumpuk vertikal, bukan
 *     berdampingan dengan Button, agar nominal Mono besar tidak terpotong di
 *     360px. `layout="row"` untuk dua tombol pendek berdampingan.
 *   - Web: kolom di-cap `md:max-w-content` (§11); bar tetap full-width
 *     agar border-t menyambung ke tepi.
 */
import type { ReactNode } from "react"
import { View, type ViewProps } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"

export type FooterBarProps = Omit<ViewProps, "children"> & {
  /** Tombol aksi — satu <Button accessibilityHint="Ketuk untuk berinteraksi"> atau beberapa */
  children: ReactNode
  /** Ringkasan di atas tombol */
  summary?: { label: string; value: ReactNode; hint?: string }
  /** "stack" (default) tombol vertikal; "row" berdampingan (flex-1 masing-masing) */
  layout?: "stack" | "row"
  safeArea?: boolean
  /** Tanpa border-t (bila body sudah berakhir dengan kartu ber-border) */
  borderless?: boolean
  className?: string
}

export function FooterBar({
  children,
  summary,
  layout = "stack",
  safeArea = true,
  borderless = false,
  className,
  ...rest
}: FooterBarProps) {
  const insets = useSafeAreaInsets()
  const paddingBottom = safeArea ? Math.max(tokens.space[4], insets.bottom) : tokens.space[4]

  return (
    <View accessible={false}
      className={cn("w-full items-center bg-background", !borderless && "border-t border-border", className)}
      style={{ paddingBottom }}
      {...rest}
    >
      <View className="w-full gap-3 px-6 pt-4 md:max-w-content tabular-nums focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
        {summary ? (
          <View className="flex-row items-end justify-between gap-4">
            <View className="gap-[2px]">
              <Text variant="caption" tone="secondary">
                {summary.label}
              </Text>
              {summary.hint ? (
                <Text ellipsizeMode="tail" variant="caption" tone="secondary" numberOfLines={1}>
                  {summary.hint}
                </Text>
              ) : null}
            </View>
            {typeof summary.value === "string" ? (
              <Text variant="monoLarge">{summary.value}</Text>
            ) : (
              summary.value
            )}
          </View>
        ) : null}

        <View className={cn(layout === "row" ? "flex-row gap-2" : "gap-2")}>{children}</View>
      </View>
    </View>
  )
}
