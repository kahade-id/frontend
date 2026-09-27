/**
 * Kahade — status konektivitas terpusat (@react-native-community/netinfo).
 *
 * Satu langganan NetInfo per proses; modul lain membaca snapshot atau
 * berlangganan lewat `useSyncExternalStore` (pola lib/ui-prefs.ts).
 *
 * Semantik TIGA keadaan (penting untuk fail-closed item #27):
 *   - `true`  = perangkat jelas online
 *   - `false` = perangkat jelas offline (NetInfo melaporkan tidak tersambung)
 *   - `null`  = belum diketahui (boot / NetInfo belum menjawab)
 *
 * Aturan: `null` diperlakukan sebagai ONLINE (fail-open). Memblokir request
 * saat status belum diketahui akan merusak cold start (semua layar gagal
 * sebelum NetInfo sempat menjawab). Yang diblokir hanya offline yang PASTI.
 */
import { useSyncExternalStore } from "react"
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo"

import { logWarn } from "@/lib/telemetry"

let initialized = false
let online: boolean | null = null
const listeners = new Set<() => void>()
const reconnectListeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function applyState(state: NetInfoState) {
  const was = online
  // `isInternetReachable` bisa null (belum dicek) — pakai `isConnected`
  // sebagai sinyal utama; reachable=false yang eksplisit ikut dihitung.
  const next =
    state.isConnected === false || state.isInternetReachable === false ? false : true
  online = next
  emit()
  // Transisi false → true = momen mengeksekusi antrean offline (item #27).
  if (was === false && next === true) {
    for (const listener of reconnectListeners) {
      try {
        listener()
      } catch (error) {
        logWarn("connectivity:reconnect-listener", error)
      }
    }
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): boolean | null {
  return online
}

/**
 * Mulai memantau konektivitas. Idempoten; panggil sekali di root layout
 * sebelum interaksi jaringan apa pun yang butuh gerbang offline.
 */
export function initConnectivity(): void {
  if (initialized) return
  initialized = true
  try {
    NetInfo.addEventListener(applyState)
    // Isi snapshot awal secepatnya — tanpa ini `online` tetap null sampai
    // ada perubahan jaringan (bisa berjam-jam).
    NetInfo.fetch()
      .then(applyState)
      .catch((error) => logWarn("connectivity:initial-fetch", error))
  } catch (error) {
    logWarn("connectivity:init", error)
  }
}

/** Snapshot terakhir: true = online, false = offline, null = belum tahu. */
export function getConnectivitySnapshot(): boolean | null {
  return online
}

/** true hanya bila perangkat JELAS offline. `null` (belum tahu) = false. */
export function isOfflineKnown(): boolean {
  return online === false
}

/** Hook untuk banner/UI: null (belum tahu) dirender sebagai online. */
export function useIsOnline(): boolean {
  const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return value !== false
}

/**
 * Daftarkan callback yang dipanggil SETIAP transisi offline → online.
 * Dipakai antrean aksi sosial (item #27). Kembalikan fungsi unsubscribe.
 */
export function onReconnect(listener: () => void): () => void {
  reconnectListeners.add(listener)
  return () => {
    reconnectListeners.delete(listener)
  }
}
