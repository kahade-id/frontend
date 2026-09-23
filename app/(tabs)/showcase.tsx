/**
 * Tab Etalase (Showcase) — feed publik karya/produk bergaya thread.
 * Feed dipisahkan dari Discover pengguna agar tiap tab memiliki satu tujuan:
 * Etalase untuk karya/percakapan, Discover untuk menemukan akun.
 *
 * Revisi audit Etalase 2026-09-23:
 *  - A-12: rute menerima param `category` (badge kategori di kartu/detail)
 *    dan meneruskannya ke <ShowcaseFeedTab>; chip filter bisa ditutup lewat
 *    `setParams({ category: undefined })`.
 *  - I-01: tab kini TERBUKA untuk tamu web (feed memang publik / auth:"none") —
 *    lihat WEB_GUEST_TAB_SCREENS di lib/protected-routes.ts.
 */
import { router, useLocalSearchParams } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { ShowcaseFeedTab } from "@/components/showcase-feed-tab"
import { Screen } from "@/components/ui/screen"
import { useDocumentTitle } from "@/components/ui/header"
import { tokens } from "@/lib/tokens"

export default function SocialShowcaseScreen() {
  const insets = useSafeAreaInsets()
  useDocumentTitle("Etalase")

  const params = useLocalSearchParams<{ category?: string }>()
  const category = typeof params.category === "string" && params.category.trim()
    ? params.category.trim()
    : undefined

  return (
    <Screen edges={["top"]} padded={false}>
      <ShowcaseFeedTab
        bottomPadding={insets.bottom + tokens.space[8]}
        category={category}
        onClearCategory={() => router.setParams({ category: undefined })}
      />
    </Screen>
  )
}
