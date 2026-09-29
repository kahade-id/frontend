/**
 * Kahade — tab /transactions (THIN SHELL, PERF-FIX 2026-09-30).
 *
 * Lihat penjelasan pola di app/scan.tsx: di native, expo-router mengevaluasi
 * semua modul rute saat boot. Implementasi tab Transaksi (±510 baris)
 * dimuat via React.lazy sehingga dievaluasi HANYA saat tab pertama kali
 * dibuka, bukan saat boot.
 *
 * Jangan menambahkan import berat di file ini.
 */
import { Suspense, lazy } from "react"
import { View } from "react-native"

import { ListLoading } from "@/components/ui/paginated-list"

const TransactionsTabScreen = lazy(() => import("@/components/screens/transactions-tab-screen"))

export default function TransactionsTabRoute() {
  return (
    <Suspense
      fallback={
        <View className="flex-1 px-5 pt-6">
          <ListLoading />
        </View>
      }
    >
      <TransactionsTabScreen />
    </Suspense>
  )
}
