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

export function GuestLoginPrompt({ next, bare = false }: { next: string; bare?: boolean }) {
  const router = useRouter()
  const loginHref = next
    ? ({ pathname: "/login", params: { next } } as const)
    : ROUTES.login
  // NAV-013: "Buat akun baru" ikut membawa `next` — tanpanya tujuan hilang
  // dan registrasi selesai mendarat di beranda (tidak konsisten dgn "Masuk").
  const registerHref = next
    ? ({ pathname: "/register", params: { next } } as const)
    : ROUTES.register

  const body = (
    <View className="flex-1 justify-center px-5">
      <EmptyState
        icon={LockKey}
        title="Masuk dulu untuk melanjutkan"
        description="Fitur ini khusus pengguna yang sudah punya akun Kahade. Masuk atau daftar untuk melanjutkan, lalu Anda kembali ke halaman yang dituju."
        action={
          <View className="w-full gap-2">
            {/* NAV-014: `replace` (bukan push) — push lalu replace setelah
                login menumpuk dua entri halaman yang sama; Back malah
                mendarat di halaman itu lagi. */}
            <Button onPress={() => router.replace(loginHref)}>Masuk</Button>
            <Button variant="secondary" onPress={() => router.replace(registerHref)}>
              Buat akun baru
            </Button>
            <Button variant="ghost" onPress={() => router.replace(ROUTES.home)}>
              Kembali ke beranda
            </Button>
          </View>
        }
      />
    </View>
  )

  // `bare`: pemanggil sudah punya Screen + header (dan switcher mode), jadi
  // prompt tidak membungkus ulang — kalau tidak, tamu kehilangan jalan ganti mode.
  if (bare) return body

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Masuk diperlukan" />
      {body}
    </Screen>
  )
}
