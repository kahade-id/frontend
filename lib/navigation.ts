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
