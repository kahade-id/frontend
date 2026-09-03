/**
 * Kahade — <EmailField> (§9.2 Input, preset email).
 *
 * Input dengan ikon Envelope, keyboard email, autocomplete, dan validasi
 * format lokal yang baru muncul SETELAH blur (bukan saat mengetik) supaya
 * tidak "berteriak" ketika user baru mengetik separuh alamat.
 *
 * Keputusan non-obvious:
 *   - Regex sengaja longgar (ada @, ada titik di domain): validasi ketat
 *     tetap di server; tujuan di sini hanya menangkap typo jelas.
 *   - Whitespace di ujung dipangkas otomatis — sumber gagal login paling
 *     umum dari autocomplete keyboard mobile.
 */
import { Envelope } from "phosphor-react-native"
import { forwardRef, useCallback, useState } from "react"
import type { TextInput, TextInputProps } from "react-native"

import { Input, type InputProps } from "@/components/ui/input"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim())
}

export type EmailFieldLabels = { label: string; invalid: string }
const DEFAULT_LABELS: EmailFieldLabels = { label: "Email", invalid: "Format email tidak valid" }

export type EmailFieldProps = Omit<
  InputProps,
  "variant" | "leftIcon" | "secureTextEntry" | "keyboardType" | "autoCapitalize" | "value" | "onChangeText"
> & {
  value: string
  onChangeText: (value: string) => void
  /** Validasi format lokal setelah blur (default true) */
  validate?: boolean
  labels?: Partial<EmailFieldLabels>
}

export const EmailField = forwardRef<TextInput, EmailFieldProps>(function EmailField(
  { value, onChangeText, validate = true, labels, label, errorText, onBlur, ...rest },
  ref,
) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const [touched, setTouched] = useState(false)

  const handleBlur = useCallback<NonNullable<TextInputProps["onBlur"]>>(
    (e) => {
      setTouched(true)
      const trimmed = value.trim()
      if (trimmed !== value) onChangeText(trimmed)
      onBlur?.(e)
    },
    [value, onChangeText, onBlur],
  )

  const localError = validate && touched && value.length > 0 && !isValidEmail(value) ? t.invalid : undefined

  return (
    <Input
      ref={ref}
      label={label ?? t.label}
      value={value}
      onChangeText={onChangeText}
      onBlur={handleBlur}
      leftIcon={Envelope}
      keyboardType="email-address"
      autoCapitalize="none"
      autoCorrect={false}
      autoComplete="email"
      textContentType="emailAddress"
      errorText={errorText ?? localError}
      {...rest}
    />
  )
})
