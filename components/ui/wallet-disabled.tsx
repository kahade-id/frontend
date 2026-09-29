/**
 * Kahade — layar pengganti saat kill-switch dompet MATI (BI-safe).
 *
 * Dipakai SEMUA layar dompet (saldo, top-up, transfer, terima, riwayat, …)
 * ketika `useWalletGate()` mengembalikan "off" — termasuk deep link: route
 * tetap bisa di-mount, tapi yang tampil hanya layar ini, bukan konten dompet.
 *
 * Minimalis (§9): satu ikon, satu judul, satu kalimat, satu aksi primer
 * (Kelola Rekening Bank — karena dana escrow kini mengalir ke bank) +
 * tombol kembali.
 */
import { View } from "react-native"
import { useRouter } from "expo-router"
import { Wallet } from "phosphor-react-native"

import { ROUTES } from "@/lib/routes"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Header } from "@/components/ui/header"
import { Screen } from "@/components/ui/screen"

export function WalletDisabledScreen() {
  const router = useRouter()
  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Dompet" />
      <View className="flex-1 justify-center px-6 pb-16">
        <EmptyState
          icon={Wallet}
          title="Dompet tidak tersedia"
          description="Fitur dompet sedang dinonaktifkan. Dana escrow diteruskan langsung ke rekening bank Anda."
          action={
            <Button fullWidth={false} onPress={() => router.push(ROUTES.bankAccounts)}>
              Kelola Rekening Bank
            </Button>
          }
          secondaryAction={
            <Button variant="ghost" fullWidth={false} onPress={() => router.back()}>
              Kembali
            </Button>
          }
        />
      </View>
    </Screen>
  )
}
