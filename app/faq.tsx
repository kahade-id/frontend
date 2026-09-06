import type { HelpArticle, HelpCategory } from "@/lib/api/help-center"
import { useState } from "react"
import { FlatList, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Question, MagnifyingGlass } from "phosphor-react-native"
import { router } from "expo-router"
import { api } from "@/lib/api"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"
import { DebouncedSearchField } from "@/components/ui/debounced-search-field"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { HelpArticleListItem } from "@/components/ui/help-article-list-item"
import { HelpCategoryCard } from "@/components/ui/help-category-card"
import { ListLoading } from "@/components/ui/paginated-list"
import { Screen } from "@/components/ui/screen"

export default function FaqScreen() {
  const insets = useSafeAreaInsets()
  const [keyword, setKeyword] = useState("")
  const categories = useApiQuery("help-categories", (signal) =>
    api.helpCenter.listHelpCategories(signal),
  )
  const search = useApiQuery(
    `help-search:${keyword}`,
    (signal) => api.helpCenter.searchHelpArticles(keyword, signal),
    Boolean(keyword),
  )
  const searching = Boolean(keyword)
  const state = searching ? search : categories
  const rows: Array<{ id: string } & ({ article: HelpArticle } | { category: HelpCategory })> =
    searching
      ? (search.data ?? []).map((article) => ({ id: article.id, article }))
      : (categories.data ?? []).map((category) => ({ id: category.slug, category }))
  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Pusat Bantuan" />
      <View accessible={false} className="px-6 pb-4">
        <DebouncedSearchField
          autoFocus={false}
          onQueryChange={setKeyword}
          placeholder="Cari bantuan"
        />
      </View>
      <FlatList
        data={rows}
        keyExtractor={(row) => row.id}
        contentContainerStyle={{
          paddingHorizontal: tokens.layout.screenPaddingX,
          paddingBottom: insets.bottom + tokens.space[8],
          flexGrow: 1,
        }}
        ItemSeparatorComponent={() => <View className="h-3" />}
        renderItem={({ item }) =>
          "article" in item ? (
            <HelpArticleListItem
              padded={false}
              title={item.article.title}
              highlight={keyword}
              onPress={() =>
                router.push(
                  ROUTES.helpArticle(
                    item.article.slug ?? item.article.id,
                    item.article.category,
                    item.article.title,
                  ),
                )
              }
            />
          ) : (
            <HelpCategoryCard
              name={item.category.name}
              description={item.category.description}
              articleCount={item.category.articleCount}
              onPress={() => router.push(ROUTES.helpCategory(item.category.slug))}
            />
          )
        }
        ListEmptyComponent={
          state.loading ? (
            <ListLoading />
          ) : state.error ? (
            <ErrorState description={state.error} onRetry={() => void state.reload()} />
          ) : (
            <EmptyState
              icon={searching ? MagnifyingGlass : Question}
              title={searching ? "Tidak ada hasil" : "Kategori bantuan belum tersedia"}
              description={
                searching
                  ? "Coba kata kunci lain."
                  : "Artikel akan ditampilkan setelah dipublikasikan oleh Kahade."
              }
            />
          )
        }
        refreshing={state.refreshing}
        onRefresh={() => void state.refresh()}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={8}
        windowSize={7}
      />
    </Screen>
  )
}