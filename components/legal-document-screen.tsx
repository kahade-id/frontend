/**
 * Kahade — <LegalDocumentScreen>: pembaca dokumen legal native.
 *
 * Syarat & Ketentuan dan Kebijakan Privasi dirender penuh di dalam aplikasi
 * memakai design system Kahade (bukan file, bukan WebView) — atas permintaan
 * produk 2026-09-28. Konten berasal dari draf v1.0 (27 Sep 2026) yang
 * dibangkitkan ke `lib/legal/*-content.ts` via tools/gen-legal-content.py.
 *
 * Konten S&K dan Privasi dibundel statis agar seluruh dokumen tersedia pada
 * first-launch tanpa jaringan; render tidak melewati spinner atau fetch.
 * Trade-off yang disengaja: kedua dokumen ikut masuk ke bundle aplikasi.
 *
 * UX: hero dokumen + ringkasan (bila ada) + Daftar Isi inline + isi pasal +
 * FAB "Daftar Isi" (bottom sheet, lompat ke pasal) + bar progres baca tipis
 * di bawah header. Tidak ada logika persetujuan di sini — layar ini murni
 * pembaca; pencatatan consent tetap di alur registrasi/transaksi.
 */
import { useCallback, useMemo, useRef, useState } from "react"
import { ScrollView, View, type ScrollViewInstance } from "react-native"
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated"
import { ArrowUp, FileText, List, ShieldCheck } from "phosphor-react-native"

import { useTheme } from "@/components/theme-provider"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Header } from "@/components/ui/header"
import { Icon } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { Emphasis } from "@/components/ui/typography"
import { accent } from "@/lib/tokens"
import { PRIVACY_CONTENT, type LegalDocData } from "@/lib/legal/privacy-content"
import { TERMS_CONTENT } from "@/lib/legal/terms-content"

/** Dokumen dibundel dan dipilih sinkron agar pembaca tidak menunggu jaringan atau chunk. */
export function LegalDocumentScreen({ kind }: { kind: "terms" | "privacy" }) {
  const doc: LegalDocData = kind === "terms" ? TERMS_CONTENT : PRIVACY_CONTENT
  return <LegalDocumentContent kind={kind} doc={doc} />
}

