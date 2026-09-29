/**
 * Kahade — rute /showcase/[id] (THIN SHELL, PERF-FIX 2026-09-30).
 *
 * Lihat penjelasan pola di app/scan.tsx: di native, expo-router mengevaluasi
 * semua modul rute saat boot. Implementasi detail showcase (±1395 baris)
 * dimuat via React.lazy sehingga dievaluasi HANYA saat pengguna pertama
 * kali membuka detail karya.
 *
 * Jangan menambahkan import berat di file ini.
 */
import { Suspense, lazy } from "react"
import { View } from "react-native"

import { ListLoading } from "@/components/ui/paginated-list"

const ShowcaseDetailScreen = lazy(() => import("@/components/screens/showcase-detail-screen"))

export default function ShowcaseDetailRoute() {
  return (
    <Suspense
      fallback={
        <View className="flex-1 px-5 pt-6">
          <ListLoading />
        </View>
      }
    >
      <ShowcaseDetailScreen />
    </Suspense>
  )
}
