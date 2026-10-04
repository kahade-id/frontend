/**
 * Kahade — Chat dengan tim Kahade.
 *
 * GELOMBANG 2: client websocket.
 *
 * Shell gelombang 1 (Poin 5, 2026-10-04): layar ini BELUM diisi dengan client
 * chat. Yang tampil ke user adalah PESAN JUJUR bahwa chat sedang disiapkan —
 * BUKAN chat palsu (polling tiket yang disamarkan jadi chat, dulu
 * app/live-support.tsx — sudah dihapus) dan bukan fitur yang pura-pura jadi.
 * Tidak ada dead-end: shell ini menawarkan jalan keluar yang nyata (cari di
 * FAQ, pusat bantuan web) + tombol kembali bawaan Header.
 *
 * Kontrak gelombang 2: isi layar ini dengan client websocket penuh
 * (backend dikerjakan paralel). Saat itu, daftarkan "support-chat" di
 * AUTHENTICATED_SCREENS (lib/protected-routes.ts) — chat butuh sesi —
 * dan hapus penanda shell ini.
 */
import { Linking, View } from "react-native"
import { router } from "expo-router"
import { ChatCircleText } from "phosphor-react-native"

import { safeExternalUrl } from "@/lib/external-url"
import { translate } from "@/lib/i18n"
import { ROUTES } from "@/lib/routes"

import { Button } from "@/components/ui/button"
import { Header } from "@/components/ui/header"
import { Icon } from "@/components/ui/icon"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { TextLink } from "@/components/ui/text-link"

/** Sama seperti di app/faq.tsx — sumber konten terpusat. */
const HELP_SITE_URL = "https://bantuan.kahade.id"

function openHelpSite() {
  const url = safeExternalUrl(HELP_SITE_URL, {
    allow: ["https:"],
    hosts: ["bantuan.kahade.id"],
  })
  if (url) void Linking.openURL(url).catch(() => undefined)
}

export default function SupportChatScreen() {
  return (
    <Screen edges={["top"]} padded={false}>
      <Header title={translate("Chat dengan tim Kahade")} />
      <View className="flex-1 items-center justify-center gap-4 px-8">
        <View className="h-16 w-16 items-center justify-center rounded-full bg-surface">
          <Icon icon={ChatCircleText} size={32} tone="active" />
        </View>
        <Text variant="h3" className="text-center">
          {translate("Chat segera hadir")}
        </Text>
        <Text variant="body" tone="secondary" className="text-center">
          {translate(
            "Kami sedang menyiapkan chat dengan tim Kahade. Untuk saat ini, cari jawaban di FAQ atau kunjungi pusat bantuan web kami.",
          )}
        </Text>
        <View className="items-center gap-3 pt-2">
          <Button fullWidth={false} onPress={() => router.push(ROUTES.faq)}>
            {translate("Cari di FAQ")}
          </Button>
          <TextLink
            inline
            onPress={openHelpSite}
            accessibilityLabel={translate("Buka bantuan.kahade.id di peramban")}
          >
            bantuan.kahade.id
          </TextLink>
        </View>
      </View>
    </Screen>
  )
}
