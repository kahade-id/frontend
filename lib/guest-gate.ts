/**
 * Kahade — gerbang tamu web untuk lapisan DATA (B-02/B-03 audit).
 *
 * Kenapa modul ini ada (non-obvious): root layout sudah memblokir *tampilan*
 * layar ber-auth untuk tamu web lewat <GuestLoginPrompt>, tetapi itu hanya
 * lapisan visual — layar di baliknya TETAP ter-mount dan efek
 * `useApiQuery`/`usePaginatedQuery`-nya sudah menembak endpoint
 * `auth:"required"`. Untuk tamu, tiap 401 memicu `refreshAccessToken()` dan
 * berpotensi `expireSession` → badai request yang tidak pernah bisa berhasil.
 *
 * Solusinya: SATU definisi "tamu web yang sedang tertutup gerbang login" yang
 * dipakai baik oleh root layout (tampilan) maupun oleh hook data (request).
 * Definisi harus identik di kedua tempat, jadi ia hidup di sini — bukan
 * disalin ke tiap layar.
 *
 * Keputusan non-obvious lainnya:
 *   - Membaca token dari STORE sesi (`lib/api/session.ts`), BUKAN dari
 *     `useAuthSession()`. Hook itu punya efek pemulihan sesi per pemanggilan
 *     (baca SecureStore, coba refresh); memakainya di hook data berarti efek
 *     itu berjalan sekali per layar — termasuk `clearSession()` berulang saat
 *     perangkat menandai "signed out". Store sesi sudah menyiarkan perubahan
 *     token ke semua pelanggan, jadi hook data cukup mendengarkannya.
 *   - `usePathname` aman dipakai di `lib/` (pola yang sudah ada di
 *     `lib/routes.ts`, `lib/navigation.ts`, `lib/notification-routing.ts`) dan
 *     di-stub pada test komponen (tests/stubs/expo-router.tsx).
 */
import { useSyncExternalStore } from "react"
import { Platform } from "react-native"
import { usePathname } from "expo-router"

import { getSessionSnapshot, subscribeSession } from "@/lib/api/session"
import { isProtectedPath } from "@/lib/protected-routes"

/** Snapshot server = belum ada sesi (SSR/hidrasi web). */
const serverSnapshot = () => null

/** Token sesi saat ini (null bila belum dibaca / tidak ada). */
export function useSessionToken(): string | null {
  return useSyncExternalStore(subscribeSession, getSessionSnapshot, serverSnapshot)
}

/**
 * Apakah ada sesi aktif? Dipakai layar tab yang endpoint-nya `auth:"required"`
 * tetapi route-nya terbuka untuk tamu web (tab Dompet/Transaksi/Pengguna):
 * tanpa token, query harus digate (`enabled`) alih-alih menembak 401.
 */
export function useHasSession(): boolean {
  return useSessionToken() !== null
}

/**
 * True bila pengunjung web tanpa akun sedang berada di layar ber-auth —
 * kondisi yang sama dengan yang memunculkan <GuestLoginPrompt>. Hook data
 * memakainya untuk berhenti menembak request; saat tamu berpindah ke layar
 * publik, nilainya kembali false dan query dimuat ulang.
 */
export function useGuestPathBlocked(): boolean {
  const token = useSessionToken()
  const pathname = usePathname()
  return Platform.OS === "web" && token === null && isProtectedPath(pathname)
}
