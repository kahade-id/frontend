/**
 * Kahade — rute /showcase/create (THIN SHELL, PERF-FIX 2026-09-30).
 *
 * Lihat penjelasan pola di app/scan.tsx: di native, expo-router mengevaluasi
 * semua modul rute saat boot. Implementasi form buat karya (±1370 baris +
 * upload media) dimuat via React.lazy sehingga dievaluasi HANYA saat
 * pengguna pertama kali membuka form, bukan saat boot.
 *
 * Jangan menambahkan import berat di file ini.
 */
import { Suspense, lazy } from "react"
import { View } from "react-native"

import { ListLoading } from "@/components/ui/paginated-list"

const ShowcaseCreateScreen = lazy(() => import("@/components/screens/showcase-create-screen"))

export default function ShowcaseCreateRoute() {
  return (
    <Suspense
      fallback={
        <View className="flex-1 px-5 pt-6">
          <ListLoading />
        </View>
      }
    >
      <ShowcaseCreateScreen />
    </Suspense>
  )
}
