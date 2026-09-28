/**
 * Kahade — <DeviceIntegrityProvider> (M-1 audit ronde-2).
 *
 * Memanaskan pemeriksaan root/jailbreak SEKALI saat aplikasi start
 * (fire-and-forget, hasil di-cache di `lib/device-integrity.ts`) agar saat
 * pengguna menekan aksi finansial hasilnya sudah siap tanpa jeda.
 *
 * Provider ini TIDAK memblokir UI dan tidak mengubah tampilan apa pun —
 * pemblokiran terjadi di titik commit dana lewat
 * `assertDeviceNotCompromised()` (transfer, tarik dana, bayar QRIS).
 * Aksi non-finansial tidak tersentuh.
 */
import { useEffect, type ReactNode } from "react"

import { checkDeviceIntegrity } from "@/lib/device-integrity"

export function DeviceIntegrityProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Sengaja tidak di-await: best-effort, jangan menghambat start.
    // Kegagalan = unknown (tidak memblokir) — proteksi utama tetap server.
    void checkDeviceIntegrity()
  }, [])
  return <>{children}</>
}
