/**
 * Kahade — <Truncate> ellipsis tengah untuk data presisi (§3.1 mono).
 *
 * ID transaksi, hash, nomor virtual account, atau nama file panjang yang
 * TIDAK boleh dipotong di ujung — 4 digit terakhir justru paling penting
 * untuk verifikasi ("…a3f9" vs "…b210"). RN `numberOfLines` +
 * `ellipsizeMode="middle"` ada, tapi tidak konsisten di web dan tidak
 * bisa diatur berapa karakter yang dipertahankan. Jadi pemotongan dilakukan
 * di string (lib/format `truncateMiddle`) dan hasilnya deterministik di
 * semua platform.
 *
 * Default `variant="monoBody"` karena kasus pakainya data presisi (§3.1);
 * ganti ke "body" untuk nama file/teks biasa.
 *
 * Aksesibilitas: `accessibilityLabel` = nilai PENUH, sehingga screen reader
 * membaca ID utuh meski tampilannya dipotong. `selectable` default true agar
 * user bisa long-press copy nilai lengkap (di RN, teks yang dicopy = teks
 * tampil; untuk copy nilai penuh pakai aksi Copy eksplisit di parent).
 */
import { truncateMiddle } from "@/lib/format"
import { Text, type TextProps } from "@/components/ui/text"

export type TruncateProps = Omit<TextProps, "children" | "numberOfLines"> & {
  value: string
  /** Karakter yang dipertahankan di awal. Default 8. */
  head?: number
  /** Karakter yang dipertahankan di akhir. Default 4. */
  tail?: number
}

export function Truncate({
  value,
  head = 8,
  tail = 4,
  variant = "monoBody",
  tone = "primary",
  selectable = true,
  accessibilityLabel,
  ...rest
}: TruncateProps) {
  const shown = truncateMiddle(value, head, tail)

  return (
    <Text
      variant={variant}
      tone={tone}
      numberOfLines={1}
      selectable={selectable}
      accessibilityLabel={accessibilityLabel ?? value}
      {...rest}
    >
      {shown}
    </Text>
  )
}
