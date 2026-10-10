/**
 * Kahade — langganan realtime story (2026-10-10).
 *
 * Backend mengirim `story.created` / `story.deleted` / `story.expired` ke
 * kanal pengguna (lihat `STORY_SOCKET_EVENTS`). Sebelum ini tray hanya
 * diperbarui saat tab kembali fokus — story kontak yang baru diunggah tidak
 * muncul sampai pengguna pindah tab, dan story yang dihapus tetap terbuka di
 * viewer sampai 404.
 *
 * Perilaku: event valid (envelope HMAC lolos `unwrapEvent`) → cache
 * `story-tray` + `story-user-*` dibatalkan dan `onChange` dipanggil supaya
 * layar yang ter-mount memuat ulang DIAM (tanpa spinner). Socket mati →
 * tidak ada yang terjadi; jalur refresh-on-focus tetap berlaku.
 */
import { useEffect, useRef } from "react"

import { STORY_SOCKET_EVENTS } from "@/lib/realtime/chat-events"
import { useRealtime } from "@/lib/realtime/realtime-context"
import { logWarn } from "@/lib/telemetry"
import { invalidateQueryCache, invalidateQueryPrefix } from "@/lib/use-api-query"

export type StoryRealtimePayload = { authorUserId?: string; storyId?: string }

export function useStoryRealtime(onChange?: (payload: StoryRealtimePayload) => void): void {
  const { socket, unwrapEvent } = useRealtime()
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!socket) return
    const handle = (raw: unknown) => {
      const event = unwrapEvent(raw)
      if (event === null) return
      try {
        invalidateQueryCache("story-tray")
        invalidateQueryPrefix("story-user-")
      } catch (err) {
        logWarn("story:realtime-invalidate", err)
      }
      const data = (event as { data?: unknown }).data
      const payload: StoryRealtimePayload =
        data && typeof data === "object" ? (data as StoryRealtimePayload) : (event as StoryRealtimePayload)
      onChangeRef.current?.(payload)
    }
    socket.on(STORY_SOCKET_EVENTS.CREATED, handle)
    socket.on(STORY_SOCKET_EVENTS.DELETED, handle)
    socket.on(STORY_SOCKET_EVENTS.EXPIRED, handle)
    return () => {
      socket.off(STORY_SOCKET_EVENTS.CREATED, handle)
      socket.off(STORY_SOCKET_EVENTS.DELETED, handle)
      socket.off(STORY_SOCKET_EVENTS.EXPIRED, handle)
    }
  }, [socket, unwrapEvent])
}
