/**
 * Kahade — Terima (Receive) — layar QR kode agar pengguna lain bisa
 * mengirim saldo ke akun ini dengan memindai kode.
 *
 * QR berisi URL universal `https://kahade.id/transfer?to=<username>&amount=<n>`
 * (FE-IMP-4 item 27); nominal opsional — bila diisi, pembayar tinggal
 * konfirmasi. Saat dipindai dari aplikasi, langsung masuk ke layar Transfer
 * dengan penerima (dan nominal) terisi otomatis.
 */
import { useCallback, useMemo, useState } from "react"
import { ScrollView, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Share } from "react-native"
import { Copy, QrCode as QrCodeIcon, ShareNetwork, Wallet } from "phosphor-react-native"
import { useRouter } from "expo-router"

import { api } from "@/lib/api"
import { AMOUNT_LIMITS } from "@/lib/financial"
import { formatRupiah } from "@/lib/format"
import { formatRupiahTypingText, parseRupiahTypingText } from "@/lib/rupiah-input"
import { queryKeys } from "@/lib/query-keys"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"
import { useCopy } from "@/lib/clipboard"
import { transferUrl } from "@/lib/deeplinks"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { CopyableField } from "@/components/ui/copyable-field"
import { FadeIn } from "@/components/ui/fade-in"
import { Header } from "@/components/ui/header"
import { Heading } from "@/components/ui/heading"
import { Icon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { QRCodeDisplay } from "@/components/ui/qr-code-display"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"
import { WalletDisabledScreen } from "@/components/ui/wallet-disabled"
import { Avatar } from "@/components/ui/avatar"
import { translate } from "@/lib/i18n/translate"
import { useWalletGate } from "@/lib/use-wallet-enabled"

export default function ReceiveScreen() {
  // Mode Tanpa Wallet Internal (BI-safe): flag false = layar diganti
  // <WalletDisabledScreen/> (deep link ikut tertutup).
  const walletGate = useWalletGate()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const toast = useToast()
  const { copied, copy } = useCopy()
  const [qrSize, setQrSize] = useState(220)
  // FE-IMP-4 item 27: nominal opsional yang dikodekan ke QR — pembayar tinggal
  // konfirmasi di layar Transfer.
  const [amountText, setAmountText] = useState("")

  const profile = useApiQuery(queryKeys.me(), (signal) => api.users.getMe(signal))
  const username = profile.data?.username
  const displayName = profile.data?.fullName?.trim() || username || "Pengguna Kahade"

  const requestedAmount = useMemo(() => {
    const n = Number(amountText.replace(/[^\d]/g, ""))
    return Number.isSafeInteger(n) && n > 0 ? n : undefined
  }, [amountText])
  /**
   * TRX-015 (audit UI/UX 2026-09-28): nominal QR dibatasi ke rentang transfer
   * yang sah — layar Transfer memotong diam-diam ke maksimum, jadi QR tidak
   * boleh menjanjikan angka yang tak akan terisi. Clamp dilakukan DI SINI
   * dan helper text menjelaskannya secara eksplisit (tidak diam-diam).
   */
  const transferMax = AMOUNT_LIMITS.transfer.maximum
  const transferMin = AMOUNT_LIMITS.transfer.minimum
  const clampedToMax = requestedAmount != null && requestedAmount > transferMax
  const belowMinimum = requestedAmount != null && requestedAmount < transferMin
  const amount = requestedAmount != null ? Math.min(requestedAmount, transferMax) : undefined
  const amountHelperText =
    amount == null
      ? "Kosongkan bila pembayar bebas menentukan nominal."
      : clampedToMax
        ? `Melebihi batas transfer — QR berisi permintaan ${formatRupiah(transferMax)} (maksimum).`
        : belowMinimum
          ? `QR berisi permintaan ${formatRupiah(amount)} — di bawah minimum transfer ${formatRupiah(transferMin)}, pembayar perlu menyesuaikan.`
          : `QR berisi permintaan ${formatRupiah(amount)}.`
  const payload = useMemo(
    () => (username ? transferUrl(username, amount) : ""),
    [username, amount],
  )

  const handleCopy = useCallback(() => {
    if (!username) return
    copy(username)
    toast.show({ title: "Username disalin", tone: "success" })
  }, [username, copy, toast.show])

  const handleShare = useCallback(async () => {
    if (!payload) return
    try {
      await Share.share({
        message: translate("Kirim saldo ke @{x} di Kahade: {y}", { x: username ?? "", y: payload }),
      })
    } catch {
      /* user membatalkan */
    }
  }, [payload, username])

  // Mode Tanpa Wallet Internal (BI-safe): flag false = layar blokir.
  if (walletGate === "off") {
    return <WalletDisabledScreen />
  }

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Terima Saldo" safeArea={false} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + tokens.space[8] }}
        contentContainerClassName="px-5 pt-6 gap-6"
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
                    {/* UI-W018: username kosong (profil gagal dimuat) dulu
                        merender "@" telanjang. */}
                    {username ? (
                      <Text variant="caption" tone="secondary">
                        @{username}
                      </Text>
                    ) : null}
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

            {/* FE-IMP-4 item 27: minta nominal tertentu. */}
            <View className="w-full gap-1">
              <Input
                label="Nominal yang diminta (opsional)"
                // FE-052: pemisah ribuan saat mengetik; state tetap digit
                // mentah — nilai ke QR/backend tidak berubah.
                value={formatRupiahTypingText(amountText)}
                onChangeText={(text) => {
                  const parsed = parseRupiahTypingText(text)
                  if (parsed === null) return
                  setAmountText(parsed)
                }}
                placeholder="cth: 50000"
                keyboardType="numeric"
                inputMode="numeric"
                helperText={amountHelperText}
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
