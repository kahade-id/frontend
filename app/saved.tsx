/**
 * Rute `/saved` → Kelola Etalase (tab "Tersimpan").
 *
 * Sidebar 2026-10-05: isi layar ini PINDAH ke tab "Tersimpan" di dalam
 * Kelola Etalase (components/ui/saved-collection.tsx). File ini hanya
 * menjaga URL lama — tautan terbagi, riwayat browser, dan deep link native
 * yang masih menunjuk `/saved` — supaya semuanya mendarat di tab yang
 * benar, bukan 404.
 *
 * `<Redirect>` deklaratif (bukan `router.replace` di effect): rekomendasi
 * Expo Router, aman dari race dengan mount navigator (pola app/more.tsx).
 */
import { Redirect } from "expo-router"

import { ROUTES } from "@/lib/routes"

export default function SavedRedirect() {
  return <Redirect href={ROUTES.showcaseManagementSaved} />
}
