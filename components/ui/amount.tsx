/**
 * Kahade — <Amount> / <MonoText> (§3.1 "Presisi di detail numerik", §13).
 *
 * Nominal uang yang BERDIRI SENDIRI (nominal utama transaksi, saldo, total)
 * selalu JetBrains Mono (+0.5px letter-spacing) dan format `Rp1.000.000`
 * tanpa desimal. Angka yang menyatu di kalimat BUKAN pakai ini — tetap
 * Sofia Sans weight 600/700 (§3.1).
 *
 * Size: "large" = Mono Large 24/32 (nominal utama), "body" = Mono Body 14/20
 * (list, ringkasan). Tone semantic (success untuk dana masuk, danger untuk
 * keluar) opsional; default text-primary.
 *
 * Keputusan non-obvious:
 *   - `sign="always"` menampilkan "+Rp…" untuk mutasi masuk — dipakai
 *     bersama tone success supaya arah dana terbaca tanpa ikon.
 *   - `hidden` mengganti digit dengan bullet (saldo disembunyikan / "mata
 *     tertutup") — jumlah bullet tetap 8 agar lebar tidak membocorkan
 *     panjang nominal.
 *   - Prefix "Rp" tidak dipisah ke Text lebih kecil: konsistensi mono lebih
 *     penting daripada ornamen tipografi (§1 "Presisi").
 *   - <MonoText> = alias Text mono untuk ID transaksi / kode ref / rekening
 *     supaya pemanggil tidak menghafal variant "monoBody".
 */
import type { TextProps as RNTextProps } from "react-native"

import { Text, type TextProps, type TextTone } from "@/components/ui/text"
import { formatRupiah } from "@/lib/format"

export type AmountProps = Omit<RNTextProps, "children"> & {
  value: number
  size?: "large" | "body"
  tone?: Extract<TextTone, "primary" | "secondary" | "inverse" | "success" | "danger" | "warning" | "inherit">
  /** "auto": hanya minus; "always": +/-; "never": tanpa tanda */
  sign?: "auto" | "always" | "never"
  /** Sembunyikan nominal (••••••••) */
  hidden?: boolean
  /** "Rp1,5 jt" untuk label chart sempit — jangan untuk nominal transaksi */
  compact?: boolean
  className?: string
}

const HIDDEN = "Rp\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"

export function Amount({
  value,
  size = "body",
  tone = "primary",
  sign = "auto",
  hidden = false,
  compact = false,
  className,
  ...rest
}: AmountProps) {
  const text = hidden ? HIDDEN : formatRupiah(value, { sign, compact })
  return (
    <Text
      variant={size === "large" ? "monoLarge" : "monoBody"}
      tone={tone}
      numberOfLines={1}
      accessibilityLabel={hidden ? "Nominal disembunyikan" : text}
      className={className}
      {...rest}
    >
      {text}
    </Text>
  )
}

export type MonoTextProps = Omit<TextProps, "variant"> & { large?: boolean }

/** Teks Mono untuk ID transaksi, kode referensi, nomor rekening, timestamp teknis */
export function MonoText({ large = false, tone = "primary", ...rest }: MonoTextProps) {
  return <Text variant={large ? "monoLarge" : "monoBody"} tone={tone} {...rest} />
}
