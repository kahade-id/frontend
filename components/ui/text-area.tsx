/**
 * Kahade — <TextArea> (§9.2 varian multiline + penghitung karakter).
 *
 * Pembungkus tipis di atas <Input variant="multiline"> untuk teks panjang:
 * deskripsi barang, catatan escrow, alasan sengketa. Menambahkan satu hal
 * yang tidak dimiliki Input: penghitung "120/500" di kanan bawah saat
 * `maxLength` ada — user tahu sisa ruang sebelum ditolak.
 *
 * Keputusan non-obvious:
 *   - Penghitung diposisikan ABSOLUTE di sudut kanan bawah, sejajar dengan
 *     baris helper/error yang dirender <Field> di dalam Input. Ini salah satu
 *     pemakaian absolute yang dibenarkan: Input tidak mengekspos slot kanan
 *     di baris helper, dan menambah baris baru akan membuat field lebih
 *     tinggi 18px hanya untuk angka kecil. `reserveHelperSpace` dipaksa true
 *     saat penghitung tampil agar baris itu selalu ada untuk ditumpangi.
 *   - Angka penghitung memakai Sofia Sans caption + tabular-nums (bawaan
 *     <Text>), BUKAN Mono — §3.1: Mono untuk data yang berdiri sendiri
 *     (nominal, ID); penghitung adalah meta UI kecil.
 *   - Saat mencapai batas (`length >= maxLength`), penghitung memakai tone
 *     danger dan weight 500 — sinyal validasi, bukan status (sejalan dengan
 *     helper error <Field>).
 *   - `rows` default 4 (≈ 136px) — cukup untuk 3–4 kalimat catatan; naikkan
 *     ke 6 untuk alasan sengketa.
 */
import { forwardRef, useState } from "react"
import { View, type TextInput } from "react-native"

import { Input, type InputProps } from "@/components/ui/input"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"

export type TextAreaProps = Omit<InputProps, "variant" | "secureTextEntry" | "clearable" | "onClear"> & {
  /** Tampilkan "n/maxLength" (default true bila maxLength ada) */
  showCount?: boolean
}

export const TextArea = forwardRef<TextInput, TextAreaProps>(function TextArea(
  {
    maxLength,
    showCount,
    value,
    defaultValue,
    onChangeText,
    rows = 4,
    reserveHelperSpace,
    containerClassName,
    ...rest
  },
  ref,
) {
  // Pantau panjang untuk mode uncontrolled tanpa mengambil alih state Input
  const [internalLength, setInternalLength] = useState((defaultValue ?? "").length)
  const length = value != null ? value.length : internalLength

  const count = showCount ?? maxLength != null
  const atLimit = maxLength != null && length >= maxLength

  return (
    <View className={cn("relative w-full", containerClassName)}>
      <Input
        ref={ref}
        variant="multiline"
        rows={rows}
        value={value}
        defaultValue={defaultValue}
        maxLength={maxLength}
        reserveHelperSpace={count ? true : reserveHelperSpace}
        onChangeText={(t) => {
          if (value == null) setInternalLength(t.length)
          onChangeText?.(t)
        }}
        {...rest}
      />
      {count ? (
        <Text
          variant="caption"
          weight={atLimit ? 500 : 400}
          tone={atLimit ? "danger" : "tertiary"}
          accessibilityLabel={
            maxLength != null ? `${length} dari ${maxLength} karakter` : `${length} karakter`
          }
          // Sejajar baris helper: caption 18px di dasar Field (gap-2 dari kotak)
          className="absolute bottom-0 right-0"
        >
          {maxLength != null ? `${length}/${maxLength}` : String(length)}
        </Text>
      ) : null}
    </View>
  )
})
