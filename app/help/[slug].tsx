/**
 * Umpan balik artikel (POST /v1/help-center/items/{id}/feedback?helpful).
 * Endpoint publik + tanpa skema respons — feedback bersifat one-shot per
 * tampilan: setelah terkirim (atau gagal) tombol dinonaktifkan dan status
 * ditampilkan sebagai teks, supaya user tidak double-vote.
 */

import { useCallback, useEffect, useState } from "react"
import { ScrollView, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useLocalSearchParams, router, type Href } from "expo-router"
import { Article, Check, ShareNetwork, X } from "phosphor-react-native"
import { api } from "@/lib/api"
import { ROUTES } from "@/lib/routes"
import { helpArticleUrl } from "@/lib/deeplinks"
import { shareContent } from "@/lib/share"
import { tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"
import { logWarn } from "@/lib/telemetry"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { HelpArticleContent } from "@/components/ui/help-article-content"
import { HelpArticleListItem } from "@/components/ui/help-article-list-item"
import { IconButton } from "@/components/ui/icon-button"
import { Crossfade } from "@/components/ui/fade-in"
import { DetailLoading } from "@/components/ui/paginated-list"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"

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
        <View className="items-center gap-2">
          <Text variant="body" tone="primary" weight={500}>
            {sent === "yes" ? "Terima kasih, catatan Anda sudah dicatat." : "Terima kasih atas umpan baliknya."}
          </Text>
          {/* Item 123: "Tidak membantu" → tawarkan buat tiket, artikel
              terkait terisi otomatis (relatedArticleId). */}
          {sent === "no" ? (
            <Button
              variant="secondary"
              size="sm"
              onPress={() =>
                router.push({
                  pathname: ROUTES.contact,
                  params: { relatedArticleId: articleId },
                } as Href)
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
  const selected = article
    ? query.data?.articles?.find((item) => item.id === article || item.slug === article)
    : undefined
  useEffect(() => {
    if (selected?.id) void api.helpCenter.trackHelpArticleView(selected.id).catch((err) => logWarn("help:track-view", err))
  }, [selected?.id])
  // Item 120: artikel terkait = artikel lain di kategori yang sama (maks 3).
  const related = selected
    ? (query.data?.articles ?? []).filter((item) => item.id !== selected.id).slice(0, 3)
    : []
  // Item 122: bagikan via tautan kanonis web (membuka deep link / web app).
  const shareArticle = useCallback(() => {
    if (!selected) return
    void shareContent({
      message: selected.title,
      url: helpArticleUrl(selected.slug ?? selected.id, slug),
      title: selected.title,
    }).catch((err) => logWarn("help:share", err))
  }, [selected, slug])
  return (
    <Screen edges={["top"]} padded={false}>
      {/* Header di LUAR area scroll: artikel bantuan bisa sangat panjang —
          pengguna harus bisa kembali tanpa menggulir ke atas dulu. */}
      <Header
        title={
          article ? (selected?.title ?? "Artikel") : (query.data?.name ?? "Kategori Bantuan")
        }
        right={
          selected ? (
            <IconButton
              icon={ShareNetwork}
              variant="ghost"
              onPress={shareArticle}
              accessibilityLabel="Bagikan artikel"
            />
          ) : null
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
              {/* Item 121: render markdown aman (tanpa WebView/HTML). */}
              <HelpArticleContent
                content={selected.content || "Isi artikel belum tersedia dari server."}
              />
              <FeedbackBlock articleId={selected.id} />
              {related.length > 0 ? (
                <View className="gap-2">
                  <Text variant="h3" weight={700}>
                    Artikel terkait
                  </Text>
                  {related.map((item) => (
                    <HelpArticleListItem
                      padded={false}
                      key={item.id}
                      title={item.title}
                      href={ROUTES.helpArticle(item.slug ?? item.id, slug)}
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
                  title={item.title}
                  href={ROUTES.helpArticle(item.slug ?? item.id, slug)}
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