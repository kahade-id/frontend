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

const ShowcaseCreateScreen = lazy(() => import("@/components/screens/showcase-create-screen"))

/**
 * UX-FDB-007: skeleton bentuk FORM (label + kotak input + area media +
 * tombol), bukan skeleton daftar. Dibangun dari View polos agar thin shell
 * tetap tanpa import komponen tambahan.
 */
function CreateFormLoading() {
  return (
    <View className="gap-4 py-4">
      <View className="h-6 w-2/5 rounded-xs bg-surface" />
      <View className="gap-3">
        <View className="gap-1.5">
          <View className="h-4 w-24 rounded-xs bg-surface" />
          <View className="h-12 w-full rounded-md bg-surface" />
        </View>
        <View className="gap-1.5">
          <View className="h-4 w-32 rounded-xs bg-surface" />
          <View className="h-12 w-full rounded-md bg-surface" />
        </View>
        <View className="gap-1.5">
          <View className="h-4 w-28 rounded-xs bg-surface" />
          <View className="h-28 w-full rounded-md bg-surface" />
        </View>
      </View>
      <View className="h-12 w-full rounded-md bg-surface" />
    </View>
  )
}

export default function ShowcaseCreateRoute() {
  return (
    <Suspense
      fallback={
        <View className="flex-1 px-5 pt-6">
          <CreateFormLoading />
        </View>
      }
    >
      <ShowcaseCreateScreen />
    </Suspense>
  )
}
