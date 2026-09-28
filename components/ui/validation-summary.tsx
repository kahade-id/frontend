/**
 * Kahade — <ValidationSummary> (Batch 139, A04).
 *
 * Saat beberapa field salah sekaligus, pengguna tidak harus mencari error
 * satu per satu: ringkasan singkat tampil DI ATAS tombol submit, dan layar
 * memfokuskan field pertama yang salah (ditangani pemanggil lewat ref).
 *
 * Render: <Alert tone="warning"> berisi daftar bullet — warning (bukan
 * danger) karena ini panduan perbaikan, bukan kegagalan sistem. Setiap item
 * dibaca screen reader sebagai satu daftar.
 */
import { View } from "react-native"

import { Alert } from "@/components/ui/alert"
import { Text } from "@/components/ui/text"

export type ValidationSummaryProps = {
  /** Daftar pesan error (satu per field yang salah). Kosong = tidak render. */
  errors: string[]
  /** Judul ringkasan. */
  title?: string
  /** Test ID untuk pengujian. */
  testID?: string
}

export function ValidationSummary({
  errors,
  title = "Periksa kembali isian berikut",
  testID,
}: ValidationSummaryProps) {
  if (errors.length === 0) return null
  return (
    <Alert
      tone="warning"
      title={title}
      testID={testID ?? "validation-summary"}
      accessibilityRole="alert"
    >
      <View className="gap-1" accessibilityRole="list">
        {errors.map((message, i) => (
          <View key={i} className="flex-row gap-2">
            <Text variant="body" tone="primary">
              {"\u2022"}
            </Text>
            <Text variant="body" tone="primary" className="flex-1">
              {message}
            </Text>
          </View>
        ))}
      </View>
    </Alert>
  )
}
