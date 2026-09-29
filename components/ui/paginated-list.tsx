import { useCallback, useMemo, useRef, type ReactElement, type ReactNode, type Ref } from "react"
import { View, type FlatList, type ListRenderItem, type StyleProp, type ViewStyle } from "react-native"
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
  /**
   * Batch 19 (item 16): diteruskan apa adanya ke FlatList — dipakai feed
   * untuk autoplay video (hanya item terlihat yang `shouldPlay`). Opsional;
   * daftar lain tidak terpengaruh.
   */
  onViewableItemsChanged?: PullToRefreshFlatListProps<T>["onViewableItemsChanged"]
  viewabilityConfig?: PullToRefreshFlatListProps<T>["viewabilityConfig"]
  /**
   * FE-IMP-1 item 58: ref ke FlatList dalam — mis. tombol "Kembali ke atas".
   * Diteruskan apa adanya ke FlatList.
   */
  listRef?: Ref<FlatList<T>>
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
  onViewableItemsChanged,
  viewabilityConfig,
  listRef,
}: PaginatedListProps<T>) {  /*
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

  // PERF-FIX (TIM1-P1): fallback ke index bila id absen — cegah kunci ""
  // duplikat yang membuat reconciler salah me-reuse sel.
  const keyExtractor = useCallback(
    (item: T, index: number) =>
      keyExtractorProp ? keyExtractorProp(item) : (item.id ?? `idx-${index}`),
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

  /**
   * LR-011 (audit performa): `onEndReached` FlatList bisa terpicu TANPA
   * scroll pengguna — mis. saat mount awal (konten lebih pendek dari
   * viewport) atau setelah data menyusut — memicu `onLoadMore` hantu
   * beruntun. Gerbang momentum standar: hanya tembakan yang didahului
   * scroll nyata yang diteruskan; satu tembakan per gestur.
   */
  const momentumRef = useRef(false)
  const handleMomentumScrollBegin = useCallback(() => {
    momentumRef.current = true
  }, [])
  const handleEndReached = useCallback(() => {
    if (!momentumRef.current) return
    momentumRef.current = false
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

  /**
   * PERF-FIX (LR-005): tuning render window.
   * - initialNumToRender 6 (dulu 8): kartu feed berat (galeri + teks + bar
   *   aksi + animasi hati); 8 kartu = first paint mahal.
   * - maxToRenderPerBatch 6 (dulu 8): batch inkremental lebih kecil = scroll
   *   lebih halus.
   * - windowSize 11 (dulu 7): headroom saat fling cepat (+-5 viewport); RN
   *   default 21 terlalu boros untuk kartu seberat ini.
   * - removeClippedSubviews TETAP false (keputusan produk/UX): true
   *   menyebabkan blank-scroll pada kartu tinggi (clip/unclip berulang saat
   *   scroll cepat). Trade-off memori diterima.
   */
  return (
    <PullToRefreshFlatList
      data={data}
      onScroll={onScroll}
      onScrollWorklet={onScrollWorklet}
      listRef={listRef}
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
      onMomentumScrollBegin={handleMomentumScrollBegin}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      initialNumToRender={6}
      maxToRenderPerBatch={6}
      windowSize={11}
      removeClippedSubviews={false}
      collapsable={false}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={viewabilityConfig}
    />
  )
}
