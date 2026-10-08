/**
 * Kahade — overlay orientasi first-run di feed (U5-005, journey 2026-09-29).
 *
 * Tampil SEKALI (flag `feedOrientationSeen`, lib/first-run.ts) saat user
 * pertama kali mendarat di feed Etalase: 3 kartu konsep inti + 1 baris
 * penjelasan tiap tab. Copy Bahasa Indonesia singkat — ditulis untuk temuan
 * ini, bukan dari tempat lain.
 *
 * Urutan first-run di feed (ShowcaseFeedTab): overlay ini DULU, lalu bottom
 * sheet rationale notifikasi (U5-003), lalu coach mark orientasi beli
 * (U5-004) — tidak tampil bertumpuk.
 */
import { useCallback } from "react"
import { Animated, ScrollView, View } from "react-native"
import { Eye, Plus, ShieldCheck, Storefront, X } from "phosphor-react-native"

import { Backdrop, useOverlayDismissKeys, useOverlayPresence } from "@/components/ui/backdrop"
import { Button } from "@/components/ui/button"
import { Heading } from "@/components/ui/heading"
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { Portal } from "@/components/ui/portal"
import { Text } from "@/components/ui/text"
import { SHELL_TABS, type ShellTabKey } from "@/lib/shell-tabs"
import { tokens } from "@/lib/tokens"
import { useTheme } from "@/components/theme-provider"
import { elevationStyle } from "@/lib/elevation"
import { translate } from "@/lib/i18n/translate"
import { useLanguage } from "@/lib/i18n"

/**
 * 1 baris penjelasan per tab — kunci = ShellTabKey (sinkron dengan label).
 * Fungsi (bukan konstanta) agar literalnya masuk katalog i18n dan ikut
 * bahasa aktif saat dirender.
 */
const tabBlurbs = (): Record<ShellTabKey, string> => ({
  showcase: translate("Feed barang & etalase — lihat, suka, beli"),
  transactions: translate("Pesanan Anda & status pembayarannya"),
  chat: translate("Chat dengan penjual & pembeli"),
  notifications: translate("Kabar transaksi & pesan penting"),
})

const concepts = () =>
  [
    {
      icon: Eye,
      title: translate("Lihat & beli barang"),
      body: translate("Ketuk barang di feed untuk lihat detail, lalu bayar aman via Kahade."),
    },
    {
      icon: Storefront,
      title: translate("Jual lewat etalase"),
      body: translate("Unggah barang lewat tombol +, terima order, kirim setelah dibayar."),
    },
    {
      icon: ShieldCheck,
      title: translate("Semua pembayaran via Kahade"),
      body: translate("Dana pembeli aman di Kahade sampai barang diterima. Tanpa transfer langsung."),
    },
  ] as const

export function FeedOrientationOverlay({
  visible,
  onDismiss,
}: {
  visible: boolean
  onDismiss: () => void
}) {
  const { mode } = useTheme()
  // i18n: blurb & konsep dibangun ulang saat bahasa berganti.
  useLanguage()
  const { mounted, progress } = useOverlayPresence(visible)
  const dismiss = useCallback(() => onDismiss(), [onDismiss])
  useOverlayDismissKeys(visible, dismiss)

  if (!mounted) return null
  const blurbs = tabBlurbs()
  return (
    <Portal>
      <Backdrop progress={progress} onPress={dismiss} accessibilityLabel={translate("Tutup orientasi")} />
      <Animated.View
        className="absolute inset-0 items-center justify-center px-6"
        style={{ opacity: progress, pointerEvents: "box-none" }}
      >
        <Animated.View
          accessibilityRole="alert"
          accessibilityLabel={translate("Orientasi Kahade")}
          className="w-full max-w-md rounded-lg bg-background"
          style={[
            elevationStyle("high", mode),
            {
              transform: [
                {
                  translateY: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [24, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View className="flex-row items-start justify-between gap-3 px-5 pt-5">
            <View className="flex-1 gap-1">
              <Heading level={2}>Kenalan dulu dengan Kahade</Heading>
              <Text variant="caption" tone="secondary" className="text-pretty">
                Tiga hal yang perlu Anda tahu sebelum mulai.
              </Text>
            </View>
            <IconButton
              icon={X}
              accessibilityLabel={translate("Tutup orientasi")}
              onPress={dismiss}
            />
          </View>

          <ScrollView
            className="max-h-96"
            contentContainerClassName="gap-3 px-5 py-4"
            showsVerticalScrollIndicator={false}
          >
            {concepts().map((c) => (
              <View
                key={c.title}
                className="flex-row items-start gap-3 rounded-md border border-border bg-surface-elevated px-4 py-3"
              >
                <View className="h-10 w-10 items-center justify-center rounded-full bg-accent-soft">
                  <Icon icon={c.icon} size="md" tone="active" />
                </View>
                <View className="flex-1 gap-0.5">
                  <Text variant="body" weight={600}>
                    {c.title}
                  </Text>
                  <Text variant="caption" tone="secondary" className="text-pretty">
                    {c.body}
                  </Text>
                </View>
              </View>
            ))}

            <View className="gap-2 rounded-md bg-surface px-4 py-3">
              <Text variant="caption" weight={600} tone="secondary">
                Isi menu bawah
              </Text>
              {SHELL_TABS.map((tab) => (
                <View key={tab.key} className="flex-row items-center gap-2">
                  <Icon icon={tab.icon} size="sm" tone="default" />
                  <Text variant="caption" tone="secondary" className="flex-1 text-pretty">
                    <Text variant="caption" weight={600}>
                      {tab.label}
                    </Text>
                    {" — "}
                    {blurbs[tab.key]}
                  </Text>
                </View>
              ))}
              <View className="flex-row items-center gap-2">
                <Icon icon={Plus} size="sm" tone="default" />
                <Text variant="caption" tone="secondary" className="flex-1 text-pretty">
                  <Text variant="caption" weight={600}>
                    Tombol +
                  </Text>
                  {" — buat etalase, buat transaksi, isi saldo"}
                </Text>
              </View>
            </View>
          </ScrollView>

          <View className="px-5 pb-5" style={{ paddingBottom: tokens.space[5] }}>
            <Button fullWidth onPress={dismiss}>
              Mengerti, mulai jelajah
            </Button>
          </View>
        </Animated.View>
      </Animated.View>
    </Portal>
  )
}
