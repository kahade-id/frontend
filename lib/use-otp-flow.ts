/**
 * Kahade — hook status alur OTP (audit layar blank 2026-10-01).
 *
 * Mengapa ada (non-obvious): sebelum ini layar `verify-otp` /
 * `whatsapp-trigger` membaca state alur SEKALI saat mount —
 * `const flowRef = useRef(getOtpFlow())` — lalu `return null` bila kosong.
 * Dua konsekuensi yang keduanya berujung layar blank:
 *
 *   1. Bila state belum ada saat mount (JS context baru setelah proses
 *      dimatikan OS saat user di WhatsApp, pembacaan SecureStore yang belum
 *      selesai, atau alur yang baru diset SETELAH layar tujuan ter-mount),
 *      layar MENGUNCI dirinya kosong — `useRef` tidak pernah memperbarui.
 *   2. "Belum tahu" (hidrasi belum selesai) diperlakukan sama dengan
 *      "tidak ada alur" — padahal keduanya butuh UI yang berbeda: loading
 *      vs pesan + tombol kembali.
 *
 * Hook ini mengembalikan status eksplisit:
 *   - `loading` → hidrasi SecureStore masih berjalan: tampilkan loading.
 *   - `ready`   → alur ada: layar boleh render penuh.
 *   - `missing` → hidrasi selesai & alur tetap tidak ada: tampilkan pesan +
 *                 jalan keluar (tombol kembali) — JANGAN blank.
 *
 * `status` bisa berpindah `loading` → `ready` kapan pun alur diset/ditambal
 * (mis. alur baru dibuat layar lain), karena nilai alur dibaca lewat
 * `useSyncExternalStore` ke `lib/otp-flow` — bukan snapshot sekali baca.
 */
import { useEffect, useState, useSyncExternalStore } from "react"

import {
  getOtpFlow,
  initOtpFlow,
  isOtpFlowHydrated,
  subscribeOtpFlow,
  type OtpFlowState,
} from "@/lib/otp-flow"

export type OtpFlowStatus = "loading" | "ready" | "missing"

/** Snapshot server (SSR/web static export) — selalu "tidak ada alur". */
const serverSnapshot = (): OtpFlowState | null => null

export type OtpFlowResult = {
  flow: OtpFlowState | null
  status: OtpFlowStatus
}

export function useOtpFlow(): OtpFlowResult {
  const flow = useSyncExternalStore(subscribeOtpFlow, getOtpFlow, serverSnapshot)
  const [hydrated, setHydrated] = useState(isOtpFlowHydrated)

  useEffect(() => {
    if (hydrated) return
    let alive = true
    // Jaring pemulihan: root layout sudah memanggil initOtpFlow() saat boot,
    // tetapi layar tidak boleh MENGASUMSIKAN itu (mis. hidrasi gagal total).
    // `initOtpFlow` idempoten — promise yang sama dibagikan.
    void initOtpFlow()
      .catch(() => {})
      .finally(() => {
        if (alive) setHydrated(true)
      })
    return () => {
      alive = false
    }
  }, [hydrated])

  const status: OtpFlowStatus = flow ? "ready" : hydrated ? "missing" : "loading"
  return { flow, status }
}
