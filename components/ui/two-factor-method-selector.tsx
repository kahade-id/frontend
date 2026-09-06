/**
 * Kahade — <TwoFactorMethodSelector> (§9.5 Radio varian card, §9.4 Badge,
 * §7 ikon monokrom).
 *
 * Pilihan metode verifikasi dua langkah saat onboarding keamanan dan di
 * halaman "Keamanan": aplikasi autentikator, SMS, email. Satu pilihan aktif
 * pada satu waktu — karena itu dibangun DI ATAS <RadioGroup variant="card">,
 * bukan daftar Switch: Switch menyiratkan tiap metode bisa aktif bersamaan,
 * yang bukan model 2FA Kahade (satu metode utama + kode cadangan).
 *
 * Keputusan non-obvious:
 *   - Urutan default: authenticator -> sms -> email, dari yang paling aman.
 *     Autentikator diberi <Badge tone="success" variant="soft">
 *     "Direkomendasikan" — satu-satunya penanda warna di komponen ini, dan
 *     memakai success karena maknanya "pilihan aman", bukan promosi (§2.3).
 *     Badge diletakkan di baris label (bukan di description) supaya terbaca
 *     sebelum pengguna membaca detail.
 *   - Ikon per metode (DeviceMobile / ChatText / EnvelopeSimple) lewat slot
 *     `leading` Radio card, tone default text-tertiary; ikon metode terpilih
 *     TIDAK berubah warna — hierarki pilihan datang dari border-focus Radio
 *     card, bukan dari ikon (§6 hierarki border).
 *   - Metode yang belum bisa dipakai (`unavailable`, mis. nomor HP belum
 *     diverifikasi) tetap DITAMPILKAN tapi `disabled`, dengan alasan
 *     menggantikan description dan tautan aksi opsional ("Verifikasi nomor").
 *     Menyembunyikannya membuat pengguna bertanya "kenapa tidak ada SMS?".
 *   - Hint tujuan (`hint`, mis. "+62 812•••••789" atau "bu••@mail.com")
 *     dirender monoBody di bawah description — data teknis bertopeng
 *     memakai Mono seperti nomor rekening (§3.1); pemanggil yang menopengi,
 *     komponen tidak pernah menerima nilai penuh.
 *   - Label "Metode saat ini" (Badge neutral outline) pada `currentMethod`
 *     membedakan "yang sedang aktif di akun" dari "yang sedang dipilih di
 *     form" — dua konsep yang sering tercampur di UI pengaturan keamanan.
 *   - Komponen menerima `methods` opsional agar layar bisa menyembunyikan
 *     metode yang tidak didukung region (mis. SMS di luar ID) tanpa fork
 *     komponen; default berisi ketiga metode.
 */
import type { ReactNode } from "react"
import { ChatText, DeviceMobile, EnvelopeSimple } from "phosphor-react-native"
import { View } from "react-native"

import { Badge } from "@/components/ui/badge"
import { Icon, type IconComponent } from "@/components/ui/icon"
import { Radio, RadioGroup, type RadioGroupProps } from "@/components/ui/radio"
import { Text } from "@/components/ui/text"
import { TextLink } from "@/components/ui/text-link"
// UX: haptic feedback ensured for onPress (light) — improves confirmation

export type TwoFactorMethodId = "authenticator" | "sms" | "email"

export type TwoFactorMethod = {
  id: TwoFactorMethodId
  label: string
  description: string
  icon?: IconComponent
  /** Tampilkan Badge "Direkomendasikan" */
  recommended?: boolean
  /** Tujuan bertopeng, sudah ditopengi pemanggil: "+62 812•••••789" */
  hint?: string
  /** Alasan metode belum bisa dipilih; membuat opsi disabled */
  unavailable?: string
  /** Aksi untuk mengatasi `unavailable`, mis. "Verifikasi nomor" */
  unavailableAction?: { label: string; onPress: () => void }
}

