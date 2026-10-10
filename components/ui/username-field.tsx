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
import { forwardRef, useMemo, useState } from "react"
import { View, type TextInputInstance } from "react-native"
import { Icon } from "@/components/ui/icon"
import { Input, type InputProps } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Text } from "@/components/ui/text"
import { translate } from "@/lib/i18n/translate"

/**
 * E-05 (audit 2026-10-10): `error` = pemeriksaan GAGAL (429 throttle 5/menit,
 * jaringan) — bukan "tidak tersedia". Simpan tetap boleh berjalan; backend
 * memutus (409 USERNAME_TAKEN).
 */
export type UsernameAvailability = "idle" | "checking" | "available" | "taken" | "error"

// Batch 139 E01: konstanta + normalisasi dipindah ke lib/username.ts (murni,
// teruji). Re-export di sini menjaga kompatibilitas import yang sudah ada.
import { normalizeUsername, USERNAME_MIN, USERNAME_MAX } from "@/lib/username"
export { normalizeUsername, USERNAME_MIN, USERNAME_MAX }

// SYS-C-201 (audit konsistensi 2026-10-03): batas username disatukan 3–30
// (DBL-006 backend; dulu 3–20). Nilai yang divalidasi di sini SUDAH
// dinormalisasi (lowercase) oleh onChangeText di bawah, jadi charset kecil
// tetap benar untuk nilai tampilan ini.
// E-06 (audit 2026-10-10): aturan SERVICE backend (users.service.ts
// updateProfile), bukan hanya DTO. DTO memang longgar (`/^[a-zA-Z0-9._]+$/`),
// tetapi service menolak awalan/akhiran `.`/`_` (`budi_`, `.andi`) dan simbol
// berurutan (`a..b`) dengan VALIDATION_ERROR — versi 2026-10-06 yang hanya
// meniru DTO meloloskannya di klien, lalu gagal saat simpan.
export const USERNAME_RE = /^[a-z0-9](?:[a-z0-9._]*[a-z0-9])?$/
export const USERNAME_CONSECUTIVE_RE = /[._]{2,}/

/** Lolos SEMUA aturan username profil (panjang + bentuk) — dipakai guard cek ketersediaan & simpan. */
export function isValidProfileUsername(value: string): boolean {
  return (
    value.length >= USERNAME_MIN &&
    value.length <= USERNAME_MAX &&
    USERNAME_RE.test(value) &&
    !USERNAME_CONSECUTIVE_RE.test(value)
  )
}

export function validateUsername(value: string, labels: UsernameFieldLabels): string | undefined {
  if (!value) return undefined
  if (value.length < USERNAME_MIN) return labels.tooShort
  if (!USERNAME_RE.test(value) || USERNAME_CONSECUTIVE_RE.test(value)) return labels.invalid
  return undefined
}

export type UsernameFieldLabels = {
  label: string
  tooShort: string
  invalid: string
  checking: string
  available: string
  taken: string
  /** E-05: pemeriksaan gagal (throttle/jaringan) — bukan "tidak tersedia". */
  checkFailed: string
  hint: string
}

/**
 * G-01 (audit 2026-09-22): label dipisah dari angka supaya bisa diterjemahkan —
 * `translate()` di scope MODUL akan membekukan bahasa saat berkas pertama kali
 * dimuat (pengguna yang menukar bahasa tidak melihat perubahan sampai restart),
 * jadi nilainya dibangun saat render lewat fungsi ini.
 */
function defaultLabels(): UsernameFieldLabels {
  return {
    label: translate("Nama pengguna"),
    tooShort: translate("Minimal {x} karakter", { x: USERNAME_MIN }),
    invalid: translate("Huruf kecil, angka, titik, garis bawah — awal & akhir huruf/angka, tanpa simbol berurutan"),
    checking: translate("Memeriksa ketersediaan…"),
    available: translate("Nama pengguna tersedia"),
    taken: translate("Nama pengguna sudah dipakai"),
    checkFailed: translate("Ketersediaan belum bisa diperiksa — akan dicek saat menyimpan"),
    hint: translate("{x}–{y} karakter, huruf kecil/angka/._", {
      x: USERNAME_MIN,
      y: USERNAME_MAX,
    }),
  }
}

export type UsernameFieldProps = Omit<
  InputProps,
  "variant" | "leftIcon" | "rightIcon" | "secureTextEntry" | "autoCapitalize" | "autoCorrect" | "value" | "onChangeText"
> & {
  value: string
  onChangeText: (value: string) => void
  availability?: UsernameAvailability
  labels?: Partial<UsernameFieldLabels>
  /**
   * Batch 139 E01 — tampilkan bentuk FINAL username yang akan dicek
   * ketersediaannya. Nilai field sudah dinormalisasi saat mengetik
   * (lowercase, tanpa spasi/karakter asing), jadi yang tampil di sini
   * persis string yang dikirim ke server — pengguna tidak lagi menebak
   * apakah "Budi Santoso" dicek sebagai "budi santoso" atau "budisantoso".
   */
  showFinalFormPreview?: boolean
}

export const UsernameField = forwardRef<TextInputInstance, UsernameFieldProps>(function UsernameField(
  { value, onChangeText, availability = "idle", labels, label, helperText, errorText, showFinalFormPreview = true, onBlur, ...rest },
  ref,
) {
  const t = { ...defaultLabels(), ...labels }
  // FRM-008: error "minimal 3 karakter" memerah sejak keystroke pertama —
  // tampilkan hanya setelah blur; saat mengetik cukup hint netral.
  const [blurred, setBlurred] = useState(false)
  const formatError = useMemo(() => {
    const err = validateUsername(value, t)
    if (!blurred && err === t.tooShort) return undefined
    return err
  }, [value, t, blurred])
  const resolvedError = errorText ?? formatError

  const statusHelper =
    !resolvedError && value
      ? availability === "checking"
        ? t.checking
        : availability === "available"
          ? t.available
          : availability === "taken"
            ? t.taken
            : availability === "error"
              ? t.checkFailed
              : undefined
      : undefined

  return (
    <View className="w-full">
      <Input
        ref={ref}
        label={label ?? t.label}
        value={value}
        onChangeText={(v) => {
          const next = normalizeUsername(v)
          if (!next) setBlurred(false)
          onChangeText(next)
        }}
        onBlur={(e) => {
          setBlurred(true)
          onBlur?.(e)
        }}
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
      {/* Batch 139 E01: bentuk final yang akan dicek ketersediaannya.
          Normalisasi terjadi saat mengetik (lihat onChangeText di atas),
          jadi nilai ini persis yang dikirim ke server. */}
      {showFinalFormPreview && value && !resolvedError ? (
        <Text variant="caption" tone="tertiary" className="pt-1">
          {translate("Dicek sebagai: @{x}", { x: value })}
        </Text>
      ) : null}
      {/*
        Status kanan dirender sebagai overlay (bukan `rightIcon`) karena Input
        hanya menerima IconComponent dengan tone default, sedangkan di sini
        butuh Spinner + tone success/danger. Tinggi h-14 = tinggi box Input
        berlabel, jadi ikon sejajar vertikal dengan teks.
      */}
      {!resolvedError && value && availability !== "idle" ? (
        <View style={{ pointerEvents: "none" }} className="absolute right-4 top-0 h-14 justify-center">
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
