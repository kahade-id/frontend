/**
 * Kahade — <UsernameField> (§9.2 Input, khusus username publik).
 *
 * Input dengan prefix "@" (ikon At), normalisasi otomatis (lowercase, hanya
 * a-z 0-9 _ .), validasi format lokal, dan status ketersediaan dari server
 * (`availability`) yang ditampilkan sebagai ikon kanan + helper text.
 *
 * Keputusan non-obvious:
 *   - Validasi format dilakukan di sini (sinkron) supaya tidak memanggil API
 *     untuk nilai yang pasti ditolak; ketersediaan tetap urusan pemanggil
 *     (debounce + fetch), komponen hanya menerima hasilnya.
 *   - Ikon status kanan mengikuti §7: Check `success`, X `danger`, spinner
 *     saat "checking". Border tetap normal saat "taken" — border-error hanya
 *     untuk error format; ketersediaan adalah informasi, bukan kesalahan input.
 */
import { At, Check, X } from "phosphor-react-native"
import { forwardRef, useMemo } from "react"
import { TextInput, View } from "react-native"

import { Icon } from "@/components/ui/icon"
import { Input, type InputProps } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"

export type UsernameAvailability = "idle" | "checking" | "available" | "taken"

export const USERNAME_MIN = 3
export const USERNAME_MAX = 20
const USERNAME_RE = /^[a-z0-9](?:[a-z0-9._]{1,18}[a-z0-9])?$/

export function normalizeUsername(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9._]/g, "").slice(0, USERNAME_MAX)
}

export function validateUsername(value: string, labels: UsernameFieldLabels): string | undefined {
  if (!value) return undefined
  if (value.length < USERNAME_MIN) return labels.tooShort
  if (!USERNAME_RE.test(value)) return labels.invalid
  return undefined
}

export type UsernameFieldLabels = {
  label: string
  tooShort: string
  invalid: string
  checking: string
  available: string
  taken: string
  hint: string
}

const DEFAULT_LABELS: UsernameFieldLabels = {
  label: "Nama pengguna",
  tooShort: `Minimal ${USERNAME_MIN} karakter`,
  invalid: "Hanya huruf kecil, angka, titik, dan garis bawah",
  checking: "Memeriksa ketersediaan…",
  available: "Nama pengguna tersedia",
  taken: "Nama pengguna sudah dipakai",
  hint: `${USERNAME_MIN}–${USERNAME_MAX} karakter, huruf kecil/angka/._`,
}

export type UsernameFieldProps = Omit<
  InputProps,
  "variant" | "leftIcon" | "rightIcon" | "secureTextEntry" | "autoCapitalize" | "autoCorrect" | "value" | "onChangeText"
> & {
  value: string
  onChangeText: (value: string) => void
  availability?: UsernameAvailability
  labels?: Partial<UsernameFieldLabels>
}

export const UsernameField = forwardRef<TextInput, UsernameFieldProps>(function UsernameField(
  { value, onChangeText, availability = "idle", labels, label, helperText, errorText, ...rest },
  ref,
) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const formatError = useMemo(() => validateUsername(value, t), [value, t])
  const resolvedError = errorText ?? formatError

  const statusHelper =
    !resolvedError && value
      ? availability === "checking"
        ? t.checking
        : availability === "available"
          ? t.available
          : availability === "taken"
            ? t.taken
            : undefined
      : undefined

  return (
    <View className="w-full">
      <Input
        ref={ref}
        label={label ?? t.label}
        value={value}
        onChangeText={(v) => onChangeText(normalizeUsername(v))}
        leftIcon={At}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        textContentType="username"
        maxLength={USERNAME_MAX}
        errorText={resolvedError}
        helperText={statusHelper ?? helperText ?? t.hint}
        {...rest}
      />
      {/*
        Status kanan dirender sebagai overlay (bukan `rightIcon`) karena Input
        hanya menerima IconComponent dengan tone default, sedangkan di sini
        butuh Spinner + tone success/danger. Tinggi h-14 = tinggi box Input
        berlabel, jadi ikon sejajar vertikal dengan teks.
      */}
      {!resolvedError && value && availability !== "idle" ? (
        <View pointerEvents="none" className="absolute right-4 top-0 h-14 justify-center">
          {availability === "checking" ? (
            <Spinner size="sm" />
          ) : (
            <Icon
              icon={availability === "available" ? Check : X}
              size="sm"
              tone={availability === "available" ? "success" : "danger"}
              weight="bold"
            />
          )}
        </View>
      ) : null}
    </View>
  )
})
