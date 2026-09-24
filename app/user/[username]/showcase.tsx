/**
 * Screen — ETALASE Publik (GET /v1/users/{username}/showcase).
 * Galeri foto produk/hasil kerja milik profil user lain.
 *
 * Revisi audit Etalase (2026-09-23):
 *  - E-01: cover via resolver bersama `showcaseCoverOf` (mengenal bentuk
 *    kanonik `coverImageUrl`/`images[0]` — dulu hanya `imageUrl ?? fileKey`,
 *    sehingga item multi-gambar baru tampil sebagai sel kosong).
 *  - E-2: `alt` = judul item (fallback caption, lalu "Item etalase") —
 *    pembaca layar tidak lagi mendengar "Portofolio" di semua sel.
 *  - E-03: layar ini ditautkan dari tab Etalase profil ("Lihat sebagai
 *    galeri") — bukan lagi kode mati.
 *  - E-04: render bertahap per 60 sel (step) alih-alih menerjemahkan satu
 *    respons penuh sekaligus ke grid.
 *  - I-05: route dikeluarkan dari daftar protected — halaman publik.
 *  - J-01: nama fitur "Etalase" (bukan "Portofolio").
 */
import { useEffect, useState } from "react"
import { View } from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Images } from "phosphor-react-native"

import { useSessionRevision } from "@/lib/guest-gate"
import { api } from "@/lib/api"
import type { ShowcaseItem } from "@/lib/api/users"
import { translate } from "@/lib/i18n/translate"
import { ROUTES } from "@/lib/routes"
import { showcaseCoverOf } from "@/lib/showcase-social"
import { tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Crossfade } from "@/components/ui/fade-in"
import { Header } from "@/components/ui/header"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { ShowcaseGalleryGrid } from "@/components/ui/showcase-gallery-grid"

/** E-04: jumlah sel yang dirender per langkah (grid bertahap). */
const GALLERY_RENDER_STEP = 60

export default function PublicShowcaseScreen() {
  const { username } = useLocalSearchParams<{ username: string }>()
  const insets = useSafeAreaInsets()
  const revision = useSessionRevision()
  // P-05 (audit 2026-09-24): `useState` DULU sebelum efek yang memakainya —
  // urutan lama sah secara runtime tapi menyesatkan saat dibaca/di-refactor.
  const [renderLimit, setRenderLimit] = useState(GALLERY_RENDER_STEP)
  useEffect(() => setRenderLimit(GALLERY_RENDER_STEP), [username])

  /**
   * `useApiQuery`, bukan rakitan useState/useEffect. Tiga hal yang sebelumnya
   * hilang dan sekarang ditangani hook: request dibatalkan saat layar
   * di-unmount (respons lambat tidak bisa menimpa layar berikutnya),
   * `refreshing` terpisah dari `loading` sehingga tarik-untuk-menyegarkan
   * tidak lagi mengganti galeri dengan skeleton, dan error lewat
   * `userMessage(err)`. `enabled` menggantikan guard `if (!username) return`.
   */
  const showcase = useApiQuery<ShowcaseItem[]>(
    `public-showcase:${revision}:${username}`,
    (signal) => api.users.getPublicShowcase(username, signal),
    Boolean(username),
    { refreshOnFocus: true, useCache: false },
  )
  const items = showcase.data ?? []

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title={translate("Etalase — @{x}", { x: username ?? "" })} />
      <PullToRefresh key={`${revision}:${username}`}
        onRefresh={showcase.refresh}
        refreshing={showcase.refreshing}
        contentContainerClassName="px-5"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        {/* v2: loading → galeri crossfade (signature moment). `loading` hanya
            true saat muat awal (refresh tidak mengganti galeri) → aman. */}
        <Crossfade loading={showcase.loading} skeleton={<ShowcaseGalleryGrid items={[]} loading />}>
          {showcase.error ? (
            <ErrorState
              title="Gagal memuat etalase"
              description={showcase.error}
              onRetry={() => void showcase.reload()}
            />
          ) : (
          <View style={{ paddingTop: tokens.space[3] }}>
            <ShowcaseGalleryGrid
              items={items.slice(0, renderLimit).map((it) => ({
                id: it.id,
                source: showcaseCoverOf(it) ?? "",
                alt: it.title ?? it.caption ?? translate("Item etalase"),
              }))}
              onPressItem={(cell) => {
                const original = items.find((it) => it.id === cell.id)
                if (original?.id) router.push(ROUTES.showcaseDetail(original.id))
              }}
              empty={
                <EmptyState
                  icon={Images}
                  title="Belum ada etalase"
                  description="Foto produk atau hasil kerja belum diunggah."
                />
              }
            />
            {items.length > renderLimit ? (
              <Button
                variant="ghost"
                fullWidth
                onPress={() => setRenderLimit((n) => n + GALLERY_RENDER_STEP)}
              >
                {translate("Tampilkan {x} lainnya", {
                  x: Math.min(items.length - renderLimit, GALLERY_RENDER_STEP),
                })}
              </Button>
            ) : null}
          </View>
          )}
        </Crossfade>
      </PullToRefresh>
    </Screen>
  )
}
