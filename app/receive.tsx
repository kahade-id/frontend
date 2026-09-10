/**
 * Kahade — Terima (Receive) — layar QR kode agar pengguna lain bisa
 * mengirim saldo ke akun ini dengan memindai kode.
 *
 * QR berisi URL deep-link `kahade://transfer?to=<username>`; saat dipindai
 * (dibuka di perangkat yang punya app Kahade) langsung masuk ke layar
 * Transfer dengan penerima terisi otomatis ke username pemilik QR.
 */
import { useCallback, useMemo, useState } from "react"
import { ScrollView, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Share } from "react-native"
import { Copy, QrCode as QrCodeIcon, ShareNetwork, Wallet } from "phosphor-react-native"
import { useRouter } from "expo-router"

import { api } from "@/lib/api"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"
import { useCopy } from "@/lib/clipboard"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { CopyableField } from "@/components/ui/copyable-field"
import { FadeIn } from "@/components/ui/fade-in"
import { Header } from "@/components/ui/header"
import { Heading } from "@/components/ui/heading"
import { Icon } from "@/components/ui/icon"
import { QRCodeDisplay } from "@/components/ui/qr-code-display"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"
import { Avatar } from "@/components/ui/avatar"

/** Scheme deep-link app. */
const SCHEME = "kahade://transfer?to="

export default function ReceiveScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const toast = useToast()
  const { copied, copy } = useCopy()
  const [qrSize, setQrSize] = useState(220)

  const profile = useApiQuery("receive-profile", (signal) => api.users.getMe(signal))
  const username = profile.data?.username
  const displayName = profile.data?.fullName?.trim() || username || "Pengguna Kahade"

  const payload = useMemo(() => (username ? `${SCHEME}${encodeURIComponent(username)}` : ""), [username])

  const handleCopy = useCallback(() => {
    if (!username) return
    copy(username)
    toast.show({ title: "Username disalin", tone: "success" })
  }, [username, copy, toast.show])

  const handleShare = useCallback(async () => {
    if (!payload) return
    try {
      await Share.share({
        message: `Kirim saldo ke @${username} di Kahade: ${payload}`,
      })
    } catch {
      /* user membatalkan */
    }
  }, [payload, username])

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Terima Saldo" safeArea={false} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + tokens.space[8] }}
        contentContainerClassName="px-6 pt-6 gap-6"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <FadeIn duration="fast">
          <View className="items-center gap-2">
            <Heading level={1} className="text-center text-balance">
              Tunjukkan QR Anda
            </Heading>
            <Text variant="body" tone="secondary" className="text-center text-pretty">
              Minta orang lain memindai kode ini untuk mengirim saldo langsung ke dompet Anda.
            </Text>
          </View>
        </FadeIn>

        <FadeIn duration="fast" className="mt-2">
          <Card variant="elevated" className="items-center gap-5 p-6" onLayout={(e) => setQrSize(Math.min(240, Math.max(180, e.nativeEvent.layout.width - 120)))}>
            {profile.loading || !username ? (
              <View className="h-[200px] w-[200px] items-center justify-center">
                <Icon icon={QrCodeIcon} size="xl" tone="disabled" />
              </View>
            ) : (
              <QRCodeDisplay
                value={payload}
                size={qrSize}
                errorCorrection="M"
                caption=""
                title={`@${username}`}
              />
            )}

            <View className="w-full items-center gap-2">
              {profile.loading ? (
                <View className="h-6 w-32 rounded-xs bg-surface" />
              ) : (
                <View className="flex-row items-center gap-3">
                  <Avatar
                    source={profile.data?.avatarUrl ?? undefined}
                    name={displayName}
                    size="sm"
                  />
                  <View>
                    <Text variant="body" weight={600} tone="primary" numberOfLines={1}>
                      {displayName}
                    </Text>
                    <Text variant="caption" tone="secondary">
                      @{username}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            <View className="w-full">
              <CopyableField
                label="Username"
                value={username ?? ""}
                mono
                copied={copied}
                onCopy={() => handleCopy()}
              />
            </View>
          </Card>
        </FadeIn>

        <View className="gap-3">
          <Button leftIcon={ShareNetwork} onPress={handleShare} disabled={!username}>
            Bagikan kode saya
          </Button>
          <Button variant="secondary" leftIcon={Copy} onPress={handleCopy} disabled={!username}>
            Salin username
          </Button>
          <Button variant="ghost" onPress={() => router.push(ROUTES.transfer)}>
            Kirim saldo sebagai gantinya
          </Button>
        </View>

        <View className="items-center gap-2 pt-2">
          <Icon icon={Wallet} size="sm" tone="default" />
          <Text variant="caption" tone="secondary" className="text-center text-pretty">
            Kode ini hanya berlaku untuk akun Anda dan tidak meminta akses apapun dari perangkat
            pemindai. Dana masuk langsung ke saldo dompet.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  )
}
