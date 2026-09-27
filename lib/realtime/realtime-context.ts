/**
 * Kahade — konteks realtime (GAP-B2).
 *
 * Dipisah dari `socket-provider.tsx` (yang berr-JSX) ke file `.ts` murni
 * agar lapisan logika — `use-chat-room.ts` dan test Vitest — bisa memakai
 * `useRealtime` TANPA menarik `nativewind/jsx-runtime` →
 * `react-native-css-interop` → `react-native` asli (sintaks Flow, gagal
 * di-parse di environment Node test).
 */
import { createContext, useContext } from "react"
import type { Socket } from "socket.io-client"

import type { UnwrappedEvent } from "./hmac"

export type RealtimeStatus =
  | "disabled"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "offline"

export type RealtimeContextValue = {
  /** Status koneksi untuk UI (banner offline/reconnecting). */
  status: RealtimeStatus
  /** true hanya saat socket benar-benar tersambung. */
  healthy: boolean
  /** Id internal viewer (JWT sub) — untuk filter gema event milik sendiri. */
  viewerId: string | null
  /** Socket mentah untuk subscribe event per-layar. */
  socket: Socket | null
  /**
   * Epoch koneksi: naik setiap `connect` sukses. Hook per-room memakainya
   * untuk membedakan "join pertama" vs "reconnect → join ulang + sync".
   */
  epoch: number
  /**
   * Gabung room chat. Guard partisipasi di SISI SERVER
   * (`join-room` → `isRoomParticipant`); resolve false bila ditolak /
   * tidak tersambung — penelepon tetap di jalur REST fallback.
   */
  joinRoom: (roomId: string) => Promise<boolean>
  leaveRoom: (roomId: string) => void
  /**
   * Verifikasi + kupas envelope HMAC event realtime (`lib/realtime/hmac.ts`).
   * Mengembalikan payload bersih, atau `null` bila event tidak valid dan
   * harus diabaikan diam-diam.
   */
  unwrapEvent: (raw: unknown) => UnwrappedEvent | null
}

export const RealtimeContext = createContext<RealtimeContextValue | null>(null)

export function useRealtime(): RealtimeContextValue {
  const ctx = useContext(RealtimeContext)
  if (!ctx) throw new Error("useRealtime harus dipakai di dalam <RealtimeProvider>")
  return ctx
}
