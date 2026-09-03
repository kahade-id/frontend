/**
 * DataTable — tabel sederhana berbasis flex (bukan <table>) untuk rincian
 * biaya, riwayat pencairan, dan perbandingan paket (§9 Display, "Table").
 *
 * Keputusan non-obvious:
 *   - Flexbox dengan lebar kolom `flex` per kolom (default 1) alih-alih
 *     ScrollView horizontal: di layar 360px tabel finansial harus terbaca
 *     tanpa geser. Kolom dibatasi maksimal 4 lewat tipe — lebih dari itu
 *     gunakan <KeyValueList> per baris (pola mobile-first §11).
 *   - Header memakai bg-surface + caption uppercase text-secondary; baris
 *     dipisah border-b 1px. Tidak ada zebra striping (menambah warna abu
 *     ke-3 yang tidak ada di token §4).
 *   - `align="right"` untuk kolom angka + font-mono agar digit sejajar.
 *   - Tabel dibungkus border rounded-md agar konsisten dengan Card, namun
 *     `overflow-hidden` diperlukan supaya bg header tidak menutup sudut.
 */
import type { ReactNode } from "react"
import { View, type ViewProps } from "react-native"

import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"

export type DataTableAlign = "left" | "right" | "center"

export type DataTableColumn<Row> = {
  key: keyof Row & string
  title: string
  flex?: number
  align?: DataTableAlign
  /** Kolom angka — pakai font-mono */
  mono?: boolean
  /** Render kustom sel; default String(row[key]) */
  render?: (row: Row) => ReactNode
}

export type DataTableProps<Row extends Record<string, unknown>> = Omit<ViewProps, "children"> & {
  columns: readonly DataTableColumn<Row>[]
  rows: Row[]
  /** Kunci unik baris; default index */
  rowKey?: (row: Row, index: number) => string
  /** Baris ringkasan di paling bawah (mis. total) — dibedakan bg-surface + semibold */
  footer?: Partial<Record<keyof Row & string, ReactNode>>
  emptyLabel?: string
  compact?: boolean
  className?: string
}

const alignClass: Record<DataTableAlign, string> = {
  left: "items-start",
  right: "items-end",
  center: "items-center",
}
const textAlignClass: Record<DataTableAlign, string> = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
}

export function DataTable<Row extends Record<string, unknown>>({
  columns,
  rows,
  rowKey,
  footer,
  emptyLabel = "Tidak ada data",
  compact = false,
  className,
  ...rest
}: DataTableProps<Row>) {
  const cellPad = compact ? "px-3 py-2" : "px-4 py-3"

  return (
    <View
      accessibilityRole="none"
      className={cn("w-full overflow-hidden rounded-md border border-border bg-background", className)}
      {...rest}
    >
      {/* Header */}
      <View className="flex-row border-b border-border bg-surface">
        {columns.map((col) => {
          const align = col.align ?? "left"
          return (
            <View key={col.key} style={{ flex: col.flex ?? 1 }} className={cn(cellPad, alignClass[align])}>
              <Text variant="caption" weight="medium" className={cn("uppercase text-text-secondary", textAlignClass[align])}>
                {col.title}
              </Text>
            </View>
          )
        })}
      </View>

      {/* Body */}
      {rows.length === 0 ? (
        <View className={cn("items-center", compact ? "py-6" : "py-8")}>
          <Text variant="body-sm" className="text-text-tertiary">
            {emptyLabel}
          </Text>
        </View>
      ) : (
        rows.map((row, i) => (
          <View
            key={rowKey ? rowKey(row, i) : String(i)}
            className={cn("flex-row", i < rows.length - 1 && "border-b border-border")}
          >
            {columns.map((col) => {
              const align = col.align ?? "left"
              const content = col.render ? col.render(row) : String(row[col.key] ?? "")
              return (
                <View key={col.key} style={{ flex: col.flex ?? 1 }} className={cn(cellPad, alignClass[align])}>
                  {typeof content === "string" || typeof content === "number" ? (
                    <Text
                      variant="body-sm"
                      className={cn("text-text-primary", textAlignClass[align], col.mono && "font-mono")}
                    >
                      {content}
                    </Text>
                  ) : (
                    content
                  )}
                </View>
              )
            })}
          </View>
        ))
      )}

      {/* Footer */}
      {footer ? (
        <View className="flex-row border-t border-border bg-surface">
          {columns.map((col) => {
            const align = col.align ?? "left"
            const content = footer[col.key]
            return (
              <View key={col.key} style={{ flex: col.flex ?? 1 }} className={cn(cellPad, alignClass[align])}>
                {typeof content === "string" || typeof content === "number" ? (
                  <Text
                    variant="body-sm"
                    weight="semibold"
                    className={cn("text-text-primary", textAlignClass[align], col.mono && "font-mono")}
                  >
                    {content}
                  </Text>
                ) : (
                  content ?? null
                )}
              </View>
            )
          })}
        </View>
      ) : null}
    </View>
  )
}
