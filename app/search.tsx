/**
 * Kahade — rute /search (THIN SHELL, PERF-FIX 2026-09-30).
 *
 * Lihat penjelasan pola di app/scan.tsx: di native, expo-router mengevaluasi
 * semua modul rute saat boot. Implementasi layar pencarian (±1350 baris)
 * dimuat via React.lazy sehingga dievaluasi HANYA saat pengguna pertama
 * kali membuka pencarian.
 *
 * Jangan menambahkan import berat di file ini.
 */
import { Suspense, lazy } from "react"
import { View } from "react-native"

import { ListLoading } from "@/components/ui/paginated-list"

const SearchScreen = lazy(() => import("@/components/screens/search-screen"))

export default function SearchRoute() {
  return (
    <Suspense
      fallback={
        <View className="flex-1 px-5 pt-6">
          <ListLoading />
        </View>
      }
    >
      <SearchScreen />
    </Suspense>
  )
}
