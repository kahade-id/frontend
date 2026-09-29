/**
 * Kahade — rute /dispute/[id] (THIN SHELL, PERF-FIX 2026-09-30).
 *
 * Lihat penjelasan pola di app/scan.tsx: di native, expo-router mengevaluasi
 * semua modul rute saat boot. Implementasi detail sengketa (±1328 baris +
 * expo-document-picker + expo-image-picker + MediaViewer) dimuat via
 * React.lazy sehingga dievaluasi HANYA saat pengguna pertama kali membuka
 * detail sengketa, bukan saat boot.
 *
 * Jangan menambahkan import berat di file ini.
 */
import { Suspense, lazy } from "react"
import { View } from "react-native"

import { ListLoading } from "@/components/ui/paginated-list"

const DisputeDetailScreen = lazy(
  () => import("@/components/screens/dispute-detail-screen"),
)

export default function DisputeDetailRoute() {
  return (
    <Suspense
      fallback={
        <View className="flex-1 px-5 pt-6">
          <ListLoading />
        </View>
      }
    >
      <DisputeDetailScreen />
    </Suspense>
  )
}
