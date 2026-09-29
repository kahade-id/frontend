/**
 * Kahade — rute /order/[id] (THIN SHELL, PERF-FIX 2026-09-30).
 *
 * Lihat penjelasan pola di app/scan.tsx: di native, expo-router mengevaluasi
 * semua modul rute saat boot. Implementasi detail order (±1680 baris:
 * milestone, escrow, dispute, retur) dimuat via React.lazy sehingga
 * dievaluasi HANYA saat pengguna pertama kali membuka detail order.
 *
 * Jangan menambahkan import berat di file ini.
 */
import { Suspense, lazy } from "react"
import { View } from "react-native"

import { ListLoading } from "@/components/ui/paginated-list"

const OrderDetailScreen = lazy(() => import("@/components/screens/order-detail-screen"))

export default function OrderDetailRoute() {
  return (
    <Suspense
      fallback={
        <View className="flex-1 px-5 pt-6">
          <ListLoading />
        </View>
      }
    >
      <OrderDetailScreen />
    </Suspense>
  )
}
