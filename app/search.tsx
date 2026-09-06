import { useMemo, useState } from "react"
import { FlatList, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { MagnifyingGlass } from "phosphor-react-native"
import { router } from "expo-router"
import { api, type Order, type WalletTransaction, type UserProfile } from "@/lib/api"
import { formatDateTime } from "@/lib/format"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"
import { Chip } from "@/components/ui/chip"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { HelpArticleListItem } from "@/components/ui/help-article-list-item"
import { ListLoading } from "@/components/ui/paginated-list"
import { OrderCard } from "@/components/ui/order-card"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { DebouncedSearchField } from "@/components/ui/debounced-search-field"
import { UserListItem } from "@/components/ui/user-list-item"
import { WalletTransactionRow } from "@/components/ui/wallet-transaction-row"

type ResultRow = { id: string } & (
  | { kind: "user"; user: UserProfile }
  | { kind: "order"; order: Order }
  | { kind: "transaction"; transaction: WalletTransaction }
  | { kind: "article"; article: { id: string; slug: string; title: string; snippet?: string } }
)
export default function SearchScreen() {
  const insets = useSafeAreaInsets()
  // UX: Fokus otomatis ke search saat layar dibuka (audit #011)
  /*
   * Hanya kata kunci yang sudah tenang yang tinggal di layar ini; teks mentah
   * dikurung di dalam <DebouncedSearchField>. Sebelumnya setiap ketukan huruf
   * merender ulang layar dan seluruh baris hasil yang terlihat (kartu pesanan,
   * avatar pengguna, baris mutasi) — padahal request-nya sendiri baru jalan
   * setelah pengguna berhenti mengetik.
   *
   * `seed` dipakai untuk mengisi ulang kolom saat pengguna menekan chip saran;
   * mengubahnya me-mount ulang field dengan nilai awal yang baru.
   */
  const [keyword, setKeyword] = useState("")
  const [seed, setSeed] = useState("")
  const enabled = keyword.length >= 2
  const result = useApiQuery(
    `search:${keyword}`,
    (signal) => api.search.globalSearch({ q: keyword, limit: 20 }, signal),
    enabled,
  )
  const suggestions = useApiQuery(
    `suggestions:${keyword}`,
    (signal) => api.search.getSearchSuggestions({ q: keyword }, signal),
    enabled,
  )
  const rows = useMemo<ResultRow[]>(
    () => [
      ...(result.data?.users ?? []).map((user) => ({
        id: `user:${user.id}`,
        kind: "user" as const,
        user,
      })),
      ...(result.data?.orders ?? []).map((order) => ({
        id: `order:${order.id}`,
        kind: "order" as const,
        order,
      })),
      ...(result.data?.transactions ?? []).map((transaction) => ({
        id: `transaction:${transaction.id}`,
        kind: "transaction" as const,
        transaction,
      })),
      ...(result.data?.articles ?? []).map((article) => ({
        id: `article:${article.id}`,
        kind: "article" as const,
        article,
      })),
    ],
    [result.data],
  )
  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Pencarian" />
      <View accessible={false} className="px-6 pb-4">
        <DebouncedSearchField
          key={seed}
          initialQuery={seed}
          onQueryChange={setKeyword}
          placeholder="Cari pengguna, pesanan, atau mutasi"
        />
      </View>
      <FlatList
        data={rows}
        keyExtractor={(row) => row.id}
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: tokens.layout.screenPaddingX,
          paddingBottom: insets.bottom + tokens.space[8],
        }}
        ListHeaderComponent={
          suggestions.data?.length ? (
            <View className="flex-row flex-wrap gap-2 pb-4">
              {[...new Set(suggestions.data)].map((s) => (
                <Chip
                  key={s}
                  onPress={() => {
                    setSeed(s)
                    setKeyword(s.trim())
                  }}
                >
                  {s}
                </Chip>
              ))}
            </View>
          ) : null
        }
        ItemSeparatorComponent={() => <View className="h-3" />}
        renderItem={({ item, index }) => {
          const prev = rows[index - 1]
          const showSection = !prev || prev.kind !== item.kind
          const sectionTitle =
            item.kind === "user"
              ? "Pengguna"
              : item.kind === "order"
                ? "Pesanan"
                : item.kind === "transaction"
                  ? "Mutasi"
                  : "Bantuan"
          const body =
            item.kind === "user" ? (
              <UserListItem
                padded={false}
                name={item.user.fullName ?? item.user.username ?? "Identitas belum tersedia"}
                username={item.user.username ?? undefined}
                avatar={item.user.avatarUrl ? { source: item.user.avatarUrl } : undefined}
                chevron
                onPress={
                  item.user.username
                    ? () => router.push(ROUTES.userProfile(item.user.username!))
                    : undefined
                }
              />
            ) : item.kind === "transaction" ? (
              <WalletTransactionRow
                transaction={item.transaction}
                onPress={() => router.push(ROUTES.walletTransaction(item.transaction.id))}
              />
            ) : item.kind === "article" ? (
              <HelpArticleListItem
                padded={false}
                title={item.article.title}
                snippet={item.article.snippet}
                highlight={keyword}
                onPress={() =>
                  router.push(ROUTES.helpArticle(item.article.slug, undefined, item.article.title))
                }
              />
            ) : (
              (() => {
                const role =
                  item.order.myRole === "BUYER"
                    ? "buyer"
                    : item.order.myRole === "SELLER"
                      ? "seller"
                      : undefined
                const counterpart =
                  role === "buyer"
                    ? item.order.seller
                    : role === "seller"
                      ? item.order.buyer
                      : undefined
                return (
                  <OrderCard
                    orderId={item.order.id}
                    title={item.order.title}
                    amount={item.order.orderValue}
                    status={item.order.status}
                    role={role}
                    counterpart={{
                      name:
                        counterpart?.fullName ??
                        counterpart?.username ??
                        "Identitas belum tersedia",
                    }}
                    timestamp={formatDateTime(item.order.createdAt)}
                    onPress={() => router.push(ROUTES.orderDetail(item.order.id))}
                  />
                )
              })()
            )
          return (
            <View className="gap-2">
              {showSection ? <SectionHeader title={sectionTitle} /> : null}
              {body}
            </View>
          )
        }}
        ListEmptyComponent={
          result.loading ? (
            <ListLoading />
          ) : result.error ? (
            <ErrorState
              title="Gagal mencari"
              description={result.error}
              onRetry={() => void result.reload()}
            />
          ) : (
            <EmptyState
              icon={MagnifyingGlass}
              title={enabled ? "Tidak ada hasil" : "Mulai mencari"}
              description={
                enabled
                  ? "Coba kata kunci yang lebih spesifik."
                  : "Masukkan setidaknya dua karakter."
              }
            />
          )
        }
        refreshing={result.refreshing}
        onRefresh={() => void result.refresh()}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={8}
        windowSize={7}
      />
    </Screen>
  )
}