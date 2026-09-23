/**
 * Rute `/home` → Etalase.
 *
 * Halaman Beranda DIHAPUS (permintaan produk 2026-09-23): tab pertama app
 * kini Etalase (`app/(tabs)/showcase.tsx`). File ini hanya menjaga URL lama
 * — tautan terbagi, riwayat browser, dan deep link native yang masih
 * menunjuk `/home` — supaya semuanya mendarat di Etalase, bukan 404.
 *
 * `<Redirect>` deklaratif (bukan `router.replace` di effect): rekomendasi
 * Expo Router, aman dari race dengan mount navigator. Rute ini DI LUAR grup
 * `(tabs)` karena ia bukan layar yang menetap — begitu ter-render ia langsung
 * menyerahkan navigasi ke tab Etalase.
 */
import { Redirect } from "expo-router"

import { ROUTES } from "@/lib/routes"

export default function HomeRedirect() {
  return <Redirect href={ROUTES.showcase} />
}
