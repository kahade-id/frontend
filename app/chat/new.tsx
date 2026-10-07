/**
 * Kahade — rute /chat/new (THIN SHELL, pola app/chat/[roomId].tsx).
 *
 * Implementasi halaman "Pesan baru" (pencarian username + kontak tersimpan)
 * dimuat via React.lazy sehingga modulnya dievaluasi HANYA saat pengguna
 * menekan ikon (+) di daftar Pesan — bukan saat boot. Jangan menambahkan
 * import berat di file ini.
 */
import { Suspense, lazy } from "react"

import { Screen } from "@/components/ui/screen"
import { ChatTabListSkeleton } from "@/components/ui/tab-loading-skeletons"

const ChatNewMessageScreen = lazy(
  () => import("@/components/screens/chat-new-message-screen"),
)

export default function ChatNewMessageRoute() {
  return (
    <Suspense
      fallback={
        <Screen edges={["top"]} padded={false}>
          <ChatTabListSkeleton />
        </Screen>
      }
    >
      <ChatNewMessageScreen />
    </Suspense>
  )
}
