/**
 * Kahade — <DisputeClaimForm> (§9.8 TextArea, §11 Form, §12 Voice & Tone,
 * §8 countdown).
 * API: POST /v1/disputes/{disputeId}/claim
 *
 * Pernyataan klaim tertulis satu pihak dalam sengketa — dikirim sekali,
 * boleh diperbarui hingga tenggat. Ini teks yang dibaca mediator, jadi
 * form menuntun struktur: panduan poin (apa yang disepakati, apa yang
 * terjadi, apa yang diminta) + TextArea panjang + hitungan karakter.
 *
 * Keputusan non-obvious:
 *   - Panduan ditulis sebagai daftar statis di atas field, bukan
 *     placeholder: placeholder hilang saat mengetik, padahal pengguna
 *     butuh rujukan sambil menulis.
 *   - `deadline` (sudah diformat) ditampilkan sebagai Alert warning
 *     "Batas kirim …" — setelah lewat, backend menolak; kita beri tahu dulu.
 *     Bila `locked` (tenggat lewat / mediator sudah memutus), TextArea
 *     disabled dan tombol hilang; teks tetap terbaca (`readOnly` view).
 *   - Minimal 50 karakter: klaim satu kalimat tidak bisa dimediasi.
 *     Batas atas 3000 mengikuti kolom backend.
 *   - Label tombol berganti "Kirim klaim" -> "Perbarui klaim" bila
 *     `existingClaim` ada — memberi tahu bahwa ini menimpa, bukan menambah.
 *   - Draft tersimpan lokal urusan pemanggil (`value`/`onChange` controlled).
 */
import { useState } from "react"
import { View, type ViewProps } from "react-native"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"
import { cn } from "@/lib/cn"

export type DisputeClaimLabels = {
  title: string
  guideTitle: string
  guide: readonly string[]
  fieldLabel: string
  placeholder: string
  deadline: (formatted: string) => string
  locked: string
  submit: string
  update: string
  lastUpdated: (formatted: string) => string
}

export type DisputeClaimFormProps = Omit<ViewProps, "children"> & {
  value?: string
  onChange?: (text: string) => void
  onSubmit: (text: string) => void
  submitting?: boolean
  /** Klaim yang sudah tersimpan — mengubah label tombol & mengisi awal */
  existingClaim?: string
  /** Sudah diformat (§13), mis. "5 Sep 2026, 23:59" */
  deadline?: string
  /** Sudah diformat — tampil sebagai caption bila existingClaim ada */
  updatedAt?: string
  /** Tenggat lewat atau sengketa sudah diputus */
  locked?: boolean
  minLength?: number
  maxLength?: number
  labels?: Partial<DisputeClaimLabels>
  className?: string
}

const DEFAULT_LABELS: DisputeClaimLabels = {
  title: "Pernyataan klaim",
  guideTitle: "Sertakan dalam pernyataan Anda:",
  guide: [
    "Apa yang disepakati di awal (barang/jasa, harga, waktu)",
    "Apa yang sebenarnya terjadi dan kapan",
    "Bukti yang Anda lampirkan dan apa yang dibuktikannya",
    "Penyelesaian yang Anda minta (refund penuh, sebagian, atau lainnya)",
  ],
  fieldLabel: "Pernyataan Anda",
  placeholder: "Tulis kronologi secara runtut…",
  deadline: (f) => `Batas kirim klaim: ${f}. Setelah itu, mediator memutus berdasarkan bukti yang ada.`,
  locked: "Klaim tidak dapat diubah lagi.",
  submit: "Kirim klaim",
  update: "Perbarui klaim",
  lastUpdated: (f) => `Terakhir diperbarui ${f}`,
}

export function DisputeClaimForm({
  value,
  onChange,
  onSubmit,
  submitting = false,
  existingClaim,
  deadline,
  updatedAt,
  locked = false,
  minLength = 50,
  maxLength = 3000,
  labels,
  className,
  ...rest
}: DisputeClaimFormProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const [inner, setInner] = useState(existingClaim ?? "")
  const text = value ?? inner
  const setText = (next: string) => {
    if (value === undefined) setInner(next)
    onChange?.(next)
  }

  const trimmed = text.trim()
  const tooShort = trimmed.length > 0 && trimmed.length < minLength
  const unchanged = existingClaim !== undefined && trimmed === existingClaim.trim()
  const canSubmit = !locked && trimmed.length >= minLength && !unchanged && !submitting

  return (
    <View accessible={false} className={cn("gap-5", className)} {...rest}>
      <View className="gap-1">
        <Text variant="h3" tone="primary">
          {t.title}
        </Text>
        {existingClaim && updatedAt ? (
          <Text variant="caption" tone="secondary">
            {t.lastUpdated(updatedAt)}
          </Text>
        ) : null}
      </View>

      {locked ? (
        <Alert tone="neutral" variant="outline">
          {t.locked}
        </Alert>
      ) : deadline ? (
        <Alert tone="warning" variant="soft">
          {t.deadline(deadline)}
        </Alert>
      ) : null}

      {!locked ? (
        <View className="gap-2">
          <Text variant="label" tone="secondary">
            {t.guideTitle}
          </Text>
          <View className="gap-1">
            {t.guide.map((g, i) => (
              <View key={g} className="flex-row gap-2">
                <Text variant="monoBody" tone="secondary">
                  {i + 1}.
                </Text>
                <Text variant="body" tone="secondary" className="flex-1 leading-6">
                  {g}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <TextArea
        label={t.fieldLabel}
        required={!locked}
        value={text}
        onChangeText={setText}
        placeholder={t.placeholder}
        rows={locked ? undefined : 8}
        maxLength={maxLength}
        showCount={!locked}
        disabled={locked}
        errorText={tooShort ? `Minimal ${minLength} karakter` : undefined}
      />

      {!locked ? (
        <Button accessibilityHint="Ketuk untuk berinteraksi" onPress={() => onSubmit(trimmed)} disabled={!canSubmit} loading={submitting}>
          {existingClaim ? t.update : t.submit}
        </Button>
      ) : null}
    </View>
  )
}