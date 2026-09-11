/**
 * Kahade — Tentang Kami.
 *
 * Layanan mandiri "Tentang" (sebelumnya menu ini membuka Pusat Bantuan/FAQ).
 * Berisi identitas aplikasi, deskripsi singkat layanan, tautan bantuan &
 * legal, serta info versi (dibaca admin saat pengguna menghubungi dukungan).
 */
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

import { ROUTES } from "@/lib/routes"
import { installedAppVersion, installedBuildNumber } from "@/lib/runtime-info"
import { tokens } from "@/lib/tokens"

import { Card } from "@/components/ui/card"
import { Header } from "@/components/ui/header"
import { Icon, type IconComponent } from "@/components/ui/icon"
import { ListItem } from "@/components/ui/list-item"
import { Logo } from "@/components/ui/logo"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"

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
    title: "Dukungan Langsung",
    subtitle: "Chat langsung dengan admin Kahade",
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

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Tentang Kami" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="gap-5 px-6 py-4"
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
