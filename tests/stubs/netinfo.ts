/**
 * Stub `@react-native-community/netinfo` untuk Vitest.
 *
 * Native module NetInfo tidak ada di Node; modul aslinya melempar saat
 * diimpor. Stub ini menyediakan API permukaan yang dipakai
 * `lib/connectivity.ts`: `fetch()`, `addEventListener()`, dan konstanta
 * tipe koneksi. Test dapat mengubah hasil `fetch()` lewat helper
 * `__setNetInfoState` bila diperlukan.
 *
 * Item #27 — stub ini adalah satu-satunya jembatan agar suite offline
 * (offline-queue, order-confirm via lib/api) bisa berjalan di Node.
 */
export type NetInfoStateType = "unknown" | "none" | "wifi" | "cellular" | "ethernet"

export type NetInfoState = {
  type: NetInfoStateType
  isConnected: boolean | null
  isInternetReachable: boolean | null
}

let currentState: NetInfoState = {
  type: "wifi",
  isConnected: true,
  isInternetReachable: true,
}
const listeners = new Set<(state: NetInfoState) => void>()

/** Test-only: ubah snapshot NetInfo dan beri tahu subscriber aktif. */
export function __setNetInfoState(next: Partial<NetInfoState>): void {
  currentState = { ...currentState, ...next }
  for (const listener of listeners) listener({ ...currentState })
}

export function fetch(): Promise<NetInfoState> {
  return Promise.resolve({ ...currentState })
}

export function addEventListener(
  listener: (state: NetInfoState) => void,
): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export default { fetch, addEventListener }
