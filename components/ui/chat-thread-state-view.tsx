/**
 * Kahade — <ChatThreadStateView> tampilan thread saat BELUM ada baris untuk
 * ditampilkan (audit chat I23).
 *
 * Sebelumnya keadaan-keadaan ini dirender sebagai `ListEmptyComponent`
 * FlatList lewat rangkaian ternary — cabang yang tak tertangani (mis. tanpa
 * `roomId`, loading selamanya) atau tinggi isi yang menyusut di dalam
 * kontainer list berujung LAYAR KOSONG tanpa penjelasan. Kini tiap keadaan
 * hasil `resolveThreadState` punya tampilan sendiri, mengisi seluruh area
 * thread (di luar FlatList):
 *
 *   loading → shimmer berbentuk percakapan (terlihat, bukan putih polos)
 *   error   → pesan galat + Coba lagi; bila muat awal melewati batas waktu
 *             (Bug 2, 2026-10-08) deskripsinya menjelaskan timeout
 *   gone    → ruang dihapus + kembali ke daftar
 *   invalid → tautan tidak valid + kembali ke daftar
 *   empty   → ilustrasi + panduan (G19)
 *
 * Semua teks lewat translate(); tanpa istilah internal yang dilarang produk.
 */
import { memo } from "react"
import { View } from "react-native"
import { Chats } from "phosphor-react-native"

import { ChatEmptyThread } from "@/components/ui/chat-empty-thread"
import { ChatThreadSkeleton } from "@/components/ui/chat-thread-skeleton"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import type { ThreadState } from "@/lib/chat-thread-state"
import { translate, useLanguage } from "@/lib/i18n"

export type ChatThreadStateViewProps = {
  state: Exclude<ThreadState, "ready">
  /** Pesan galat untuk keadaan "error". */
  error: string | null
  /** Muat awal melewati batas waktu tanpa data (keadaan "error" karena timeout). */
  timedOut: boolean
  counterpartName: string | null | undefined
  selfChat: boolean
  onRetry: () => void
  onBackToList: () => void
}

function ChatThreadStateViewImpl({
  state,
  error,
  timedOut,
  counterpartName,
  selfChat,
  onRetry,
  onBackToList,
}: ChatThreadStateViewProps) {
  useLanguage()

  if (state === "loading") {
    return (
      <View testID="chat-thread-loading" className="flex-1">
        <ChatThreadSkeleton />
      </View>
    )
  }

  if (state === "error") {
    // Bug 2 (2026-10-08): timeout muat awal → galat yang jelas + Coba lagi,
    // bukan shimmer yang tak pernah selesai.
    const description = timedOut
      ? translate("Percakapan belum termuat. Periksa koneksi internet Anda, lalu coba lagi.")
      : (error ?? translate("Kami tidak dapat memuat percakapan ini. Silakan coba lagi."))
    return (
      <View testID={timedOut ? "chat-thread-timeout" : "chat-thread-error"} className="flex-1">
        <ErrorState
          title={translate("Gagal memuat")}
          description={description}
          onRetry={onRetry}
        />
      </View>
    )
  }

  if (state === "gone" || state === "invalid") {
    return (
      <View testID={state === "gone" ? "chat-thread-gone" : "chat-thread-invalid"} className="flex-1">
        <EmptyState
          icon={Chats}
          title={translate("Percakapan tidak tersedia")}
          description={
            state === "gone"
              ? translate("Ruang chat ini telah dihapus atau dinonaktifkan.")
              : translate("Tautan percakapan ini tidak valid.")
          }
          action={<Button onPress={onBackToList}>{translate("Kembali ke daftar chat")}</Button>}
        />
      </View>
    )
  }

  return (
    <View testID="chat-thread-empty" className="flex-1">
      <ChatEmptyThread name={counterpartName} selfChat={selfChat} />
    </View>
  )
}

export const ChatThreadStateView = memo(ChatThreadStateViewImpl)
