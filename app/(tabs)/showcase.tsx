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
import { useCallback, useMemo } from "react"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { ShowcaseFeedTab } from "@/components/showcase-feed-tab"
import { Screen } from "@/components/ui/screen"
import { useDocumentTitle } from "@/components/ui/header"
import { translate } from "@/lib/i18n/translate"
import { tokens } from "@/lib/tokens"

export default function SocialShowcaseScreen() {
  const insets = useSafeAreaInsets()
  useDocumentTitle(translate("Etalase"))

  const params = useLocalSearchParams<{ category?: string; location?: string }>()
  // PERF-FIX (P2 nav): derivasi params di-memo — tab Etalase me-render ulang
  // tiap scroll (viewability tick); tanpa memo, trim/slice string jalan tiap
  // render dan identitas `category`/`location` berubah → memo anak jebol.
  const { category, location } = useMemo(() => {
    const rawCategory = params.category
    const rawLocation = params.location
    return {
      category:
        typeof rawCategory === "string" && rawCategory.trim()
          ? rawCategory.trim().slice(0, 60)
          : undefined,
      // Filter lokasi dari layar Pencarian ("Lihat semua di Etalase") — pola
      // sama dengan kategori: state hidup di param rute, bukan state lokal tab.
      location:
        typeof rawLocation === "string" && rawLocation.trim()
          ? rawLocation.trim().slice(0, 100)
          : undefined,
    }
  }, [params.category, params.location])

  // FE-067 (audit 2026-09-29): handler clear stabil — tanpa ini memo di
  // <ShowcaseFeedTab> tidak pernah hit saat layar me-render ulang.
  const handleClearCategory = useCallback(() => {
    router.setParams({ category: undefined })
  }, [])
  const handleClearLocation = useCallback(() => {
    router.setParams({ location: undefined })
  }, [])

  return (
    <Screen edges={["top"]} padded={false}>
      <ShowcaseFeedTab
        bottomPadding={insets.bottom + tokens.space[8]}
        category={category}
        onClearCategory={handleClearCategory}
        location={location}
        onClearLocation={handleClearLocation}
      />
    </Screen>
  )
}
