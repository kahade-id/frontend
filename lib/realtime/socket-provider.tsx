/**
 * Kahade — penyedia koneksi realtime tunggal (GAP-B2, G102/G103/G104/G117–G124).
 *
 * SATU socket.io-client per akun untuk seluruh aplikasi:
 * - Auth handshake TANPA token di query URL — `auth: { token }` di payload
 *   handshake (server membaca `handshake.auth.token`; B-39 membuang
 *   long-polling sehingga token tak pernah menumpang query string).
 * - Token refresh: bila `token` berganti (client REST memanggil
 *   `setAccessToken` → `useAuthSession` memperbarui), `socket.auth`
 *   diperbarui lalu re-handshake — tanpa membuat socket baru.
 * - Logout / sesi hilang (`token` null): koneksi DITUTUP dan dibuang.
 * - App background → `disconnect()` manual (jeda); foreground → `connect()`
 *   lagi. Reconnect otomatis socket.io tetap aktif untuk putus jaringan.
 * - Backoff reconnect + jitter dikonfigurasi di `buildSocketOptions`.
 *
 * Metrik (G124): hanya hitungan/status koneksi — TIDAK PERNAH isi pesan
 * atau token — via `__DEV__` console + `logWarn` untuk anomali.
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { AppState } from "react-native"
// ST-005 (PERF-FIX 2026-09-29): `io` dimuat via dynamic import() di efek
// koneksi — socket.io-client (±90KB + engine.io) keluar dari graph evaluasi
// awal. Import TIPE saja di sini (dihapus saat kompilasi).
import type { Socket } from "socket.io-client"

import { API_BASE_URL } from "@/lib/api/config"
import { refreshAccessToken } from "@/lib/api/client"
import { logWarn } from "@/lib/telemetry"
import {
  buildSocketOptions,
  getViewerIdFromToken,
  SOCKET_SERVER_ERROR_EVENT,
} from "./chat-events"
import { verifyAndUnwrapEvent, type UnwrappedEvent } from "./hmac"

// Tipe + context + hook dipisah ke `realtime-context.ts` (file `.ts` murni)
// supaya lapisan logika & test tidak menarik `nativewind/jsx-runtime` lewat
// file `.tsx` ini. Re-export di sini agar import lama tetap jalan.
export { RealtimeContext, useRealtime } from "./realtime-context"
export type { RealtimeContextValue, RealtimeStatus } from "./realtime-context"
import { RealtimeContext } from "./realtime-context"
import type { RealtimeContextValue, RealtimeStatus } from "./realtime-context"

/** Metrik koneksi tanpa isi sensitif (G124). */
function logMetric(event: string, detail?: string): void {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.debug(`[kahade/realtime] ${event}${detail ? ` — ${detail}` : ""}`)
  }
}

const JOIN_ACK_TIMEOUT_MS = 8000

