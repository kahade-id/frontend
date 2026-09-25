/**
 * Screen — Jelajahi (tab "Pengguna"): rekomendasi akun + follow.
 * Feed etalase (showcase) yang dulu ikut di file ini kini komponen sendiri —
 * <ShowcaseFeedTab> (components/showcase-feed-tab.tsx) dan <UsersTab>
 * (components/discover-users-tab.tsx) — sesuai ratchet G-11: layar hanya
 * memasang kerangka + judul dokumen web.
 */
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { tokens } from "@/lib/tokens"

import { Header } from "@/components/ui/header"
import { Screen } from "@/components/ui/screen"

import { UsersTab } from "@/components/discover-users-tab"

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets()

  return (
    <Screen edges={["top"]} padded={false}>
      <Header
        showBack={true}
        title="Temukan pengguna"
      />
      <UsersTab bottomPadding={insets.bottom + tokens.space[8]} />
    </Screen>
  )
}
