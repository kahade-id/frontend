import { useEffect } from "react"
import { View } from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import { Article } from "phosphor-react-native"
import { api } from "@/lib/api"
import { ROUTES } from "@/lib/routes"
import { useApiQuery } from "@/lib/use-api-query"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { HelpArticleListItem } from "@/components/ui/help-article-list-item"
import { LoadingScreen } from "@/components/ui/loading-screen"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"

export default function HelpScreen() {
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
    if (selected?.id) void api.helpCenter.trackHelpArticleView(selected.id).catch(() => undefined)
  }, [selected?.id])
  return (
    <Screen edges={["top"]} padded={false} scroll>
      <Header title={article ? "Artikel" : "Kategori Bantuan"} />
      <View className="gap-4 px-6 py-4">
        {query.loading ? (
          <LoadingScreen message="Memuat bantuan…" />
        ) : query.error ? (
          <ErrorState description={query.error} onRetry={() => void query.reload()} />
        ) : article ? (
          selected ? (
            <>
              <SectionHeader title={selected.title} />
              <Text variant="body">
                {selected.content || "Isi artikel belum tersedia dari server."}
              </Text>
            </>
          ) : (
            <EmptyState
              icon={Article}
              title="Artikel tidak ditemukan"
              description="Artikel mungkin belum dipublikasikan atau telah dipindahkan."
            />
          )
        ) : (
          <>
            <SectionHeader title={query.data?.name ?? "Bantuan"} />
            {!query.data?.articles?.length ? (
              <EmptyState icon={Article} title="Belum ada artikel" />
            ) : (
              query.data.articles.map((item) => (
                <HelpArticleListItem
                  padded={false}
                  key={item.id}
                  title={item.title}
                  onPress={() => router.push(ROUTES.helpArticle(item.slug ?? item.id, slug))}
                />
              ))
            )}
          </>
        )}
      </View>
    </Screen>
  )
}
