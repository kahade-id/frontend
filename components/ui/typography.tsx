/**
 * Kahade — Shortcut tipografi: <Paragraph>, <Caption>, <Label>, <Emphasis>
 * (§3.1, §3.2).
 *
 * Pelengkap <Heading> (heading.tsx): pemanggil memilih PERAN teks, bukan
 * variant + tone, sehingga aturan §3 hanya ditulis sekali:
 *
 *   - <Paragraph> : body 14/22 (atau `large` 16/26), tone primary, boleh
 *                   multi-baris. `muted` -> tone secondary untuk deskripsi.
 *   - <Caption>   : 12/18 tone secondary (helper, timestamp label). `strong`
 *                   -> weight 500 (§3.2 "Caption 400/500 untuk penekanan ringan").
 *   - <Label>     : 13/18 weight 600 tone secondary — label form/tab. TIDAK
 *                   ALL CAPS (§3.2); komponen ini tidak menyediakan prop uppercase
 *                   sama sekali supaya aturan itu tidak bisa dilanggar.
 *   - <Emphasis>  : Text INLINE untuk penekanan di tengah kalimat, mis.
 *                   "Anda akan transfer <Emphasis>Rp5.000.000</Emphasis>".
 *                   §3.1: tetap Sofia Sans weight 600/700 — JANGAN Mono
 *                   inline. tone "inherit" agar mengikuti warna paragraf.
 *
 * Kenapa <Emphasis> hanya menerima weight 600|700 (non-obvious): itulah dua
 * nilai yang disebut §3.1 untuk emphasis; 500 sudah dipakai Caption strong
 * dan 400 bukan penekanan. Membatasi tipe = aturan ditegakkan compiler.
 */
import { Text, type TextProps } from "@/components/ui/text"

export type ParagraphProps = Omit<TextProps, "variant"> & {
  /** Body Large 16/26 untuk body utama / deskripsi hero */
  large?: boolean
  /** tone secondary */
  muted?: boolean
}

export function Paragraph({ large = false, muted = false, tone, ...rest }: ParagraphProps) {
  return (
    <Text
      variant={large ? "bodyLarge" : "body"}
      tone={tone ?? (muted ? "secondary" : "primary")}
      {...rest}
    />
  )
}

export type CaptionProps = Omit<TextProps, "variant" | "weight"> & {
  /** weight 500 — penekanan ringan (§3.2) */
  strong?: boolean
}

export function Caption({ strong = false, tone = "secondary", ...rest }: CaptionProps) {
  return <Text variant="caption" weight={strong ? 500 : 400} tone={tone} {...rest} />
}

export type LabelProps = Omit<TextProps, "variant" | "weight">

/** 13/600 — label form, tab, kolom tabel. Tidak ada opsi uppercase (§3.2). */
export function Label({ tone = "secondary", ...rest }: LabelProps) {
  return <Text variant="label" tone={tone} {...rest} />
}

export type EmphasisProps = Omit<TextProps, "variant" | "tone" | "weight"> & {
  weight?: 600 | 700
}

/**
 * Penekanan inline di dalam <Paragraph>/<Text>. Variant tidak di-set agar
 * mewarisi size parent (RN Text nested mewarisi style parent); hanya weight
 * yang dipaksa. Angka uang di tengah kalimat memakai ini, bukan <Amount>.
 */
export function Emphasis({ weight = 600, className, ...rest }: EmphasisProps) {
  // `variant="body"` hanya agar family sans ter-set; size/lineHeight parent
  // menang karena RN menggabungkan style nested text (parent -> child).
  return <Text variant="body" weight={weight} tone="inherit" className={className} {...rest} />
}