export function RealtimeProvider({
  token,
  children,
}: {
  token: string | null
  children: ReactNode
}): React.JSX.Element {
  const socketRef = useRef<Socket | null>(null)
  const tokenRef = useRef<string | null>(token)
  tokenRef.current = token
  const pausedRef = useRef(false)
  /**
   * Kunci HMAC sesi dari event `session_hmac_token` server. Dipakai
   * `unwrapEvent` untuk memverifikasi setiap event bertanda tangan.
   * Dihapus saat socket dibuang / sesi berakhir (kunci tidak disimpan).
   */
  const sessionKeyRef = useRef<string | null>(null)
  /**
   * G108: "connected" (pintu join room) hanya dibuka SETELAH kunci HMAC sesi
   * tiba — event bertanda tangan tidak pernah diproses tanpa kunci
   * (fail-closed by construction, tanpa race window). Bila server tidak
   * mendukung HMAC (deploy lama), grace timer 8 dtk membuka pintu agar
   * kompatibel; event tak bertanda tetap diterima seperti sebelumnya.
   */
  const statusRef = useRef<RealtimeStatus>(token ? "connecting" : "disabled")
  const [status, setStatusState] = useState<RealtimeStatus>(token ? "connecting" : "disabled")
  const [epoch, setEpoch] = useState(0)
  const refreshAttemptedRef = useRef(false)

  const setStatus = useCallback((next: RealtimeStatus) => {
    if (statusRef.current === next) return
    statusRef.current = next
    setStatusState(next)
  }, [])

  const keyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearKeyTimer = useCallback(() => {
    if (keyTimerRef.current) {
      clearTimeout(keyTimerRef.current)
      keyTimerRef.current = null
    }
  }, [])
  const armKeyWait = useCallback(() => {
    clearKeyTimer()
    keyTimerRef.current = setTimeout(() => {
      keyTimerRef.current = null
      if (sessionKeyRef.current) return
      logWarn("realtime:hmac", new Error("session_hmac_token tak kunjung tiba — mode kompatibel tanpa verifikasi"))
      setStatus("connected")
      setEpoch((e) => e + 1)
    }, 8000)
  }, [clearKeyTimer, setStatus])

  const destroySocket = useCallback(() => {
    const socket = socketRef.current
    socketRef.current = null
    sessionKeyRef.current = null
    if (keyTimerRef.current) {
      clearTimeout(keyTimerRef.current)
      keyTimerRef.current = null
    }
    if (socket) {
      socket.removeAllListeners()
      socket.disconnect()
    }
    refreshAttemptedRef.current = false
  }, [])

  /**
   * Verifikasi + kupas envelope HMAC event realtime (G108/G125).
   * `null` = event tidak valid → penelepon mengabaikannya diam-diam.
   */
  const unwrapEvent = useCallback(
    (raw: unknown): UnwrappedEvent | null =>
      verifyAndUnwrapEvent(raw, sessionKeyRef.current),
    [],
  )

  /**
   * ST-005: pasang semua handler socket SETELAH dynamic import("socket.io-client")
   * selesai. Dipisah dari efek koneksi agar modul realtime tidak dievaluasi saat boot.
   */
  const attachSocketHandlers = useCallback((socket: Socket) => {
      socket.on("connect", () => {
        refreshAttemptedRef.current = false
        pausedRef.current = false
        logMetric("connected", `socket ${socket.id} — menunggu kunci HMAC`)
        // G108: pintu "connected" dibuka oleh session_hmac_token / grace timer.
        armKeyWait()
      })

      socket.on("disconnect", (reason) => {
        logMetric("disconnect", reason)
        if (pausedRef.current) {
          // Jeda manual saat background (G117) — bukan kegagalan.
          setStatus("offline")
          return
        }
        if (reason === "io server disconnect") {
          // Server menendang (mis. token kedaluwarsa/dicabut): coba refresh
          // SEKALI, lalu biarkan efek token di atas yang re-handshake.
          // Tanpa ini socket.io tidak auto-reconnect setelah kick server.
          setStatus("reconnecting")
          if (!refreshAttemptedRef.current) {
            refreshAttemptedRef.current = true
            void refreshAccessToken()
              .then((fresh) => {
                if (!fresh) {
                  // Refresh gagal total → sesi berakhir; jalur REST yang
                  // menangani logout. Jangan putar ulang tanpa henti.
                  logWarn("realtime:reauth", new Error("refresh token gagal setelah kick server"))
                  setStatus("offline")
                }
                // Sukses → `setAccessToken` memicu efek token → re-handshake.
              })
              .catch((err: unknown) => {
                logWarn("realtime:reauth", err)
                setStatus("offline")
              })
          }
          return
        }
        // Putus jaringan / transport: biarkan auto-reconnect bawaan bekerja.
        setStatus("reconnecting")
      })

      socket.on("reconnect_attempt", (attempt) => {
        logMetric("reconnect_attempt", `#${attempt}`)
        setStatus("reconnecting")
      })

      socket.on("reconnect", (attempt) => {
        logMetric("reconnected", `setelah ${attempt} percobaan — menunggu kunci HMAC baru`)
        // Server bisa merotasi kunci tiap sesi; jangan pakai status lama
        // sebelum kunci baru tiba (atau grace timer).
        armKeyWait()
      })

      socket.on("reconnect_failed", () => {
        logWarn("realtime:reconnect", new Error("reconnect gagal berulang — menunggu jaringan"))
        setStatus("offline")
      })

      socket.on("connect_error", (err) => {
        // JANGAN log err.message mentah bila mengandung token — pesan error
        // koneksi engine.io tidak membawa token; tetap redaksi defensif.
        logWarn("realtime:connect", err)
        setStatus("reconnecting")
      })

      // Kunci HMAC sesi: server mengirim tepat setelah auth sukses.
      // Disimpan di ref (bukan state) — hanya dipakai verifikasi event.
      socket.on("session_hmac_token", (payload: unknown) => {
        const tokenValue =
          typeof payload === "object" && payload !== null
            ? (payload as { token?: unknown }).token
            : undefined
        if (typeof tokenValue === "string" && tokenValue.length >= 16) {
          sessionKeyRef.current = tokenValue
          clearKeyTimer()
          logMetric("hmac", "kunci sesi diterima — pintu connected dibuka")
          setStatus("connected")
          setEpoch((e) => e + 1)
        } else {
          logWarn("realtime:hmac", new Error("session_hmac_token tanpa token valid"))
        }
      })

      // Event `error` dari server (auth gagal, rate limit, dst).
      socket.on(SOCKET_SERVER_ERROR_EVENT, (payload: unknown) => {
        const message =
          typeof payload === "object" && payload !== null
            ? String((payload as { message?: unknown }).message ?? "unknown")
            : "unknown"
        logWarn("realtime:server", new Error(`server error: ${message}`))
      })

  }, [setStatus, armKeyWait, clearKeyTimer])

  // ── Siklus hidup socket mengikuti token (G103/G104/G123) ───────────────
  useEffect(() => {
    if (!token) {
      // Logout / sesi berakhir: tutup koneksi akun ini (G123).
      destroySocket()
      setStatus("disabled")
      return
    }
    const existing = socketRef.current
    if (existing) {
      // Token refresh (akun sama): re-auth TANPA socket baru.
      const current = (existing.auth ?? {}) as { token?: unknown }
      if (current.token !== token) {
        logMetric("reauth", "token berganti — handshake ulang")
        existing.auth = { token }
        refreshAttemptedRef.current = false
        if (!pausedRef.current) {
          existing.disconnect()
          existing.connect()
          setStatus("connecting")
        }
      }
      return
    }
    logMetric("connect", "membuka koneksi socket — memuat socket.io-client lazy (ST-005)")
    // ST-005: modul socket.io-client dievaluasi HANYA di titik ini (koneksi
    // pertama), bukan saat boot. Tanpa token yang masih valid, jangan konek.
    let cancelled = false
    setStatus("connecting")
    void import("socket.io-client")
      .then(({ io }) => {
        if (cancelled) return
        // Token berganti/hilang saat modul dimuat → jangan sambungkan socket
        // basi (fail-closed).
        if (tokenRef.current !== token || !tokenRef.current) return
        const socket = io(API_BASE_URL, buildSocketOptions(token))
        if (cancelled || tokenRef.current !== token) {
          socket.disconnect()
          return
        }
        socketRef.current = socket
        attachSocketHandlers(socket)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        logWarn("realtime:load", err)
        setStatus("offline")
      })
    return () => {
      cancelled = true
    }
  }, [token, destroySocket, setStatus, attachSocketHandlers])


  // Unmount provider → buang socket.
  useEffect(() => () => destroySocket(), [destroySocket])

  // ── Jeda saat background, sambung lagi saat foreground (G117/G118) ────
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      const socket = socketRef.current
      if (!socket) return
      if (state === "background") {
        if (socket.connected) {
          logMetric("pause", "app background — disconnect manual")
          pausedRef.current = true
          socket.disconnect()
        }
      } else if (state === "active") {
        if (pausedRef.current && tokenRef.current) {
          logMetric("resume", "app foreground — connect lagi")
          pausedRef.current = false
          setStatus("connecting")
          // Token terkini (bisa saja di-refresh saat background).
          socket.auth = { token: tokenRef.current }
          socket.connect()
        }
      }
    })
    return () => subscription.remove()
  }, [setStatus])

  const joinRoom = useCallback(async (roomId: string): Promise<boolean> => {
    const socket = socketRef.current
    if (!socket || !socket.connected || !roomId) return false
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), JOIN_ACK_TIMEOUT_MS)
      socket.emit("join-room", { roomId }, (ack: unknown) => {
        clearTimeout(timer)
        const ok =
          typeof ack === "object" && ack !== null && (ack as { success?: unknown }).success === true
        if (!ok) {
          const message =
            typeof ack === "object" && ack !== null
              ? String((ack as { message?: unknown }).message ?? "rejected")
              : "no-ack"
          logWarn("realtime:join-room", new Error(`room ${roomId}: ${message}`))
        } else {
          logMetric("join-room", roomId)
        }
        resolve(ok)
      })
    })
  }, [])

  const leaveRoom = useCallback((roomId: string): void => {
    const socket = socketRef.current
    if (!socket || !socket.connected || !roomId) return
    socket.emit("leave-room", { roomId })
    logMetric("leave-room", roomId)
  }, [])

  const value = useMemo<RealtimeContextValue>(
    () => ({
      status,
      healthy: status === "connected",
      viewerId: getViewerIdFromToken(token),
      socket: socketRef.current,
      epoch,
      joinRoom,
      leaveRoom,
      unwrapEvent,
    }),
    // `socket` dari ref: nilai baca saat render; hook per-room membaca ulang
    // lewat efek saat `status`/`epoch` berubah (itulah sinyal koneksi baru).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status, epoch, token, joinRoom, leaveRoom, unwrapEvent],
  )

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
}
