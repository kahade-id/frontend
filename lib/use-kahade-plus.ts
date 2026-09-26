/**
 * Kahade — `useKahadePlus()`: SATU-SATUNYA cara membaca status langganan
 * Kahade+ di seluruh UI.
 *
 * Aturan keras: JANGAN memanggil `api.subscriptions.getKahadePlusMe()` (atau
 * endpoint status lama) langsung dari komponen/layar untuk keputusan UI.
 * Selalu lewat hook ini — supaya seluruh permukaan (badge abu, limit foto
 * etalase, tema, gate fitur) melihat satu snapshot yang sama.
 *
 * Desain store (non-obvious):
 *   - Module-level store + `useSyncExternalStore` (pola `unread-count.ts`):
 *     satu request GET /v1/subscriptions/me dibagi semua pemakai, tanpa
 *     Context/Provider tambahan.
 *   - Tamu / belum login TIDAK menembak endpoint: `getAccessToken()` kosong
 *     → snapshot non-aktif langsung. 401 di tengah jalan diperlakukan sama
 *     (bukan error layar).
 *   - Galat jaringan: snapshot kembali non-aktif + `error` terisi; layar yang
 *     butuh membedakan "gagal muat" dari "bukan anggota" membaca `error`.
 *   - `invalidateKahadePlus()` dipanggil alur subscribe/cancel setelah sukses
 *     supaya snapshot global ikut baru tanpa menunggu revalidasi fokus.
 */
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react"
import { useIsFocused } from "@react-navigation/native"

import { ApiError, userMessage } from "@/lib/api/errors"
import { getAccessToken, getSessionSnapshot, subscribeSession } from "@/lib/api/session"
import {
  INACTIVE_KAHADE_PLUS,
  getKahadePlusMe,
  type KahadePlusStatus,
} from "@/lib/api/subscriptions"
import { logWarn } from "@/lib/telemetry"

/** Snapshot mentah store (tanpa `refetch` — itu milik hook). */
export type KahadePlusSnapshot = KahadePlusStatus & {
  loading: boolean
  error: string | null
}

/** Nilai yang dikembalikan `useKahadePlus()`. */
export type KahadePlusState = KahadePlusSnapshot & {
  /** Muat ulang paksa dari server (melewati jeda revalidasi). */
  refetch: () => Promise<void>
}

/** Jeda minimum antar revalidasi fokus — jangan menembak /me tiap pindah tab. */
const FOCUS_REVALIDATE_MS = 60_000
/** Jeda minimum antar pemuatan saat beberapa komponen mount berurutan. */
const MOUNT_DEDUPE_MS = 30_000

const initialSnapshot: KahadePlusSnapshot = {
  ...INACTIVE_KAHADE_PLUS,
  loading: true,
  error: null,
}

let snapshot: KahadePlusSnapshot = initialSnapshot
let loadedAt = 0
let inflight: Promise<void> | null = null
let sessionWatched = false
let lastToken: string | null | undefined

const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function subscribeStore(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getStoreSnapshot(): KahadePlusSnapshot {
  return snapshot
}

function setSnapshot(next: KahadePlusSnapshot) {
  snapshot = next
  emit()
}

/** Pembaca non-hook untuk util (early access, tema) — JANGAN dipakai di render. */
export function getKahadePlusSnapshot(): KahadePlusSnapshot {
  return snapshot
}

async function fetchStatus(force: boolean): Promise<void> {
  if (inflight) {
    await inflight
    return
  }
  if (!force && loadedAt > 0 && Date.now() - loadedAt < MOUNT_DEDUPE_MS) return
  inflight = (async () => {
    setSnapshot({ ...snapshot, loading: true, error: null })
    try {
      const token = await getAccessToken()
      if (!token) {
        loadedAt = Date.now()
        setSnapshot({ ...INACTIVE_KAHADE_PLUS, loading: false, error: null })
        return
      }
      const status = await getKahadePlusMe()
      loadedAt = Date.now()
      setSnapshot({ ...status, loading: false, error: null })
    } catch (error) {
      if (error instanceof ApiError && error.code === "ABORTED") return
      loadedAt = Date.now()
      if (error instanceof ApiError && error.code === "UNAUTHORIZED") {
        // Sesi kedaluwarsa di tengah jalan — perlakukan sebagai bukan anggota,
        // bukan galat layar (auth flow yang menangani sesi).
        setSnapshot({ ...INACTIVE_KAHADE_PLUS, loading: false, error: null })
        return
      }
      logWarn("kahade-plus:me", error)
      setSnapshot({ ...INACTIVE_KAHADE_PLUS, loading: false, error: userMessage(error) })
    } finally {
      inflight = null
    }
  })()
  await inflight
}

function ensureSessionWatch() {
  if (sessionWatched) return
  sessionWatched = true
  lastToken = getSessionSnapshot()
  subscribeSession(() => {
    const token = getSessionSnapshot()
    if (token === lastToken) return
    lastToken = token
    if (!token) {
      // Logout: status premium milik sesi lama tidak boleh tertinggal.
      loadedAt = Date.now()
      setSnapshot({ ...INACTIVE_KAHADE_PLUS, loading: false, error: null })
      return
    }
    void fetchStatus(true)
  })
}

/**
 * Segarkan snapshot global — dipanggil setelah subscribe/cancel berhasil.
 * Komponen yang memakai `useKahadePlus()` ikut diperbarui otomatis.
 */
export function invalidateKahadePlus(): Promise<void> {
  return fetchStatus(true)
}

/** Langganan ke store mentah (untuk pemakaian di luar React context navigasi). */
export function subscribeKahadePlusStore(listener: () => void): () => void {
  return subscribeStore(listener)
}

/**
 * Pastikan pemuatan awal berjalan — idempoten. Dipakai <ThemeProvider> yang
 * berada di luar konteks navigasi sehingga tidak bisa memakai hook-nya.
 */
export function ensureKahadePlusLoaded(): void {
  ensureSessionWatch()
  void fetchStatus(false)
}

export function useKahadePlus(): KahadePlusState {
  const snap = useSyncExternalStore(subscribeStore, getStoreSnapshot)
  const focused = useIsFocused()

  const refetch = useCallback(() => fetchStatus(true), [])

  useEffect(() => {
    ensureKahadePlusLoaded()
  }, [])

  // Revalidasi diam saat layar kembali fokus (stale-while-revalidate ringan).
  useEffect(() => {
    if (!focused) return
    if (Date.now() - loadedAt > FOCUS_REVALIDATE_MS) void fetchStatus(false)
  }, [focused])

  return useMemo(() => ({ ...snap, refetch }), [snap, refetch])
}
