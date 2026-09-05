/**
 * Screen — Artikel Bantuan (GET /v1/help-center/categories/{slug} atau
 * /search; konten artikel dirender apa adanya dari server).
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useLocalSearchParams } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Article as ArticleIcon } from "phosphor-react-native"

import { api } from "@/lib/api"
import { tokens } from "@/lib/tokens"

import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"

export default function HelpArticleScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const insets = useSafeAreaInsets()

  const [article, setArticle] = useState<{ title: string; content?: string; category?: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchArticle = useCallback(async () => {
    if (!slug) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.helpCenter.getHelpCategory(slug)
      setArticle({ title: res.name, content: res.articles?.[0]?.content, category: slug })
    } catch {
      setError("Artikel tidak ditemukan.")
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    void fetchArticle()
  }, [fetchArticle])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchArticle()
    setRefreshing(false)
  }, [fetchArticle])

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Artikel" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{ style: { paddingBottom: insets.bottom + tokens.space[8] } }}
      >
        {loading ? (
          <EmptyState icon={ArticleIcon} title="Memuat artikel…" />
        ) : error ? (
          <ErrorState title="Gagal memuat" description={error} onRetry={() => void fetchArticle()} />
        ) : article ? (
          <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
            <SectionHeader title={article.title} />
            <Text variant="body">{article.content ?? "Artikel ini sedang disiapkan."}</Text>
          </View>
        ) : null}
      </PullToRefresh>
    </Screen>
  )
}
