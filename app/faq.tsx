/**
 * Screen — FAQ / Pusat Bantuan (GET /v1/help-center/categories, /search,
 * /items/{id}/view). SearchField debounce ke endpoint search.
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Question, MagnifyingGlass } from "phosphor-react-native"
import { router } from "expo-router"

import { api } from "@/lib/api"
import type { HelpArticle, HelpCategory } from "@/lib/api/help-center"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"

import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { HelpArticleListItem } from "@/components/ui/help-article-list-item"
import { HelpCategoryCard } from "@/components/ui/help-category-card"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SearchField } from "@/components/ui/search-field"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"

export default function FaqScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [categories, setCategories] = useState<HelpCategory[]>([])
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<HelpArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [searching, setSearching] = useState(false)

  const fetchCategories = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.helpCenter.listHelpCategories()
      setCategories(res ?? [])
    } catch {
      setError("Gagal memuat daftar bantuan.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchCategories()
  }, [fetchCategories])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchCategories()
    if (query.trim()) {
      try {
        const res = await api.helpCenter.searchHelpArticles(query.trim())
        setResults(Array.isArray(res) ? res : res.data ?? [])
      } catch {
        setResults([])
      }
    }
    setRefreshing(false)
  }, [fetchCategories, query])

  const handleSearch = useCallback(
    async (q: string) => {
      setQuery(q)
      if (!q.trim()) {
        setResults([])
        return
      }
      setSearching(true)
      try {
        const res = await api.helpCenter.searchHelpArticles(q.trim())
        setResults(Array.isArray(res) ? res : res.data ?? [])
      } catch {
        setResults([])
        toast.show({ title: "Pencarian gagal", tone: "danger" })
      } finally {
        setSearching(false)
      }
    },
    [toast.show],
  )

  const openArticle = useCallback((article: HelpArticle) => {
    router.push(ROUTES.helpArticle(article.slug ?? article.id))
    void api.helpCenter.trackHelpArticleView(article.id).catch(() => undefined)
  }, [])

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Pusat Bantuan" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{ style: { paddingBottom: insets.bottom + tokens.space[8] } }}
      >
        <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
          <SearchField
            value={query}
            onChangeText={(q) => setQuery(q)}
            onSearch={(q) => void handleSearch(q)}
            placeholder="Cari artikel bantuan"
            debounceMs={300}
          />

          {query.trim() ? (
            <>
              <SectionHeader title="Hasil pencarian" inset />
              {searching ? (
                <Text variant="body" tone="secondary">Mencari…</Text>
              ) : results.length === 0 ? (
                <EmptyState icon={MagnifyingGlass} title="Tidak ada hasil" description="Coba kata kunci lain." />
              ) : (
                results.map((a, i) => (
                  <HelpArticleListItem
                    key={a.id}
                    title={a.title}
                    snippet={a.content}
                    highlight={query.trim()}
                    divider={i < results.length - 1}
                    onPress={() => openArticle(a)}
                  />
                ))
              )}
            </>
          ) : (
            <>
              <SectionHeader title="Kategori" inset />
              {loading ? (
                <Text variant="body" tone="secondary">Memuat kategori…</Text>
              ) : error ? (
                <ErrorState title="Gagal memuat" description={error} onRetry={() => void fetchCategories()} />
              ) : categories.length === 0 ? (
                <EmptyState icon={Question} title="Belum ada artikel" />
              ) : (
                <View className="gap-2">
                  {categories.map((c) => (
                    <HelpCategoryCard
                      key={c.slug}
                      name={c.name}
                      description={c.description}
                      articleCount={c.articleCount}
                      onPress={() => openArticle({ id: c.slug, slug: c.slug, title: c.name })}
                    />
                  ))}
                </View>
              )}
            </>
          )}
        </View>
      </PullToRefresh>
    </Screen>
  )
}
