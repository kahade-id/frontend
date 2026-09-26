/**
 * Kahade — <VerifiedSeal> (§verified-badge).
 *
 * Seal-check di samping nama pengguna dengan 3 tier warna:
 * - emas  = TRUSTED_BY_KAHADE — verifikasi eksklusif yang diberikan
 *            langsung oleh admin Kahade (tier tertinggi).
 * - biru  = BUSINESS_VERIFIED — badan usaha terverifikasi.
 * - abu   = verifikasi lengkap (KYC + email & HP) atau sebagian.
 *
 * Ditekan → BottomSheet berisi semua badge aktif beserta keterangannya.
 * Branching tampilan WAJIB memakai `type` badge dari backend, bukan label.
 */
import { useState } from "react"
import { Pressable, View } from "react-native"
import {
  Briefcase,
  Envelope,
  IdentificationBadge,
  SealCheck,
  ShieldStar,
  Sparkle,
  type Icon as PhosphorIcon,
} from "phosphor-react-native"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Icon, type IconComponent } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"
import { translate } from "@/lib/i18n/translate"
import type { VerificationBadge } from "@/lib/api/users"
import { cn } from "@/lib/cn"

// ---------------------------------------------------------------------------

export type SealTier = "gold" | "blue" | "gray"

/** Warna seal per tier — identitas visual tetap di light & dark mode. */
export const SEAL_TIER_COLOR: Record<SealTier, string> = {
  gold: "#C9A227",
  blue: "#1D9BF0",
  gray: "#6B7280",
}

const SEAL_TIER_LABEL: Record<SealTier, string> = {
  gold: "Terverifikasi Eksklusif",
  blue: "Bisnis Terverifikasi",
  gray: "Terverifikasi",
}

const SEAL_TIER_DESCRIPTION: Record<SealTier, string> = {
  gold: "Akun ini diverifikasi secara eksklusif oleh admin Kahade.",
  blue: "Legalitas badan usaha akun ini sudah diverifikasi Kahade.",
  gray: "Akun ini telah menyelesaikan verifikasi identitas dan kontak.",
}

/**
 * Tentukan tier seal dari daftar badge aktif.
 * Prioritas: emas (admin) > biru (bisnis) > abu (verifikasi identitas/kontak).
 */
export function getSealTier(badges: VerificationBadge[] | undefined | null): SealTier | null {
  if (!badges || badges.length === 0) return null
  const types = new Set(badges.map((b) => b.type))
  if (types.has("TRUSTED_BY_KAHADE")) return "gold"
  if (types.has("BUSINESS_VERIFIED")) return "blue"
  if (types.has("FULLY_VERIFIED") || types.has("KYC_VERIFIED") || types.has("CONTACT_VERIFIED"))
    return "gray"
  return "gray"
}

/** Ikon Phosphor per nama ikon badge dari backend (kebab-case). */
const BADGE_ICON_MAP: Partial<Record<string, IconComponent>> = {
  "seal-check": SealCheck as unknown as IconComponent,
  "badge-check": IdentificationBadge as unknown as IconComponent,
  "briefcase-check": Briefcase as unknown as IconComponent,
  sparkles: Sparkle as unknown as IconComponent,
  "shield-star": ShieldStar as unknown as IconComponent,
  "envelope-check": Envelope as unknown as IconComponent,
}

/** Warna ikon tiap badge di dalam sheet — selaras dengan tier seal. */
function badgeIconColor(type: string): string {
  switch (type) {
    case "TRUSTED_BY_KAHADE":
      return SEAL_TIER_COLOR.gold
    case "BUSINESS_VERIFIED":
      return SEAL_TIER_COLOR.blue
    case "KAHADE_PLUS":
      return "#8B5CF6"
    default:
      return SEAL_TIER_COLOR.gray
  }
}

// ---------------------------------------------------------------------------

export type VerifiedSealProps = {
  /** Badge aktif dari GET /v1/users/{username}/badges (sudah terurut). */
  badges: VerificationBadge[] | undefined | null
  /** Fallback boolean lama bila daftar badge belum dimuat. */
  verified?: boolean
  size?: number
  className?: string
}

export function VerifiedSeal({ badges, verified = false, size = 16, className }: VerifiedSealProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const tier = getSealTier(badges) ?? (verified ? "gray" : null)
  if (!tier) return null

  const color = SEAL_TIER_COLOR[tier]
  const label = SEAL_TIER_LABEL[tier]

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={translate("Akun {x}", { x: label })}
        accessibilityHint={translate("Ketuk untuk melihat detail verifikasi")}
        hitSlop={8}
        onPress={() => setSheetOpen(true)}
        className={cn("items-center justify-center", className)}
      >
        <Icon icon={SealCheck as unknown as IconComponent} size={size} weight="fill" color={color} />
      </Pressable>

      <VerificationSheet
        visible={sheetOpen}
        onRequestClose={() => setSheetOpen(false)}
        badges={badges ?? []}
        tier={tier}
      />
    </>
  )
}

export type VerificationSheetProps = {
  visible: boolean
  onRequestClose: () => void
  badges: VerificationBadge[]
  tier: SealTier
}

/** Sheet detail verifikasi — dipakai VerifiedSeal & baris chip badge. */
export function VerificationSheet({ visible, onRequestClose, badges, tier }: VerificationSheetProps) {
  return (
    <BottomSheet
      visible={visible}
      onRequestClose={onRequestClose}
      title={translate("Verifikasi akun")}
      description={translate(SEAL_TIER_DESCRIPTION[tier])}
    >
      <View className="gap-1">
        {badges.map((b) => {
          const IconCmp = BADGE_ICON_MAP[b.icon] ?? (SealCheck as unknown as IconComponent)
          return (
            <View key={b.type} className="flex-row items-start gap-3 py-2.5">
              <View
                className="h-10 w-10 items-center justify-center rounded-full"
                style={{ backgroundColor: `${badgeIconColor(b.type)}1A` }}
              >
                <Icon icon={IconCmp} size={20} color={badgeIconColor(b.type)} />
              </View>
              <View className="flex-1">
                <Text variant="body" weight={600}>
                  {b.label}
                </Text>
                <Text variant="caption" tone="secondary" className="pt-0.5">
                  {b.description}
                </Text>
                {b.earnedAt ? (
                  <Text variant="caption" tone="tertiary" className="pt-0.5">
                    {translate("Sejak {x}", { x: formatBadgeDate(b.earnedAt) })}
                  </Text>
                ) : null}
              </View>
            </View>
          )
        })}
      </View>
    </BottomSheet>
  )
}

function formatBadgeDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  try {
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
  } catch {
    return iso
  }
}

// Re-ekspor agar call site lama tidak perlu impor phosphor langsung.
export type { PhosphorIcon }
