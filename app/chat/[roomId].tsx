/**
 * Kahade — rute /chat/[roomId] (THIN SHELL, PERF-FIX 2026-09-30).
 *
 * Lihat penjelasan pola di app/scan.tsx: di native, expo-router mengevaluasi
 * semua modul rute saat boot. Implementasi layar chat room (±3000 baris +
 * expo-document-picker + ~10 sheets) dimuat via React.lazy sehingga
 * dievaluasi HANYA saat pengguna pertama kali membuka chat, bukan saat boot.
 *
 * Jangan menambahkan import berat di file ini.
 */
import { Suspense, lazy } from "react"
import { useLocalSearchParams } from "expo-router"
import { View } from "react-native"

import { DetailLoading } from "@/components/ui/paginated-list"

const ChatRoomScreen = lazy(() => import("@/components/screens/chat-room-screen"))

export default function ChatRoomRoute() {
  const { roomId } = useLocalSearchParams<{ roomId?: string | string[] }>()
  // One route component instance must represent one room. The screen owns
  // room-scoped composer text, uploads, replies, selections and overlays; a
  // dynamic-route param update without this key would carry that state into a
  // different conversation.
  const roomKey = Array.isArray(roomId) ? (roomId[0] ?? "missing") : (roomId ?? "missing")

  return (
    <Suspense
      fallback={
        <View className="flex-1 px-5 pt-6">
          <DetailLoading />
        </View>
      }
    >
      <ChatRoomScreen key={roomKey} />
    </Suspense>
  )
}
