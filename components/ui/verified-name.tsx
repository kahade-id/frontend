/**
 * Kahade — <VerifiedName> (§verified-badge).
 *
 * Nama pengguna + seal verifikasi yang SELALU:
 * - presisi vertikal di tengah (flex-row items-center)
 * - ukuran seal proporsional dengan ukuran teks (berdasarkan variant)
 *
 * Dipakai di semua permukaan yang menampilkan nama + badge:
 * profil, list etalase, detail etalase, chat, search, dll.
 * Jangan lagi merangkai <Text> + <VerifiedSeal> manual — ukuran bisa
 * tidak pas dan centering meleset.
 */
import { View } from "react-native"

import { Text, type TextProps } from "@/components/ui/text"
import { VerifiedSeal, type SealTier } from "@/components/ui/verified-seal"
import type { VerificationBadge } from "@/lib/api/users"
import { typography, type TypographyKey } from "@/lib/tokens"
import { cn } from "@/lib/cn"

/**
 * Ukuran seal = fontSize × rasio. Rasio 1.0 membuat seal sejajar dengan
 * tinggi huruf kapital; sedikit di bawah 1.0 agar tidak mendominasi.
 */
const SEAL_SIZE_RATIO = 0.95

export type VerifiedNameProps = {
  /** Nama yang ditampilkan */
  name: string
  /** Variant teks — menentukan ukuran seal otomatis */
  variant?: TypographyKey
  /** Badge aktif dari backend */
  badges?: VerificationBadge[] | undefined | null
  /** Fallback boolean lama */
  verified?: boolean
  /** Tier dari payload backend (diutamakan) */
  tier?: SealTier | null
  /** Override ukuran seal manual (abaikan rasio otomatis) */
  sealSize?: number
  /** Props Text tambahan (weight, numberOfLines, className, dll) */
  textProps?: Omit<TextProps, "variant" | "children">
  className?: string
}

export function VerifiedName({
  name,
  variant = "body",
  badges,
  verified = false,
  tier,
  sealSize,
  textProps,
  className,
}: VerifiedNameProps) {
  const fontSize = typography[variant]?.fontSize ?? typography.body.fontSize
  const size = sealSize ?? Math.round(fontSize * SEAL_SIZE_RATIO)

  return (
    <View className={cn("flex-row items-center gap-1", className)}>
      <Text variant={variant} numberOfLines={1} className="min-w-0 shrink" {...textProps}>
        {name}
      </Text>
      <VerifiedSeal badges={badges} verified={verified} tier={tier} size={size} />
    </View>
  )
}
