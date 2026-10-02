import { useRouter } from "expo-router"
import { MagnifyingGlass } from "phosphor-react-native"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { Header } from "@/components/ui/header"
import { Screen } from "@/components/ui/screen"
import { ROUTES } from "@/lib/routes"
import { translate } from "@/lib/i18n/translate"

export default function NotFoundScreen() {
  const router = useRouter()
  return (
    <Screen edges={["top", "bottom"]} padded={false}>
      <Header title={translate("Halaman tidak ditemukan")} />
      <EmptyState
        icon={MagnifyingGlass}
        title={translate("Tautan tidak tersedia")}
        description={translate("Tautan mungkin sudah berubah. Kembali ke beranda untuk melanjutkan.")}
        action={
          <Button fullWidth={false} onPress={() => router.replace(ROUTES.home)}>
            {translate("Ke beranda")}
          </Button>
        }
      />
    </Screen>
  )
}