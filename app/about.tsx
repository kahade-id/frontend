/**
 * Kahade — Tentang Kami.
 *
 * Layanan mandiri "Tentang" (sebelumnya menu ini membuka Pusat Bantuan/FAQ).
 * Berisi identitas aplikasi, deskripsi singkat layanan, tautan bantuan &
 * legal, serta info versi (dibaca admin saat pengguna menghubungi dukungan).
 */
import { useCallback } from "react"
import { ScrollView, View } from "react-native"
import Constants from "expo-constants"

import {
  FileText,
  Headset,
  Lifebuoy,
  ShieldCheck,
  ChatTeardropDots,
  ChatCircleDots,
} from "phosphor-react-native"

import { useCopy } from "@/lib/clipboard"
import { ROUTES } from "@/lib/routes"
import { getTelemetryBuffer } from "@/lib/telemetry"
import { installedAppVersion, installedBuildNumber } from "@/lib/runtime-info"
import { tokens } from "@/lib/tokens"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Header } from "@/components/ui/header"
import { Icon, type IconComponent } from "@/components/ui/icon"
import { ListItem } from "@/components/ui/list-item"
import { Logo } from "@/components/ui/logo"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"

type AboutLink = {
  id: string
  title: string
  subtitle?: string
  icon: IconComponent
  href: Parameters<typeof ListItem>[0]["href"]
  divider?: boolean
}

const LINKS: AboutLink[] = [
  {
    id: "faq",
    title: "Pusat Bantuan",
    subtitle: "Artikel dan panduan penggunaan Kahade",
    icon: Lifebuoy,
    href: ROUTES.faq,
    divider: true,
  },
  {
    id: "live-support",
    title: "Asisten Bantuan",
    subtitle: "Panduan otomatis; buat tiket untuk bantuan resmi",
    icon: Headset,
    href: ROUTES.liveSupport,
    divider: true,
  },
  {
    id: "contact",
    title: "Hubungi Kami",
    subtitle: "Buat tiket bantuan resmi",
    icon: ChatCircleDots,
    href: ROUTES.contact,
    divider: true,
  },
  {
    id: "feedback",
    title: "Umpan Balik",
    subtitle: "Saran dan masukan untuk Kahade",
    icon: ChatTeardropDots,
    href: ROUTES.feedback,
    divider: true,
  },
  {
    id: "terms",
    title: "Syarat & Ketentuan",
    icon: FileText,
    href: ROUTES.terms,
    divider: true,
  },
  {
    id: "privacy",
    title: "Kebijakan Privasi",
    icon: ShieldCheck,
    href: ROUTES.privacyPolicy,
  },
]

export default function AboutScreen() {
  const version = installedAppVersion() ?? Constants.expoConfig?.version ?? "—"
  const build = installedBuildNumber()
  const { copy } = useCopy()
  const toast = useToast()
  const events = getTelemetryBuffer()
  /**
   * Panel diagnostik sengaja tidak pernah tampil di produksi tanpa izin
   * eksplisit: jejaknya memuat scope internal (mis. `order:me-fallback`) yang
   * membingungkan pengguna biasa.
   */
  const showDiagnostics =
    __DEV__ || process.env.EXPO_PUBLIC_TELEMETRY_DEBUG === "1"
  const copyAll = useCallback(
    async (value: string) => {
      const ok = await copy(value)
      if (!ok) toast.show({ title: "Gagal menyalin diagnostik", tone: "danger" })
    },
    [copy, toast],
  )

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Tentang Kami" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="gap-5 px-5 py-4"
        contentContainerStyle={{ paddingBottom: tokens.space[8] }}
      >
        {/* Identitas */}
        <Card elevation="flat" className="items-center gap-3 p-6">
          <Logo variant="lockup" size="lg" />
          <Text variant="body" tone="secondary" className="text-center text-pretty">
            Kahade adalah platform transaksi escrow (rekening bersama) yang
            menahan dana pembayaran sampai barang atau jasa benar-benar diterima,
            sehingga jual-beli antar pengguna menjadi aman, terlacak, dan
            dipercaya.
          </Text>
          <Text variant="caption" tone="secondary" className="text-center">
            Transaksi aman, mudah, dan terpercaya.
          </Text>
        </Card>

        {/* Tautan bantuan & legal */}
        <Card padded={false} className="overflow-hidden">
          {LINKS.map((link) => (
            <ListItem
              key={link.id}
              title={link.title}
              subtitle={link.subtitle}
              href={link.href}
              chevron
              divider={link.divider}
              padded
              leading={
                <View className="h-10 w-10 items-center justify-center rounded-sm bg-surface">
                  <Icon icon={link.icon} size="sm" tone="active" />
                </View>
              }
            />
          ))}
        </Card>

        {/*
         * D-02 (audit): sebelum ini `getTelemetryBuffer()` tidak dibaca siapa
         * pun — 50 kegagalan terakhir jatuh ke array memori yang tak pernah
         * dilihat, termasuk saat admin meminta detail masalah. Panel ini
         * memakainya untuk dukungan: hanya tampil di build dev atau bila
         * EXPO_PUBLIC_TELEMETRY_DEBUG=1, dan menyediakan tombol salin supaya
         * pengguna bisa mengirimkan jejaknya tanpa mengetik ulang.
         */}
        {showDiagnostics ? (
          <Card className="gap-2">
            <Text variant="body" weight={600}>
              Diagnostik
            </Text>
            <Text variant="caption" tone="secondary">
              {events.length
                ? `${events.length} kejadian terakhir di perangkat ini (paling baru di bawah).`
                : "Belum ada kejadian tercatat di sesi ini."}
            </Text>
            {events.slice(-5).map((event, index) => (
              <Text key={`${event.at}-${index}`} variant="caption" tone="secondary">
                {`${event.level === "error" ? "!" : "·"} ${event.scope}${
                  event.apiCode ? ` (${event.apiCode})` : ""
                }`}
              </Text>
            ))}
            <Button
              variant="secondary"
              onPress={() => void copyAll(JSON.stringify(events, null, 2))}
              disabled={!events.length}
            >
              Salin diagnostik
            </Button>
          </Card>
        ) : null}

        {/* Info versi — data yang ditanyakan admin saat membantu */}
        <View className="items-center gap-1">
          <Text variant="caption" tone="secondary">
            Kahade versi {version}
            {build ? ` (${build})` : ""}
          </Text>
          <Text variant="caption" tone="secondary">
            © {new Date().getFullYear()} Kahade. Seluruh hak cipta dilindungi.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  )
}
