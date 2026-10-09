/**
 * Kahade — <ProfileAboutTab>: isi tab "Tentang" di profil publik user.
 *
 * Diekstrak sekaligus dirapikan dari app/user/[username].tsx (permintaan
 * produk bagian B):
 *  - B.1: opsi "Laporkan"/"Blokir" TIDAK lagi di tab ini — keduanya pindah
 *    ke header profil (menu kebab titik tiga pada profil orang lain).
 *  - B.2: informasi akun publik dilengkapi — kartu "Informasi Akun" (status
 *    KYC, skor kepercayaan, BERGABUNG SEJAK) + kartu "Kontak publik"
 *    (email kontak & nomor HP kontak yang dipilih pemilik untuk dipublik).
 */
import type { ReactNode } from "react"
import { View } from "react-native"
import { CalendarBlank, DeviceMobile, EnvelopeSimple, ShieldCheck } from "phosphor-react-native"

import type { PublicUserProfile, VerificationBadge } from "@/lib/api/users"
import { formatDate } from "@/lib/format"
import { useLanguage } from "@/lib/i18n"
import { translate } from "@/lib/i18n/translate"

import { Badge } from "@/components/ui/badge"
import { Icon, type IconComponent } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"

export type ProfileAboutTabProps = {
  profile: PublicUserProfile
  /** (2026-10-05: badge verifikasi pindah ke tab Tentang.) */
  badges?: VerificationBadge[]
}

/**
 * Baris label–nilai di kartu tab Tentang (label kiri dengan ikon kecil,
 * nilai kanan). Ikon membantu pembacaan sekilas tanpa menambah teks.
 */
function InfoRow({
  label,
  icon,
  children,
}: {
  label: string
  icon: IconComponent
  children: ReactNode
}) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <View className="shrink flex-row items-center gap-2">
        <Icon icon={icon} size="xs" tone="default" />
        <Text variant="caption" tone="secondary" className="shrink">
          {label}
        </Text>
      </View>
      {children}
    </View>
  )
}

/** Nilai kontak: tampilkan nilainya, atau "Tidak dibagikan" yang jujur. */
function ContactValue({ value }: { value?: string | null }) {
  return value ? (
    <Text variant="caption" tone="primary" numberOfLines={1} className="shrink text-right">
      {value}
    </Text>
  ) : (
    <Text variant="caption" tone="tertiary">
      {translate("Tidak dibagikan")}
    </Text>
  )
}

export function ProfileAboutTab({ profile, badges = [] }: ProfileAboutTabProps) {
  // i18n: label mengikuti bahasa aktif.
  useLanguage()
  return (
    <View className="px-5 pt-4 gap-4">
      {/* (2026-10-05: badge verifikasi pindah ke tab Tentang.) */}
      {badges.length > 0 ? (
        <View className="w-full gap-3 rounded-md border border-border bg-surface p-4">
          <Text variant="body" weight={600} tone="primary">
            {translate("Lencana Verifikasi")}
          </Text>
          <View className="flex-row flex-wrap items-center gap-1.5">
            {badges.map((b) => (
              <Badge
                key={b.type}
                tone="neutral"
                variant="soft"
                accessibilityLabel={`${b.label}: ${b.description}`}
              >
                {b.shortLabel}
              </Badge>
            ))}
          </View>
        </View>
      ) : null}
      <View className="w-full gap-3 rounded-md border border-border bg-surface p-4">
        <Text variant="body" weight={600} tone="primary">
          {translate("Informasi Akun")}
        </Text>
        <View className="gap-2">
          <InfoRow label={translate("Status Verifikasi (KYC)")} icon={ShieldCheck}>
            <Badge tone={profile.verified ? "success" : "neutral"}>
              {profile.verified ? translate("Terverifikasi") : translate("Belum Verifikasi")}
            </Badge>
          </InfoRow>
          <InfoRow label={translate("Skor Kepercayaan")} icon={ShieldCheck}>
            {/* D-09 (audit): fallback 100/100 = sinyal trust palsu untuk
                profil yang skornya tidak dikirim/gagal dimuat. Tanpa data →
                tampilkan "—" + keterangan. */}
            <Text variant="body" weight={600} tone="primary">
              {profile.trustScore != null ? `${profile.trustScore} / 100` : translate("— (belum ada skor)")}
            </Text>
          </InfoRow>
          {/* B.2 — "Bergabung sejak" (join date) */}
          <InfoRow label={translate("Bergabung Sejak")} icon={CalendarBlank}>
            <Text variant="caption" tone="primary">
              {profile.createdAt ? formatDate(profile.createdAt) : "—"}
            </Text>
          </InfoRow>
        </View>
      </View>

      {/* B.2 — Kontak publik. Nilai hanya dikirim backend bila pemilik
          mengaktifkan "tampilkan di profil" (flag showContact* dicek sebagai
          pengaman). Fail closed: flag harus eksplisit `true` — flag yang
          tidak dikirim berarti TIDAK dibagikan. Tanpa nilai, baris jujur
          menampilkan "Tidak dibagikan" daripada merahasiakan keberadaan fitur. */}
      <View className="w-full gap-3 rounded-md border border-border bg-surface p-4">
        <Text variant="body" weight={600} tone="primary">
          {translate("Kontak publik")}
        </Text>
        <View className="gap-2">
          <InfoRow label={translate("Email kontak")} icon={EnvelopeSimple}>
            <ContactValue value={profile.showContactEmail === true ? profile.contactEmail : null} />
          </InfoRow>
          <InfoRow label={translate("Nomor HP kontak")} icon={DeviceMobile}>
            <ContactValue value={profile.showContactPhone === true ? profile.contactPhone : null} />
          </InfoRow>
        </View>
      </View>
    </View>
  )
}
