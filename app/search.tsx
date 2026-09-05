/**
 * Screen — Pencarian Global (GET /v1/search + /v1/search/suggestions).
 * SearchField live → suggestion chips → hasil (user, article).
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { MagnifyingGlass } from "phosphor-react-native"
import { router } from "expo-router"

import { api } from "@/lib/api"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"

import { ChipGroup } from "@/components/ui/chip"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { HelpArticleListItem } from "@/components/ui/help-article-list-item"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SearchField } from "@/components/ui/search-field"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { UserListItem } from "@/components/ui/user-list-item"
import { useToast } from "@/components/ui/toast"

export default function SearchScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [query, setQuery] = useState("")
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [users, setUsers] = useState<Array<{ id: string; username: string; fullName?: string; avatarUrl?: string | null }>>([])
  const [articles, setArticles] = useState<Array<{ id: string; slug: string; title: string; snippet?: string }>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [searched, setSearched] = useState(false)

  const doSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setUsers([])
        setArticles([])
        setSearched(false)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const res = await api.search.globalSearch({ q: q.trim() })
        setUsers((res?.users ?? []).map((u) => ({ id: u.id, username: u.username ?? "", fullName: u.fullName, avatarUrl: u.avatarUrl })))
        setArticles(res?.articles ?? [])
        setSearched(true)
      } catch {
        setError("Pencarian gagal. Coba lagi.")
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([])
      return
    }
    const t = setTimeout(() => {
      void api.search
        .getSearchSuggestions({ q: query.trim() })
        .then((s) => setSuggestions(s ?? []))
        .catch(() => setSuggestions([]))
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await doSearch(query)
    setRefreshing(false)
  }, [doSearch, query])

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Pencarian" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{ style: { paddingBottom: insets.bottom + tokens.space[8] } }}
      >
        <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
          <SearchField
            value={query}
            onChangeText={setQuery}
            onSearch={(q) => void doSearch(q)}
            placeholder="Cari pengguna atau artikel"
            debounceMs={300}
          />

          {!searched && suggestions.length > 0 ? (
            <>
              <SectionHeader title="Saran" />
              <ChipGroup
                options={suggestions.map((s) => ({ value: s, label: s }))}
                value={[]}
                onChange={(next) => {
                  const q = next[0]
                  if (q) {
                    setQuery(q)
                    void doSearch(q)
                  }
                }}
                single
              />
            </>
          ) : null}

          {searched ? (
            <>
              {error ? (
                <ErrorState title="Gagal mencari" description={error} onRetry={() => void doSearch(query)} />
              ) : loading ? (
                <Text variant="body" tone="secondary">Mencari…</Text>
              ) : users.length === 0 && articles.length === 0 ? (
                <EmptyState icon={MagnifyingGlass} title="Tidak ada hasil" description="Coba kata kunci lain." />
              ) : (
                <>
                  {users.length > 0 ? (
                    <>
                      <SectionHeader title="Pengguna" />
                      {users.map((u, i) => (
                        <UserListItem
                          key={u.id}
                          name={u.fullName ?? u.username}
                          username={u.username}
                          avatar={u.avatarUrl ? { source: u.avatarUrl } : undefined}
                          chevron
                          divider={i < users.length - 1}
                          onPress={() => router.push(ROUTES.userProfile(u.username))}
                        />
                      ))}
                    </>
                  ) : null}
                  {articles.length > 0 ? (
                    <>
                      <SectionHeader title="Artikel" />
                      {articles.map((a, i) => (
                        <HelpArticleListItem
                          key={a.id}
                          title={a.title}
                          snippet={a.snippet}
                          highlight={query.trim()}
                          divider={i < articles.length - 1}
                          onPress={() => router.push(ROUTES.helpArticle(a.slug))}
                        />
                      ))}
                    </>
                  ) : null}
                </>
              )}
            </>
          ) : null}
        </View>
      </PullToRefresh>
    </Screen>
  )
}
