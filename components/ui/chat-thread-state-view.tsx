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
 *   loading → shimmer berbentuk percakapan (+ penjelasan & Coba lagi bila
 *             terlalu lama)
 *   error   → pesan galat + Coba lagi
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
import { Text } from "@/components/ui/text"
import type { ThreadState } from "@/lib/chat-thread-state"
import { translate, useLanguage } from "@/lib/i18n"

export type ChatThreadStateViewProps = {
  state: Exclude<ThreadState, "ready">
  /** Pesan galat untuk keadaan "error". */
  error: string | null
  /** Memuat sudah terlalu lama → tambahkan penjelasan + Coba lagi. */
  slow: boolean
  counterpartName: string | null | undefined
  selfChat: boolean
  onRetry: () => void
  onBackToList: () => void
}

function ChatThreadStateViewImpl({
  state,
  error,
  slow,
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
        {slow ? (
          <View
            testID="chat-thread-slow"
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            className="items-center gap-2 px-8 pb-4"
          >
            <Text variant="caption" tone="secondary" className="text-center">
              {translate("Masih memuat percakapan. Periksa koneksi internet Anda.")}
            </Text>
            <Button variant="ghost" size="sm" fullWidth={false} onPress={onRetry}>
              {translate("Coba lagi")}
            </Button>
          </View>
        ) : null}
      </View>
    )
  }

  if (state === "error") {
    return (
      <View testID="chat-thread-error" className="flex-1">
        <ErrorState
          title={translate("Gagal memuat")}
          description={error ?? translate("Kami tidak dapat memuat percakapan ini. Silakan coba lagi.")}
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