function LegalDocumentContent({ kind, doc }: { kind: "terms" | "privacy"; doc: LegalDocData }) {
  const { mode } = useTheme()
  const HeroIcon = kind === "terms" ? FileText : ShieldCheck

  const scrollRef = useRef<ScrollViewInstance>(null)
  const sectionY = useRef<Record<string, number>>({})
  const [tocOpen, setTocOpen] = useState(false)

  // ── Progres baca (UI thread, tanpa re-render) ──────────────────────────
  const progress = useSharedValue(0)
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (e) => {
      const max = e.contentSize.height - e.layoutMeasurement.height
      progress.value = max > 0 ? Math.min(1, Math.max(0, e.contentOffset.y / max)) : 0
    },
  })
  const barStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }))

  // ── Daftar isi datar (part → pasal) untuk TOC inline & sheet ───────────
  const toc = useMemo(
    () =>
      doc.parts.flatMap((part) =>
        part.sections.map((s) => ({ part: part.title, id: s.id, title: s.title })),
      ),
    [doc],
  )

  const jumpTo = useCallback((id: string | null) => {
    setTocOpen(false)
    // Beri waktu sheet menutup sebelum melompat.
    setTimeout(() => {
      const y = id == null ? 0 : sectionY.current[id] ?? 0
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 4), animated: true })
    }, 220)
  }, [])

  const rememberY = useCallback(
    (id: string) => (e: { nativeEvent: { layout: { y: number } } }) => {
      sectionY.current[id] = e.nativeEvent.layout.y
    },
    [],
  )

  const renderParagraph = (p: LegalDocData["intro"][number], key: string) => (
    <Text key={key} variant="body" className="leading-7">
      {p.segments.map((seg, i) =>
        seg.bold ? (
          <Emphasis key={i} weight={700} italic={seg.italic || undefined}>
            {seg.text}
          </Emphasis>
        ) : seg.italic ? (
          <Text key={i} variant="inherit" italic>
            {seg.text}
          </Text>
        ) : (
          seg.text
        ),
      )}
    </Text>
  )

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title={doc.title} />
      {/* Bar progres baca — inline backgroundColor (aman di web, lihat AGENTS.md). */}
      <View className="h-[3px] w-full bg-transparent">
        <Animated.View style={[{ height: 3, backgroundColor: accent[mode].fill }, barStyle]} />
      </View>

      <View className="flex-1">
        <Animated.ScrollView
          ref={scrollRef}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          <View className="gap-6 px-5 pt-5">
            {/* ── Hero dokumen ── */}
            <View className="gap-4 rounded-lg bg-surface-elevated p-5">
              <View className="flex-row items-center gap-4">
                <View className="h-14 w-14 items-center justify-center rounded-lg bg-accent-soft">
                  <Icon icon={HeroIcon} size="lg" tone="active" weight="duotone" />
                </View>
                <View className="flex-1 gap-1">
                  <Text variant="h2" accessibilityRole="header">{doc.title}</Text>
                  <Text variant="caption" tone="secondary">
                    {doc.company}
                  </Text>
                </View>
              </View>
              <View className="flex-row flex-wrap gap-2">
                <View className="rounded-full bg-accent-soft px-3 py-1">
                  <Text variant="caption" weight={600}>
                    {doc.versionLabel}
                  </Text>
                </View>
                <View className="rounded-full bg-accent-soft px-3 py-1">
                  <Text variant="caption" tone="secondary">
                    {doc.effectiveLabel}
                  </Text>
                </View>
              </View>
            </View>

            {/* ── Intro ── */}
            {doc.intro.length > 0 ? (
              <View className="gap-3">
                {doc.intro.map((p, i) => renderParagraph(p, `intro-${i}`))}
              </View>
            ) : null}

            {/* ── Ringkasan utama (kartu sorot) ── */}
            {doc.summary ? (
              <View className="gap-3 rounded-lg border-l-4 border-accent bg-accent-soft p-5">
                <Text variant="bodyLarge" weight={700}>
                  {doc.summary.title}
                </Text>
                {doc.summary.paragraphs.map((p, i) => renderParagraph(p, `sum-${i}`))}
              </View>
            ) : null}

            {/* ── Daftar Isi inline ── */}
            <View className="gap-3">
              <Text variant="h3" accessibilityRole="header">Daftar Isi</Text>
              <View className="overflow-hidden rounded-lg bg-surface-elevated">
                {doc.parts.map((part) => (
                  <View key={part.id}>
                    <View className="px-5 pb-1 pt-4">
                      {/* TYP-010: tanpa ALL CAPS (§3.2) — hierarki cukup dari weight/size. */}
                      <Text variant="caption" weight={700} tone="secondary">
                        {part.title}
                      </Text>
                    </View>
                    {part.sections.map((s) => {
                      const n = toc.findIndex((t) => t.id === s.id) + 1
                      return (
                        <PressableScale
                          key={s.id}
                          onPress={() => jumpTo(s.id)}
                          accessibilityRole="button"
                          accessibilityLabel={`Ke bagian ${s.title}`}
                          className="flex-row items-center gap-3 border-t border-border px-5 py-3"
                        >
                          <View className="h-7 w-7 items-center justify-center rounded-full bg-accent-soft">
                            <Text variant="caption" weight={700}>
                              {n}
                            </Text>
                          </View>
                          <Text variant="body" weight={500} className="flex-1">
                            {s.title}
                          </Text>
                        </PressableScale>
                      )
                    })}
                  </View>
                ))}
              </View>
            </View>

            {/* ── Isi pasal ── */}
            {doc.parts.map((part) => (
              <View key={part.id} className="gap-6">
                <View className="flex-row items-center gap-3 pt-2">
                  <View className="h-6 w-1 rounded-full bg-accent" />
                  {/* TYP-010: tanpa ALL CAPS (§3.2). */}
                  <Text variant="bodyLarge" weight={700} className="flex-1">
                    {part.title}
                  </Text>
                </View>
                {part.sections.map((s) => (
                  <View key={s.id} onLayout={rememberY(s.id)} className="gap-3">
                    <Text variant="bodyLarge" weight={700} accessibilityRole="header">
                      {s.title}
                    </Text>
                    {s.paragraphs.map((p, i) => renderParagraph(p, `${s.id}-${i}`))}
                  </View>
                ))}
              </View>
            ))}

            {/* ── Penutup ── */}
            <View className="items-center gap-3 pb-4 pt-2">
              <PressableScale
                onPress={() => jumpTo(null)}
                accessibilityRole="button"
                accessibilityLabel="Kembali ke atas"
                className="flex-row items-center gap-2 rounded-full bg-surface-elevated px-5 py-3"
              >
                <Icon icon={ArrowUp} size="sm" tone="active" weight="bold" />
                <Text variant="body" weight={600}>
                  Kembali ke atas
                </Text>
              </PressableScale>
              <Text variant="caption" tone="secondary" className="text-center">
                {doc.title} • {doc.versionLabel} • {doc.company}
              </Text>
            </View>
          </View>
        </Animated.ScrollView>

        {/* ── FAB Daftar Isi ── */}
        <PressableScale
          onPress={() => setTocOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Buka daftar isi"
          className="absolute bottom-6 right-5 h-14 w-14 items-center justify-center rounded-full bg-accent"
        >
          <Icon icon={List} size="md" weight="bold" color={accent[mode].onFill} />
        </PressableScale>
      </View>

      {/* ── Bottom sheet Daftar Isi ── */}
      <BottomSheet
        visible={tocOpen}
        onRequestClose={() => setTocOpen(false)}
        title="Daftar Isi"
        description="Ketuk untuk lompat ke bagian"
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <PressableScale
            onPress={() => jumpTo(null)}
            accessibilityRole="button"
            accessibilityLabel="Kembali ke atas dokumen"
            className="flex-row items-center gap-3 border-b border-border py-3"
          >
            <Icon icon={ArrowUp} size="sm" tone="active" weight="bold" />
            <Text variant="body" weight={600}>
              Kembali ke atas
            </Text>
          </PressableScale>
          {doc.parts.map((part) => (
            <View key={part.id}>
              <View className="pb-1 pt-4">
                {/* TYP-010: tanpa ALL CAPS (§3.2) — hierarki cukup dari weight/size. */}
                <Text variant="caption" weight={700} tone="secondary">
                  {part.title}
                </Text>
              </View>
              {part.sections.map((s) => {
                const n = toc.findIndex((t) => t.id === s.id) + 1
                return (
                  <PressableScale
                    key={s.id}
                    onPress={() => jumpTo(s.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Ke bagian ${s.title}`}
                    className="flex-row items-center gap-3 border-t border-border py-3"
                  >
                    <View className="h-7 w-7 items-center justify-center rounded-full bg-accent-soft">
                      <Text variant="caption" weight={700}>
                        {n}
                      </Text>
                    </View>
                    <Text variant="body" className="flex-1">
                      {s.title}
                    </Text>
                  </PressableScale>
                )
              })}
            </View>
          ))}
        </ScrollView>
      </BottomSheet>
    </Screen>
  )
}
