/**
 * Screen — Kebijakan Privasi (konten statis; i18n-ready key).
 * Draft content placeholder — copy final dari legal team.
 */
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { tokens } from "@/lib/tokens"

import { Header } from "@/components/ui/header"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"

export default function PrivacyPolicyScreen() {
  const insets = useSafeAreaInsets()
  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Kebijakan Privasi" />
      <View className="gap-4 px-6" style={{ paddingTop: tokens.space[3], paddingBottom: insets.bottom + tokens.space[8] }}>
        <SectionHeader title="1. Data yang kami kumpulkan" />
        <Text variant="body" tone="secondary">
          Kahade mengumpulkan data pribadi yang Anda berikan langsung (nama, nomor telepon, email, dokumen
          KYC) dan data penggunaan aplikasi untuk keperluan layanan.
        </Text>
        <SectionHeader title="2. Penggunaan data" />
        <Text variant="body" tone="secondary">
          Data digunakan untuk memproses transaksi, mencegah penipuan, dan meningkatkan pengalaman Anda.
        </Text>
        <SectionHeader title="3. Berbagi data" />
        <Text variant="body" tone="secondary">
          Kami tidak menjual data Anda. Data hanya dibagikan dengan penyedia pembayaran dan mitra yang
          diperlukan untuk menjalankan layanan.
        </Text>
        <SectionHeader title="4. Kontak" />
        <Text variant="body" tone="secondary">
          Untuk pertanyaan tentang privasi, hubungi kami melalui menu Hubungi Kami.
        </Text>
      </View>
    </Screen>
  )
}
