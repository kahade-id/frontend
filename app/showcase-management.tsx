/**
 * Kahade — rute /showcase-management (THIN SHELL, PERF-FIX 2026-09-30).
 *
 * Lihat penjelasan pola di app/scan.tsx: di native, expo-router mengevaluasi
 * semua modul rute saat boot. Implementasi kelola etalase (±1330 baris,
 * hanya untuk seller aktif) dimuat via React.lazy sehingga dievaluasi
 * HANYA saat dibuka, bukan saat boot semua user.
 *
 * Jangan menambahkan import berat di file ini.
 */
import { Suspense, lazy } from "react"
import { View } from "react-native"

import { ListLoading } from "@/components/ui/paginated-list"

const ShowcaseManagementScreen = lazy(() => import("@/components/screens/showcase-management-screen"))

export default function ShowcaseManagementRoute() {
  return (
    <Suspense
      fallback={
        <View className="flex-1 px-5 pt-6">
          <ListLoading />
        </View>
      }
    >
      <ShowcaseManagementScreen />
    </Suspense>
  )
}
