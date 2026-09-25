/**
 * Kahade — Tabs Layout (kerangka navigasi utama).
 *
 * Expo Router `<Tabs>` dengan `tabBar` kini dipusatkan di root (_layout
 * PersistentShellBar) agar tetap ada saat navigasi ke stack shell
 * (chat/vouchers/wallet-history/own profile) — sebelumnya bar dibuat
 * PER HALAMAN (Tabs bar + per-page <ShellTabBar/>) sehingga klik history
 * membuat bar ikut hilang. TabBar di sini hanya mendaftarkan navigator
 * untuk parkir, tanpa merender UI.
 *
 * `showcase` tetap terdaftar sebagai Tabs.Screen (rute /showcase hidup) tetapi
 * bukan slot commerce yang terlihat sampai mode commerce memilihnya sebagai
 * primer. Highlight slot datang dari pathname, bukan index tab.
 *
 * Unread tetap dipoll SEKALI di layout ini (beberapa pemasangan = beberapa
 * timer). Badge Pesan membaca store yang sama.
 */
import { useCallback, useEffect, type ComponentProps } from "react"
import { Tabs } from "expo-router"

import { TAB_ROUTE_NAMES } from "@/lib/routes"
import { useAuthSession } from "@/lib/use-auth-session"
import { useUnreadCount } from "@/lib/unread-count"
import { registerShellTabNavigator } from "@/lib/app-mode"
import type { ShellTabNavigation } from "@/components/ui/shell-tab-bar"

type TabsTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0]

function TabsRegistrar({ navigation }: { navigation: ShellTabNavigation }) {
  useEffect(() => {
    registerShellTabNavigator(navigation)
    return () => registerShellTabNavigator(null)
  }, [navigation])
  return null
}

export default function TabsLayout() {
  // B-05: poll DIGATE sesi — tamu web tidak menembak endpoint auth tiap 60 dtk.
  const session = useAuthSession()
  useUnreadCount({ enabled: Boolean(session.token) })

  const renderTabBar = useCallback(
    (props: TabsTabBarProps) => <TabsRegistrar navigation={props.navigation} />,
    [],
  )

  return (
    <Tabs
      initialRouteName="showcase"
      screenOptions={{
        headerShown: false,
      }}
      tabBar={renderTabBar}
    >
      {TAB_ROUTE_NAMES.map((name) => (
        <Tabs.Screen key={name} name={name} />
      ))}
    </Tabs>
  )
}
