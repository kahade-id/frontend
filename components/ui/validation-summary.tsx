/**
 * Kahade — <ValidationSummary> (Batch 139, A04).
 *
 * Ringkasan singkat semua error validasi form, dirender DI ATAS tombol
 * submit: saat beberapa field salah, user tidak perlu mencari error satu
 * per satu. Pemanggil juga memfokuskan field pertama yang salah (lihat
 * `focusFirstInvalid` di lib/form-validation.ts).
 *
 * Aksesibilitas: role="alert" supaya screen reader mengumumkan begitu
 * muncul; tiap item menyebut nama field + pesan.
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
  issues: ValidationIssue[]
  onDismiss?: () => void
  className?: string
}

export function ValidationSummary({ issues, onDismiss, className }: ValidationSummaryProps) {
  if (issues.length === 0) return null
  const title =
    issues.length === 1
      ? "1 masalah perlu diperbaiki"
      : `${issues.length} masalah perlu diperbaiki`
  return (
    <Alert
      tone="danger"
      title={title}
      onDismiss={onDismiss}
      className={className}
      accessibilityRole="alert"
    >
      <View className="gap-1">
        {issues.map((issue) => (
          <Text key={issue.field} variant="body" tone="inherit">
            <Text variant="body" weight={600} tone="inherit">
              {issue.field}
              {": "}
            </Text>
            {issue.message}
          </Text>
        ))}
      </View>
    </Alert>
  )
}
