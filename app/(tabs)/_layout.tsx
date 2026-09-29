/**
 * Kahade — Tabs Layout (kerangka navigasi utama).
 *
 * Expo Router `<Tabs>` dengan `tabBar` kini dipusatkan di root (_layout
 * PersistentShellBar) agar tetap ada saat navigasi ke stack shell
 * (chat/vouchers/wallet-history/own profile) — sebelumnya bar dibuat
 * PER HALAMAN (Tabs bar + per-page <ShellTabBar/>) sehingga klik history
 * membuat bar ikut hilang.
 *
 * NAV-011 (2026-09-28): pendaftaran navigator tab untuk "parkir mode"
 * dihapus bersama mesin mode-switcher yang mati — tabBar di sini murni
 * menekan bar bawaan Tabs (return null), tanpa merender UI.
 *
 * Unread tetap dipoll SEKALI di layout ini (beberapa pemasangan = beberapa
 * timer). Badge Pesan membaca store yang sama.
 */
import { Tabs } from "expo-router"

import { TAB_ROUTE_NAMES } from "@/lib/routes"
import { useAuthSession } from "@/lib/use-auth-session"
import { useUnreadCount } from "@/lib/unread-count"
import { useChatUnreadCount } from "@/lib/chat-unread-count"

export default function TabsLayout() {
  // B-05: poll DIGATE sesi — tamu web tidak menembak endpoint auth tiap 60 dtk.
  const session = useAuthSession()
  useUnreadCount({ enabled: Boolean(session.token) })
  // CN-011: badge tab Pesan memakai unread CHAT (bukan total notifikasi).
  useChatUnreadCount({ enabled: Boolean(session.token) })

  return (
    <Tabs
      initialRouteName="showcase"
      screenOptions={{
        headerShown: false,
        // PERF-FIX (P2 nav): kontrak eksplisit — tab di-mount malas saat
        // pertama dibuka dan di-freeze saat blur (bukan unmount: state tab
        // tetap, tapi render berhenti). Tanpa ini, perilaku mount tab
        // implisit mengikuti default expo-router yang bisa berubah.
        lazy: true,
        freezeOnBlur: true,
      }}
      // Bar bawaan Tabs ditekan — bar asli dirender sekali di root layout
      // (PersistentShellBar) supaya tetap ada di stack shell.
      tabBar={() => null}
    >
      {TAB_ROUTE_NAMES.map((name) => (
        <Tabs.Screen key={name} name={name} />
      ))}
    </Tabs>
  )
}
