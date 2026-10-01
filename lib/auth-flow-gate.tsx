/**
 * Kahade — gerbang UI alur auth pra-sesi (audit layar blank 2026-10-01).
 *
 * Kontrak: layar auth yang state-nya hidup di MEMORI modul (alur OTP
 * `lib/otp-flow`, tempToken registrasi, tempToken reset kata sandi, sesi 2FA)
 * TIDAK PERNAH boleh `return null` diam-diam. Bila state belum atau tidak
 * tersedia, layar merender salah satu dari dua keadaan deterministik:
 *
 *   1. <AuthFlowLoading>  — pembacaan/pemulihan state masih berjalan
 *      ("belum tahu"). Bukan layar kosong.
 *   2. <AuthFlowMissing>  — state memang tidak ada (aplikasi ditutup di
 *      tengah alur, JS context baru, atau halaman dibuka langsung). Menampilkan
 *      penjelasan + TOMBOL yang berfungsi — bukan layar putih tanpa jalan
 *      keluar, yang membuat tombol back perangkat terasa mati.
 *
 * Mengapa tinggal di `lib/` dan bukan `components/`: perbaikan ini sengaja
 * dibatasi ke `app/` + `lib/` agar tidak menyentuh berkas yang memengaruhi
 * fingerprint native (`app.json`, `assets/`) — OTA harus tetap berlaku untuk
 * APK yang sudah terpasang. Aturan statis `check:screens` (S1–S8) menganggap
 * berkas di `lib/` sebagai sumber produk biasa, jadi penempatan ini tetap
 * lolos seluruh gate.
 */
import { ActivityIndicator, View } from "react-native"
import { WarningCircle } from "phosphor-react-native"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"

/** Keadaan "sedang memulihkan state alur" — bukan blank, bukan error. */
export function AuthFlowLoading({ label }: { label: string }) {
  return (
    <Screen padded={false} edges={["top", "bottom"]}>
      <View className="flex-1 items-center justify-center gap-4 px-6">
        <ActivityIndicator />
        <Text variant="body" tone="secondary" className="text-center text-pretty">
          {label}
        </Text>
      </View>
    </Screen>
  )
}

/**
 * Keadaan "state alur tidak ditemukan" — selalu membawa jalan keluar.
 *
 * `onBack` WAJIB disediakan pemanggil dan harus selalu melakukan navigasi
 * nyata (kembali, atau replace ke pintu masuk alur). Tanpa itu layar kembali
 * menjadi jalan buntu.
 */
export function AuthFlowMissing({
  title,
  description,
  backLabel = "Kembali",
  onBack,
}: {
  title: string
  description: string
  backLabel?: string
  onBack: () => void
}) {
  return (
    <Screen padded={false} edges={["top", "bottom"]}>
      <EmptyState
        icon={WarningCircle}
        title={title}
        description={description}
        action={
          <Button fullWidth={false} onPress={onBack}>
            {backLabel}
          </Button>
        }
      />
    </Screen>
  )
}
