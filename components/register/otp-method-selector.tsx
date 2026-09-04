/**
 * Kahade — <OtpMethodSelector> (§9.5 Radio varian card, §7 ikon monokrom).
 *
 * Pilihan kanal pengiriman kode OTP saat registrasi via nomor HP: SMS atau
 * WhatsApp — nilai PERSIS enum `RequestOtpDto.method` ("SMS" | "WHATSAPP").
 * Satu pilihan aktif, karena itu dibangun di atas <RadioGroup variant="card">
 * seperti <TwoFactorMethodSelector>; TIDAK memakai komponen itu langsung
 * karena id-nya ("authenticator" | "sms" | "email") adalah domain 2FA, bukan
 * enum OTP registrasi — memaksakan pemetaan akan mengaburkan kontrak API.
 *
 * Keputusan non-obvious:
 *   - Daftar metode datang dari backend (`otp-methods`) lewat prop `methods`;
 *     komponen hanya tahu copy + ikon per enum. Metode yang tidak ada di
 *     daftar TIDAK dirender (berbeda dari 2FA yang menampilkan opsi disabled
 *     dengan alasan) — di sini "tidak ditawarkan" berarti backend memang
 *     tidak punya kanal itu, bukan "belum memenuhi syarat".
 *   - Ikon: ChatText (SMS) dan WhatsappLogo (WhatsApp) — keduanya Phosphor
 *     monokrom tone default; logo WhatsApp TIDAK hijau (§7: pengecualian warna
 *     hanya untuk logo bank/e-wallet di alur pembayaran).
 *   - Tidak ada Badge "Direkomendasikan": kedua kanal setara secara keamanan
 *     untuk OTP registrasi; memberi label rekomendasi akan menyiratkan
 *     preferensi yang tidak kami miliki.
 *   - `loading` merender 2 Skeleton berbentuk card dengan tinggi mendekati
 *     Radio card (p-5 + label + caption) agar layout tidak melompat saat
 *     data tiba; SkeletonGroup memberi satu pulse + satu label "Memuat".
 */
import { ChatText, WhatsappLogo } from "phosphor-react-native"

import { Icon, type IconComponent } from "@/components/ui/icon"
import { Radio, RadioGroup, type RadioGroupProps } from "@/components/ui/radio"
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton"
import type { OtpMethod } from "@/lib/api"

type OtpMethodMeta = {
  label: string
  description: string
  icon: IconComponent
}

export const OTP_METHOD_META: Record<OtpMethod, OtpMethodMeta> = {
  SMS: {
    label: "SMS",
    description: "Kode dikirim sebagai pesan SMS ke nomor Anda. Bergantung pada sinyal operator.",
    icon: ChatText,
  },
  WHATSAPP: {
    label: "WhatsApp",
    description: "Kode dikirim ke akun WhatsApp dengan nomor ini. Membutuhkan koneksi internet.",
    icon: WhatsappLogo,
  },
}

/** Tinggi perkiraan satu Radio card (p-5 x2 + body 22 + gap 4 + caption 18) */
const CARD_SKELETON_HEIGHT = 84

export type OtpMethodSelectorProps = Omit<RadioGroupProps, "children" | "variant" | "value" | "onChange"> & {
  value: OtpMethod | undefined
  onChange: (method: OtpMethod) => void
  /** Metode yang ditawarkan backend, urutan = urutan tampil */
  methods: OtpMethod[]
  loading?: boolean
}

export function OtpMethodSelector({ value, onChange, methods, loading = false, disabled, ...rest }: OtpMethodSelectorProps) {
  if (loading) {
    return (
      <SkeletonGroup className="w-full gap-3">
        <Skeleton shape="card" height={CARD_SKELETON_HEIGHT} className="w-full" />
        <Skeleton shape="card" height={CARD_SKELETON_HEIGHT} className="w-full" />
      </SkeletonGroup>
    )
  }

  return (
    <RadioGroup variant="card" value={value} onChange={(v) => onChange(v as OtpMethod)} disabled={disabled} {...rest}>
      {methods.map((m) => {
        const meta = OTP_METHOD_META[m]
        return (
          <Radio
            key={m}
            value={m}
            label={meta.label}
            description={meta.description}
            leading={<Icon icon={meta.icon} size="md" tone="default" />}
            accessibilityLabel={`${meta.label}. ${meta.description}`}
          />
        )
      })}
    </RadioGroup>
  )
}
