/** Preferensi lokal tetap bisa diubah saat preferensi server sedang dimuat/gagal. */
import { View } from "react-native"

import { PrivacyToggleList } from "@/components/ui/privacy-toggle-list"
import { SectionHeader } from "@/components/ui/section"
import { translate, useLanguage } from "@/lib/i18n"
import {
  LOCAL_NOTIFICATION_KINDS,
  setLocalNotificationPref,
  useLocalNotificationPrefs,
  type LocalNotificationKind,
} from "@/lib/notification-local-prefs"

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
    description: "Suka dan komentar pada etalase Anda.",
  },
  promo: {
    title: "Promo",
    description: "Voucher, cashback, langganan, dan penawaran lainnya.",
  },
}

export function DeviceNotificationSettings() {
  useLanguage()
  const prefs = useLocalNotificationPrefs()

  return (
    <View className="gap-4">
      <SectionHeader
        title={translate("Perangkat ini")}
        subtitle={translate("Banner saat aplikasi terbuka. Tidak mengubah kiriman notifikasi dari server.")}
      />
      <PrivacyToggleList<LocalNotificationKind>
        items={LOCAL_NOTIFICATION_KINDS.map((kind) => ({
          key: kind,
          title: translate(KIND_COPY[kind].title),
          description: translate(KIND_COPY[kind].description),
        }))}
        value={prefs}
        onChange={setLocalNotificationPref}
      />
    </View>
  )
}
