/**
 * Screen — Syarat & Ketentuan (konten statis).
 *
 * Catatan audit #15: spec API tidak punya endpoint dokumen legal, jadi teks
 * di-bundle di app. Ini RINGKASAN; versi final harus datang dari tim legal
 * (ganti isi atau arahkan ke URL publik bila tersedia). Body dibuat scroll
 * (`Screen scroll`) — sebelumnya konten terpotong di layar kecil.
 */
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { tokens } from "@/lib/tokens"

import { Header } from "@/components/ui/header"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"

export default function TermsScreen() {
  const insets = useSafeAreaInsets()
  return (
    <Screen edges={["top"]} padded={false} scroll>
      <Header title="Syarat & Ketentuan" />
      <View className="gap-4 px-6" style={{ paddingTop: tokens.space[3], paddingBottom: insets.bottom + tokens.space[8] }}>
        <SectionHeader title="1. Ketentuan umum" />
        <Text variant="body" tone="secondary">
          Dengan menggunakan Kahade, Anda setuju untuk mematuhi peraturan transaksi escrow yang berlaku.
        </Text>
        <SectionHeader title="2. Transaksi" />
        <Text variant="body" tone="secondary">
          Dana dipegang dalam escrow sampai kedua pihak mengonfirmasi penyelesaian transaksi.
        </Text>
        <SectionHeader title="3. Sengketa" />
        <Text variant="body" tone="secondary">
          Sengketa diselesaikan melalui mekanisme penyelesaian sengketa dengan bukti yang disediakan para pihak.
        </Text>
        <SectionHeader title="4. Perubahan ketentuan" />
        <Text variant="body" tone="secondary">
          Kami dapat memperbarui ketentuan ini sewaktu-waktu dan akan memberi tahu Anda melalui notifikasi.
        </Text>
      </View>
    </Screen>
  )
}
