/**
 * Kahade — <VerifiedSeal> (§verified-badge).
 *
 * Seal-check di samping nama pengguna dengan 3 tier warna:
 * - emas  = TRUSTED_BY_KAHADE — diberikan manual oleh admin Kahade kepada
 *            customer pilihan (tier tertinggi). Bisa dicabut admin kapanpun.
 * - biru  = BUSINESS_VERIFIED — verifikasi manual admin atas legalitas badan
 *            usaha. Bisa dicabut admin kapanpun.
 * - abu   = FULLY_VERIFIED — otomatis bila: KYC APPROVED + email verified +
 *            HP verified + alamat lengkap + langganan Kahade+ aktif.
 *            Bisa dicabut admin kapanpun.
 *
 * Badge event (mis. dari kampanye) BUKAN tier verified dan tidak memicu seal.
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
import { useTheme } from "@/components/theme-provider"
import { translate } from "@/lib/i18n/translate"
import { formatDate } from "@/lib/format"
import { modes, type ColorMode } from "@/lib/tokens"
import type { VerificationBadge } from "@/lib/api/users"
import { cn } from "@/lib/cn"

// ---------------------------------------------------------------------------

export type SealTier = "gold" | "blue" | "gray"

/** Warna seal per tier — identitas visual tetap di light & dark mode. */
export const SEAL_TIER_COLOR: Record<SealTier, string> = {
  gold: "#C9A227",
  blue: "#1D9BF0",
  // FE-131: `gray` literal DIHENTIKAN — pakai `sealTierColor()` agar abu
  // mengikuti token `badgeGray` per-mode (AA di light & dark). Nilai ini
  // dipertahankan hanya sebagai fallback historis, bukan untuk render.
  gray: "#6B7280",
}

/**
 * FE-131 (audit frontend 2026-09-29): warna tier seal yang theme-aware.
 * Emas/biru = identitas brand, sengaja tetap di kedua mode; abu = token
 * `badgeGray` per-mode (light #6B7280, dark #9CA3AF — keduanya lolos AA,
 * sedangkan #6B7280 di dark hanya ±3.94:1 vs background).
 */
export function sealTierColor(tier: SealTier, mode: ColorMode): string {
  return tier === "gray" ? modes[mode].badgeGray : SEAL_TIER_COLOR[tier]
}

const SEAL_TIER_LABEL: Record<SealTier, string> = {
  gold: "Terverifikasi Eksklusif",
  blue: "Bisnis Terverifikasi",
  gray: "Terverifikasi",
}

const SEAL_TIER_DESCRIPTION: Record<SealTier, string> = {
  gold: "Akun ini diverifikasi secara eksklusif oleh admin Kahade.",
  blue: "Legalitas badan usaha akun ini sudah diverifikasi Kahade.",
  gray: "Akun ini telah menyelesaikan verifikasi identitas, kontak, alamat, dan berlangganan Kahade+.",
}

/**
 * Tentukan tier seal dari daftar badge aktif.
 * Prioritas: emas (admin) > biru (bisnis) > abu (FULLY_VERIFIED).
 * Abu HANYA dari FULLY_VERIFIED — badge parsial (KYC_VERIFIED /
 * CONTACT_VERIFIED saja) dan badge event TIDAK memicu seal.
 */
export function getSealTier(badges: VerificationBadge[] | undefined | null): SealTier | null {
  if (!badges || badges.length === 0) return null
  const types = new Set(badges.map((b) => b.type))
  if (types.has("TRUSTED_BY_KAHADE")) return "gold"
  if (types.has("BUSINESS_VERIFIED")) return "blue"
  if (types.has("FULLY_VERIFIED")) return "gray"
  return null
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
function badgeIconColor(type: string, mode: ColorMode): string {
  switch (type) {
    case "TRUSTED_BY_KAHADE":
      return SEAL_TIER_COLOR.gold
    case "BUSINESS_VERIFIED":
      return SEAL_TIER_COLOR.blue
    case "KAHADE_PLUS":
      return "#8B5CF6"
    default:
      return sealTierColor("gray", mode)
  }
}

/**
 * Deskripsi tampilan badge verifikasi — selaras dengan definisi 3 tier.
 * Badge lain (event, Kahade+, dsb.) memakai deskripsi dari backend apa adanya.
 * Nama `type` tidak diubah (kontrak backend); hanya teks tampilan.
 */
const BADGE_DISPLAY_DESCRIPTION: Partial<Record<string, string>> = {
  FULLY_VERIFIED:
    "Menyelesaikan seluruh verifikasi: identitas (KYC), email, nomor handphone, alamat lengkap, dan berlangganan Kahade+.",
  BUSINESS_VERIFIED:
    "Legalitas badan usaha (NPWP dan akta/SIUP) sudah diverifikasi manual oleh admin Kahade.",
  TRUSTED_BY_KAHADE:
    "Diberikan langsung oleh admin Kahade kepada akun pilihan sebagai tanda kepercayaan tertinggi.",
}

// ---------------------------------------------------------------------------

export type VerifiedSealProps = {
  /** Badge aktif dari GET /v1/users/{username}/badges (sudah terurut). */
  badges: VerificationBadge[] | undefined | null
  /** Fallback boolean lama bila daftar badge belum dimuat. */
  verified?: boolean
  /**
   * R1 (audit 2026-09-26): tier dari payload backend (`sealTier`) — dipakai
   * di permukaan yang tidak memuat daftar badge penuh (feed, search, chat).
   * Diutamakan di atas komputasi dari `badges`.
   */
  tier?: SealTier | null
  size?: number
  className?: string
}

export function VerifiedSeal({ badges, verified = false, tier: tierProp, size = 16, className }: VerifiedSealProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const { mode } = useTheme()
  const tier = tierProp ?? getSealTier(badges) ?? (verified ? "gray" : null)
  if (!tier) return null

  const color = sealTierColor(tier, mode)
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
  const { mode } = useTheme()
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
                style={{ backgroundColor: `${badgeIconColor(b.type, mode)}1A` }}
              >
                <Icon icon={IconCmp} size={20} color={badgeIconColor(b.type, mode)} />
              </View>
              <View className="flex-1">
                <Text variant="body" weight={600}>
                  {b.label}
                </Text>
                <Text variant="caption" tone="secondary" className="pt-0.5">
                  {BADGE_DISPLAY_DESCRIPTION[b.type] ?? b.description}
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
  // FE-124: helper tanggal baku (§13) — bukan toLocaleDateString mentah.
  return formatDate(iso, { long: true })
}

// Re-ekspor agar call site lama tidak perlu impor phosphor langsung.
export type { PhosphorIcon }
