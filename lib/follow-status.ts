/**
 * Cache status follow per sesi (mega-batch FE-IMP-1, item 56).
 *
 * Payload author feed TIDAK membawa status follow — menembak
 * `GET /v1/users/:username` per kartu tanpa cache = N+1 request.
 * Modul ini: satu cache `username → boolean|null` per sesi + dedupe request
 * in-flight. `FollowButton` (components/ui/follow-button.tsx) membaca lewat
 * hook di sini; toggle memperbarui cache supaya semua pemakai konsisten.
 *
 * `resolveFollowStatus` menormalkan respons profil backend (lihat
 * lib/api/users.ts). `null` = backend tidak memberi status — pemanggil
 * memperlakukannya sebagai "tidak diketahui".
 */

import { useEffect, useSyncExternalStore } from "react"

import { getSessionRevision, subscribeSession } from "@/lib/api/session"
import { getUserByUsername, resolveFollowStatus } from "@/lib/api/users"

const cache = new Map<string, boolean | null>()
const inflight = new Map<string, Promise<boolean | null>>()
const listeners = new Set<() => void>()

let sessionRevision = getSessionRevision()
subscribeSession(() => {
  if (sessionRevision === getSessionRevision()) return
  sessionRevision = getSessionRevision()
  cache.clear()
  inflight.clear()
  emit()
})

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}

/** Tulis manual (dipakai toggle optimistis & pemanggil lain yang tahu status). */
export function setFollowStatus(username: string, following: boolean | null): void {
  if (cache.get(username) !== following) {
    cache.set(username, following)
    emit()
  }
}

/** Baca sinkron dari cache: boolean | null (tak diketahui) | undefined (belum dimuat). */
export function peekFollowStatus(username: string): boolean | null | undefined {
  return cache.has(username) ? cache.get(username) : undefined
}

/** Ambil status follow; request in-flight per username di-dedupe. */
export function fetchFollowStatus(username: string): Promise<boolean | null> {
  const cached = peekFollowStatus(username)
  if (cached !== undefined) return Promise.resolve(cached)
  const existing = inflight.get(username)
  if (existing) return existing
  const request = getUserByUsername(username)
    .then((profile) => {
      const status = resolveFollowStatus(profile)
      cache.set(username, status)
      return status
    })
    .catch(() => {
      // Gagal muat = "tak diketahui"; jangan blokir UI follow.
      cache.set(username, null)
      return null
    })
    .finally(() => {
      inflight.delete(username)
      emit()
    })
  inflight.set(username, request)
  return request
}

/**
 * Hook reaktif status follow. Memuat dari backend SEKALI per username per
 * sesi (cache di atas) — aman dipakai banyak kartu sekaligus.
 */
export function useFollowStatus(username: string): {
  following: boolean | null
  loading: boolean
} {
  const cached = useSyncExternalStore(subscribe, () => peekFollowStatus(username), () => undefined)
  useEffect(() => {
    if (cached === undefined) void fetchFollowStatus(username)
  }, [username, cached])
  return { following: cached ?? null, loading: cached === undefined }
}

/** Reset manual (dipakai test). */
export function clearFollowStatusCache() {
  cache.clear()
  inflight.clear()
  emit()
}
