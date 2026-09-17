/**
 * Tab sosial Showcase — feed publik bergaya thread.
 * Feed dipisahkan dari Discover pengguna agar tiap tab memiliki satu tujuan:
 * Showcase untuk karya/percakapan, Discover untuk menemukan akun.
 */
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { ImagesSquare, Plus } from "phosphor-react-native"
import { router } from "expo-router"

import { ShowcaseFeedTab } from "./discover"
import { Header } from "@/components/ui/header"
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { Screen } from "@/components/ui/screen"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"

export default function SocialShowcaseScreen() {
  const insets = useSafeAreaInsets()

  return (
    <Screen edges={["top"]} padded={false}>
      <Header
        showBack={false}
        title="Showcase"
        left={<Icon icon={ImagesSquare} size="md" tone="active" />}
        right={
          <IconButton
            icon={Plus}
            accessibilityLabel="Kelola showcase saya"
            accessibilityHint="Buka halaman untuk menambah dan mengatur showcase"
            onPress={() => router.push(ROUTES.showcaseManagement)}
          />
        }
      />
      <ShowcaseFeedTab bottomPadding={insets.bottom + tokens.space[8]} />
    </Screen>
  )
}
