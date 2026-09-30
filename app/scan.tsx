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
import { Text, View } from "react-native"

const ScanScreen = lazy(() => import("@/components/scan-screen"))

export default function ScanRoute() {
  return (
    <Suspense
      fallback={
        /* UX-FDB-004 (audit UI/UX 2026-10-01): placeholder viewfinder kamera,
           bukan skeleton daftar. Sengaja tanpa import komponen tambahan agar
           thin shell tetap ringan (lihat header file). */
        <View className="flex-1 items-center justify-center gap-4 bg-black px-8">
          <View className="h-56 w-56 items-center justify-center rounded-2xl border-2 border-white/30">
            <View className="h-40 w-40 rounded-xl border border-white/15" />
          </View>
          <Text className="text-sm text-white/70">Menyiapkan kamera…</Text>
        </View>
      }
    >
      <ScanScreen />
    </Suspense>
  )
}
