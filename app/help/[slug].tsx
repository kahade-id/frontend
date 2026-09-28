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
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ScrollView, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useLocalSearchParams, router, type Href } from "expo-router"
import { Article, ArrowUp, CaretDown, Check, ListBullets, ShareNetwork, X } from "phosphor-react-native"
import { api } from "@/lib/api"
import { ROUTES } from "@/lib/routes"
import { helpArticleUrl } from "@/lib/deeplinks"
import { shareContent } from "@/lib/share"
import { tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"
import { logWarn } from "@/lib/telemetry"
import { getHelpFeedback, saveHelpFeedback, type HelpFeedbackChoice } from "@/lib/help-feedback"
import { recordHelpArticleView } from "@/lib/help-history"
import { parseArticleHeadings } from "@/lib/help-toc"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { HelpArticleContent } from "@/components/ui/help-article-content"
import { HelpArticleListItem } from "@/components/ui/help-article-list-item"
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { Crossfade } from "@/components/ui/fade-in"
import { DetailLoading } from "@/components/ui/paginated-list"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"

/**
 * F17: umpan balik sekali per VERSI artikel. Pilihan disimpan lokal per
 * versi konten; koreksi tunggal diizinkan (mis. salah ketuk), setelah itu
 * terkunci. Pengiriman ke server tetap best-effort seperti sebelumnya.
 */
function FeedbackBlock({ articleId, content }: { articleId: string; content: string }) {
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
        // Kirim ke server best-effort (tidak mengganggu baca artikel).
        api.helpCenter.submitHelpArticleFeedback(articleId, helpful).catch(() => {})
      })()
    },
    [articleId, content],
  )

  if (!loaded) return null
  const voted = choice !== null
  return (
    <View className="items-center gap-3 rounded-md border border-border bg-surface p-4">
      <Text variant="body" tone="secondary" className="text-center">
        Apakah artikel ini membantu?
      </Text>
      {voted ? (
        <View className="items-center gap-2">
          <Text variant="body" tone="primary" weight={500} className="text-center">
            {choice === "helpful"
              ? "Terima kasih, catatan Anda sudah dicatat."
              : "Terima kasih atas umpan baliknya."}
          </Text>
          {/* F17: koreksi tunggal bila belum dipakai. */}
          {!corrected ? (
            <Button
              variant="ghost"
              size="sm"
              fullWidth={false}
              onPress={() => send(choice !== "helpful")}
            >
              Ubah pilihan (1x)
            </Button>
          ) : (
            <Text variant="caption" tone="secondary" className="text-center">
              Pilihan untuk versi artikel ini sudah final.
            </Text>
          )}
          {/* Item 123: "Tidak membantu" → tawarkan buat tiket, artikel
              terkait terisi otomatis (relatedArticleId). */}
          {choice === "not_helpful" ? (
            <Button
              variant="secondary"
              size="sm"
              onPress={() =>
                router.push({
                  pathname: ROUTES.contact,
                  params: { relatedArticleId: articleId },
                } as Href)
              }
            >
              Buat tiket
            </Button>
          ) : null}
        </View>
      ) : (
        <View className="flex-row gap-3">
          <Button variant="secondary" size="sm" leftIcon={Check} onPress={() => send(true)}>
            Ya, membantu
          </Button>
          <Button variant="ghost" size="sm" leftIcon={X} onPress={() => send(false)}>
            Tidak
          </Button>
        </View>
      )}
    </View>
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
    { label: "Pusat Bantuan", href: ROUTES.faq },
  ]
  if (searchQuery) {
    crumbs.push({
      label: `Hasil pencarian "${searchQuery}"`,
      href: { pathname: "/help/[slug]", params: { slug, q: searchQuery } } as Href,
    })
  } else {
    crumbs.push({ label: categoryName, href: ROUTES.helpCategory(slug) })
  }
  if (articleTitle) crumbs.push({ label: articleTitle, current: true })
  return (
    <View
      className="flex-row flex-wrap items-center gap-1"
      accessibilityRole="list"
      accessibilityLabel="Navigasi breadcrumb"
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
              accessibilityLabel={`Kembali ke ${c.label}`}
            >
              <Text variant="caption" tone="active" numberOfLines={1} className="max-w-[160px] underline">
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
  const insets = useSafeAreaInsets()
  const { slug, article, q, anchor } = useLocalSearchParams<{
    slug: string
    article?: string
    q?: string
    /** F03: indeks heading untuk lompat otomatis (deep link anchor). */
    anchor?: string
  }>()
  const query = useApiQuery(
    `help:${slug}:${article ?? ""}:${q ?? ""}`,
    async (signal) => {
      if (article && q) {
        const articles = await api.helpCenter.searchHelpArticles(q, signal)
        return { name: "Artikel bantuan", articles }
      }
      return api.helpCenter.getHelpCategory(slug, signal)
    },
    Boolean(slug),
  )
  const selected = article
    ? query.data?.articles?.find((item) => item.id === article || item.slug === article)
    : undefined
  useEffect(() => {
    if (selected?.id) void api.helpCenter.trackHelpArticleView(selected.id).catch((err) => logWarn("help:track-view", err))
  }, [selected?.id])
  // F04: catat ke riwayat lokal per akun (aksi bersihkan ada di Pusat Bantuan).
  useEffect(() => {
    if (!selected) return
    void recordHelpArticleView({
      articleId: selected.id || selected.slug,
      slug,
      title: selected.title || "Artikel bantuan",
      categoryName: query.data?.name,
    }).catch((err) => logWarn("help:record-history", err))
  }, [selected, slug, query.data?.name])

  const content = selected?.content || ""
  // F03: daftar isi dari heading yang ada.
  const toc = useMemo(() => parseArticleHeadings(content), [content])
  const [tocOpen, setTocOpen] = useState(true)
  const scrollRef = useRef<ScrollView | null>(null)
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
  const [progress, setProgress] = useState(0)
  const handleScroll = useCallback((e: { nativeEvent: { contentOffset: { y: number }; contentSize: { height: number }; layoutMeasurement: { height: number } } }) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent
    const max = contentSize.height - layoutMeasurement.height
    setProgress(max > 0 ? Math.min(1, Math.max(0, contentOffset.y / max)) : 0)
  }, [])
  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true })
  }, [])

  // Item 120: artikel terkait = artikel lain di kategori yang sama (maks 3).
  const related = selected
    ? (query.data?.articles ?? []).filter((item) => item.id !== selected.id).slice(0, 3)
    : []
  // Item 122: bagikan via tautan kanonis web (membuka deep link / web app).
  const shareArticle = useCallback(() => {
    if (!selected) return
    void shareContent({
      message: selected.title,
      url: helpArticleUrl(selected.slug ?? selected.id, slug),
      title: selected.title,
    }).catch((err) => logWarn("help:share", err))
  }, [selected, slug])
  return (
    <Screen edges={["top"]} padded={false}>
      {/* Header di LUAR area scroll: artikel bantuan bisa sangat panjang —
          pengguna harus bisa kembali tanpa menggulir ke atas dulu. */}
      <Header
        title={
          article ? (selected?.title ?? "Artikel") : (query.data?.name ?? "Kategori Bantuan")
        }
        right={
          selected ? (
            <IconButton
              icon={ShareNetwork}
              variant="ghost"
              onPress={shareArticle}
              accessibilityLabel="Bagikan artikel"
            />
          ) : null
        }
      />
      {/* F02: progress bar tipis di bawah header (hanya mode artikel). */}
      {article ? (
        <View className="h-[3px] w-full bg-border" accessibilityRole="progressbar" accessibilityLabel={`Progres baca ${Math.round(progress * 100)} persen`}>
          <View className="h-[3px] bg-primary" style={{ width: `${Math.round(progress * 100)}%` }} />
        </View>
      ) : null}
      <View className="flex-1">
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={article ? handleScroll : undefined}
          contentContainerClassName="gap-4 px-5 py-4"
          contentContainerStyle={{ paddingBottom: insets.bottom + tokens.space[8] }}
        >
          <Crossfade loading={query.loading} skeleton={<DetailLoading />}>
            {query.error ? (
            <ErrorState description={query.error} onRetry={() => void query.reload()} />
          ) : article ? (
            selected ? (
              <View className="gap-4">
                {/* F01: breadcrumb — kembali ke kategori/pencarian tanpa reset. */}
                <Breadcrumb
                  slug={slug}
                  categoryName={query.data?.name ?? "Kategori Bantuan"}
                  articleTitle={selected.title}
                  searchQuery={q || undefined}
                />
                {/* F03: daftar isi dari heading yang sudah ada. */}
                {toc.length >= 2 ? (
                  <View className="gap-1 rounded-md border border-border bg-surface p-3">
                    <PressableScale
                      onPress={() => setTocOpen((v) => !v)}
                      accessibilityRole="button"
                      accessibilityLabel={tocOpen ? "Sembunyikan daftar isi" : "Tampilkan daftar isi"}
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
                            accessibilityLabel={`Lompat ke ${entry.text}`}
                            className="py-1.5"
                            style={{ paddingLeft: (entry.level - 1) * 12 }}
                          >
                            <Text variant="body" tone="active" numberOfLines={2} className="underline">
                              {entry.text}
                            </Text>
                          </PressableScale>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ) : null}
                {/* Item 121: render markdown aman (tanpa WebView/HTML). */}
                <View
                  onLayout={(e) => {
                    contentTopY.current = e.nativeEvent.layout.y
                  }}
                >
                  <HelpArticleContent
                    content={content || "Isi artikel belum tersedia dari server."}
                    onHeadingLayout={(index, y) => {
                      headingY.current.set(index, contentTopY.current + y)
                    }}
                  />
                </View>
                <FeedbackBlock articleId={selected.id} content={content} />
                {related.length > 0 ? (
                  <View className="gap-2">
                    <Text variant="h3" weight={700}>
                      Artikel terkait
                    </Text>
                    {related.map((item) => (
                      <HelpArticleListItem
                        padded={false}
                        key={item.id}
                        title={item.title}
                        href={ROUTES.helpArticle(item.slug ?? item.id, slug)}
                      />
                    ))}
                  </View>
                ) : null}
              </View>
            ) : (
              <EmptyState
                icon={Article}
                title="Artikel tidak ditemukan"
                description="Artikel mungkin belum dipublikasikan atau telah dipindahkan."
              />
            )
          ) : (
            <>
              {!query.data?.articles?.length ? (
                <EmptyState icon={Article} title="Belum ada artikel" />
              ) : (
                query.data.articles.map((item) => (
                  <HelpArticleListItem
                    padded={false}
                    key={item.id}
                    title={item.title}
                    href={ROUTES.helpArticle(item.slug ?? item.id, slug)}
                  />
                ))
              )}
              </>
            )}
          </Crossfade>
        </ScrollView>
        {/* F02: kembali ke atas — hanya menggulir, tidak menutup isi. */}
        {article && progress > 0.15 ? (
          <PressableScale
            onPress={scrollToTop}
            accessibilityRole="button"
            accessibilityLabel="Kembali ke atas artikel"
            className="absolute bottom-6 right-5 h-12 w-12 items-center justify-center rounded-full bg-primary"
            style={{ elevation: 4 }}
          >
            <Icon icon={ArrowUp} size="md" tone="inverse" weight="bold" />
          </PressableScale>
        ) : null}
      </View>
    </Screen>
  )
}
