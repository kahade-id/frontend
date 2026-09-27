/**
 * Layar artikel/kategori bantuan (mega-batch FE-IMP-5, item 120–123).
 *
 * Item 120: respons backend dinormalisasi (question/answer, items) — lihat
 *   `normalizeHelpArticle` / `normalizeHelpArticleList` di lib/api/help-center;
 *   artikel lain di kategori yang sama ditampilkan sebagai "Artikel terkait"
 *   (dari respons kategori — tanpa endpoint baru).
 * Item 121: isi artikel di-render KAYA via <Markdown> (heading, paragraf,
 *   bullet, bold/italic/tautan/gambar) — renderer aman tanpa
 *   dangerouslySetInnerHTML.
 * Item 122: tombol bagikan memakai `shareContent()` dengan URL publik
 *   https://kahade.id/help/<slug>?article=<articleId>.
 * Item 123: setelah "Tidak membantu", tampilkan tombol "Buat tiket" yang
 *   membuka form kontak dengan relatedArticleId terisi.
 *
 * Umpan balik artikel (POST /v1/help-center/items/{id}/feedback?helpful):
 * endpoint publik + tanpa skema respons — feedback bersifat one-shot per
 * tampilan: setelah terkirim (atau gagal) tombol dinonaktifkan dan status
 * ditampilkan sebagai teks, supaya user tidak double-vote.
 */

import { useCallback, useEffect, useState } from "react"
import { ScrollView, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useLocalSearchParams, router } from "expo-router"
import { Article, Check, ShareNetwork, X } from "phosphor-react-native"
import { api } from "@/lib/api"
import { normalizeHelpArticle, type HelpArticle } from "@/lib/api/help-center"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"
import { logWarn } from "@/lib/telemetry"
import { shareContent } from "@/lib/share"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { IconButton } from "@/components/ui/icon-button"
import { HelpArticleListItem } from "@/components/ui/help-article-list-item"
import { Markdown } from "@/components/ui/markdown"
import { SectionHeader } from "@/components/ui/section"
import { Crossfade } from "@/components/ui/fade-in"
import { DetailLoading } from "@/components/ui/paginated-list"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"

/** Item 123: umpan balik + jalan pintas "Buat tiket" bila tidak membantu. */
function FeedbackBlock({ articleId }: { articleId: string }) {
  const [sent, setSent] = useState<"yes" | "no" | null>(null)
  const send = useCallback(
    (helpful: boolean) => {
      if (sent) return
      setSent(helpful ? "yes" : "no")
      void api.helpCenter.submitHelpArticleFeedback(articleId, helpful).catch(() => {
        // Gagal kirim feedback tidak boleh mengganggu baca artikel — status
        // tetap "sudah dikirim" agar user tidak terjebak retry tak berujung.
      })
    },
    [articleId, sent],
  )
  return (
    <View className="items-center gap-3 rounded-md border border-border bg-surface p-4">
      <Text variant="body" tone="secondary" className="text-center">
        Apakah artikel ini membantu?
      </Text>
      {sent ? (
        <View className="items-center gap-3">
          <Text variant="body" tone="primary" weight={500}>
            {sent === "yes" ? "Terima kasih, catatan Anda sudah dicatat." : "Terima kasih atas umpan baliknya."}
          </Text>
          {sent === "no" ? (
            <Button
              variant="secondary"
              size="sm"
              onPress={() =>
                router.push(
                  ROUTES.contact + `?relatedArticleId=${encodeURIComponent(articleId)}`,
                )
              }
            >
              Buat tiket
            </Button>
          ) : null}
        </View>
      ) : (
        <View className="flex-row gap-3">
          <Button variant="secondary" size="sm" leftIcon={Check} onPress={() => send(true)}>
            Ya, membantu
          </Button>
          <Button variant="ghost" size="sm" leftIcon={X} onPress={() => send(false)}>
            Tidak
          </Button>
        </View>
      )}
    </View>
  )
}

