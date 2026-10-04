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
import { LockKey, Warning } from "phosphor-react-native"
import { forwardRef, useCallback, useState } from "react"
import { View, type TextInputInstance, type TextInputProps } from "react-native"
import { Input, type InputProps } from "@/components/ui/input"
import { Icon } from "@/components/ui/icon"
import { PasswordStrength, type PasswordStrengthProps } from "@/components/ui/password-strength"
import { Text } from "@/components/ui/text"
import { useCapsLockWarning } from "@/lib/caps-lock"

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

export const PasswordField = forwardRef<TextInputInstance, PasswordFieldProps>(function PasswordField(
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
    onFocus,
    containerClassName,
    ...rest
  },
  ref,
) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const isConfirm = confirmOf !== undefined
  const [touched, setTouched] = useState(false)
  // A02 (batch 139) [Web]: lacak fokus untuk peringatan Caps Lock.
  const [focused, setFocused] = useState(false)
  const capsLockOn = useCapsLockWarning(focused)
  // A03 (batch 139): nama field untuk label a11y tombol tampil/sembunyi —
  // "Konfirmasi kata sandi" → "Tampilkan konfirmasi kata sandi".
  const resolvedLabel = label ?? (isConfirm ? t.confirmLabel : t.label)
  const toggleName =
    resolvedLabel.charAt(0).toLowerCase() + resolvedLabel.slice(1)

  const handleFocus = useCallback<NonNullable<TextInputProps["onFocus"]>>(
    (e) => {
      setFocused(true)
      onFocus?.(e)
    },
    [onFocus],
  )

  const handleBlur = useCallback<NonNullable<TextInputProps["onBlur"]>>(
    (e) => {
      setTouched(true)
      setFocused(false)
      onBlur?.(e)
    },
    [onBlur],
  )

  const mismatch = isConfirm && touched && value.length > 0 && value !== confirmOf ? t.mismatch : undefined

  return (
    <View className={containerClassName}>
      <Input
        ref={ref}
        label={resolvedLabel}
        value={value}
        onChangeText={onChangeText}
        onFocus={handleFocus}
        onBlur={handleBlur}
        leftIcon={LockKey}
        secureTextEntry
        // A03: label a11y toggle mengikuti nama field ini.
        secureToggleLabel={toggleName}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={showStrength || isConfirm ? "new-password" : "current-password"}
        textContentType={showStrength || isConfirm ? "newPassword" : "password"}
        errorText={errorText ?? mismatch}
        {...rest}
      />
      {/*
       * A02 (batch 139) [Web]: peringatan kontekstual saat Caps Lock aktif.
       * Tidak mengungkap isi field — hanya status tombol. Muncul di semua
       * field kata sandi (login/daftar/ubah/reset) karena semuanya memakai
       * <PasswordField>.
       */}
      {capsLockOn ? (
        <View className="mt-2 flex-row items-center gap-1.5">
          <Icon icon={Warning} size="xs" tone="warning" />
          <Text
            variant="caption"
            tone="warning"
            accessibilityRole="alert"
          >
            Caps Lock aktif — kata sandi membedakan huruf besar dan kecil.
          </Text>
        </View>
      ) : null}
      {showStrength && !isConfirm ? <PasswordStrength password={value} className="mt-2" {...strengthProps} /> : null}
    </View>
  )
})
