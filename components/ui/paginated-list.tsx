import type { ReactElement, ReactNode } from "react"
import { FlatList, View, type ListRenderItem, type StyleProp, type ViewStyle } from "react-native"
import { ErrorState } from "@/components/ui/error-state"
import { LoadMore } from "@/components/ui/load-more"
import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton"
import { tokens } from "@/lib/tokens"

export type PaginatedListProps<T extends { id: string }> = {
  data: T[]
  renderItem: ListRenderItem<T>
  loading: boolean
  error?: string | null
  loadMoreError?: string | null
  refreshing: boolean
  loadingMore: boolean
  hasMore: boolean
  onRefresh: () => void | Promise<void>
  onRetry: () => void | Promise<void>
  onLoadMore: () => void | Promise<void>
  empty: ReactElement
  /**
   * Placeholder muat-pertama. Default <ListLoading/> (4 kartu h-24) hanya
   * cocok untuk daftar berbentuk kartu; daftar baris rapat (notifikasi,
   * mutasi) harus mengirim skeleton sebentuk barisnya sendiri, kalau tidak
   * layout melompat saat data tiba.
   */
  loadingPlaceholder?: ReactElement
  header?: ReactElement
  footer?: ReactNode
  padded?: boolean
  gap?: number
  bottomPadding?: number
  contentContainerStyle?: StyleProp<ViewStyle>
}

export function ListLoading() {
  return (
    <SkeletonGroup className="gap-4 py-4">
      {Array.from({ length: 4 }, (_, index) => (
        <Skeleton key={index} shape="card" className="h-24 w-full" />
      ))}
    </SkeletonGroup>
  )
}

/** Reuses the design system while keeping long histories virtualized on native AND web. */
export function PaginatedList<T extends { id: string }>({
  data,
  renderItem,
  loading,
  error,
  loadMoreError,
  refreshing,
  loadingMore,
  hasMore,
  onRefresh,
  onRetry,
  onLoadMore,
  empty,
  loadingPlaceholder,
  header,
  footer,
  padded = true,
  gap = tokens.space[3],
  bottomPadding = tokens.space[8],
  contentContainerStyle,
}: PaginatedListProps<T>) {
  return (
    <FlatList
      data={data}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      style={{ flex: 1 }}
      contentContainerStyle={[
        {
          flexGrow: 1,
          paddingHorizontal: padded ? tokens.layout.screenPaddingX : 0,
          paddingBottom: bottomPadding,
        },
        contentContainerStyle,
      ]}
      ListHeaderComponent={
        <>
          {header}
          {error && data.length ? (
            <ErrorState compact description={error} onRetry={() => void onRetry()} />
          ) : null}
        </>
      }
      ListEmptyComponent={
        loading ? (
          (loadingPlaceholder ?? <ListLoading />)
        ) : error ? (
          <ErrorState description={error} onRetry={() => void onRetry()} />
        ) : (
          empty
        )
      }
      ItemSeparatorComponent={() => <View style={{ height: gap }} />}
      ListFooterComponent={
        <>
          {data.length > 0 && (hasMore || loadingMore) ? (
            <LoadMore
              status={loadingMore ? "loading" : loadMoreError ? "error" : "idle"}
              errorLabel={loadMoreError ?? undefined}
              onLoadMore={() => void onLoadMore()}
            />
          ) : null}
          {footer}
        </>
      }
      refreshing={refreshing}
      onRefresh={() => void onRefresh()}
      progressViewOffset={tokens.space[2]}
      onEndReached={() => {
        if (hasMore && !loading && !loadingMore && !loadMoreError) void onLoadMore()
      }}
      onEndReachedThreshold={0.3}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      windowSize={7}
    />
  )
}
