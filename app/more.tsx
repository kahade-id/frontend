/**
 * Rute `/more` → Etalase.
 *
 * Tab "Lainnya" DIHAPUS (redesign navigasi mobile 2026-09-27): fungsinya
 * pindah ke drawer/sidebar. File ini hanya menjaga URL lama — tautan
 * terbagi, riwayat browser, dan deep link native yang masih menunjuk
 * `/more` — supaya semuanya mendarat di Etalase, bukan 404.
 *
 * `<Redirect>` deklaratif (bukan `router.replace` di effect): rekomendasi
 * Expo Router, aman dari race dengan mount navigator. Rute ini DI LUAR grup
 * `(tabs)` karena ia bukan layar yang menetap — begitu ter-render ia langsung
 * menyerahkan navigasi ke tab Etalase.
 */
import { Redirect } from "expo-router"

import { ROUTES } from "@/lib/routes"

export default function MoreRedirect() {
  return <Redirect href={ROUTES.showcase} />
}
