/**
 * Kahade — <PasswordStrength> + `scorePassword()` (§9.2 pendukung registrasi).
 *
 * Meter kekuatan kata sandi di bawah <Input secureTextEntry>: 4 segmen bar
 * tipis (h-1, rounded-full) + label tingkat di kanan. TETAP MONOKROM: segmen
 * terisi `bg-primary`, kosong `bg-border` — bukan gradasi merah→hijau.
 * Alasannya §2.3: warna semantik eksklusif untuk STATUS TRANSAKSI; kekuatan
 * sandi adalah feedback form, dan hierarki dari kontras hitam/abu sudah
 * cukup membedakan 1 vs 4 bar.
 *
 * Satu pengecualian: label "Lemah" (level 1) memakai tone danger. Ini
 * diperlakukan sebagai VALIDASI (sama seperti helper text error di <Field>),
 * bukan status — user perlu tahu sandi belum bisa diterima.
 *
 * `scorePassword()` sengaja sederhana & deterministik (tanpa dependensi
 * zxcvbn): 5 kriteria -> level 0–4. Aturan minimum yang dipakai server harus
 * sama; helper ini hanya umpan balik instan di klien, bukan gerbang keamanan.
 *
 * Keputusan non-obvious:
 *   - Kriteria yang belum terpenuhi bisa ditampilkan sebagai daftar
 *     (`showCriteria`) dengan ikon Check/Circle Phosphor — memberi arah
 *     ("tambahkan angka"), bukan sekadar skor. Ikon terpenuhi = tone active
 *     (bukan success) demi konsistensi monokrom yang sama.
 *   - Label diumumkan ke screen reader saat berubah (live region polite);
 *     bar hanya dekoratif (`accessibilityElementsHidden`).
 *   - Saat `password` kosong, komponen merender bar kosong TANPA label supaya
 *     tinggi tidak melompat ketika user mulai mengetik (`reserveSpace`).
 */
import { Check, Circle } from "phosphor-react-native"
import { View, type ViewProps } from "react-native"

import { Icon } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"

export type PasswordStrengthLevel = 0 | 1 | 2 | 3 | 4

export type PasswordCriterion = {
  key: string
  label: string
  test: (pw: string) => boolean
}

export const PASSWORD_MIN_LENGTH = 8

/** Kriteria default — urutan = urutan tampil di daftar */
export const DEFAULT_PASSWORD_CRITERIA: readonly PasswordCriterion[] = [
  { key: "length", label: `Minimal ${PASSWORD_MIN_LENGTH} karakter`, test: (p) => p.length >= PASSWORD_MIN_LENGTH },
  { key: "case", label: "Huruf besar dan kecil", test: (p) => /[a-z]/.test(p) && /[A-Z]/.test(p) },
  { key: "digit", label: "Mengandung angka", test: (p) => /\d/.test(p) },
  { key: "symbol", label: "Mengandung simbol", test: (p) => /[^A-Za-z0-9]/.test(p) },
]

/**
 * Level 0–4. Panjang < 8 selalu 0–1 apa pun variasinya (panjang adalah
 * faktor terkuat). Setiap kriteria lain menambah satu level; bonus +1 bila
 * >= 12 karakter, dibatasi 4.
 */
export function scorePassword(
  pw: string,
  criteria: readonly PasswordCriterion[] = DEFAULT_PASSWORD_CRITERIA,
): PasswordStrengthLevel {
  if (!pw) return 0
  const met = criteria.filter((c) => c.test(pw)).length
  if (pw.length < PASSWORD_MIN_LENGTH) return 1
  const bonus = pw.length >= 12 ? 1 : 0
  return Math.min(4, Math.max(1, met + bonus - 1)) as PasswordStrengthLevel
}

const DEFAULT_LABELS: readonly string[] = ["", "Lemah", "Cukup", "Kuat", "Sangat kuat"]

export type PasswordStrengthProps = Omit<ViewProps, "children"> & {
  password: string
  /** Override kriteria (harus sinkron dengan validasi server) */
  criteria?: readonly PasswordCriterion[]
  /** Label per level, index 0 untuk kosong (tidak ditampilkan) */
  labels?: readonly string[]
  /** Tampilkan daftar kriteria di bawah bar */
  showCriteria?: boolean
  /** Sisakan ruang label meski password kosong (default true) */
  reserveSpace?: boolean
  className?: string
}

export function PasswordStrength({
  password,
  criteria = DEFAULT_PASSWORD_CRITERIA,
  labels = DEFAULT_LABELS,
  showCriteria = false,
  reserveSpace = true,
  className,
  ...rest
}: PasswordStrengthProps) {
  const level = scorePassword(password, criteria)
  const label = labels[level] ?? ""

  return (
    <View accessible={false} className={cn("w-full gap-2", className)} {...rest}>
      <View className="flex-row items-center gap-3">
        {/* Bar: dekoratif, status dibaca lewat label */}
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className="flex-1 flex-row gap-1"
        >
          {[1, 2, 3, 4].map((i) => (
            <View
              key={i}
              className={cn("h-1 flex-1 rounded-full", i <= level ? "bg-primary" : "bg-border")}
            />
          ))}
        </View>

        {label || reserveSpace ? (
          <Text accessibilityHint="Ketuk untuk detail"
            variant="caption"
            weight={500}
            tone={level === 1 ? "danger" : "secondary"}
            accessibilityLiveRegion="polite"
            accessibilityLabel={label ? `Kekuatan kata sandi: ${label}` : undefined}
            className="min-w-[72px] text-right"
          >
            {label}
          </Text>
        ) : null}
      </View>

      {showCriteria ? (
        <View className="gap-1" accessibilityRole="list">
          {criteria.map((c) => {
            const ok = !!password && c.test(password)
            return (
              <View key={c.key} className="flex-row items-center gap-2">
                <Icon
                  icon={ok ? Check : Circle}
                  size="xs"
                  weight={ok ? "bold" : "regular"}
                  tone={ok ? "active" : "default"}
                />
                <Text variant="caption" tone={ok ? "primary" : "secondary"}>
                  {c.label}
                </Text>
              </View>
            )
          })}
        </View>
      ) : null}
    </View>
  )
}
