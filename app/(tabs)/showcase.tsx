/**
 * Tab Etalase (Showcase) — feed publik karya/produk bergaya thread.
 * Feed dipisahkan dari Discover pengguna agar tiap tab memiliki satu tujuan:
 * Etalase untuk karya/percakapan, Discover untuk menemukan akun.
 *
 * Revisi 2026-09-17 #2: header (bar judul + pencarian + strip tab feed)
 * kini hidup DI DALAM <ShowcaseFeedTab> supaya bisa melipat saat scroll
 * (pola X) — lihat useCollapsingHeader. Layar ini hanya memasang kerangka
 * Screen + judul dokumen web.
 *
 * Revisi 2026-09-23: nama pengguna di UI seragam "Etalase" (label slot
 * primer mode commerce, ikon CardsThree) — "Showcase" tetap sebagai nama
 * teknis rute/feed.
 */
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { ShowcaseFeedTab } from "@/components/showcase-feed-tab"
import { Screen } from "@/components/ui/screen"
import { useDocumentTitle } from "@/components/ui/header"
import { tokens } from "@/lib/tokens"

export default function SocialShowcaseScreen() {
  const insets = useSafeAreaInsets()
  useDocumentTitle("Etalase")

  return (
    <Screen edges={["top"]} padded={false}>
      <ShowcaseFeedTab bottomPadding={insets.bottom + tokens.space[8]} />
    </Screen>
  )
}
