import type { HelpArticle, HelpCategory } from "@/lib/api/help-center"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Linking, View, type ListRenderItem } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useIsFocused } from "expo-router"
import { router, useLocalSearchParams } from "expo-router"
import { MagnifyingGlass, Question, Scales, Shield } from "phosphor-react-native"
import { api } from "@/lib/api"
import { safeExternalUrl } from "@/lib/external-url"
import { translate, useLanguage } from "@/lib/i18n"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"
import { clearHelpHistory, getHelpHistory, type HelpHistoryEntry } from "@/lib/help-history"
import { DebouncedSearchField } from "@/components/ui/debounced-search-field"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { HelpArticleListItem } from "@/components/ui/help-article-list-item"
import { HelpCategoryCard } from "@/components/ui/help-category-card"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/modal"
import { Divider } from "@/components/ui/divider"
import { FadeIn } from "@/components/ui/fade-in"
import { ListItem } from "@/components/ui/list-item"
import { ListLoading } from "@/components/ui/paginated-list"
import { PullToRefreshFlatList } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { TextLink } from "@/components/ui/text-link"

/**
 * FE-013 (audit 2026-09-29): separator sebagai komponen bernama — arrow
 * inline = tipe komponen baru tiap render → React unmount/mount ulang
 * SEMUA separator tiap render layar.
 */
function FaqItemSeparator() {
  return <View className="h-3" />
}

/**
 * Poin 5 (2026-10-04): pusat bantuan web sebagai sumber konten terpusat.
 * Dibuka lewat validator allowlist (gate check:external-urls).
 */
const HELP_SITE_URL = "https://bantuan.kahade.id"

function openHelpSite() {
  const url = safeExternalUrl(HELP_SITE_URL, {
    allow: ["https:"],
    hosts: ["bantuan.kahade.id"],
  })
  if (url) void Linking.openURL(url).catch(() => undefined)
}

/**
 * Poin 5 (2026-10-04): SATU alur bantuan — cari/baca FAQ dulu; bila tidak
 * ketemu, SATU tombol "Chat dengan tim Kahade" (→ /support-chat, shell jujur
 * gelombang 1). Pintu lama (Bantuan Langsung palsu, Hubungi Kami/tiket manual)
 * dihapus. Tiket yang masih ada (kini hanya dibuat admin dari eskalasi chat)
 * tetap terjangkau sebagai tautan sekunder, begitu juga pusat bantuan web.
 */
function HelpEscalationFooter() {
  return (
    <View className="gap-3 pt-2">
      <SectionHeader title={translate("Masih butuh bantuan?")} level="h3" />
      <Button fullWidth onPress={() => router.push(ROUTES.supportChat)}>
        {translate("Chat dengan tim Kahade")}
      </Button>
      <View className="flex-row items-center justify-center gap-5">
        <TextLink inline onPress={() => router.push(ROUTES.support)}>
          {translate("Tiket bantuan saya")}
        </TextLink>
        <TextLink
          inline
          onPress={openHelpSite}
          accessibilityLabel={translate("Buka bantuan.kahade.id di peramban")}
        >
          bantuan.kahade.id
        </TextLink>
      </View>
      {/* Sidebar 2026-10-05: legal pindahan /settings yang dihapus —
          Syarat & Ketentuan + Kebijakan Privasi di bagian bawah. */}
      <View className="pt-2">
        <Divider />
      </View>
      <View className="w-full overflow-hidden rounded-md bg-surface">
        <ListItem
          title={translate("Syarat & Ketentuan")}
          titleVariant="bodyLarge"
          leading={Scales}
          chevron
          divider={false}
          href={ROUTES.terms}
        />
        <ListItem
          title={translate("Kebijakan Privasi")}
          titleVariant="bodyLarge"
          leading={Shield}
          chevron
          divider={false}
          href={ROUTES.privacyPolicy}
        />
      </View>
    </View>
  )
}

type FaqRow = { id: string } & ({ article: HelpArticle } | { category: HelpCategory })

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
  const faqListFooter = useMemo(
    () => (searching ? null : <HelpEscalationFooter />),
    [searching],
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
      ) : searching ? (
        // Poin 5: tidak ketemu di FAQ → SATU tombol chat (shell jujur).
        <EmptyState
          icon={MagnifyingGlass}
          title="Tidak ada hasil"
          description="Coba kata kunci lain, atau chat dengan tim Kahade untuk bantuan lebih lanjut."
          action={
            <Button
              variant="secondary"
              fullWidth={false}
              onPress={() => router.push(ROUTES.supportChat)}
            >
              Chat dengan tim Kahade
            </Button>
          }
        />
      ) : (
        <EmptyState
          icon={Question}
          title="Kategori bantuan belum tersedia"
          description="Artikel akan ditampilkan setelah dipublikasikan oleh Kahade."
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
        ListHeaderComponent={faqListHeader ?? undefined}
        ListFooterComponent={faqListFooter ?? undefined}
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
