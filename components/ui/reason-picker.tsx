/**
 * Kahade — <ReasonPicker> (§9.5 Radio + §9.2 multiline).
 *
 * Daftar alasan (radio, satu pilihan) + textarea "Lainnya" yang muncul hanya
 * saat opsi `other` dipilih. Dipakai di pembatalan order, sengketa, laporan
 * pengguna, tutup akun — semua alur yang butuh alasan terstruktur untuk
 * analitik, plus ruang teks bebas.
 *
 * Keputusan non-obvious:
 *   - Nilai dikembalikan sebagai objek `{ code, note }` (bukan string gabungan)
 *     supaya server bisa mengagregasi `code` dan `note` tetap mentah.
 *   - Opsi "Lainnya" ditandai `other: true` di data, bukan hardcode kode
 *     "other" — kode dari backend bisa berbeda.
 *   - Textarea wajib diisi bila `other` dipilih; `errorText` dari luar
 *     (mis. saat submit) ditampilkan di bawah textarea.
 */
import { View, type ViewProps } from "react-native"

import { Radio, RadioGroup } from "@/components/ui/radio"
import { TextArea } from "@/components/ui/text-area"
import { cn } from "@/lib/cn"

export type ReasonOption = {
  code: string
  label: string
  description?: string
  /** Opsi bebas -> menampilkan textarea */
  other?: boolean
  disabled?: boolean
}

export type ReasonValue = { code: string | undefined; note: string }

export type ReasonPickerLabels = { noteLabel: string; notePlaceholder: string }
const DEFAULT_LABELS: ReasonPickerLabels = {
  noteLabel: "Alasan lainnya",
  notePlaceholder: "Jelaskan secara singkat",
}

export type ReasonPickerProps = Omit<ViewProps, "children"> & {
  options: readonly ReasonOption[]
  value: ReasonValue
  onChange: (value: ReasonValue) => void
  /** Tampilkan catatan untuk semua opsi (bukan hanya "Lainnya") */
  alwaysShowNote?: boolean
  noteMaxLength?: number
  errorText?: string
  disabled?: boolean
  labels?: Partial<ReasonPickerLabels>
  className?: string
}

export function isReasonComplete(value: ReasonValue, options: readonly ReasonOption[]): boolean {
  if (!value.code) return false
  const opt = options.find((o) => o.code === value.code)
  return !opt?.other || value.note.trim().length > 0
}

export function ReasonPicker({
  options,
  value,
  onChange,
  alwaysShowNote = false,
  noteMaxLength = 300,
  errorText,
  disabled = false,
  labels,
  className,
  ...rest
}: ReasonPickerProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const selected = options.find((o) => o.code === value.code)
  const showNote = alwaysShowNote || !!selected?.other

  return (
    <View accessible={false} className={cn("w-full gap-4", className)} {...rest}>
      <RadioGroup
        value={value.code}
        onChange={(code) => onChange({ code, note: value.note })}
        disabled={disabled}
        variant="card"
      >
        {options.map((o) => (
          <Radio key={o.code} value={o.code} label={o.label} description={o.description} disabled={o.disabled} />
        ))}
      </RadioGroup>

      {showNote ? (
        <TextArea
          label={t.noteLabel}
          placeholder={t.notePlaceholder}
          value={value.note}
          onChangeText={(note) => onChange({ code: value.code, note })}
          maxLength={noteMaxLength}
          rows={3}
          required={!!selected?.other}
          errorText={errorText}
          disabled={disabled}
        />
      ) : null}
    </View>
  )
}
