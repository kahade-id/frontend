/**
 * Kahade — <Field> / <FieldLabel> / <FieldHelper> (§9.2 pendukung form).
 *
 * Kerangka bersama untuk SEMUA kontrol form (Input, Select, OTP, grup
 * Checkbox/Radio, Switch row): label di atas (opsional), kontrol di tengah,
 * helper/error di bawah. Dipisah dari Input supaya aturan teks form hanya
 * ditulis sekali:
 *   - Label  : variant `label` (13/600, §3.2) tone secondary — TIDAK all-caps.
 *   - Helper : variant `caption` tone secondary.
 *   - Error  : variant `caption` tone danger, MENGGANTIKAN helper (bukan
 *     ditumpuk) agar tinggi field tidak melompat saat validasi berubah.
 *   - Required ditandai " *" tone danger di label, bukan teks "(wajib)".
 *
 * Kenapa slot helper selalu dirender saat `reserveHelperSpace` (non-obvious):
 * di form panjang, error yang muncul/hilang menggeser field di bawahnya —
 * terasa "loncat". Slot kosong setinggi satu baris caption (18px) menjaga
 * layout stabil. Default false karena tidak semua field butuh helper.
 */
import { useEffect, useRef, type ReactNode } from "react"
import { AccessibilityInfo, Platform, View, type ViewProps } from "react-native"

import { cn } from "@/lib/cn"
import { Text } from "@/components/ui/text"

export type FieldProps = ViewProps & {
  label?: string
  required?: boolean
  helperText?: string
  errorText?: string
  /** Sisakan ruang satu baris caption meski helper/error kosong */
  reserveHelperSpace?: boolean
  disabled?: boolean
  children: ReactNode
  className?: string
}

export function FieldLabel({
  children,
  required,
  disabled,
  className,
}: {
  children: string
  required?: boolean
  disabled?: boolean
  className?: string
}) {
  return (
    <Text variant="label" tone={disabled ? "disabled" : "secondary"} className={className}>
      {children}
      {required ? (
        <Text variant="label" tone="danger">
          {" *"}
        </Text>
      ) : null}
    </Text>
  )
}

export function FieldHelper({
  helperText,
  errorText,
  reserveSpace = false,
  className,
}: {
  helperText?: string
  errorText?: string
  reserveSpace?: boolean
  className?: string
}) {
  const message = errorText || helperText

  // iOS VoiceOver TIDAK mendukung live region (lihat live-region.tsx) —
  // tanpa ini error validasi di iOS tidak pernah diumumkan. Android/web
  // sudah tercakup oleh `accessibilityLiveRegion` di bawah. Pesan yang sama
  // berturut-turut hanya diumumkan sekali agar tidak spam saat re-render.
  const lastAnnounced = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (!errorText || errorText === lastAnnounced.current) {
      if (!errorText) lastAnnounced.current = undefined
      return
    }
    lastAnnounced.current = errorText
    if (Platform.OS === "ios") AccessibilityInfo.announceForAccessibility(errorText)
  }, [errorText])

  if (!message && !reserveSpace) return null
  return (
    <Text
      variant="caption"
      tone={errorText ? "danger" : "secondary"}
      // Error text harus diumumkan screen reader saat muncul
      accessibilityLiveRegion={errorText ? "polite" : "none"}
      className={cn("min-h-[18px]", className)}
    >
      {message ?? ""}
    </Text>
  )
}

export function Field({
  label,
  required = false,
  helperText,
  errorText,
  reserveHelperSpace = false,
  disabled = false,
  children,
  className,
  ...rest
}: FieldProps) {
  return (
    <View className={cn("w-full gap-2", className)} {...rest}>
      {label ? (
        <FieldLabel required={required} disabled={disabled}>
          {label}
        </FieldLabel>
      ) : null}
      {children}
      <FieldHelper
        helperText={helperText}
        errorText={errorText}
        reserveSpace={reserveHelperSpace}
      />
    </View>
  )
}
