/**
 * Kahade — Tabs Layout (kerangka navigasi utama).
 *
 * Expo Router `<Tabs>` dengan `tabBar` = <ShellTabBar>. Lima slot tetap;
 * isi slot (ikon, label, tujuan) mengikuti `appMode`. Profil tidak lagi
 * memakai listener `tabPress` di sini — penekanan profil hidup di ShellTabBar
 * supaya discover tidak terfokus dan `getMe` tidak dipanggil dua kali.
 *
 * `showcase` tetap terdaftar sebagai Tabs.Screen (rute /showcase hidup) tetapi
 * bukan slot commerce yang terlihat sampai mode commerce memilihnya sebagai
 * primer. Highlight slot datang dari pathname, bukan index tab.
 *
 * Unread tetap dipoll SEKALI di layout ini (beberapa pemasangan = beberapa
 * timer). Badge Pesan membaca store yang sama.
 */
import { useCallback, type ComponentProps } from "react"
import { Tabs } from "expo-router"

import { ShellTabBar } from "@/components/ui/shell-tab-bar"
import { TAB_ROUTE_NAMES } from "@/lib/routes"
import { useAuthSession } from "@/lib/use-auth-session"
import { useUnreadCount } from "@/lib/unread-count"

type TabsTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0]

export default function TabsLayout() {
  // B-05: poll DIGATE sesi — tamu web tidak menembak endpoint auth tiap 60 dtk.
  const session = useAuthSession()
  useUnreadCount({ enabled: Boolean(session.token) })

  const renderTabBar = useCallback(
    (props: TabsTabBarProps) => <ShellTabBar navigation={props.navigation} />,
    [],
  )

  return (
    <Tabs
      initialRouteName="home"
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
