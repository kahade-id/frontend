/**
 * Kahade — rute /user/[username] (THIN SHELL, PERF-FIX 2026-09-30).
 *
 * Lihat penjelasan pola di app/scan.tsx: di native, expo-router mengevaluasi
 * semua modul rute saat boot. Implementasi profil publik (±1750 baris: tab
 * etalase, questions, ratings) dimuat via React.lazy sehingga dievaluasi
 * HANYA saat pengguna pertama kali membuka profil, bukan saat boot.
 *
 * Jangan menambahkan import berat di file ini.
 */
import { Suspense, lazy } from "react"
import { View } from "react-native"

import { ListLoading } from "@/components/ui/paginated-list"

const UserProfileScreen = lazy(() => import("@/components/screens/user-profile-screen"))

export default function UserProfileRoute() {
  return (
    <Suspense
      fallback={
        <View className="flex-1 px-5 pt-6">
          <ListLoading />
        </View>
      }
    >
      <UserProfileScreen />
    </Suspense>
  )
}