export type TwoFactorMethodSelectorLabels = {
  recommended: string
  current: string
}

export type TwoFactorMethodSelectorProps = Omit<RadioGroupProps, "children" | "variant" | "onChange"> & {
  value: TwoFactorMethodId | undefined
  onChange: (id: TwoFactorMethodId) => void
  /** Metode yang saat ini aktif di akun (bukan yang dipilih di form) */
  currentMethod?: TwoFactorMethodId
  /** Override daftar metode; default: authenticator, sms, email */
  methods?: TwoFactorMethod[]
  labels?: Partial<TwoFactorMethodSelectorLabels>
}

const DEFAULT_ICON: Record<TwoFactorMethodId, IconComponent> = {
  authenticator: DeviceMobile,
  sms: ChatText,
  email: EnvelopeSimple,
}

export const DEFAULT_TWO_FACTOR_METHODS: TwoFactorMethod[] = [
  {
    id: "authenticator",
    label: "Aplikasi autentikator",
    description: "Kode 6 digit dari Google Authenticator, Authy, atau sejenisnya. Bekerja tanpa sinyal.",
    recommended: true,
  },
  {
    id: "sms",
    label: "SMS",
    description: "Kode dikirim ke nomor HP terdaftar. Bergantung pada sinyal operator.",
  },
  {
    id: "email",
    label: "Email",
    description: "Kode dikirim ke alamat email terdaftar.",
  },
]

const DEFAULT_LABELS: TwoFactorMethodSelectorLabels = {
  recommended: "Direkomendasikan",
  current: "Metode saat ini",
}

export function TwoFactorMethodSelector({
  value,
  onChange,
  currentMethod,
  methods = DEFAULT_TWO_FACTOR_METHODS,
  labels,
  disabled,
  ...rest
}: TwoFactorMethodSelectorProps) {
  const t = { ...DEFAULT_LABELS, ...labels }

  return (
    <RadioGroup
      variant="card"
      value={value}
      onChange={(v) => onChange(v as TwoFactorMethodId)}
      disabled={disabled}
      {...rest}
    >
      {methods.map((m) => {
        const isUnavailable = !!m.unavailable
        const isCurrent = currentMethod === m.id

        const label: ReactNode = (
          <View accessible={false} className="flex-row flex-wrap items-center gap-2">
            <Text variant="body" weight={600} tone={isUnavailable ? "disabled" : "primary"}>
              {m.label}
            </Text>
            {m.recommended && !isUnavailable ? (
              <Badge tone="success" variant="soft">
                {t.recommended}
              </Badge>
            ) : null}
            {isCurrent ? (
              <Badge tone="neutral" variant="outline">
                {t.current}
              </Badge>
            ) : null}
          </View>
        )

        const description: ReactNode = (
          <View className="gap-1">
            <Text variant="caption" tone={isUnavailable ? "disabled" : "secondary"}>
              {isUnavailable ? m.unavailable : m.description}
            </Text>
            {!isUnavailable && m.hint ? (
              <Text variant="monoBody" tone="secondary">
                {m.hint}
              </Text>
            ) : null}
            {isUnavailable && m.unavailableAction ? (
              <TextLink onPress={m.unavailableAction.onPress} variant="caption">
                {m.unavailableAction.label}
              </TextLink>
            ) : null}
          </View>
        )

        return (
          <Radio
            key={m.id}
            value={m.id}
            label={label}
            description={description}
            disabled={isUnavailable}
            leading={<Icon icon={m.icon ?? DEFAULT_ICON[m.id]} size="md" tone={isUnavailable ? "disabled" : "default"} />}
            accessibilityLabel={`${m.label}${m.recommended ? `, ${t.recommended}` : ""}${
              isCurrent ? `, ${t.current}` : ""
            }${isUnavailable ? `, ${m.unavailable}` : ""}`}
          />
        )
      })}
    </RadioGroup>
  )
}