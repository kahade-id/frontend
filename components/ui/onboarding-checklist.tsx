/**
 * Kahade — kartu checklist onboarding (KYC, tambah rekening, etalase pertama).
 *
 * Muncul SEKALI sampai ketiga item selesai → hilang permanen (flag
 * `SecureKeys.onboardingChecklistDone`, lihat lib/onboarding-checklist.ts).
 * Tiap item deep-link ke layar yang relevan. Status dibaca dari
 * `useOnboardingChecklist()` (query cache yang sudah ada — tanpa endpoint
 * baru).
 *
 * Penempatan (keputusan 2026-09-28): kartu ini dirender di layar khusus
 * `app/onboarding-checklist.tsx` (deep-link `/onboarding-checklist`) dan
 * siap dipasang di atas feed Etalase (`app/(tabs)/showcase.tsx`, milik
 * worker lain — TIDAK disentuh batch ini) sebagai <OnboardingChecklistCard>
 * yang me-render `null` saat tidak relevan.
 */
import { Bank, CaretRight, CheckCircle, IdentificationCard, Storefront } from "phosphor-react-native"
import { useEffect, useRef } from "react"
import { Animated, View } from "react-native"
import { router, type Href } from "expo-router"

import { Icon, type IconComponent } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { useTheme } from "@/components/theme-provider"
import { useReducedMotion } from "@/lib/use-reduced-motion"
import { translate, useLanguage } from "@/lib/i18n"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import {
  useOnboardingChecklist,
  type OnboardingChecklistState,
} from "@/lib/use-onboarding-checklist"
import type { ChecklistItemId } from "@/lib/onboarding-checklist"

const ITEM_META: Record<
  ChecklistItemId,
  { icon: IconComponent; title: string; description: string; href: Href }
> = {
  kyc: {
    icon: IdentificationCard,
    title: "Verifikasi identitas (KYC)",
    description: "KTP + selfie — buka batas transaksi penuh",
    href: ROUTES.kyc,
  },
  bankAccount: {
    icon: Bank,
    title: "Tambah rekening bank",
    description: "Untuk pencairan dana ke rekening Anda",
    href: ROUTES.bankAccounts,
  },
  firstShowcase: {
    icon: Storefront,
    title: "Buat etalase pertama",
    description: "Pasang karya pertama Anda untuk mulai berjualan",
    href: ROUTES.showcaseCreate,
  },
}

export type OnboardingChecklistCardProps = {
  /** Dipakai layar khusus; default memakai hook sendiri. */
  state?: OnboardingChecklistState
  className?: string
}

export function OnboardingChecklistCard({ state, className }: OnboardingChecklistCardProps) {
  const fallback = useOnboardingChecklist()
  const { dismissed, loading, progress } = state ?? fallback
  // Copy statis dibaca generator katalog i18n — panggil hook bahasa.
  useLanguage()
  const { mode } = useTheme()
  const palette = tokens.colors[mode]
  const reducedMotion = useReducedMotion()
  const bar = useRef(new Animated.Value(progress.fraction)).current

  useEffect(() => {
    if (reducedMotion) {
      bar.setValue(progress.fraction)
      return
    }
    // PERF-FIX (P0): cleanup — tiap tick progress sebelumnya memicu animasi
    // baru yang menumpuk di atas yang lama (JS thread, width) → jank.
    const a = Animated.timing(bar, {
      toValue: progress.fraction,
      duration: 400,
      useNativeDriver: false,
    })
    a.start()
    return () => a.stop()
  }, [progress.fraction, reducedMotion, bar])

  if (dismissed) return null

  const width = bar.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  })

  return (
    <View
      className={className}
      accessibilityRole="summary"
      accessibilityLabel={translate("Daftar periksa pengenalan")}
    >
      <View className="gap-3 rounded-md border border-border bg-surface p-4">
        <View className="gap-1">
          <Text variant="bodyLarge" weight={700}>
            {translate("Lengkapi akun Anda")}
          </Text>
          <Text variant="caption" tone="secondary">
            {loading
              ? translate("Memeriksa progres…")
              : translate(`${progress.doneCount} dari ${progress.total} selesai`)}
          </Text>
        </View>

        {/* Progress bar: Animated.View TIDAK boleh className bg-* (aturan)
            → backgroundColor inline dari tokens. */}
        <View
          className="h-2 overflow-hidden rounded-full bg-surface"
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: progress.total, now: progress.doneCount }}
        >
          <Animated.View
            style={[{ width }, { backgroundColor: palette.primary, height: "100%", borderRadius: tokens.radius.full }]}
          />
        </View>

        <View className="gap-1">
          {progress.items.map((item) => {
            const meta = ITEM_META[item.id]
            return (
              <PressableScale
                key={item.id}
                onPress={() => router.push(meta.href)}
                accessibilityLabel={`${meta.title} — ${item.done ? translate("selesai") : translate("belum selesai")}`}
                accessibilityRole="button"
                className="flex-row items-center gap-3 rounded-sm px-2 py-2.5"
              >
                <View
                  className={
                    item.done
                      ? "rounded-full bg-success-soft p-2"
                      : "rounded-full bg-surface p-2"
                  }
                >
                  <Icon
                    icon={item.done ? CheckCircle : meta.icon}
                    tone={item.done ? "success" : "default"}
                    size="sm"
                    weight={item.done ? "fill" : "regular"}
                  />
                </View>
                <View className="flex-1 gap-0.5">
                  <Text variant="body" weight={600}>
                    {meta.title}
                  </Text>
                  <Text variant="caption" tone="secondary">
                    {meta.description}
                  </Text>
                </View>
                <Icon icon={CaretRight} tone="default" size="sm" />
              </PressableScale>
            )
          })}
        </View>
      </View>
    </View>
  )
}
