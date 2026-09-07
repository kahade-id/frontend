/**
 * Kahade — <DataTable> tabel sederhana berbasis flex (§9.18 pendukung
 * statistik, §3.1 angka Mono, §13 format).
 *
 * Untuk rincian biaya, riwayat pencairan, dan perbandingan paket. BUKAN
 * <table> HTML — flexbox agar satu implementasi jalan di iOS/Android/web.
 *
 * Keputusan non-obvious:
 *   - Lebar kolom lewat `flex` per kolom (default 1), tanpa ScrollView
 *     horizontal: di layar 360px tabel finansial harus terbaca tanpa geser.
 *     Lebih dari 4 kolom -> pecah ke <KeyValueList> per baris (mobile-first
 *     §11).
 *   - Header: `bg-surface` + variant `label` (13/600) tone secondary. TIDAK
 *     uppercase — §3.2 melarang ALL CAPS untuk label; hierarki cukup dari
 *     weight 600 + ukuran kecil.
 *   - Kolom `mono` merender variant `monoBody` (JetBrains Mono 14/500 +0.5px)
 *     — bukan class `font-mono` polos, karena di RN family tanpa weight
 *     terdaftar jatuh ke system font (lihat lib/fonts.ts).
 *   - Baris dipisah `border-b` 1px. Tidak ada zebra striping: itu menambah
 *     abu ketiga yang tidak punya peran di §2.4.
 *   - Footer (total) = `bg-surface` + weight 600 (mono 600 tersedia di tokens).
 *   - Dibungkus `rounded-md border` seperti Card; `overflow-hidden` supaya
 *     bg header tidak menutup sudut.
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
  /** Kolom angka/kode — JetBrains Mono (variant monoBody) */
  mono?: boolean
  /** Render kustom sel; default String(row[key]) */
  render?: (row: Row) => ReactNode
}

export type DataTableProps<Row extends Record<string, unknown>> = Omit<ViewProps, "children"> & {
  columns: readonly DataTableColumn<Row>[]
  rows: Row[]
  /** Kunci unik baris; default index */
  rowKey?: (row: Row, index: number) => string
  /** Baris ringkasan paling bawah (mis. total) — bg-surface + weight 600 */
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

function isPrimitive(v: unknown): v is string | number {
  return typeof v === "string" || typeof v === "number"
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

  const renderCell = (col: DataTableColumn<Row>, content: ReactNode, emphasis: boolean) => {
    const align = col.align ?? "left"
    return (
      <View key={col.key} style={{ flex: col.flex ?? 1 }} className={cn(cellPad, alignClass[align])}>
        {isPrimitive(content) ? (
          <Text
            variant={col.mono ? "monoBody" : "body"}
            weight={emphasis ? 600 : undefined}
            tone="primary"
            className={textAlignClass[align]}
          >
            {content}
          </Text>
        ) : (
          content ?? null
        )}
      </View>
    )
  }

  return (
    <View
      className={cn("w-full overflow-hidden rounded-md border border-border bg-background", className)}
      {...rest}
    >
      {/* Header */}
      <View className="flex-row border-b border-border bg-surface">
        {columns.map((col) => {
          const align = col.align ?? "left"
          return (
            <View key={col.key} style={{ flex: col.flex ?? 1 }} className={cn(cellPad, alignClass[align])}>
              <Text variant="label" tone="secondary" className={textAlignClass[align]}>
                {col.title}
              </Text>
            </View>
          )
        })}
      </View>

      {/* Body */}
      {rows.length === 0 ? (
        <View className={cn("items-center", compact ? "py-6" : "py-8")}>
          <Text variant="body" tone="secondary">
            {emptyLabel}
          </Text>
        </View>
      ) : (
        rows.map((row, i) => (
          <View
            key={rowKey ? rowKey(row, i) : String(i)}
            className={cn("flex-row", i < rows.length - 1 && "border-b border-border")}
          >
            {columns.map((col) =>
              renderCell(col, col.render ? col.render(row) : String(row[col.key] ?? ""), false),
            )}
          </View>
        ))
      )}

      {/* Footer */}
      {footer ? (
        <View className="flex-row border-t border-border bg-surface">
          {columns.map((col) => renderCell(col, footer[col.key], true))}
        </View>
      ) : null}
    </View>
  )
}
