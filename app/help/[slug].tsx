/**
 * Detail artikel bantuan.
 *
 * Umpan balik artikel (POST /v1/help-center/items/{id}/feedback?helpful).
 * Endpoint publik + tanpa skema respons — feedback bersifat one-shot per
 * TAMPILAN; status persisten per versi artikel disimpan lokal (F17).
 *
 * Item batch 139:
 * - F01: breadcrumb kategori + jalur kembali tanpa mereset kata pencarian.
 * - F02: progress bar baca + tombol kembali ke atas (tidak menutup isi).
 * - F03: daftar isi dari heading + anchor lompat.
 * - F04: artikel dicatat ke riwayat lokal per akun.
 * - F17: umpan balik sekali per versi artikel + koreksi tunggal.
 *
 * Audit Pengaturan & Bantuan 2026-10-10:
 * - Artikel backend (dari kategori backend atau hasil pencarian global
 *   `/search`) kini bisa dibuka: bila tidak ada di bundel, layar memuat
 *   kategori backend (slug) / hasil pencarian (q) dan mencocokkan id.
 *   Sebelumnya setiap artikel backend berakhir "Artikel tidak ditemukan".
 * - `items/{id}/view` & `/feedback` HANYA dipanggil untuk artikel backend —
 *   keduanya memakai ParseIdPipe (CUID) dan selalu menolak slug bundel
 *   (400 diam-diam setiap kali artikel bawaan dibuka).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { View, type ScrollViewInstance } from "react-native"
import Animated, {
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useLocalSearchParams, router, type Href } from "expo-router"
import { Article, ArrowUp, CaretDown, Check, ListBullets, ShareNetwork, X } from "phosphor-react-native"
import { api } from "@/lib/api"
import type { HelpArticle, HelpCategoryDetail } from "@/lib/api/help-center"
import { translate, useLanguage } from "@/lib/i18n"
import { ROUTES } from "@/lib/routes"
import { helpArticleUrl } from "@/lib/deeplinks"
import { shareContent } from "@/lib/share"
import { tokens, modes } from "@/lib/tokens"
import { isOfflineKnown } from "@/lib/connectivity"
import {
  BUNDLED_HELP,
  findBundledHelpArticle,
  getBundledHelpCategory,
  isBundledHelpArticle,
  searchBundledHelpArticles,
} from "@/lib/help-content"
import { findHelpArticleIn, mergeHelpArticles, mergeHelpCategories } from "@/lib/help-remote"
import { logWarn } from "@/lib/telemetry"
import { getHelpFeedback, saveHelpFeedback, type HelpFeedbackChoice } from "@/lib/help-feedback"
import { recordHelpArticleView } from "@/lib/help-history"
import { parseArticleHeadings } from "@/lib/help-toc"
import { useApiQuery } from "@/lib/use-api-query"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { Header } from "@/components/ui/header"
import { HelpArticleContent } from "@/components/ui/help-article-content"
import { HelpArticleListItem, HelpArticleListItemSkeleton } from "@/components/ui/help-article-list-item"
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { useTheme } from "@/components/theme-provider"

/**
 * F17: umpan balik sekali per VERSI artikel. Pilihan disimpan lokal per
 * versi konten; koreksi tunggal diizinkan (mis. salah ketuk), setelah itu
 * terkunci. Pengiriman ke server tetap best-effort seperti sebelumnya.
 */
