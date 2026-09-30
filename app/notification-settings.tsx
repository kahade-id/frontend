/**
 * Screen — Notifikasi Perangkat Ini (toggle granular per jenis, lokal).
 *
 * PENTING: ini PREFERENSI LOKAL perangkat (SecureStore), bukan preferensi
 * server. Toggle di sini hanya menahan banner + entri tray sistem untuk
 * notifikasi yang tiba saat aplikasi FOREGROUND (lihat
 * lib/notification-local-prefs.ts). Push yang tiba saat aplikasi
 * background/tertutup tetap dikirim dan ditampilkan menurut preferensi
 * SERVER — kelola lewat layar "Preferensi Notifikasi".
 *
 * Tidak ada fetch di sini: murni state perangkat, seperti app/appearance.tsx
 * — <Screen> biasa, bukan <DataScreen>.
 */
import { useCallback } from "react"
import { View } from "react-native"
import { useRouter } from "expo-router"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Header } from "@/components/ui/header"
import { PrivacyToggleList } from "@/components/ui/privacy-toggle-list"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { translate, useLanguage } from "@/lib/i18n"
import {
  LOCAL_NOTIFICATION_KINDS,
  setLocalNotificationPref,
  useLocalNotificationPrefs,
  type LocalNotificationKind,
} from "@/lib/notification-local-prefs"
import { ROUTES } from "@/lib/routes"

const KIND_COPY: Record<LocalNotificationKind, { title: string; description: string }> = {
  chat: {
    title: "Chat",
    description: "Banner pesan chat baru dari lawan transaksi atau admin.",
  },
  transaction: {
    title: "Transaksi",
    description: "Status pesanan, escrow, dompet, sengketa, dan ulasan.",
  },
  showcase: {
    title: "Etalase",
    description: "Suka dan komentar pada karya etalase.",
  },
  promo: {
    title: "Promo",
    description: "Voucher, cashback, langganan, dan penawaran lainnya.",
  },
}

export default function NotificationSettingsScreen() {
  // Ikut re-render saat bahasa berganti (pola app/badges.tsx).
  useLanguage()
  const router = useRouter()
  const prefs = useLocalNotificationPrefs()

  const handleChange = useCallback((key: LocalNotificationKind, next: boolean) => {
    setLocalNotificationPref(key, next)
  }, [])

  return (
    <Screen edges={["top"]}>
      <Header title={translate("Notifikasi Perangkat Ini")} />
      <View className="gap-4 px-5 pt-3">
        <SectionHeader
          title={translate("Jenis notifikasi")}
          subtitle={translate("Pilih jenis notifikasi yang tampil sebagai banner di perangkat ini.")}
        />
        <PrivacyToggleList<LocalNotificationKind>
          items={LOCAL_NOTIFICATION_KINDS.map((kind) => ({
            key: kind,
            title: translate(KIND_COPY[kind].title),
            description: translate(KIND_COPY[kind].description),
          }))}
          value={prefs}
          onChange={(key, next) => handleChange(key, next)}
        />
        <Alert
          tone="neutral"
          title={translate("Hanya berlaku di perangkat ini")}
          action={
            <Button
              size="sm"
              variant="secondary"
              onPress={() => router.push(ROUTES.notificationPreferences)}
            >
              {translate("Kelola preferensi server")}
            </Button>
          }
        >
          <Text variant="body" tone="secondary">
            {translate(
              "Toggle di atas tidak menghentikan push dari server. Untuk mengatur notifikasi yang dikirim ke semua perangkat Anda, gunakan preferensi server.",
            )}
          </Text>
        </Alert>
      </View>
    </Screen>
  )
}
