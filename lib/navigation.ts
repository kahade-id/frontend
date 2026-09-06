/**
 * Kahade — helper navigasi lintas layar.
 *
 * `useComingSoon()`: handler seragam untuk tujuan yang rutenya BELUM dibuat
 * di `app/` (mis. /topup, /edit-profile). Sebelumnya screen melakukan
 * `router.push("/topup")` sehingga Expo Router menampilkan "Unmatched Route"
 * di dev — pengalaman rusak. Sekarang tap memunculkan toast info sekali
 * (dengan nama fitur dari pemanggil), dan begitu file route dibuat, screen
 * cukup mengganti pemanggil ke `router.push(ROUTES.…)` tanpa menyentuh copy.
 *
 * Catatan: helper bergantung pada <ToastProvider> yang sudah dipasang di
 * app/_layout.tsx; jangan dipakai di luar tree provider.
 */
import { useCallback } from "react"
import { router } from "expo-router"
import type { Href } from "expo-router"

import { useToast } from "@/components/ui/toast"

/** Label default untuk fitur yang sedang disiapkan (satu tempat). */
export const COMING_SOON_DESCRIPTION =
  "Fitur ini sedang disiapkan dan akan tersedia di rilis berikutnya."

export function useComingSoon() {
  const toast = useToast()

  return useCallback(
    (feature: string) => {
      toast.show({
        title: `${feature} — segera hadir`,
        description: COMING_SOON_DESCRIPTION,
        tone: "info",
        duration: 4000,
      })
    },
    [toast.show],
  )
}

/* ── Navigasi balik yang tidak pernah berujung buntu ───────────────────── */

/**
 * `router.back()` adalah **no-op bila tidak ada entri riwayat sebelumnya**.
 * Itu bukan kasus pinggiran: screen di app ini bisa dibuka lewat deep link,
 * notifikasi push, atau tab baru (build web dipublikasikan ke Cloudflare
 * Pages). Saat itu stack hanya berisi satu entri, sehingga `back()` tidak
 * melakukan apa-apa dan pengguna terjebak di layar yang baru saja
 * menyelesaikan aksinya — tanpa toast yang menjelaskan, tanpa tombol maju.
 *
 * Lebih buruk lagi di web: bila tab memang punya riwayat dari situs lain
 * (mis. tautan dibuka dari klien email), `back()` justru mengeluarkan
 * pengguna **dari aplikasi** tepat setelah aksi yang berhasil.
 *
 * Fallback eksplisit membuat kedua kasus berujung pada tujuan yang masuk
 * akal. Pola ini sudah dipakai di `components/ui/header.tsx` dan sebagian
 * alur auth; helper ini menyatukannya supaya screen lain tidak perlu
 * mengingat rumusnya.
 */

/**
 * Struktur minimal yang dibutuhkan — sengaja tidak memakai tipe `Router`
 * penuh supaya helper ini bisa menerima instance dari `useRouter()` maupun
 * singleton `router` tanpa bergantung pada nama tipe internal expo-router.
 */
export type BackNavigator = {
  canGoBack: () => boolean
  back: () => void
  replace: (href: Href) => void
}

/**
 * Kembali ke layar sebelumnya, atau ke `fallback` bila tidak ada riwayat.
 *
 * @param fallback Tujuan pengganti — harus tujuan yang selalu bisa dicapai
 *   (tab/home/detail order), bukan layar lain yang juga menumpuk riwayat.
 * @param nav Instance router. Default singleton `router`; teruskan hasil
 *   `useRouter()` bila screen sudah memakainya agar konsisten.
 */
export function goBackOrNavigate(fallback: Href, nav: BackNavigator = router): void {
  if (nav.canGoBack()) nav.back()
  else nav.replace(fallback)
}
