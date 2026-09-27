/**
 * Screen — Checklist onboarding (KYC, rekening, etalase pertama).
 *
 * Layar khusus (deep-link `/onboarding-checklist`) untuk kartu progres
 * onboarding. Kartu muncul sekali sampai ketiga item selesai, lalu hilang
 * permanen (flag persisten `SecureKeys.onboardingChecklistDone`).
 *
 * Keputusan penempatan (2026-09-28, batch UI/UX): <OnboardingChecklistCard>
 * idealnya tampil di ATAS feed Etalase (`app/(tabs)/showcase.tsx`) — titik
 * paling sering dilihat user baru. File itu milik worker lain batch ini,
 * jadi TIDAK disentuh; kartu + layar ini siap dipasang di sana (komponen
 * me-render `null` saat tidak relevan). Layar ini memastikan fitur tetap
 * bisa diakses/ditinjau tanpa menunggu integrasi tab.
 */
import { View } from "react-native"

import { Header } from "@/components/ui/header"
import { OnboardingChecklistCard } from "@/components/ui/onboarding-checklist"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { translate, useLanguage } from "@/lib/i18n"

export default function OnboardingChecklistScreen() {
  useLanguage()
  return (
    <Screen edges={["top"]} padded={false}>
      <Header title={translate("Checklist akun")} />
      <View className="gap-3 px-5 pt-3">
        <Text variant="caption" tone="secondary">
          {translate("Selesaikan tiga langkah ini untuk membuka semua fitur Kahade.")}
        </Text>
        <OnboardingChecklistCard />
      </View>
    </Screen>
  )
}
