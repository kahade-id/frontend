/**
 * Kahade — layout panel admin (§admin).
 *
 * Stack khusus admin + guard sesi: tanpa token admin → redirect ke
 * /admin/login. Guard berjalan saat mount; selama pengecekan tampilkan
 * loading agar tidak ada kedip konten terproteksi.
 */
import { useEffect, useState } from "react"
import { View, ActivityIndicator } from "react-native"
import { Stack, router, usePathname } from "expo-router"

import { isAdminLoggedIn, adminLogout } from "@/lib/api/admin/auth"
import { translate } from "@/lib/i18n/translate"

export default function AdminPanelLayout() {
  const [checked, setChecked] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    let cancelled = false
    isAdminLoggedIn().then((ok) => {
      if (cancelled) return
      if (!ok) {
        router.replace("/admin/login")
      } else {
        setChecked(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [pathname])

  if (!checked) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator accessibilityLabel={translate("Memuat panel admin")} />
      </View>
    )
  }

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitle: translate("Kembali"),
      }}
    >
      <Stack.Screen name="index" options={{ title: translate("Dasbor Admin") }} />
      <Stack.Screen name="kyc/index" options={{ title: translate("Antrean KYC") }} />
      <Stack.Screen name="kyc/[id]" options={{ title: translate("Detail KYC") }} />
      <Stack.Screen name="business/index" options={{ title: translate("Verifikasi Bisnis") }} />
      <Stack.Screen name="business/[id]" options={{ title: translate("Detail Verifikasi") }} />
      <Stack.Screen name="disputes/index" options={{ title: translate("Sengketa") }} />
      <Stack.Screen name="disputes/[id]" options={{ title: translate("Detail Sengketa") }} />
      <Stack.Screen name="tickets/index" options={{ title: translate("Tiket Bantuan") }} />
      <Stack.Screen name="tickets/[id]" options={{ title: translate("Detail Tiket") }} />
      <Stack.Screen name="reports/index" options={{ title: translate("Laporan Pengguna") }} />
      <Stack.Screen name="reports/[id]" options={{ title: translate("Detail Laporan") }} />
      <Stack.Screen name="chat/index" options={{ title: translate("Moderasi Chat") }} />
      <Stack.Screen name="badges/index" options={{ title: translate("Badge & Centang Emas") }} />
    </Stack>
  )
}

/** Dipakai tombol keluar di dasbor. */
export async function logoutAdminAndRedirect(): Promise<void> {
  await adminLogout()
  router.replace("/admin/login")
}
