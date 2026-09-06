/**
 * Kahade — <PasswordField> (§9.2 Input, preset kata sandi).
 *
 * Input `secureTextEntry` (toggle Eye/EyeSlash sudah disediakan <Input>)
 * dengan ikon LockKey dan — opsional — <PasswordStrength> di bawahnya untuk
 * alur buat/ubah kata sandi. Untuk login, matikan `showStrength`.
 *
 * Keputusan non-obvious:
 *   - `autoComplete` dibedakan: "new-password" saat strength aktif (alur
 *     registrasi/ubah) supaya password manager menawarkan generator, dan
 *     "current-password" untuk login. Ini bukan kosmetik — memengaruhi
 *     autofill iOS/Android/web.
 *   - `confirmOf`: bila diisi, field ini bertindak sebagai konfirmasi dan
 *     menampilkan error "tidak cocok" setelah blur (bukan per ketikan).
 */
import { LockKey } from "phosphor-react-native"
import { forwardRef, useCallback, useState } from "react"
import { View, type TextInput, type TextInputProps } from "react-native"

import { Input, type InputProps } from "@/components/ui/input"
import { PasswordStrength, type PasswordStrengthProps } from "@/components/ui/password-strength"

export type PasswordFieldLabels = { label: string; confirmLabel: string; mismatch: string }
const DEFAULT_LABELS: PasswordFieldLabels = {
  label: "Kata sandi",
  confirmLabel: "Ulangi kata sandi",
  mismatch: "Kata sandi tidak cocok",
}

export type PasswordFieldProps = Omit<
  InputProps,
  "variant" | "leftIcon" | "secureTextEntry" | "autoCapitalize" | "value" | "onChangeText"
> & {
  value: string
  onChangeText: (value: string) => void
  /** Tampilkan meter kekuatan (alur buat/ubah kata sandi) */
  showStrength?: boolean
  strengthProps?: Omit<PasswordStrengthProps, "password">
  /** Nilai kata sandi utama — menjadikan field ini konfirmasi */
  confirmOf?: string
  labels?: Partial<PasswordFieldLabels>
  containerClassName?: string
}

export const PasswordField = forwardRef<TextInput, PasswordFieldProps>(function PasswordField(
  {
    value,
    onChangeText,
    showStrength = false,
    strengthProps,
    confirmOf,
    labels,
    label,
    errorText,
    onBlur,
    containerClassName,
    ...rest
  },
  ref,
) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const isConfirm = confirmOf !== undefined
  const [touched, setTouched] = useState(false)

  const handleBlur = useCallback<NonNullable<TextInputProps["onBlur"]>>(
    (e) => {
      setTouched(true)
      onBlur?.(e)
    },
    [onBlur],
  )

  const mismatch = isConfirm && touched && value.length > 0 && value !== confirmOf ? t.mismatch : undefined

  return (
    <View accessible={false} className={containerClassName}>
      <Input
        ref={ref}
        label={label ?? (isConfirm ? t.confirmLabel : t.label)}
        value={value}
        onChangeText={onChangeText}
        onBlur={handleBlur}
        leftIcon={LockKey}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={showStrength || isConfirm ? "new-password" : "current-password"}
        textContentType={showStrength || isConfirm ? "newPassword" : "password"}
        errorText={errorText ?? mismatch}
        {...rest}
      />
      {showStrength && !isConfirm ? <PasswordStrength password={value} className="mt-2" {...strengthProps} /> : null}
    </View>
  )
})
