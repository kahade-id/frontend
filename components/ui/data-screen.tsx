/**
 * Kahade — <DataScreen> (kerangka layar berbasis data).
 *
 * Audit menemukan satu blok yang disalin nyaris identik di puluhan route:
 *
 *   const insets = useSafeAreaInsets()
 *   <Screen edges={["top"]} padded={false}>
 *     <Header title="…" />
 *     <PullToRefresh
 *       onRefresh={handleRefresh}
 *       refreshing={refreshing}
 *       contentContainerClassName="px-6"
 *       scrollViewProps={{ contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] } }}
 *     >
 *       {loading ? <LoadingScreen/> : error ? <ErrorState/> : items.length === 0 ? <EmptyState/> : (
 *         <View accessible={false} className="gap-4" style={{ paddingTop: tokens.space[3] }}>…</View>
 *       )}
 *     </PullToRefresh>
 *   </Screen>
 *
 * Menyalinnya bukan sekadar verbose — ia membuat empat keputusan UX menjadi
 * tidak konsisten antar layar dan gampang salah:
 *
 *   1. Urutan state. Beberapa layar mengecek `error` sebelum `loading`,
 *      sebagian sebaliknya, sebagian lupa `empty`. Di sini urutannya SATU:
 *      loading → error → empty → konten.
 *   2. Bottom inset. `insets.bottom + tokens.space[8]` diulang 40+ kali;
 *      satu layar yang lupa menambahkannya akan menyembunyikan baris terakhir
 *      di balik home indicator. Sekarang dihitung sekali di sini.
 *   3. Refresh vs load. Kerangka ini sengaja memisahkan `loading` (ganti isi
 *      layar dengan <LoadingScreen>) dari `refreshing` (indikator logo
 *      pull-to-refresh, isi layar TETAP terlihat). Pola lama memanggil
 *      fetcher yang sama untuk keduanya sehingga tarik-untuk-refresh
 *      mengosongkan layar — kedipan yang tidak perlu.
 *   4. Padding konten. `px-6` + `pt-3` + `gap-4` adalah irama standar §4;
 *      di sini menjadi default, bukan hafalan per layar.
 *
 * `state` sengaja berbentuk struktural (bukan tipe hook tertentu) supaya
 * `useApiQuery`, `usePaginatedQuery`, atau state lokal apa pun bisa dipasang
 * tanpa adapter. Yang dijamin komponen ini hanya bentuk & urutan render.
 *
 * Kapan TIDAK memakai ini: layar form (pakai <Screen scroll keyboardAvoiding>
 * + <FooterBar>), layar list virtual besar (<PaginatedList>/FlashList punya
 * kerangka sendiri), dan layar tanpa fetch.
 */
import type { ReactNode } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { EmptyState, type EmptyStateProps } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header, type HeaderProps } from "@/components/ui/header"
import { LoadingScreen } from "@/components/ui/loading-screen"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen, type ScreenBackground } from "@/components/ui/screen"
import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"

/**
 * Bentuk minimum state async yang dibutuhkan kerangka ini — persis subset
 * yang dikembalikan `useApiQuery` / `usePaginatedQuery`.
 */
export type DataScreenState = {
  /** Muat pertama (atau ganti kunci): isi layar diganti <LoadingScreen>. */
  loading: boolean
  /** Tarik-untuk-refresh: isi layar TETAP dirender. */
  refreshing?: boolean
  /** Pesan siap tampil dari `userMessage(err)` — bukan copy hardcode per layar. */
  error: string | null
  /** Dipanggil oleh gesture pull-to-refresh. */
  refresh: () => void | Promise<void>
  /** Dipanggil oleh tombol "Coba lagi" di <ErrorState>. */
  reload: () => void | Promise<void>
}

export type DataScreenProps = {
  /** Judul <Header>. */
  title: string
  /** Prop <Header> lain (right, showBack, largeTitle, …). */
  header?: Omit<HeaderProps, "title">
  state: DataScreenState
  /** Teks di bawah logo saat muat pertama — isi dengan konteks (audit #045: "Memuat" tanpa konteks = SR bingung). */
  loadingMessage?: string
  /** Judul <ErrorState>; deskripsinya selalu `state.error`. */
  errorTitle?: string
  /**
   * Props <EmptyState> saat data kosong. Kirim `false`/`null`/`undefined`
   * bila data tidak kosong — jadi pemanggil menulis
   * `empty={items.length === 0 && { icon, title }}`.
   */
  empty?: EmptyStateProps | false | null
  /** Aksi sticky di bawah (mis. tombol "Tambah"). */
  footer?: ReactNode
  /** Nonaktifkan gesture refresh (layar yang datanya tidak bisa dimuat ulang). */
  refreshable?: boolean
  background?: ScreenBackground
  /** Padding horizontal 24px pada konten. Default true. */
  padded?: boolean
  /** Kelas tambahan pembungkus konten (default `gap-4 pt-3`). */
  contentClassName?: string
  /** Node yang selalu dirender di atas area state (mis. tab/segmented). */
  above?: ReactNode
  children?: ReactNode
}

export function DataScreen({
  title,
  header,
  state,
  loadingMessage,
  errorTitle = "Gagal memuat",
  empty,
  footer,
  refreshable = true,
  background,
  padded = true,
  contentClassName,
  above,
  children,
}: DataScreenProps) {
  const insets = useSafeAreaInsets()
  const { loading, refreshing = false, error, refresh, reload } = state

  // Bottom inset dipindah ke konten ScrollView (Screen `edges` tanpa "bottom")
  // supaya baris terakhir bisa di-scroll melewati home indicator. Bila ada
  // footer, <Screen> sendiri yang memberi inset pada FooterBar.
  const bottomPad = (footer ? 0 : insets.bottom) + tokens.space[8]

  const body = loading ? (
    <LoadingScreen message={loadingMessage} />
  ) : error ? (
    <ErrorState title={errorTitle} description={error} onRetry={() => void reload()} />
  ) : empty ? (
    <EmptyState {...empty} />
  ) : (
    <View className={cn("gap-4 pt-3", contentClassName)}>{children}</View>
  )

  return (
    <Screen edges={["top"]} padded={false} background={background} footer={footer}>
      <Header title={title} {...header} />
      {above}
      <PullToRefresh
        onRefresh={refresh}
        refreshing={refreshing}
        // Gesture dimatikan saat layar sedang menampilkan LoadingScreen:
        // tidak ada konten untuk ditarik dan request-nya sudah berjalan.
        enabled={refreshable && !loading}
        contentContainerClassName={cn(padded && "px-6")}
        scrollViewProps={{ contentContainerStyle: { paddingBottom: bottomPad } }}
      >
        {body}
      </PullToRefresh>
    </Screen>
  )
}
