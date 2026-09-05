import { useRouter } from "expo-router"
import { MagnifyingGlass } from "phosphor-react-native"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Header } from "@/components/ui/header"
import { Screen } from "@/components/ui/screen"
import { ROUTES } from "@/lib/routes"

export default function NotFoundScreen() {
  const router = useRouter()
  return (
    <Screen padded={false}>
      <Header title="Halaman tidak ditemukan" />
      <EmptyState
        icon={MagnifyingGlass}
        title="Tautan tidak tersedia"
        description="Tautan mungkin sudah berubah. Kembali ke beranda untuk melanjutkan."
        action={
          <Button fullWidth={false} onPress={() => router.replace(ROUTES.home)}>
            Ke beranda
          </Button>
        }
      />
    </Screen>
  )
}