function FeedbackBlock({
  articleId,
  content,
  remote,
}: {
  articleId: string
  content: string
  /** true = artikel backend (id CUID) — hanya ini yang dikirim ke server. */
  remote: boolean
}) {
  const [choice, setChoice] = useState<HelpFeedbackChoice | null>(null)
  const [corrected, setCorrected] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let alive = true
    void getHelpFeedback(articleId, content).then((stored) => {
      if (!alive) return
      setChoice(stored?.choice ?? null)
      setCorrected(stored?.corrected ?? false)
      setLoaded(true)
    })
    return () => {
      alive = false
    }
  }, [articleId, content])

  const send = useCallback(
    (helpful: boolean) => {
      const next: HelpFeedbackChoice = helpful ? "helpful" : "not_helpful"
      void (async () => {
        const res = await saveHelpFeedback(articleId, content, next)
        if (res.status === "already_locked") return
        setChoice(next)
        setCorrected(res.status === "corrected")
        // Pilihan tersimpan lokal. Kirim ke server hanya saat online; feedback
        // tidak pernah masuk antrean aksi offline.
        if (remote && !isOfflineKnown())
          api.helpCenter.submitHelpArticleFeedback(articleId, helpful).catch(() => {})
      })()
    },
    [articleId, content, remote],
  )

  if (!loaded) return null
  const voted = choice !== null
  return (
    <Card padded={false} className="items-center gap-3 p-4">
      <Text variant="body" tone="secondary" className="text-center">
        Apakah artikel ini membantu?
      </Text>
      {voted ? (
        <View className="items-center gap-2">
          <Text variant="body" tone="primary" weight={500} className="text-center">
            Terima kasih, pilihan Anda tersimpan di perangkat ini.
          </Text>
          {/* F17: koreksi tunggal bila belum dipakai.
              FE-102: pilihan final = tombol dinonaktifkan secara visual,
              bukan teks aturan internal ("…sudah final"). */}
          <Button
            variant="ghost"
            size="sm"
            fullWidth={false}
            disabled={corrected}
            onPress={() => send(choice !== "helpful")}
          >
            Ubah pilihan (1x)
          </Button>
          {/* Item 123 (revisi Poin 5, 2026-10-04): "Tidak membantu" → tawarkan
              SATU alur chat (bukan lagi buat tiket — tiket kini hanya dibuat
              admin dari eskalasi). */}
          {choice === "not_helpful" ? (
            <Button
              variant="secondary"
              size="sm"
              onPress={() => router.push(ROUTES.supportChat)}
            >
              Chat dengan tim Kahade
            </Button>
          ) : null}
        </View>
      ) : (
        <View className="flex-row gap-3">
          <Button containerClassName="flex-1" variant="secondary" size="sm" leftIcon={Check} onPress={() => send(true)}>
            Ya, membantu
          </Button>
          <Button containerClassName="flex-1" variant="ghost" size="sm" leftIcon={X} onPress={() => send(false)}>
            Tidak
          </Button>
        </View>
      )}
    </Card>
  )
}

/**
 * F01: breadcrumb — "Pusat Bantuan › Kategori › Judul". Jalur kembali tidak
 * mereset kata pencarian: bila artikel dibuka dari hasil pencarian (param
 * `q`), crumb tengah mengarah ke daftar hasil pencarian yang sama.
 */
function Breadcrumb({
  slug,
  categoryName,
  articleTitle,
  searchQuery,
}: {
  slug: string
  categoryName: string
  articleTitle?: string
  searchQuery?: string
}) {
  const crumbs: Array<{ label: string; href?: Href; current?: boolean }> = [
    { label: translate("Pusat Bantuan"), href: ROUTES.faq },
  ]
  if (searchQuery) {
    // P1b (2026-10-03): kembali ke /faq dengan param q (kolom cari terisi
    // otomatis, lihat app/faq.tsx). Sebelumnya menaut ke /help/[slug] tanpa
    // param article — halaman tujuan rusak.
    crumbs.push({
      label: translate('Hasil pencarian "{x}"', { x: searchQuery }),
      href: { pathname: "/faq", params: { q: searchQuery } } as Href,
    })
  } else {
    crumbs.push({ label: categoryName, href: ROUTES.helpCategory(slug) })
  }
  if (articleTitle) crumbs.push({ label: articleTitle, current: true })
  return (
    <View
      className="flex-row flex-wrap items-center gap-1"
      accessibilityRole="list"
      accessibilityLabel={translate("Navigasi breadcrumb")}
    >
      {crumbs.map((c, i) => (
        <View key={i} className="flex-row items-center gap-1">
          {i > 0 ? (
            <Text variant="caption" tone="secondary">
              ›
            </Text>
          ) : null}
          {c.current || !c.href ? (
            <Text variant="caption" tone={c.current ? "primary" : "secondary"} numberOfLines={1} className="max-w-[160px]">
              {c.label}
            </Text>
          ) : (
            <PressableScale
              onPress={() => router.push(c.href as Href)}
              accessibilityRole="link"
              accessibilityLabel={translate("Kembali ke {x}", { x: c.label })}
            >
              <Text variant="caption" tone="accent" numberOfLines={1} className="max-w-[160px] underline">
                {c.label}
              </Text>
            </PressableScale>
          )}
        </View>
      ))}
    </View>
  )
}

