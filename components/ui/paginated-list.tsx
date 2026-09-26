import { useCallback, useMemo, type ReactElement, type ReactNode } from "react"
import { View, type ListRenderItem, type StyleProp, type ViewStyle } from "react-native"
import { ErrorState } from "@/components/ui/error-state"
import { LoadMore } from "@/components/ui/load-more"
import {
  PullToRefreshFlatList,
  type PullToRefreshFlatListProps,
} from "@/components/ui/pull-to-refresh"
import { Skeleton, SkeletonGroup, SkeletonText } from "@/components/ui/skeleton"
import { tokens } from "@/lib/tokens"

export type PaginatedListProps<T extends { id?: string }> = {
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
   * Kunci unik baris. Default `item.id`; timpa bila payload tidak membawa id
   * (mis. followers/following — backend tidak membocorkan id internal).
   */
  keyExtractor?: (item: T) => string
  /**
   * Event scroll scroller (web/iOS) — mis. header yang melipat saat scroll.
   * Di Android `onScroll` JS tidak berjalan (lihat pull-to-refresh); kirim
   * pasangan worklet-nya lewat `onScrollWorklet`.
   */
  onScroll?: PullToRefreshFlatListProps<T>["onScroll"]
  /** Worklet scroll UI-thread untuk jalur Android (stabil via useCallback). */
  onScrollWorklet?: (offsetY: number) => void
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

/** Style konstan: literal `{ flex: 1 }` inline membuat prop baru tiap render. */
const FILL = { flex: 1 } as const

export function ListLoading() {
  return (
    <SkeletonGroup className="gap-4 py-4">
      {Array.from({ length: 3 }, (_, index) => (
        <Skeleton key={index} shape="card" className="h-24 w-full" />
      ))}
    </SkeletonGroup>
  )
}

/**
 * Placeholder untuk layar DETAIL satu record (invoice, mutasi, preview
 * tautan, form ulasan) — bukan daftar.
 *
 * Audit komposisi: layar-layar itu memakai <ListLoading> (4 kartu h-24)
 * padahal isinya satu kartu + beberapa baris. Akibatnya tinggi konten
 * menyusut drastis saat data tiba dan layar "melompat". Bentuk di sini
 * mengikuti anatomi yang sebenarnya: satu blok judul, satu kartu, lalu
 * beberapa baris key-value.
 */
export function DetailLoading() {
  return (
    <SkeletonGroup className="gap-4 py-4">
      <Skeleton className="h-6 w-2/5" />
      <Skeleton shape="card" className="h-[120px] w-full" />
      <SkeletonText lines={3} />
    </SkeletonGroup>
  )
}

/** Reuses the design system while keeping long histories virtualized on native AND web. */
export function PaginatedList<T extends { id?: string }>({
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
  onScroll,
  onScrollWorklet,
  loadingPlaceholder,
  header,
  footer,
  padded = true,
  gap = tokens.space[3],
  bottomPadding = tokens.space[8],
  contentContainerStyle,
  keyExtractor: keyExtractorProp,
}: PaginatedListProps<T>) {
  /*
   * Audit performa — semua prop di bawah ini DULU ditulis inline di JSX.
   *
   * FlatList adalah PureComponent: ia membandingkan prop-nya secara dangkal
   * untuk memutuskan apakah perlu menggambar ulang. Elemen JSX, array literal,
   * dan arrow function adalah objek BARU setiap render, sehingga perbandingan
   * itu selalu gagal dan list menggambar ulang seluruh sel yang terlihat
   * meskipun `data` tidak berubah sama sekali.
   *
   * `ItemSeparatorComponent` paling merugikan: nilainya adalah tipe komponen.
   * Arrow baru = tipe komponen baru = React meng-unmount lalu me-mount ulang
   * SETIAP pemisah, bukan sekadar merender ulang.
   */
  const separator = useMemo(
    () =>
      function Separator() {
        return <View style={{ height: gap }} />
      },
    [gap],
  )

  const containerStyle = useMemo(
    () => [
      {
        flexGrow: 1,
        paddingHorizontal: padded ? tokens.layout.screenPaddingX : 0,
        paddingBottom: bottomPadding,
      },
      contentContainerStyle,
    ],
    [padded, bottomPadding, contentContainerStyle],
  )

  const keyExtractor = useCallback(
    (item: T) => (keyExtractorProp ? keyExtractorProp(item) : (item.id ?? "")),
    [keyExtractorProp],
  )
  /*
   * REVISI 2026-09-23 — wrapper `Animated.View layout` DIHAPUS.
   *
   * Animasi Layout reanimated di dalam list ter-virtualisasi adalah penyebab
   * klasik sel/layar TIBA-TIBA KOSONG di aplikasi mobile (Android/new-arch):
   * saat jari menggulir, FlatList memasang & melepas sel di luar jendela
   * (`windowSize`), dan Layout animation yang menyertai siklus mount/unmount
   * itu bisa menyiapkan frame kosong — pengguna melihat "blank" mendadak di
   * tengah scroll. Dokumen Reanimated sendiri menandai layout animation di
   * dalam FlatList/SectionList sebagai area bermasalah (measuring list
   * virtualized). Efek kosmetiknya (item bergeser dengan spring saat data
   * tambah/hapus) tidak sebanding dengan regresi blank-scroll ini — sel kini
   * dirender langsung oleh `renderItem` pemanggil, tanpa lapisan animasi.
   */
  const handleRefresh = useCallback(() => onRefresh(), [onRefresh])
  const handleRetry = useCallback(() => void onRetry(), [onRetry])
  const handleLoadMore = useCallback(() => void onLoadMore(), [onLoadMore])

  const handleEndReached = useCallback(() => {
    if (hasMore && !loading && !refreshing && !loadingMore && !loadMoreError) void onLoadMore()
  }, [hasMore, loading, refreshing, loadingMore, loadMoreError, onLoadMore])

  const headerElement = useMemo(
    () => (
      <>
        {header}
        {error && data.length ? (
          <ErrorState compact description={error} onRetry={handleRetry} />
        ) : null}
      </>
    ),
    [header, error, data.length, handleRetry],
  )

  const emptyElement = useMemo(
    () =>
      loading ? (
        (loadingPlaceholder ?? <ListLoading />)
      ) : error ? (
        <ErrorState description={error} onRetry={handleRetry} />
      ) : (
        empty
      ),
    [loading, loadingPlaceholder, error, empty, handleRetry],
  )

  const footerElement = useMemo(
    () => (
      <>
        {!loading && (hasMore || loadingMore || !!loadMoreError) ? (
          <LoadMore
            status={loadingMore ? "loading" : loadMoreError ? "error" : "idle"}
            errorLabel={loadMoreError ?? undefined}
            onLoadMore={handleLoadMore}
          />
        ) : null}
        {footer}
      </>
    ),
    [loading, hasMore, loadingMore, loadMoreError, footer, handleLoadMore],
  )

  return (
    <PullToRefreshFlatList
      data={data}
      onScroll={onScroll}
      onScrollWorklet={onScrollWorklet}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      style={FILL}
      contentContainerStyle={containerStyle}
      ListHeaderComponent={headerElement}
      ListEmptyComponent={emptyElement}
      ItemSeparatorComponent={separator}
      ListFooterComponent={footerElement}
      refreshing={refreshing}
      onRefresh={handleRefresh}
      refreshEnabled={!loading}
      onEndReached={handleEndReached}
      onEndReachedThreshold={0.3}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      initialNumToRender={8}
      maxToRenderPerBatch={8}
      windowSize={7}
      removeClippedSubviews={false}
      collapsable={false}
    />
  )
}
