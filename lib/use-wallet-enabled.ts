/**
 * Kahade — hook reaktif untuk kill-switch dompet internal.
 *
 * `useWalletEnabled()` me-render ulang komponen saat nilai efektif berubah
 * (mis. status server tiba setelah fetch). `useWalletGate()` dipakai di tiap
 * layar dompet: kembalikan konten bila "on", varian penarikan-saldo-lama bila
 * "legacy", atau <WalletDisabledScreen/> bila "off".
 */
import { useEffect, useSyncExternalStore } from "react"

import {
  getWalletEnabled,
  refreshWalletStatus,
  subscribeWalletFlag,
} from "@/lib/wallet-flag"

/** Nilai efektif kill-switch dompet; reaktif terhadap fetch status server. */
export function useWalletEnabled(): boolean {
  // PERF-FIX (state audit): useSyncExternalStore agar React bisa bail out
  // saat emit terjadi tanpa perubahan nilai efektif — dulu useReducer +
  // forceRender me-render ulang SELALU di tiap emit.
  useEffect(() => {
    void refreshWalletStatus()
  }, [])
  return useSyncExternalStore(subscribeWalletFlag, getWalletEnabled, getWalletEnabled)
}

/**
 * Status gate untuk satu layar dompet:
 * - "on"     — dompet aktif penuh (flag true).
 * - "legacy" — flag false TAPI layar ini diizinkan sebagai jalur penarikan
 *              satu arah saldo lama (hanya `app/withdraw.tsx`).
 * - "off"    — tampilkan <WalletDisabledScreen/> (deep link ikut tertutup).
 */
export type WalletGateState = "on" | "legacy" | "off"

export function useWalletGate(options?: {
  /** `app/withdraw.tsx`: izinkan mode penarikan saldo lama saat flag false. */
  allowLegacyWithdrawal?: boolean
}): WalletGateState {
  const enabled = useWalletEnabled()
  if (enabled) return "on"
  return options?.allowLegacyWithdrawal === true ? "legacy" : "off"
}
