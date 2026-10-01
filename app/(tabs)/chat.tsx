/**
 * Kahade — tab /chat (THIN SHELL, PERF-FIX 2026-09-30).
 *
 * Lihat penjelasan pola di app/scan.tsx: di native, expo-router mengevaluasi
 * semua modul rute saat boot. Implementasi tab Pesan (±1230 baris) dimuat
 * via React.lazy sehingga dievaluasi HANYA saat tab pertama kali dibuka,
 * bukan saat boot (tab awal = showcase).
 *
 * Jangan menambahkan import berat di file ini.
 */
import { Suspense, lazy } from "react"

import { Screen } from "@/components/ui/screen"
import { ChatTabListSkeleton } from "@/components/ui/tab-loading-skeletons"

const ChatTabScreen = lazy(() => import("@/components/screens/chat-tab-screen"))

export default function ChatTabRoute() {
  return (
    <Suspense
      fallback={
        <Screen edges={["top"]} padded={false}>
          <ChatTabListSkeleton />
        </Screen>
      }
    >
      <ChatTabScreen />
    </Suspense>
  )
}