export default function HelpScreen() {
  const language = useLanguage()
  const insets = useSafeAreaInsets()
  const { slug, article, q, anchor } = useLocalSearchParams<{
    slug: string
    article?: string
    q?: string
    /** F03: indeks heading untuk lompat otomatis (deep link anchor). */
    anchor?: string
  }>()
  const bundledCategory = getBundledHelpCategory(slug)
  const bundledSearchResults = useMemo(() => searchBundledHelpArticles(q ?? ""), [q])
  const bundledSelected = article
    ? findBundledHelpArticle(article, q ? undefined : slug) ??
      bundledSearchResults.find((item) => item.id === article || item.slug === article) ??
      null
    : null

  /**
   * Sumber backend — dimuat HANYA bila yang dibutuhkan tidak ada di bundel:
   *   - kategori (mode daftar): gabungkan artikel backend untuk slug ini;
   *   - artikel: cari di kategori backend (slug) atau hasil pencarian (q).
   * Gagal/offline → bundel apa adanya (tidak ada error state untuk konten
   * pelengkap); artikel backend yang tidak terjangkau → EmptyState jujur.
   */
  const needRemoteCategory = Boolean(slug) && (!article || !bundledSelected) && !q
  const remoteCategory = useApiQuery<HelpCategoryDetail | null>(
    `help-category:${language}:${slug}`,
    (signal) => api.helpCenter.getHelpCategory(slug, signal).catch(() => null),
    needRemoteCategory,
  )
  const needRemoteSearch = Boolean(article) && !bundledSelected && Boolean(q)
  const remoteSearch = useApiQuery<HelpArticle[]>(
    `help-search:${language}:${q ?? ""}`,
    (signal) => api.helpCenter.searchHelpArticles(q ?? "", signal).catch(() => []),
    needRemoteSearch,
  )
  // Cadangan terakhir: artikel dibuka lewat deep link tanpa q dan dengan
  // slug kategori yang tidak cocok — pindai seluruh kategori backend.
  const needRemoteAll =
    Boolean(article) &&
    !bundledSelected &&
    ((needRemoteCategory && !remoteCategory.loading && !remoteCategory.data) ||
      (needRemoteSearch && !remoteSearch.loading && !(remoteSearch.data ?? []).some((a) => a.id === article || a.slug === article)))
  const remoteAll = useApiQuery<HelpCategoryDetail[]>(
    `help-categories:${language}`,
    (signal) => api.helpCenter.listHelpCategories(signal).catch(() => []),
    needRemoteAll,
  )

  const remoteCategories = useMemo<HelpCategoryDetail[]>(() => {
    const list: HelpCategoryDetail[] = []
    if (remoteCategory.data) list.push(remoteCategory.data)
    for (const category of remoteAll.data ?? []) {
      if (!list.some((c) => c.slug === category.slug)) list.push(category)
    }
    return list
  }, [remoteCategory.data, remoteAll.data])
  const mergedCategories = useMemo(
    () => mergeHelpCategories(BUNDLED_HELP, remoteCategories),
    [remoteCategories],
  )

  const category =
    mergedCategories.find((c) => c.slug === slug) ??
    (bundledCategory as HelpCategoryDetail | null) ??
    null
  const remoteHit = useMemo(() => {
    if (!article || bundledSelected) return null
    const fromSearch = (remoteSearch.data ?? []).find(
      (item) => item.id === article || item.slug === article,
    )
    if (fromSearch) {
      const cat = fromSearch.category
        ? mergedCategories.find((c) => c.slug === fromSearch.category) ?? null
        : null
      return { article: fromSearch, category: cat }
    }
    const found = findHelpArticleIn(mergedCategories, article)
    return found ? { article: found.article, category: found.category } : null
  }, [article, bundledSelected, remoteSearch.data, mergedCategories])

  const selected: HelpArticle | null = bundledSelected ?? remoteHit?.article ?? null
  const selectedIsRemote = Boolean(selected) && !isBundledHelpArticle(selected as HelpArticle)
  const selectedCategory: HelpCategoryDetail | null = bundledSelected?.category
    ? (getBundledHelpCategory(bundledSelected.category) as HelpCategoryDetail | null)
    : remoteHit?.category ?? category
  const resolving =
    Boolean(article) &&
    !selected &&
    (remoteCategory.loading || remoteSearch.loading || remoteAll.loading)

  // Daftar artikel kategori (mode daftar) — bundel + backend untuk slug ini.
  const articles: HelpArticle[] = useMemo(() => {
    if (article && q) return mergeHelpArticles(bundledSearchResults, remoteSearch.data ?? [])
    return category?.articles ?? []
  }, [article, q, bundledSearchResults, remoteSearch.data, category])

  // F04: catat artikel ke riwayat lokal per akun; konten tetap tersedia dari bundle.
  useEffect(() => {
    if (!selected) return
    void recordHelpArticleView({
      articleId: selected.id || selected.slug,
      slug: selectedCategory?.slug ?? slug,
      title: selected.title || "Artikel bantuan",
      categoryName: selectedCategory?.name,
    }).catch((err) => logWarn("help:record-history", err))
  }, [selected, slug, selectedCategory?.slug, selectedCategory?.name])

  // View-count hanya telemetri opsional; tidak pernah diminta ketika offline,
  // dan hanya untuk artikel backend (id CUID — lihat catatan di atas).
  useEffect(() => {
    if (!selected?.id || !selectedIsRemote || isOfflineKnown()) return
    void api.helpCenter.trackHelpArticleView(selected.id).catch((err) =>
      logWarn("help:track-view", err),
    )
  }, [selected?.id, selectedIsRemote])

  const content = selected?.content || ""
  // F03: daftar isi dari heading yang ada.
  const toc = useMemo(() => parseArticleHeadings(content), [content])
  const [tocOpen, setTocOpen] = useState(true)
  const scrollRef = useRef<ScrollViewInstance | null>(null)
  /** F03: posisi Y tiap heading (relatif ke konten scroll). */
  const headingY = useRef(new Map<number, number>())
  /** F03: offset Y HelpArticleContent di dalam konten scroll. */
  const contentTopY = useRef(0)

  const jumpToHeading = useCallback((index: number) => {
    const y = headingY.current.get(index)
    if (y == null) return
    scrollRef.current?.scrollTo({ y: Math.max(0, y - tokens.space[2]), animated: true })
  }, [])

  // F03: deep link anchor (?anchor=2) — lompat setelah layout tercatat.
  useEffect(() => {
    if (!anchor || toc.length === 0) return
    const idx = Number.parseInt(anchor, 10)
    if (!Number.isFinite(idx)) return
    const t = setTimeout(() => jumpToHeading(idx), 600)
    return () => clearTimeout(t)
  }, [anchor, toc.length, jumpToHeading, selected?.id])

  // F02: progres baca (0–1) + tombol kembali ke atas.
  // TIM 8 (perf): progres di UI thread via reanimated shared value — pola
  // components/legal-document-screen.tsx. Sebelumnya `setProgress` tiap
  // scroll event (throttle 16) me-render ulang layar tiap frame.
  const { mode } = useTheme()
  const progress = useSharedValue(0)
  // F02: tombol "kembali ke atas" muncul setelah pengguna menggulir cukup
  // jauh. Boolean ini hanya berubah saat MELEWATI ambang 0.15 — bukan tiap
  // frame — jadi re-render tetap jarang walau progres bar di UI thread.
  const [showTop, setShowTop] = useState(false)
  const showTopRef = useRef(false)
  const handleScroll = useAnimatedScrollHandler((e) => {
    const max = e.contentSize.height - e.layoutMeasurement.height
    const p = max > 0 ? Math.min(1, Math.max(0, e.contentOffset.y / max)) : 0
    progress.value = p
    const over = p > 0.15
    if (over !== showTopRef.current) {
      showTopRef.current = over
      runOnJS(setShowTop)(over)
    }
  })
  // `bg-primary` tidak ter-compile jadi background di Reanimated.View pada
  // web (lihat AGENTS.md) — pakai backgroundColor inline mode-aware.
  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
    backgroundColor: modes[mode].primary,
  }))
  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true })
  }, [])

  // Item 120: artikel terkait = artikel lain di kategori yang sama (maks 3).
  const related = selected
    ? (selectedCategory?.articles ?? articles)
        .filter((item) => item.id !== selected.id)
        .slice(0, 3)
    : []
  const relatedCategorySlug = selectedCategory?.slug ?? slug
  // Item 122: bagikan via tautan kanonis web (membuka deep link / web app).
  const shareArticle = useCallback(() => {
    if (!selected) return
    void shareContent({
      message: selected.title,
      url: helpArticleUrl(selected.slug || selected.id, relatedCategorySlug),
      title: selected.title,
    }).catch((err) => logWarn("help:share", err))
  }, [selected, relatedCategorySlug])

  const listLoading = !article && !category && remoteCategory.loading
  return (
    <Screen edges={["top"]} padded={false}>
      {/* Header di LUAR area scroll: artikel bantuan bisa sangat panjang —
          pengguna harus bisa kembali tanpa menggulir ke atas dulu. */}
      <Header
        title={article ? (selected?.title ?? "Artikel") : (category?.name || "Kategori Bantuan")}
        right={
          selected ? (
            <IconButton
              icon={ShareNetwork}
              variant="ghost"
              onPress={shareArticle}
              accessibilityLabel={translate("Bagikan artikel")}
            />
          ) : null
        }
      />
      {/* F02: progress bar tipis di bawah header (hanya mode artikel). */}
      {article ? (
        <View
          className="h-[3px] w-full bg-border"
          accessibilityRole="progressbar"
          accessibilityLabel={translate("Progres baca")}
        >
          <Animated.View className="h-[3px]" style={progressBarStyle} />
        </View>
      ) : null}
      <View className="flex-1">
        <Animated.ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={article ? handleScroll : undefined}
          contentContainerClassName="gap-4 px-5 py-4"
          contentContainerStyle={{ paddingBottom: insets.bottom + tokens.space[8] }}
        >
          {article ? (
            selected ? (
              <View className="gap-4">
                {/* F01: breadcrumb — kembali ke kategori/pencarian tanpa reset. */}
                <Breadcrumb
                  slug={relatedCategorySlug}
                  categoryName={selectedCategory?.name || translate("Kategori Bantuan")}
                  articleTitle={selected.title}
                  searchQuery={q || undefined}
                />
                {/* F03: daftar isi dari heading yang sudah ada. */}
                {toc.length >= 2 ? (
                  <Card padded={false} className="gap-1 p-3">
                    <PressableScale
                      onPress={() => setTocOpen((v) => !v)}
                      accessibilityRole="button"
                      accessibilityLabel={
                        tocOpen ? translate("Sembunyikan daftar isi") : translate("Tampilkan daftar isi")
                      }
                      accessibilityState={{ expanded: tocOpen }}
                      className="flex-row items-center justify-between py-1"
                    >
                      <View className="flex-row items-center gap-2">
                        <Icon icon={ListBullets} size="sm" tone="default" />
                        <Text variant="label" weight={600}>
                          Daftar isi
                        </Text>
                      </View>
                      <Icon icon={CaretDown} size="sm" tone="default" style={{ transform: [{ rotate: tocOpen ? "180deg" : "0deg" }] }} />
                    </PressableScale>
                    {tocOpen ? (
                      <View className="gap-0.5 pt-1">
                        {toc.map((entry) => (
                          <PressableScale
                            key={entry.index}
                            onPress={() => jumpToHeading(entry.index)}
                            accessibilityRole="link"
                            accessibilityLabel={translate("Lompat ke {x}", { x: entry.text })}
                            className="py-1.5"
                          >
                            <View style={{ paddingLeft: (entry.level - 1) * 12 }}>
                              <Text variant="body" tone="accent" numberOfLines={2} className="underline">
                                {entry.text}
                              </Text>
                            </View>
                          </PressableScale>
                        ))}
                      </View>
                    ) : null}
                  </Card>
                ) : null}
                {/* Item 121: render markdown aman (tanpa WebView/HTML). */}
                <View
                  onLayout={(e) => {
                    contentTopY.current = e.nativeEvent.layout.y
                  }}
                >
                  <HelpArticleContent
                    content={content || translate("Isi panduan belum tersedia di perangkat ini.")}
                    onHeadingLayout={(index, y) => {
                      headingY.current.set(index, contentTopY.current + y)
                    }}
                  />
                </View>
                <FeedbackBlock articleId={selected.id} content={content} remote={selectedIsRemote} />
                {related.length > 0 ? (
                  <View className="gap-2">
                    <Text variant="h3">
                      Artikel terkait
                    </Text>
                    {related.map((item) => (
                      <HelpArticleListItem
                        padded={false}
                        key={item.id}
                        title={item.title}
                        href={ROUTES.helpArticle(item.slug || item.id, relatedCategorySlug)}
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            ) : resolving ? (
              <View className="gap-3">
                <HelpArticleListItemSkeleton />
                <HelpArticleListItemSkeleton />
              </View>
            ) : (
              <EmptyState
                icon={Article}
                title={translate("Artikel tidak ditemukan")}
                description={translate(
                  isOfflineKnown()
                    ? "Artikel ini perlu koneksi internet. Panduan utama tetap tersedia di Pusat Bantuan."
                    : "Artikel mungkin belum dipublikasikan atau telah dipindahkan.",
                )}
                action={
                  <Button variant="secondary" fullWidth={false} onPress={() => router.push(ROUTES.faq)}>
                    {translate("Buka Pusat Bantuan")}
                  </Button>
                }
              />
            )
          ) : listLoading ? (
            <View className="gap-3">
              <HelpArticleListItemSkeleton />
              <HelpArticleListItemSkeleton />
              <HelpArticleListItemSkeleton />
            </View>
          ) : articles.length === 0 ? (
            <EmptyState
              icon={Article}
              title={translate("Kategori bantuan belum tersedia")}
              description={translate(
                "Panduan utama tetap tersedia di Pusat Bantuan pada perangkat ini.",
              )}
            />
          ) : (
            articles.map((item) => (
              <HelpArticleListItem
                padded={false}
                key={item.id || item.slug}
                title={item.title}
                href={ROUTES.helpArticle(item.slug || item.id, item.category ?? slug)}
              />
            ))
          )}
        </Animated.ScrollView>
        {/* F02: kembali ke atas — hanya menggulir, tidak menutup isi. */}
        {article && showTop ? (
          <PressableScale
            onPress={scrollToTop}
            accessibilityRole="button"
            accessibilityLabel={translate("Kembali ke atas artikel")}
            className="h-12 w-12 items-center justify-center rounded-full bg-primary"
            containerClassName="absolute bottom-6 right-5"
          >
            <Icon icon={ArrowUp} size="md" tone="inverse" weight="bold" />
          </PressableScale>
        ) : null}
      </View>
    </Screen>
  )
}
