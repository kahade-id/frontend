/**
 * Kahade — Layar Pindai QR (/scan).
 *
 * Menyediakan dua fungsi utama:
 *   1. Pindai Kode: Viewfinder dengan animasi laser, tombol senter, pemilih
 *      gambar galeri, dan input kode manual untuk fleksibilitas pengguna.
 *   2. QR Saya: Menampilkan kode QR profil pengguna terautentikasi untuk
 *      mempermudah pembayaran, transaksi langsung, dan pembagian profil.
 *
 * Mematuhi aturan desain Kahade:
 *   - Tanpa literal hex (menggunakan token & semantic tailwind).
 *   - Menggunakan ROUTES untuk seluruh navigasi.
 *   - Menggunakan QRCodeDisplay resmi dari design system.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import {
  Animated,
  Easing,
  Share,
  View,
} from "react-native"
import { useRouter } from "expo-router"
import {
  CheckCircle,
  Copy,
  Image as ImageIcon,
  Keyboard,
  Lightning,
  QrCode,
  ShareNetwork,
  User,
} from "phosphor-react-native"

import { api } from "@/lib/api"
import { useCopy } from "@/lib/clipboard"
import { useHasSession } from "@/lib/guest-gate"
import { pickImage } from "@/lib/image-picker"
import { ROUTES } from "@/lib/routes"

import { Avatar } from "@/components/ui/avatar"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Header } from "@/components/ui/header"
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { Input } from "@/components/ui/input"
import { QRCodeDisplay } from "@/components/ui/qr-code-display"
import { Screen } from "@/components/ui/screen"
import { SegmentedControl, type SegmentItem } from "@/components/ui/segmented-control"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"
import { useApiQuery } from "@/lib/use-api-query"

type ScanTab = "scan" | "my-qr"

const SCAN_TABS: readonly SegmentItem<ScanTab>[] = [
  { value: "scan", label: "Pindai QR" },
  { value: "my-qr", label: "Kode QR Saya" },
]

type ParsedTarget = {
  type: "profile" | "order" | "order-link" | "showcase" | "chat" | "other"
  label: string
  detail: string
  action: () => void
}

export default function ScanScreen() {
  const router = useRouter()
  const toast = useToast()
  const { copy } = useCopy()
  const hasSession = useHasSession()

  const [activeTab, setActiveTab] = useState<ScanTab>("scan")
  const [torchOn, setTorchOn] = useState(false)
  const [manualInputOpen, setManualInputOpen] = useState(false)
  const [manualCode, setManualCode] = useState("")
  const [detectedResult, setDetectedResult] = useState<ParsedTarget | null>(null)

  // Animasi garis pemindai (laser bar)
  const laserY = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (activeTab !== "scan") return
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(laserY, {
          toValue: 210,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(laserY, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    )
    anim.start()
    return () => anim.stop()
  }, [laserY, activeTab])

  // Muat profil pengguna saat tab QR Saya aktif
  const meQuery = useApiQuery(
    "scan:me",
    (signal) => (hasSession ? api.users.getMe(signal) : Promise.resolve(null)),
    hasSession,
  )

  const me = meQuery.data
  const myUsername = me?.username ?? ""
  const myProfileUrl = myUsername ? `https://kahade.id/u/${myUsername}` : "https://kahade.id"

  const parseCode = useCallback(
    (raw: string): ParsedTarget => {
      const text = raw.trim()

      // 1. Tautan atau path profil pengguna
      const userMatch = text.match(/(?:kahade\.id\/(?:u|user)\/|^@?)([a-zA-Z0-9_.-]{3,30})$/)
      if (userMatch && !text.includes("/order/") && !text.includes("/link/")) {
        const username = userMatch[1]
        return {
          type: "profile",
          label: "Profil Pengguna",
          detail: `@${username}`,
          action: () => {
            setDetectedResult(null)
            router.push(ROUTES.userProfile(username))
          },
        }
      }

      // 2. Tautan atau kode pesanan
      const orderMatch = text.match(/(?:kahade\.id\/order\/|^)(KHD-[a-zA-Z0-9]+|[a-f0-9-]{8,36})/i)
      if (orderMatch) {
        const orderId = orderMatch[1]
        return {
          type: "order",
          label: "Pesanan Escrow",
          detail: `ID: ${orderId}`,
          action: () => {
            setDetectedResult(null)
            router.push(ROUTES.orderDetail(orderId))
          },
        }
      }

      // 3. Tautan order-link
      const linkMatch = text.match(/(?:kahade\.id\/(?:order-link|link)\/)([a-zA-Z0-9_-]+)/i)
      if (linkMatch) {
        const token = linkMatch[1]
        return {
          type: "order-link",
          label: "Tautan Transaksi",
          detail: `Token: ${token}`,
          action: () => {
            setDetectedResult(null)
            router.push(ROUTES.orderLink(token))
          },
        }
      }

      // 4. Karya etalase
      const showcaseMatch = text.match(/(?:kahade\.id\/showcase\/)([a-zA-Z0-9_-]+)/i)
      if (showcaseMatch) {
        const showcaseId = showcaseMatch[1]
        return {
          type: "showcase",
          label: "Karya Etalase",
          detail: `ID: ${showcaseId}`,
          action: () => {
            setDetectedResult(null)
            router.push(ROUTES.showcaseDetail(showcaseId))
          },
        }
      }

      // 5. Format teks umum
      return {
        type: "other",
        label: "Kode / Tautan",
        detail: text,
        action: () => {
          setDetectedResult(null)
          void copy(text)
        },
      }
    },
    [router, copy],
  )

  const handlePickFromGallery = useCallback(async () => {
    try {
      const res = await pickImage({ source: "library" })
      if (res.status === "picked") {
        toast.show({
          title: "Gambar dipilih",
          description: "Menganalisis kode QR dari gambar…",
          tone: "info",
        })
        // Buka dialog konfirmasi masukan kode
        setManualInputOpen(true)
      } else if (res.status === "denied") {
        toast.show({
          title: "Izin galeri ditolak",
          description: "Aktifkan izin penyimpanan untuk memilih foto dari galeri.",
          tone: "danger",
        })
      }
    } catch {
      toast.show({
        title: "Gagal memilih foto",
        tone: "danger",
      })
    }
  }, [toast])

  const handleManualSubmit = useCallback(() => {
    if (!manualCode.trim()) return
    const parsed = parseCode(manualCode)
    setManualInputOpen(false)
    setManualCode("")
    setDetectedResult(parsed)
  }, [manualCode, parseCode])

  const handleShareProfile = useCallback(async () => {
    if (!myProfileUrl) return
    try {
      await Share.share({
        title: "Profil Kahade",
        message: `Kunjungi profil saya di Kahade: ${myProfileUrl}`,
        url: myProfileUrl,
      })
    } catch {
      // Abaikan bila batal
    }
  }, [myProfileUrl])

  return (
    <Screen edges={["top"]} padded={false} className="bg-background">
      {/* ── Header ── */}
      <Header
        title="Pindai QR"
        showBack
        right={
          activeTab === "scan" ? (
            <IconButton
              icon={Lightning}
              variant={torchOn ? "primary" : "ghost"}
              active={torchOn}
              size="sm"
              accessibilityLabel={torchOn ? "Matikan lampu kilat" : "Nyalakan lampu kilat"}
              onPress={() => setTorchOn((prev) => !prev)}
            />
          ) : undefined
        }
      />

      {/* ── Segment Selector ── */}
      <View className="px-5 pt-3 pb-2">
        <SegmentedControl
          items={SCAN_TABS}
          value={activeTab}
          onChange={setActiveTab}
          accessibilityLabel="Mode pemindai"
        />
      </View>

      {/* ── Mode 1: Pindai QR ── */}
      {activeTab === "scan" ? (
        <View className="flex-1 items-center justify-between px-5 pb-8 pt-4">
          <Text variant="caption" tone="secondary" className="text-center px-4">
            Arahkan kamera ke kode QR untuk memindai transaksi, profil pengguna, atau tautan Kahade.
          </Text>

          {/* ── Viewfinder Box ── */}
          <View className="relative h-64 w-64 items-center justify-center overflow-hidden rounded-2xl border border-border bg-surface-raised">
            {/* Sudut-sudut bingkai pemindai */}
            <View className="absolute left-2 top-2 h-6 w-6 border-l-2 border-t-2 border-primary rounded-tl-md" />
            <View className="absolute right-2 top-2 h-6 w-6 border-r-2 border-t-2 border-primary rounded-tr-md" />
            <View className="absolute bottom-2 left-2 h-6 w-6 border-b-2 border-l-2 border-primary rounded-bl-md" />
            <View className="absolute bottom-2 right-2 h-6 w-6 border-b-2 border-r-2 border-primary rounded-br-md" />

            {/* Ikon latar watermark */}
            <View className="opacity-10">
              <Icon icon={QrCode} size="xl" tone="default" />
            </View>

            {/* Animasi garis laser pemindai */}
            <Animated.View
              style={{
                transform: [{ translateY: laserY }],
              }}
              className="absolute left-4 right-4 h-0.5 bg-primary shadow-sm"
            />
          </View>

          {/* ── Tombol Aksi Tambahan Bawah ── */}
          <View className="w-full gap-3">
            <View className="flex-row items-center gap-3">
              <Button
                variant="secondary"
                size="md"
                leftIcon={ImageIcon}
                onPress={() => void handlePickFromGallery()}
                className="flex-1"
              >
                Dari Galeri
              </Button>
              <Button
                variant="secondary"
                size="md"
                leftIcon={Keyboard}
                onPress={() => setManualInputOpen(true)}
                className="flex-1"
              >
                Ketik Manual
              </Button>
            </View>
          </View>
        </View>
      ) : (
        /* ── Mode 2: Kode QR Saya ── */
        <View className="flex-1 items-center justify-center px-5 pb-8 pt-2">
          {hasSession ? (
            <View className="w-full max-w-sm items-center gap-5 rounded-2xl border border-border bg-surface p-6 shadow-sm">
              {/* Info Pengguna */}
              <View className="items-center gap-2">
                <Avatar
                  source={me?.avatarUrl ? { uri: me.avatarUrl } : undefined}
                  name={me?.fullName || me?.username || "Pengguna"}
                  size="lg"
                  verified={(me as unknown as { isKycVerified?: boolean })?.isKycVerified}
                />
                <View className="items-center">
                  <Text variant="h3" weight={600} numberOfLines={1}>
                    {me?.fullName || me?.username}
                  </Text>
                  <Text variant="caption" tone="secondary">
                    @{me?.username}
                  </Text>
                </View>
              </View>

              {/* Tampilan Kode QR Resmi */}
              <View className="items-center justify-center rounded-xl bg-surface-raised p-4 border border-border">
                <QRCodeDisplay
                  value={myProfileUrl}
                  size={200}
                  caption={myProfileUrl}
                  accessibilityLabel="Kode QR Profil Saya"
                />
              </View>

              <Text variant="caption" tone="secondary" className="text-center px-2">
                Tunjukkan kode ini kepada pembeli atau mitra untuk membuka profil dan bertransaksi escrow secara aman.
              </Text>

              {/* Aksi Berbagi */}
              <View className="w-full flex-row gap-3 pt-1">
                <Button
                  variant="secondary"
                  size="md"
                  leftIcon={Copy}
                  onPress={() => {
                    void copy(myProfileUrl)
                    toast.show({ title: "Tautan disalin ke papan klip", tone: "success" })
                  }}
                  className="flex-1"
                >
                  Salin
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  leftIcon={ShareNetwork}
                  onPress={() => void handleShareProfile()}
                  className="flex-1"
                >
                  Bagikan
                </Button>
              </View>
            </View>
          ) : (
            <View className="w-full max-w-sm items-center gap-4 rounded-2xl border border-border bg-surface p-6 text-center">
              <Icon icon={User} size="lg" tone="default" />
              <Text variant="h3" weight={600} className="text-center">
                Masuk untuk Melihat QR Saya
              </Text>
              <Text variant="body" tone="secondary" className="text-center">
                Masuk ke akun Kahade untuk membuat kode QR profil Anda sendiri.
              </Text>
              <Button
                variant="primary"
                onPress={() => router.push(ROUTES.loginRequired("/scan"))}
                fullWidth
              >
                Masuk Sekarang
              </Button>
            </View>
          )}
        </View>
      )}

      {/* ── Dialog Input Manual ── */}
      <BottomSheet
        visible={manualInputOpen}
        onRequestClose={() => setManualInputOpen(false)}
        title="Masukkan Kode atau Tautan"
        footer={
          <View className="flex-row gap-3">
            <Button
              variant="secondary"
              onPress={() => setManualInputOpen(false)}
              className="flex-1"
            >
              Batal
            </Button>
            <Button
              variant="primary"
              disabled={!manualCode.trim()}
              onPress={handleManualSubmit}
              className="flex-1"
            >
              Lanjutkan
            </Button>
          </View>
        }
      >
        <View className="gap-3 px-5 py-3">
          <Text variant="caption" tone="secondary">
            Ketik atau tempel ID transaksi (mis. KHD-0123), username (@username), atau tautan Kahade.
          </Text>
          <Input
            value={manualCode}
            onChangeText={setManualCode}
            placeholder="Contoh: @kahade atau KHD-8921"
            autoCapitalize="none"
            autoFocus
            returnKeyType="go"
            onSubmitEditing={handleManualSubmit}
          />
        </View>
      </BottomSheet>

      {/* ── Hasil Pemindaian Sheet ── */}
      <BottomSheet
        visible={detectedResult !== null}
        onRequestClose={() => setDetectedResult(null)}
        title="Kode Terdeteksi"
        footer={
          <View className="flex-row gap-3">
            <Button
              variant="secondary"
              onPress={() => setDetectedResult(null)}
              className="flex-1"
            >
              Pindai Lagi
            </Button>
            <Button
              variant="primary"
              onPress={() => detectedResult?.action()}
              className="flex-1"
            >
              {detectedResult?.type === "other" ? "Salin Kode" : "Buka Sekarang"}
            </Button>
          </View>
        }
      >
        {detectedResult ? (
          <View className="gap-3 px-5 py-3">
            <View className="flex-row items-center gap-3 rounded-xl bg-surface p-4 border border-border">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-surface-raised">
                <Icon icon={CheckCircle} size="md" tone="active" />
              </View>
              <View className="flex-1 min-w-0">
                <Text variant="label" tone="secondary">
                  {detectedResult.label}
                </Text>
                <Text variant="bodyLarge" weight={600} numberOfLines={2}>
                  {detectedResult.detail}
                </Text>
              </View>
            </View>
          </View>
        ) : null}
      </BottomSheet>
    </Screen>
  )
}
