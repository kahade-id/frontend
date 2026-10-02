import type { HelpArticle, HelpCategory } from "@/lib/api/help-center"
import { useCallback, useEffect, useMemo, useState } from "react"
import { View, type ListRenderItem } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useIsFocused } from "@react-navigation/native"
import { router, useLocalSearchParams } from "expo-router"
import {
  ChatCircleText,
  EnvelopeSimple,
  Flag,
  Info,
  Lifebuoy,
  MagnifyingGlass,
  Question,
  Ticket,
} from "phosphor-react-native"
import { api } from "@/lib/api"
import { translate, useLanguage } from "@/lib/i18n"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"
import { clearHelpHistory, getHelpHistory, type HelpHistoryEntry } from "@/lib/help-history"
import {
  getLiveSupportAvailability,
  liveSupportScheduleSummary,
} from "@/lib/live-support-availability"
import { DebouncedSearchField } from "@/components/ui/debounced-search-field"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { HelpArticleListItem } from "@/components/ui/help-article-list-item"
import { HelpCategoryCard } from "@/components/ui/help-category-card"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog } from "@/components/ui/modal"
import { FadeIn } from "@/components/ui/fade-in"
import { Icon } from "@/components/ui/icon"
import { ListLoading } from "@/components/ui/paginated-list"
import { ListGroup, ListItem } from "@/components/ui/list-item"
import { PullToRefreshFlatList } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { TextLink } from "@/components/ui/text-link"

/**
 * FE-013 (audit 2026-09-29): separator sebagai komponen bernama — arrow
 * inline = tipe komponen baru tiap render → React unmount/mount ulang
 * SEMUA separator tiap render layar.
 */
function FaqItemSeparator() {
  return <View className="h-3" />
}

/** Existing FAQ route doubles as the native Help Center hub, avoiding a new route. */
function HelpCenterLinks() {
  return (
    <View className="gap-3">
      <SectionHeader title={translate("Jelajahi bantuan")} level="h3" />
      <ListGroup>
        <ListItem
          title={translate("Tentang Kahade")}
          subtitle={translate("Informasi aplikasi dan kebijakan")}
          leading={Info}
          href={ROUTES.about}
          chevron
          divider
        />
        <ListItem
          title={translate("Laporan Saya")}
          subtitle={translate("Pantau laporan yang pernah Anda kirim")}
          leading={Flag}
          href={ROUTES.reports()}
          chevron
          divider
        />
        <ListItem
          title={translate("Tiket Bantuan")}
          subtitle={translate("Lihat percakapan dan status tiket")}
          leading={Ticket}
          href={ROUTES.support}
          chevron
          divider
        />
        <ListItem
          title={translate("Bantuan Langsung")}
          subtitle={translate("Hubungi tim Kahade saat layanan tersedia")}
          leading={Lifebuoy}
          href={ROUTES.liveSupport}
          chevron
          divider
        />
        <ListItem
          title={translate("Umpan Balik")}
          subtitle={translate("Kirim saran untuk membantu kami berkembang")}
          leading={ChatCircleText}
          href={ROUTES.feedback}
          chevron
          divider
        />
        <ListItem
          title={translate("Hubungi Kami")}
          subtitle={translate("Buat tiket baru untuk pertanyaan lain")}
          leading={EnvelopeSimple}
          href={ROUTES.contact}
          chevron
        />
      </ListGroup>
    </View>
  )
}

type FaqRow = { id: string } & ({ article: HelpArticle } | { category: HelpCategory })

/**
 * F05: kartu status Bantuan Langsung — jam layanan, status buka/tutup
 * (dari jadwal, BUKAN klaim "agen online"), petunjuk antrean, dan alternatif
 * buat tiket saat tutup. CTA tidak lagi tampak selalu siap.
 */
