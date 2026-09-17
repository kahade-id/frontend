/**
 * Tab sosial Showcase — feed publik bergaya thread.
 * Feed dipisahkan dari Discover pengguna agar tiap tab memiliki satu tujuan:
 * Showcase untuk karya/percakapan, Discover untuk menemukan akun.
 *
 * Revisi 2026-09-17 #2: header (bar judul + pencarian + strip tab feed)
 * kini hidup DI DALAM <ShowcaseFeedTab> supaya bisa melipat saat scroll
 * (pola X) — lihat useCollapsingHeader. Layar ini hanya memasang kerangka
 * Screen + judul dokumen web.
 */
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { ShowcaseFeedTab } from "./discover"
import { Screen } from "@/components/ui/screen"
import { useDocumentTitle } from "@/components/ui/header"
import { tokens } from "@/lib/tokens"

export default function SocialShowcaseScreen() {
  const insets = useSafeAreaInsets()
  useDocumentTitle("Showcase")

  return (
    <Screen edges={["top"]} padded={false}>
      <ShowcaseFeedTab bottomPadding={insets.bottom + tokens.space[8]} />
    </Screen>
  )
}
