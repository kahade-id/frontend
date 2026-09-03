/**
 * KeyValue — baris "label : nilai" untuk ringkasan transaksi, detail escrow,
 * dan struk. Dipakai berkelompok lewat <KeyValueList> yang menyisipkan
 * Divider di antara baris (§9 Display, "Detail row").
 *
 * Keputusan non-obvious:
 *   - Label memakai text-secondary + body-sm; nilai text-primary + body-md
 *     medium. Kontras label/nilai adalah satu-satunya hierarki (§3: tanpa
 *     shadow, tanpa warna aksen).
 *   - `emphasis` untuk baris total: nilai naik ke heading-sm + Divider tebal
 *     di atas (pola struk: total dipisah garis dari rincian).
 *   - `mono` mengaktifkan font-mono untuk nomor referensi / rekening agar
 *     digit sejajar dan mudah disalin (§5 typography mono untuk kode).
 *   - Nilai boleh ReactNode (mis. <Amount/> atau <Badge/>) — bukan hanya
 *     string — supaya komponen domain bisa menyusun tanpa duplikasi layout.
 *   - Layout `align="stack"` (label di atas nilai) untuk nilai panjang
 *     seperti alamat; default "row" untuk nilai pendek.
 */
import type { ReactNode } from "react"
import { View, type ViewProps } from "react-native"

import { Divider } from "@/components/ui/divider"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"

export type KeyValueAlign = "row" | "stack"

export type KeyValueProps = Omit<ViewProps, "children"> & {
  label: string
  value: ReactNode
  /** Teks bantu di bawah nilai (mis. "Termasuk PPN 11%") */
  hint?: string
  align?: KeyValueAlign
  /** Baris total — nilai lebih besar, label medium */
  emphasis?: boolean
  /** Nilai ditampilkan font-mono (nomor referensi, rekening) */
  mono?: boolean
  className?: string
}

export function KeyValue({
  label,
  value,
  hint,
  align = "row",
  emphasis = false,
  mono = false,
  className,
  ...rest
}: KeyValueProps) {
  const isRow = align === "row"
  const valueNode =
    typeof value === "string" || typeof value === "number" ? (
      <Text
        variant={emphasis ? "heading-sm" : "body-md"}
        weight={emphasis ? "semibold" : "medium"}
        className={cn("text-text-primary", isRow && "text-right", mono && "font-mono")}
        selectable
      >
        {value}
      </Text>
    ) : (
      value
    )

  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${typeof value === "string" || typeof value === "number" ? value : ""}`}
      className={cn(
        "w-full py-3",
        isRow ? "flex-row items-start justify-between gap-4" : "flex-col gap-1",
        className,
      )}
      {...rest}
    >
      <Text
        variant="body-sm"
        weight={emphasis ? "medium" : "regular"}
        className={cn("text-text-secondary", isRow && "shrink-0 max-w-[45%]")}
      >
        {label}
      </Text>
      <View className={cn(isRow ? "flex-1 items-end" : "items-start", "gap-[2px]")}>
        {valueNode}
        {hint ? (
          <Text variant="caption" className={cn("text-text-tertiary", isRow && "text-right")}>
            {hint}
          </Text>
        ) : null}
      </View>
    </View>
  )
}

export type KeyValueListProps = Omit<ViewProps, "children"> & {
  children: ReactNode
  /** Divider di antara baris (default true) */
  divided?: boolean
  className?: string
}

/**
 * Pembungkus yang menyisipkan Divider di antara <KeyValue>. Divider
 * disisipkan via React.Children agar pemanggil tidak perlu menulis manual.
 */
export function KeyValueList({ children, divided = true, className, ...rest }: KeyValueListProps) {
  const items = Array.isArray(children) ? children.filter(Boolean) : [children]
  return (
    <View className={cn("w-full", className)} {...rest}>
      {items.map((child, i) => (
        <View key={i}>
          {divided && i > 0 ? <Divider /> : null}
          {child}
        </View>
      ))}
    </View>
  )
}
