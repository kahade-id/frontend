/**
 * Kahade — <ChatScreenCaptureGate> proteksi screenshot/rekam layar untuk CHAT
 * yang dikendalikan PENGGUNA (audit chat H21).
 *
 * Pengaturan → Pengaturan pesan → "Izinkan screenshot & rekam layar di chat"
 * (default IZINKAN). Bila dimatikan, gate ini menyalakan <ScreenCaptureGuard>
 * (expo-screen-capture): Android = FLAG_SECURE (juga mengosongkan pratinjau
 * aplikasi di daftar aplikasi terbaru), iOS = screenshot & rekam layar tertutup
 * + blur app-switcher; screenshot yang tetap lolos ditutup lapisan penyembunyi.
 *
 * Keputusan non-obvious:
 *   - Beda dengan layar sensitif (PIN/OTP/dompet) yang SELALU terlindungi dan
 *     dikunci test `screenshot-guard`: di sini proteksi mengikuti pilihan
 *     pengguna, jadi kebijakan "layar biasa tetap boleh di-screenshot"
 *     (2026-09-27) tidak berubah untuk yang tidak memilihnya.
 *   - `active` = syarat tambahan dari pemanggil. Tab "Pesan" tetap ter-mount
 *     saat pengguna berpindah tab; tanpa `active={isFocused}` FLAG_SECURE akan
 *     menempel di SEMUA tab. Ruang chat tidak memakainya: ia ter-mount selama
 *     dibuka, termasuk saat penampil media dibuka di atasnya — foto dari chat
 *     ikut terlindungi.
 *   - Struktur pohon tetap (guard selalu ada, hanya `enabled` yang berubah):
 *     menyalakan/mematikan tidak me-remount ruang chat (draft & scroll aman).
 */
import type { ReactNode } from "react"

import { ScreenCaptureGuard } from "@/components/security/screen-capture-guard"
import { useUiPref } from "@/lib/ui-prefs"

/** Proteksi menyala? — murni, dipakai gate dan diuji terpisah. */
export function chatCaptureGuardEnabled(allowCapture: boolean, active = true): boolean {
  return !allowCapture && active
}

export function ChatScreenCaptureGate({
  children,
  active = true,
}: {
  children: ReactNode
  /** Syarat tambahan (mis. tab sedang fokus). Default true. */
  active?: boolean
}) {
  const allowCapture = useUiPref("chatAllowScreenCapture")
  return (
    <ScreenCaptureGuard enabled={chatCaptureGuardEnabled(allowCapture, active)}>
      {children}
    </ScreenCaptureGuard>
  )
}