export default function HelpScreen() {
  const insets = useSafeAreaInsets()
  const { slug, article, q } = useLocalSearchParams<{
    slug: string
    article?: string
    q?: string
  }>()
  const query = useApiQuery(
    `help:${slug}:${article ?? ""}:${q ?? ""}`,
    async (signal) => {
      if (article && q) {
        const articles = await api.helpCenter.searchHelpArticles(q, signal)
        return { name: "Artikel bantuan", articles }
      }
      return api.helpCenter.getHelpCategory(slug, signal)
    },
    Boolean(slug),
  )
  const rawSelected = article
    ? query.data?.articles?.find((item) => item.id === article || item.slug === article)
    : undefined
  // Item 120: normalisasi defensif (varian question/answer dari backend).
  const selected: HelpArticle | undefined = rawSelected
    ? (normalizeHelpArticle(rawSelected) ?? undefined)
    : undefined
  // Item 120: artikel lain di kategori yang sama (dari respons kategori —
  // tanpa endpoint baru), kecuali artikel yang sedang dibaca.
  const relatedArticles = article
    ? (query.data?.articles ?? []).filter((item) => item.id !== selected?.id).slice(0, 4)
    : []

  const shareArticle = useCallback(() => {
    if (!selected) return
    const url = `https://kahade.id/help/${encodeURIComponent(slug)}?article=${encodeURIComponent(selected.id)}`
    void shareContent({
      message: `${selected.title || "Artikel bantuan Kahade"}\n${url}`,
      url,
      title: "Bagikan artikel",
    })
  }, [selected, slug])

  useEffect(() => {
    if (selected?.id) void api.helpCenter.trackHelpArticleView(selected.id).catch((err) => logWarn("help:track-view", err))
  }, [selected?.id])
  return (
    <Screen edges={["top"]} padded={false}>
      {/* Header di LUAR area scroll: artikel bantuan bisa sangat panjang —
          pengguna harus bisa kembali tanpa menggulir ke atas dulu. */}
      <Header
        title={
          article ? (selected?.title ?? "Artikel") : (query.data?.name ?? "Kategori Bantuan")
        }
        right={
          // Item 122: bagikan artikel (hanya di mode artikel).
          article && selected ? (
            <IconButton
              icon={ShareNetwork}
              variant="ghost"
              accessibilityLabel="Bagikan artikel"
              onPress={shareArticle}
            />
          ) : undefined
        }
      />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="gap-4 px-5 py-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + tokens.space[8] }}
      >
        <Crossfade loading={query.loading} skeleton={<DetailLoading />}>
          {query.error ? (
          <ErrorState description={query.error} onRetry={() => void query.reload()} />
        ) : article ? (
          selected ? (
            <View className="gap-4">
              <Text variant="h2" weight={700}>
                {selected.title || "Tanpa judul"}
              </Text>
              {/* Item 121: konten kaya — heading/paragraf/bullet/bold/italic/
                  tautan/gambar via renderer aman. */}
              <Markdown source={selected.content || "Isi artikel belum tersedia dari server."} />
              <FeedbackBlock articleId={selected.id} />
              {/* Item 120: artikel terkait di kategori yang sama. */}
              {relatedArticles.length > 0 ? (
                <View className="gap-2">
                  <SectionHeader title="Artikel terkait" />
                  {relatedArticles.map((item) => (
                    <HelpArticleListItem
                      padded={false}
                      key={item.id}
                      title={item.title || "Tanpa judul"}
                      href={ROUTES.helpArticle(item.slug || item.id, slug)}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          ) : (
            <EmptyState
              icon={Article}
              title="Artikel tidak ditemukan"
              description="Artikel mungkin belum dipublikasikan atau telah dipindahkan."
            />
          )
        ) : (
          <>
            {!query.data?.articles?.length ? (
              <EmptyState icon={Article} title="Belum ada artikel" />
            ) : (
              query.data.articles.map((item) => (
                <HelpArticleListItem
                  padded={false}
                  key={item.id}
                  title={item.title || "Tanpa judul"}
                  href={ROUTES.helpArticle(item.slug || item.id, slug)}
                />
              ))
            )}
            </>
          )}
        </Crossfade>
      </ScrollView>
    </Screen>
  )
}
