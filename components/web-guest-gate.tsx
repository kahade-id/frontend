/**
 * Kahade — <GuestLoginPrompt> ajakan login untuk pengunjung web tamu.
 *
 * Dirender oleh root layout sebagai lapisan penuh saat pengunjung tanpa
 * akun membuka layar ber-auth (lihat isProtectedPath). Tidak dipakai di
 * native — gate native tetap onboarding/login pada pembukaan pertama.
 */
import { View } from "react-native"
import { useRouter } from "expo-router"
import { LockKey } from "phosphor-react-native"

import { ROUTES } from "@/lib/routes"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Header } from "@/components/ui/header"
import { Screen } from "@/components/ui/screen"

export function GuestLoginPrompt({ next }: { next: string }) {
  const router = useRouter()
  const loginHref = next
    ? ({ pathname: "/login", params: { next } } as const)
    : ROUTES.login

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Masuk diperlukan" />
      <View className="flex-1 justify-center px-6">
        <EmptyState
          icon={LockKey}
          title="Masuk dulu untuk melanjutkan"
          description="Fitur ini khusus pengguna yang sudah punya akun Kahade. Masuk atau daftar untuk melanjutkan, lalu Anda kembali ke halaman yang dituju."
          action={
            <View className="w-full gap-2">
              <Button onPress={() => router.push(loginHref)}>Masuk</Button>
              <Button variant="secondary" onPress={() => router.push(ROUTES.register)}>
                Buat akun baru
              </Button>
              <Button variant="ghost" onPress={() => router.replace(ROUTES.home)}>
                Kembali ke beranda
              </Button>
            </View>
          }
        />
      </View>
    </Screen>
  )
}
