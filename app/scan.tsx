/**
 * Kahade — rute /scan (THIN SHELL, ST-001 PERF-FIX 2026-09-29).
 *
 * Batasan jujur asyncRoutes (lihat juga header app/_layout.tsx):
 * `app.json` memakai `"asyncRoutes": { "web": "production", "default": false }`.
 * Di WEB production, expo-router memecah bundle per rute (chunk terpisah per
 * layar — payload awal menyusut). Di NATIVE, pemisahan file TIDAK TERJADI
 * by design — "Native production builds still load routes synchronously"
 * (docs Expo, https://docs.expo.dev/router/web/async-routes/): artefak
 * native tetap satu file .hbc dan SEMUA modul rute dievaluasi saat boot.
 *
 * Karena itu, untuk native, satu-satunya "code splitting" yang benar-benar
 * ada adalah PENUNDAAN EVALUASI modul — dan file inilah contohnya:
 * implementasi layar pindai (±1000 baris + `expo-camera` + `expo-brightness`,
 * satu-satunya pengimpor kedua modul native itu di seluruh app) dimuat via
 * React.lazy, sehingga dievaluasi HANYA saat pengguna pertama kali membuka
 * /scan, bukan saat boot. Fallback = skeleton loading yang sama dengan
 * skeleton pemulihan sesi di root layout.
 *
 * Jangan menambahkan import berat di file ini: setiap import statis di sini
 * kembali dievaluasi saat boot dan membatalkan tujuan pemisahan.
 */
import { Suspense, lazy } from "react"
import { View } from "react-native"

import { ListLoading } from "@/components/ui/paginated-list"

const ScanScreen = lazy(() => import("@/components/scan-screen"))

export default function ScanRoute() {
  return (
    <Suspense
      fallback={
        <View className="flex-1 px-5 pt-6">
          <ListLoading />
        </View>
      }
    >
      <ScanScreen />
    </Suspense>
  )
}
