/**
 * Kahade — <DateText> (§13 Format Data: tanggal & waktu).
 *
 * SATU jalan untuk menampilkan timestamp di UI. §13 menetapkan format
 * eksplisit ("3 Sep 2026, 14:30") dan MELARANG relative time ("2 jam lalu")
 * — demi presisi yang konsisten dengan prinsip data akurat. Komponen ini
 * sengaja TIDAK punya prop `relative`, supaya larangan itu ditegakkan di
 * level API, bukan hanya di dokumen.
 *
 * Format (dari lib/format, bukan logika lokal):
 *   - "datetime" (default) : "3 Sep 2026, 14:30" — timestamp default seluruh app
 *   - "date"               : "3 Sep 2026"
 *   - "time"               : "14:30"
 *   - "long"               : "Rabu, 3 September 2026" — struk/konfirmasi
 *
 * Keputusan non-obvious:
 *   - Default variant `caption` tone `secondary`: di §3.2 Caption disebut
 *     eksplisit untuk "timestamp label". Timestamp hampir selalu metadata
 *     pendamping (di bawah judul list item), bukan konten utama.
 *   - `mono` mengalihkan ke JetBrains Mono (monoBody) untuk "timestamp
 *     teknis" (§3.1) — mis. di detail transaksi/security log berdampingan
 *     dengan ID. Timestamp di kalimat/list biasa TETAP Sofia Sans dengan
 *     tabular figures (sudah di-handle <Text accessibilityHint="Ketuk untuk detail">).
 *   - `accessibilityLabel` = format "long" + jam, agar screen reader membaca
 *     "Rabu, 3 September 2026, 14:30" walau tampilannya singkat.
 */
import { Text, type TextProps } from "@/components/ui/text"
import { formatDate, formatDateLong, formatDateTime, formatTime } from "@/lib/format"

export type DateTextFormat = "datetime" | "date" | "time" | "long"

export type DateTextProps = Omit<TextProps, "children" | "variant"> & {
  value: Date | number | string
  format?: DateTextFormat
  /** JetBrains Mono untuk timestamp teknis (detail transaksi, log) */
  mono?: boolean
  /** Variant Sofia Sans saat `mono=false`. Default caption. */
  variant?: Extract<TextProps["variant"], "bodyLarge" | "body" | "caption" | "label">
}

function render(value: Date | number | string, format: DateTextFormat): string {
  switch (format) {
    case "date":
      return formatDate(value)
    case "time":
      return formatTime(value)
    case "long":
      return formatDateLong(value)
    default:
      return formatDateTime(value)
  }
}

export function DateText({
  value,
  format = "datetime",
  mono = false,
  variant = "caption",
  tone = "secondary",
  accessibilityLabel,
  ...rest
}: DateTextProps) {
  const shown = render(value, format)
  const spoken =
    format === "time" ? shown : `${formatDateLong(value)}, ${formatTime(value)}`

  return (
    <Text ellipsizeMode="tail"
      variant={mono ? "monoBody" : variant}
      tone={tone}
      numberOfLines={1}
      accessibilityLabel={accessibilityLabel ?? spoken}
      {...rest}
    >
      {shown}
    </Text>
  )
}
