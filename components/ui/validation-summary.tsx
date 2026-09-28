/**
 * Kahade — <ValidationSummary> (Batch 139, A04 — gabungan tim AUTH & FEED).
 *
 * Ringkasan singkat semua error validasi form, dirender DI ATAS tombol
 * submit: saat beberapa field salah, user tidak perlu mencari error satu
 * per satu. Pemanggil juga memfokuskan field pertama yang salah.
 *
 * Dua bentuk input didukung (satu komponen untuk dua pemakaian):
 * - `issues`: pasangan { field, message } — dipakai alur auth.
 * - `errors`: daftar pesan polos — dipakai form etalase.
 *
 * Aksesibilitas: role="alert" supaya screen reader mengumumkan begitu
 * muncul; tiap item dibaca sebagai satu daftar.
 */
import { View } from "react-native"

import { Alert } from "@/components/ui/alert"
import { Text } from "@/components/ui/text"

export type ValidationIssue = {
  /** Nama field yang ramah dibaca, mis. "Kata sandi" */
  field: string
  /** Pesan error untuk field tersebut */
  message: string
}

export type ValidationSummaryProps = {
  /** Pasangan field + pesan (alur auth). */
  issues?: ValidationIssue[]
  /** Daftar pesan polos (form etalase). */
  errors?: string[]
  /** Judul ringkasan. Default: "N masalah perlu diperbaiki". */
  title?: string
  /**
   * Tone alert: "warning" = panduan perbaikan, "danger" = kegagalan.
   * Default "warning".
   */
  tone?: "warning" | "danger"
  onDismiss?: () => void
  /** Test ID untuk pengujian. */
  testID?: string
  className?: string
}

export function ValidationSummary({
  issues = [],
  errors = [],
  title,
  tone = "warning",
  onDismiss,
  testID,
  className,
}: ValidationSummaryProps) {
  const total = issues.length + errors.length
  if (total === 0) return null
  const heading =
    title ??
    (total === 1 ? "1 masalah perlu diperbaiki" : `${total} masalah perlu diperbaiki`)
  return (
    <Alert
      tone={tone}
      title={heading}
      onDismiss={onDismiss}
      testID={testID ?? "validation-summary"}
      className={className}
      accessibilityRole="alert"
    >
      <View className="gap-1" accessibilityRole="list">
        {issues.map((issue) => (
          <View key={issue.field} className="flex-row gap-2">
            <Text variant="body" tone="inherit">
              {"\u2022"}
            </Text>
            <Text variant="body" tone="inherit" className="flex-1">
              <Text variant="body" weight={600} tone="inherit">
                {issue.field}
                {": "}
              </Text>
              {issue.message}
            </Text>
          </View>
        ))}
        {errors.map((message, i) => (
          <View key={`err-${i}`} className="flex-row gap-2">
            <Text variant="body" tone="inherit">
              {"\u2022"}
            </Text>
            <Text variant="body" tone="inherit" className="flex-1">
              {message}
            </Text>
          </View>
        ))}
      </View>
    </Alert>
  )
}
