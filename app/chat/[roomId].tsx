/**
 * Kahade — rute /chat/[roomId] (THIN SHELL, PERF-FIX 2026-09-30).
 *
 * Lihat penjelasan pola di app/scan.tsx: di native, expo-router mengevaluasi
 * semua modul rute saat boot. Implementasi layar chat room (±3000 baris +
 * expo-document-picker + ~10 sheets) dimuat via React.lazy sehingga
 * dievaluasi HANYA saat pengguna pertama kali membuka chat, bukan saat boot.
 *
 * Jangan menambahkan import berat di file ini.
 *
 * Audit chat I23 ("layar kosong saat buka ruang"): selama chunk layar dimuat
 * yang tampil shimmer BERBENTUK percakapan (sama dengan keadaan memuat di
 * dalam layar — tanpa lompatan bentuk), dan error render apa pun di ruang
 * ditangkap boundary tingkat-rute (UI dengan penjelasan + Coba lagi, sadar
 * offline) alih-alih meruntuhkan seluruh aplikasi ke layar kosong.
 */
import { Suspense, lazy } from "react"
import { useLocalSearchParams, type ErrorBoundaryProps } from "expo-router"
import { View } from "react-native"

import { SectionErrorBoundary } from "@/components/section-error-boundary"
import { ChatThreadSkeleton } from "@/components/ui/chat-thread-skeleton"

const ChatRoomScreen = lazy(() => import("@/components/screens/chat-room-screen"))

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return <SectionErrorBoundary error={error} retry={retry} />
}

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
        <View className="flex-1">
          <ChatThreadSkeleton />
        </View>
      }
    >
      <ChatRoomScreen key={roomKey} />
    </Suspense>
  )
}
