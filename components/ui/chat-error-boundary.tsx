/**
 * Kahade — <ChatErrorBoundary> pagar render di dalam thread chat (Bug 1, 2026-10-08).
 *
 * Dua pemakaian:
 *   - per BARIS (renderThreadRow): satu bubble yang gagal di-render hanya
 *     menggantikan dirinya dengan caption kecil — thread tidak ikut kosong;
 *   - per AREA thread (chat-room-screen): kegagalan render di FlatList
 *     ditampilkan di tempat dengan tombol Coba lagi, bukan layar putih.
 *
 * Batas yang perlu diketahui: boundary React hanya menangkap error RENDER JS.
 * Error di UI thread (updater worklet Reanimated) tidak lewat sini — itu
 * ditangani `useSafeAnimatedStyle` dan perbaikan di sumbernya.
 *
 * `captureError` dipanggil di SEMUA build (bukan hanya __DEV__) supaya
 * crash render ikut tercatat di log crash lokal (lib/crash-log).
 */
import { Component, type ReactNode } from "react"
import { View } from "react-native"

import { Text } from "@/components/ui/text"
import { translate } from "@/lib/i18n"
import { captureError } from "@/lib/telemetry"

export type ChatErrorBoundaryProps = {
  /** Label untuk telemetri, mis. "chat:row-render". */
  scope: string
  children: ReactNode
  /** Tampilan saat render gagal. `reset` memasang ulang anak. */
  fallback: (reset: () => void) => ReactNode
}

type ChatErrorBoundaryState = { failed: boolean }

export class ChatErrorBoundary extends Component<ChatErrorBoundaryProps, ChatErrorBoundaryState> {
  state: ChatErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): ChatErrorBoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: unknown): void {
    captureError(this.props.scope, error)
  }

  private reset = (): void => {
    this.setState({ failed: false })
  }

  render(): ReactNode {
    if (this.state.failed) return this.props.fallback(this.reset)
    return this.props.children
  }
}

/** Pengganti satu baris yang gagal di-render: caption kecil, tanpa aksi. */
export function ChatRowFallback() {
  return (
    <View testID="chat-row-render-error" className="px-5 py-2">
      <Text variant="caption" tone="secondary">
        {translate("Pesan ini tidak dapat ditampilkan.")}
      </Text>
    </View>
  )
}

/** `fallback` untuk <ChatErrorBoundary> per baris (tanpa `reset`). */
export function renderChatRowFallback(): ReactNode {
  return <ChatRowFallback />
}
