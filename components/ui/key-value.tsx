/**
 * Kahade — <KeyValue> + <KeyValueList> baris "label : nilai" (§9.17 turunan,
 * §3.1 angka Mono, §6 pemisah border).
 *
 * Untuk ringkasan transaksi, detail escrow, struk. Dipakai berkelompok lewat
 * <KeyValueList> yang menyisipkan <Divider> di antara baris.
 *
 * Keputusan non-obvious:
 *   - Label `body` tone secondary; nilai `body` weight 500 tone primary.
 *     Kontras label/nilai adalah satu-satunya hierarki — tanpa shadow, tanpa
 *     warna aksen (§6).
 *   - `emphasis` untuk baris total: nilai naik ke `h3` (18/600) dan label ke
 *     weight 500. Tidak ada garis "tebal" khusus di atas total: §6.1 hanya
 *     punya border-default 1px untuk divider, jadi pemisah total = <Divider>
 *     biasa dari <KeyValueList>; penekanan datang dari tipografi saja.
 *   - `mono` merender variant `monoBody`/`monoLarge` (bukan class `font-mono`
 *     polos — RN butuh nama asset per weight, lihat lib/fonts.ts). Untuk
 *     nominal uang gunakan <Amount> sebagai `value` (ReactNode) supaya format
 *     §13 datang dari satu tempat.
 *   - `align="stack"` (label di atas nilai) untuk nilai panjang seperti
 *     alamat; default "row".
 *   - Label dibatasi `max-w-[45%]` di mode row: proporsi (bukan px), supaya
 *     nilai panjang tetap punya ruang; nilai yang lebih panjang lagi harus
 *     pindah ke "stack".
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
  /** Nilai ditampilkan JetBrains Mono (nomor referensi, rekening, kode) */
  mono?: boolean
  className?: string
}

function isPrimitive(v: unknown): v is string | number {
  return typeof v === "string" || typeof v === "number"
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

  const valueNode = isPrimitive(value) ? (
    <Text
      variant={mono ? (emphasis ? "monoLarge" : "monoBody") : emphasis ? "h3" : "body"}
      weight={mono || emphasis ? undefined : 500}
      tone="primary"
      className={cn(isRow && "text-right")}
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
      accessibilityLabel={`${label}: ${isPrimitive(value) ? value : ""}`}
      className={cn(
        "w-full py-3",
        isRow ? "flex-row items-start justify-between gap-4" : "flex-col gap-1",
        className,
      )}
      {...rest}
    >
      <Text
        variant="body"
        weight={emphasis ? 500 : 400}
        tone="secondary"
        className={cn(isRow && "shrink-0 max-w-[45%]")}
      >
        {label}
      </Text>
      <View className={cn(isRow ? "flex-1 items-end" : "items-start", "gap-1")}>
        {valueNode}
        {hint ? (
          <Text variant="caption" tone="tertiary" className={cn(isRow && "text-right")}>
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

/** Pembungkus yang menyisipkan <Divider> di antara <KeyValue>. */
export function KeyValueList({ children, divided = true, className, ...rest }: KeyValueListProps) {
  const items = (Array.isArray(children) ? children : [children]).filter(Boolean)
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
