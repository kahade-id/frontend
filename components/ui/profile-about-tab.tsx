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

import type { PublicUserProfile } from "@/lib/api/users"
import { formatDate } from "@/lib/format"
import { useLanguage } from "@/lib/i18n"
import { translate } from "@/lib/i18n/translate"

import { Badge } from "@/components/ui/badge"
import { Text } from "@/components/ui/text"

export type ProfileAboutTabProps = {
  profile: PublicUserProfile
}

/** Baris label–nilai di kartu tab Tentang (label kiri, nilai kanan). */
function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
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

export function ProfileAboutTab({ profile }: ProfileAboutTabProps) {
  // i18n: label mengikuti bahasa aktif.
  useLanguage()
  return (
    <View className="px-5 pt-4 gap-4">
      <View className="w-full gap-3 rounded-md border border-border bg-surface p-4">
        <Text variant="body" weight={600} tone="primary">
          {translate("Informasi Akun")}
        </Text>
        <View className="gap-2">
          <InfoRow label={translate("Status Verifikasi (KYC)")}>
            <Badge tone={profile.verified ? "success" : "neutral"}>
              {profile.verified ? translate("Terverifikasi") : translate("Belum Verifikasi")}
            </Badge>
          </InfoRow>
          <InfoRow label={translate("Skor Kepercayaan")}>
            {/* D-09 (audit): fallback 100/100 = sinyal trust palsu untuk
                profil yang skornya tidak dikirim/gagal dimuat. Tanpa data →
                tampilkan "—" + keterangan. */}
            <Text variant="body" weight={600} tone="primary">
              {profile.trustScore != null ? `${profile.trustScore} / 100` : translate("— (belum ada skor)")}
            </Text>
          </InfoRow>
          {/* B.2 — "Bergabung sejak" (join date) */}
          <InfoRow label={translate("Bergabung Sejak")}>
            <Text variant="caption" tone="primary">
              {profile.createdAt ? formatDate(profile.createdAt) : "—"}
            </Text>
          </InfoRow>
        </View>
      </View>

      {/* B.2 — Kontak publik. Nilai hanya dikirim backend bila pemilik
          mengaktifkan "tampilkan di profil" (flag showContact* dicek sebagai
          pengaman); tanpa nilai baris jujur menampilkan "Tidak dibagikan"
          daripada merahasiakan keberadaan fitur. */}
      <View className="w-full gap-3 rounded-md border border-border bg-surface p-4">
        <Text variant="body" weight={600} tone="primary">
          {translate("Kontak publik")}
        </Text>
        <View className="gap-2">
          <InfoRow label={translate("Email kontak")}>
            <ContactValue
              value={profile.showContactEmail === false ? null : profile.contactEmail}
            />
          </InfoRow>
          <InfoRow label={translate("Nomor HP kontak")}>
            <ContactValue
              value={profile.showContactPhone === false ? null : profile.contactPhone}
            />
          </InfoRow>
        </View>
      </View>
    </View>
  )
}
