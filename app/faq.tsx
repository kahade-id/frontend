import type { HelpArticle, HelpCategory, HelpCategoryDetail } from "@/lib/api/help-center"
import { useCallback, useEffect, useMemo, useState } from "react"
import { FlatList, Linking, View, type ListRenderItem } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useIsFocused } from "expo-router"
import { router, useLocalSearchParams } from "expo-router"
import {
  ChatTeardropDots,
  Info,
  MagnifyingGlass,
  Question,
  Scales,
  Shield,
} from "phosphor-react-native"
import { api } from "@/lib/api"
import { safeExternalUrl } from "@/lib/external-url"
import { translate, useLanguage } from "@/lib/i18n"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { BUNDLED_HELP, searchBundledHelpArticles } from "@/lib/help-content"
import { mergeHelpArticles, mergeHelpCategories } from "@/lib/help-remote"
import { clearHelpHistory, getHelpHistory, type HelpHistoryEntry } from "@/lib/help-history"
import { useApiQuery } from "@/lib/use-api-query"
import { DebouncedSearchField } from "@/components/ui/debounced-search-field"
import { EmptyState } from "@/components/ui/empty-state"
import { Header } from "@/components/ui/header"
import { HelpArticleListItem } from "@/components/ui/help-article-list-item"
import { HelpCategoryCard } from "@/components/ui/help-category-card"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/modal"
import { Divider } from "@/components/ui/divider"
import { FadeIn } from "@/components/ui/fade-in"
import { ListItem } from "@/components/ui/list-item"
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
 *
 * Audit Pengaturan & Bantuan 2026-10-10: "Kirim masukan" (/feedback) dan
 * "Tentang Kahade" (/about) ditambahkan di sini — sejak /settings dihapus
 * (2026-10-05) KEDUA layar itu tidak punya satu pun pintu masuk di aplikasi
 * (ROUTES.about/ROUTES.feedback tidak dirujuk layar mana pun).
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
          title={translate("Kirim masukan")}
          titleVariant="bodyLarge"
          leading={ChatTeardropDots}
          chevron
          divider={false}
          href={ROUTES.feedback}
        />
        <ListItem
          title={translate("Tentang Kahade")}
          titleVariant="bodyLarge"
          leading={Info}
          chevron
          divider={false}
          href={ROUTES.about}
        />
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
  // ikut berganti saat pengguna mengubah bahasa (UI-M008). Bahasa juga
  // menjadi bagian kunci query backend (artikel EN/ID berbeda).
  const language = useLanguage()
  const insets = useSafeAreaInsets()
  const isFocused = useIsFocused()
  // F01: breadcrumb artikel menautkan kembali ke hasil pencarian — param `q`
  // mengisi kolom cari agar kata pencarian tidak hilang.
  const params = useLocalSearchParams<{ q?: string }>()
  const [keyword, setKeyword] = useState("")
  useEffect(() => {
    if (typeof params.q === "string" && params.q.trim()) setKeyword(params.q.trim())
  }, [params.q])
  const trimmedKeyword = keyword.trim()
  const searching = Boolean(trimmedKeyword)

  /**
   * Audit Pengaturan & Bantuan 2026-10-10: konten backend (artikel yang
   * dikelola tim) digabung dengan bundel. Bundel tampil SEKETIKA (tidak
   * menunggu jaringan); respons backend hanya menambah. Gagal/offline →
   * diam, bundel tetap utuh (tidak ada error state untuk konten pelengkap).
   */
  const remoteCategories = useApiQuery<HelpCategoryDetail[]>(
    `help-categories:${language}`,
    (signal) => api.helpCenter.listHelpCategories(signal).catch(() => []),
  )
  const categories = useMemo(
    () => mergeHelpCategories(BUNDLED_HELP, remoteCategories.data),
    [remoteCategories.data],
  )
  const remoteSearch = useApiQuery<HelpArticle[]>(
    `help-search:${language}:${trimmedKeyword}`,
    (signal) => api.helpCenter.searchHelpArticles(trimmedKeyword, signal).catch(() => []),
    // Backend menolak kueri < 2 karakter (mengembalikan []) — hemat request.
    trimmedKeyword.length >= 2,
  )
  const rows = useMemo<FaqRow[]>(() => {
    if (!searching) {
      return categories.map(({ articles: _articles, ...category }) => ({
        id: category.slug,
        category,
      }))
    }
    const bundledHits = searchBundledHelpArticles(trimmedKeyword)
    // Artikel backend yang sudah dimuat bersama kategori ikut dicari lokal
    // (tanpa menunggu endpoint search), lalu hasil search server menambah.
    const needle = trimmedKeyword.toLocaleLowerCase("id-ID")
    const mergedLocalHits = categories
      .flatMap((category) => category.articles ?? [])
      .filter((article) =>
        [article.title, article.content]
          .filter((value): value is string => typeof value === "string")
          .some((value) => value.toLocaleLowerCase("id-ID").includes(needle)),
      )
    return mergeHelpArticles(
      mergeHelpArticles(bundledHits, mergedLocalHits),
      remoteSearch.data ?? [],
    ).map((article) => ({ id: article.id || article.slug, article }))
  }, [searching, trimmedKeyword, categories, remoteSearch.data])

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
                title={translate("Terakhir dilihat")}
                action={
                  <TextLink inline onPress={() => setClearOpen(true)}>
                    {translate("Bersihkan")}
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
          snippet={item.article.categoryName}
          highlight={keyword}
          href={ROUTES.helpArticle(
            item.article.slug || item.article.id,
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
      searching ? (
        <EmptyState
          icon={MagnifyingGlass}
          title={translate("Tidak ada hasil")}
          description={translate(
            "Coba kata kunci lain, atau chat dengan tim Kahade untuk bantuan lebih lanjut.",
          )}
          action={
            <Button
              variant="secondary"
              fullWidth={false}
              onPress={() => router.push(ROUTES.supportChat)}
            >
              {translate("Chat dengan tim Kahade")}
            </Button>
          }
        />
      ) : (
        <EmptyState
          icon={Question}
          title={translate("Panduan belum tersedia")}
          description={translate(
            "Panduan utama tetap tersedia di perangkat ini. Hubungi tim Kahade untuk pertanyaan lain.",
          )}
        />
      ),
    [searching],
  )

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
      <FlatList
        className="flex-1"
        data={rows}
        keyExtractor={faqKeyExtractor}
        contentContainerStyle={faqContentStyle}
        ItemSeparatorComponent={FaqItemSeparator}
        ListHeaderComponent={faqListHeader ?? undefined}
        ListFooterComponent={faqListFooter ?? undefined}
        renderItem={faqRenderItem}
        ListEmptyComponent={faqListEmpty}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
      />
      <Dialog
        title={translate("Bersihkan riwayat?")}
        description={translate(
          "Daftar artikel yang terakhir Anda lihat akan dihapus dari perangkat ini.",
        )}
        visible={clearOpen}
        destructive
        confirmLabel={translate("Bersihkan")}
        cancelLabel={translate("Batal")}
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