function LiveSupportStatusCard() {
  const availability = getLiveSupportAvailability()
  return (
    <Card padded={false} className="gap-2 p-4">
      <View className="flex-row items-center gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-full bg-background">
          <Icon icon={Lifebuoy} size="md" tone="active" />
        </View>
        <View className="flex-1 gap-0.5">
          <Text variant="body" weight={600}>
            Bantuan Langsung
          </Text>
          <View className="flex-row items-center gap-1.5">
            <View
              className={`h-2 w-2 rounded-full ${availability.open ? "bg-success" : "bg-border"}`}
            />
            <Text variant="caption" tone="secondary">
              {availability.open
                ? `Online (jadwal) · sampai ${availability.closesAt}`
                : `Sedang offline · buka ${availability.opensAt}`}
            </Text>
          </View>
        </View>
      </View>
      <Text variant="caption" tone="secondary">
        Jam layanan: {liveSupportScheduleSummary()}.
      </Text>
      <Text variant="caption" tone="secondary">
        {availability.queueHint}
      </Text>
      <View className="flex-row gap-2 pt-1">
        {availability.open ? (
          <Button
            variant="secondary"
            size="sm"
            fullWidth={false}
            onPress={() => router.push(ROUTES.liveSupport)}
          >
            Mulai percakapan
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            fullWidth={false}
            onPress={() => router.push(ROUTES.contact)}
          >
            Buat tiket
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          fullWidth={false}
          onPress={() => router.push(ROUTES.support)}
        >
          Tiket saya
        </Button>
      </View>
    </Card>
  )
}

export default function FaqScreen() {
  // Langganan bahasa: placeholder kolom cari (prop string) harus langsung
  // ikut berganti saat pengguna mengubah bahasa (UI-M008).
  useLanguage()
  const insets = useSafeAreaInsets()
  const isFocused = useIsFocused()
  // F01: breadcrumb artikel menautkan kembali ke hasil pencarian — param `q`
  // mengisi kolom cari agar kata pencarian tidak hilang.
  const params = useLocalSearchParams<{ q?: string }>()
  const [keyword, setKeyword] = useState("")
  useEffect(() => {
    if (typeof params.q === "string" && params.q.trim()) setKeyword(params.q.trim())
  }, [params.q])
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
  // FE-013: `data` ikut di-memo — array baru tiap render menjebol bail-out FlatList.
  const rows = useMemo<FaqRow[]>(
    () =>
      searching
        ? (search.data ?? []).map((article) => ({ id: article.id, article }))
        : (categories.data ?? []).map((category) => ({ id: category.slug, category })),
    [searching, search.data, categories.data],
  )

  // F04: riwayat artikel terakhir dilihat (lokal, per akun) + aksi bersihkan.
  const [history, setHistory] = useState<HelpHistoryEntry[]>([])
  const [clearOpen, setClearOpen] = useState(false)
  const reloadHistory = useCallback(() => {
    void getHelpHistory().then(setHistory)
  }, [])
  useEffect(() => {
    if (isFocused) reloadHistory()
  }, [isFocused, reloadHistory])

  /**
   * FE-013 (audit 2026-09-29): SEMUA prop list di-hoist — tiap keystroke
   * pencarian sebelumnya me-render ulang seluruh daftar (keyExtractor,
   * style, separator, header, renderItem, empty, onRefresh semuanya inline).
   */
  const faqKeyExtractor = useCallback((row: FaqRow) => row.id, [])
  const faqContentStyle = useMemo(
    () => ({
      paddingHorizontal: tokens.layout.screenPaddingX,
      paddingBottom: insets.bottom + tokens.space[8],
      flexGrow: 1,
    }),
    [insets.bottom],
  )
  const faqListHeader = useMemo(
    () =>
      searching ? null : (
        <View className="gap-4 pb-3">
          <HelpCenterLinks />
          {/* F05: status ketersediaan Bantuan Langsung. */}
          <LiveSupportStatusCard />
          {/* F04: artikel terakhir dilihat. */}
          {history.length > 0 ? (
            <View className="gap-2">
              <SectionHeader
                title="Terakhir dilihat"
                action={
                  <TextLink inline onPress={() => setClearOpen(true)}>
                    Bersihkan
                  </TextLink>
                }
              />
              {history.slice(0, 5).map((entry) => (
                <HelpArticleListItem
                  key={`${entry.articleId || entry.slug}`}
                  padded={false}
                  title={entry.title}
                  snippet={entry.categoryName}
                  href={ROUTES.helpArticle(entry.articleId || entry.slug, entry.slug)}
                />
              ))}
            </View>
          ) : null}
        </View>
      ),
    [searching, history],
  )
  const faqRenderItem: ListRenderItem<FaqRow> = useCallback(
    ({ item }) =>
      "article" in item ? (
        <HelpArticleListItem
          padded={false}
          title={item.article.title}
          highlight={keyword}
          href={ROUTES.helpArticle(
            item.article.slug ?? item.article.id,
            item.article.category,
            item.article.title,
          )}
        />
      ) : (
        <HelpCategoryCard
          name={item.category.name}
          description={item.category.description}
          articleCount={item.category.articleCount}
          href={ROUTES.helpCategory(item.category.slug)}
        />
      ),
    [keyword],
  )
  const faqListEmpty = useMemo(
    () =>
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
      ),
    [state, searching],
  )
  const faqRefresh = useCallback(() => void state.refresh(), [state])

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Pusat Bantuan" />
      {/* v2: kolom cari fade-in tanpa geser (pola Transaksi) — kontrol
          fungsional harus stabil. Item FAQ tidak direveal per-item. */}
      <FadeIn duration="fast" translate={false} className="px-5 pb-4">
        <DebouncedSearchField
          autoFocus={false}
          initialQuery={keyword}
          onQueryChange={setKeyword}
          placeholder={translate("Cari bantuan")}
        />
      </FadeIn>
      <PullToRefreshFlatList
        data={rows}
        keyExtractor={faqKeyExtractor}
        contentContainerStyle={faqContentStyle}
        ItemSeparatorComponent={FaqItemSeparator}
        ListHeaderComponent={faqListHeader}
        renderItem={faqRenderItem}
        ListEmptyComponent={faqListEmpty}
        refreshing={state.refreshing}
        onRefresh={faqRefresh}
        refreshEnabled={!state.loading}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
      />
      <Dialog
        title="Bersihkan riwayat?"
        description="Daftar artikel yang terakhir Anda lihat akan dihapus dari perangkat ini. Tindakan ini tidak bisa dibatalkan."
        visible={clearOpen}
        destructive
        confirmLabel="Bersihkan"
        cancelLabel="Batal"
        onConfirm={() => {
          void clearHelpHistory().then(() => {
            setHistory([])
            setClearOpen(false)
          })
        }}
        onCancel={() => setClearOpen(false)}
        onRequestClose={() => setClearOpen(false)}
      />
    </Screen>
  )
}
