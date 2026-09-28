/**
 * Kahade — Layar Pindai QR (/scan).
 *
 * FE-IMP-4 (item 17–24): pemindaian kamera BENAR-BENAR memakai expo-camera
 * (CameraView + onBarcodeScanned), bukan viewfinder dekoratif. Kode baru
 * aktif setelah APK baru (plugin native) — build menunggu perintah user.
 *
 * Dua tab:
 *   1. "Pindai QR": kamera nyata (native) / panel fallback (web), decode dari
 *      galeri via `scanFromURLAsync`, input manual dengan validasi live,
 *      riwayat pindaian per perangkat, dan sheet konfirmasi untuk SEMUA
 *      hasil — termasuk anti-phishing untuk URL asing (tidak auto-open).
 *   2. "QR Saya": QR profil + label eksplisit, mode layar penuh dengan
 *      kecerahan maksimal (restore otomatis), simpan sebagai gambar.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { Linking, Platform, Share, View } from "react-native"
import { useRouter } from "expo-router"
import * as Haptics from "expo-haptics"
import { CameraView, scanFromURLAsync, useCameraPermissions } from "expo-camera"
import * as Brightness from "expo-brightness"
import { captureView } from "@/lib/capture-view"
import {
  ArrowsOut,
  Camera,
  CheckCircle,
  Copy,
  DownloadSimple,
  Image as ImageIcon,
  Keyboard,
  Lightning,
  QrCode,
  Receipt,
  ShareNetwork,
  Storefront,
  Trash,
  User,
  Wallet,
  Warning,
  X,
} from "phosphor-react-native"

import { api } from "@/lib/api"
import { useCopy } from "@/lib/clipboard"
import { profileUrl } from "@/lib/deeplinks"
import { safeHttpsLink } from "@/lib/external-url"
import { useHasSession } from "@/lib/guest-gate"
import { useUiPrefs } from "@/lib/ui-prefs"
import { translate } from "@/lib/i18n/translate"
import { pickImage } from "@/lib/image-picker"
import { parseQrCode, type QrTarget } from "@/lib/qr-parse"
import { ROUTES } from "@/lib/routes"
import {
  addScanHistory,
  clearScanHistory,
  getScanHistory,
  removeScanHistory,
  type ScanHistoryItem,
} from "@/lib/scan-history"
import { shareContent } from "@/lib/share"

import { Avatar } from "@/components/ui/avatar"
import { Alert } from "@/components/ui/alert"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Header } from "@/components/ui/header"
import { Icon, type IconComponent } from "@/components/ui/icon"
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

const isWeb = Platform.OS === "web"

type DetectedResult = {
  target: QrTarget
  raw: string
}

/**
 * Batch 139 E16 — salinan sheet hasil pindaian per jenis target.
 *
 * Setiap jenis QR mendapat judul, ikon, penjelasan, dan label CTA sendiri
 * supaya pengguna langsung paham apa yang akan terjadi SEBELUM mengetuk.
 * Khusus transfer: peringatan eksplisit + CTA "Lanjut ke Transfer" — aksi
 * hanya MEMBUKA layar transfer untuk direview, TIDAK PERNAH mengeksekusi
 * pemindahan dana (keputusan finansial tetap di tangan pengguna).
 */
function getScanResultCopy(target: QrTarget): {
  title: string
  icon: IconComponent
  iconTone: "active" | "warning" | "default"
  explainer: string
  primaryCta: string
  warnTransfer: boolean
} {
  switch (target.type) {
    case "profile":
      return {
        title: translate("Profil Kahade"),
        icon: User,
        iconTone: "active",
        explainer: target.username
          ? translate("Kode ini membuka profil @{x} di Kahade.", { x: target.username })
          : translate("Kode ini membuka sebuah profil di Kahade."),
        primaryCta: translate("Lihat profil"),
        warnTransfer: false,
      }
    case "order":
      return {
        title: translate("Pesanan"),
        icon: Receipt,
        iconTone: "active",
        explainer: translate("Kode ini membuka detail pesanan terkait."),
        primaryCta: translate("Lihat pesanan"),
        warnTransfer: false,
      }
    case "order-link":
      return {
        title: translate("Tautan Pesanan"),
        icon: Receipt,
        iconTone: "active",
        explainer: translate("Kode ini membuka tautan pembayaran pesanan."),
        primaryCta: translate("Buka tautan pesanan"),
        warnTransfer: false,
      }
    case "showcase":
      return {
        title: translate("Etalase"),
        icon: Storefront,
        iconTone: "active",
        explainer: translate("Kode ini membuka sebuah etalase di Kahade."),
        primaryCta: translate("Lihat etalase"),
        warnTransfer: false,
      }
    case "transfer":
      return {
        title: translate("Permintaan Transfer"),
        icon: Wallet,
        iconTone: "warning",
        explainer: translate(
          "Kode ini berisi permintaan transfer. Periksa kembali nama penerima dan nominal di layar berikutnya — dana TIDAK dikirim otomatis.",
        ),
        primaryCta: translate("Lanjut ke transfer"),
        warnTransfer: true,
      }
    case "external-url":
      return {
        title: translate("Tautan Luar"),
        icon: Warning,
        iconTone: "warning",
        explainer: translate("Kode ini mengarah ke situs di luar Kahade."),
        primaryCta: translate("Buka tautan"),
        warnTransfer: false,
      }
    case "text":
    default:
      return {
        title: translate("Teks / Kode"),
        icon: QrCode,
        iconTone: "default",
        explainer: translate("Kode berisi teks biasa — tidak ada aksi khusus."),
        primaryCta: translate("Salin kode"),
        warnTransfer: false,
      }
  }
}

/** Contoh ketuk-isi untuk input manual (FE-IMP-4 item 20). */
const MANUAL_EXAMPLES = [
  "@kahade",
  "KHD-8921",
  "https://kahade.id/transfer?to=kahade&amount=50000",
] as const

export default function ScanScreen() {
  const router = useRouter()
  const toast = useToast()
  const { copy } = useCopy()
  const hasSession = useHasSession()

  const [activeTab, setActiveTab] = useState<ScanTab>("scan")
  const [torchOn, setTorchOn] = useState(false)
  const [manualInputOpen, setManualInputOpen] = useState(false)
  const [manualCode, setManualCode] = useState("")
  const [detected, setDetected] = useState<DetectedResult | null>(null)
  const [history, setHistory] = useState<ScanHistoryItem[]>([])

  // Kamera nyata (expo-camera). Izin diminta eksplisit — tidak auto-request
  // saat layar dibuka agar tidak mengejutkan pengguna.
  const [permission, requestPermission] = useCameraPermissions()
  // Kunci anti-spam: satu kode diproses sekali sampai sheet ditutup.
  const scanLock = useRef(false)

  // Batch 139 E14: preferensi umpan balik pindaian (per perangkat).
  // Dibaca lewat ref agar callback scan tidak dibuat ulang setiap
  // preferensi berubah.
  const { prefs, setPrefs } = useUiPrefs()
  const scanFeedbackRef = useRef(prefs.scanFeedback)
  scanFeedbackRef.current = prefs.scanFeedback

  const meQuery = useApiQuery(
    "scan:me",
    (signal) => (hasSession ? api.users.getMe(signal) : Promise.resolve(null)),
    hasSession,
  )
  const me = meQuery.data
  const myUsername = me?.username ?? ""
  // FX-002: URL profil kanonis `https://kahade.id/user/<username>`.
  // FX-014: username kosong → jangan render QR menyesatkan.
  const myProfileUrl = myUsername ? profileUrl(myUsername) : null

  // ── Riwayat pindaian ──────────────────────────────────────────────
  useEffect(() => {
    void getScanHistory().then(setHistory)
  }, [])

  const handleDetected = useCallback((raw: string) => {
    // Batch 139 E15: kunci terpusat — SEMUA sumber (kamera, galeri, manual)
    // menghormati lock yang sama; satu kode diproses sekali sampai sheet
    // ditutup ("Pindai Lagi").
    if (scanLock.current) return
    scanLock.current = true
    const text = raw.trim()
    if (!text) {
      scanLock.current = false
      return
    }
    const target = parseQrCode(text)
    // Batch 139 E14: getaran konfirmasi saat kode berhasil dipindai — hanya
    // bila pengguna mengaktifkannya di preferensi. Haptic tidak mengeluarkan
    // bunyi sehingga otomatis menghormati mode senyap perangkat; bunyi
    // sengaja TIDAK ditambahkan (butuh aset audio + konfigurasi audio yang
    // terbukti tidak mengabaikan silent mode — dilaporkan sebagai batasan).
    if (scanFeedbackRef.current && Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined)
    }
    // FE-IMP-4 item 21: catat ke riwayat per perangkat.
    void addScanHistory({
      raw: text,
      type: target.type,
      label: target.label,
      detail: target.detail,
    }).then(setHistory)
    setDetected({ target, raw: text })
  }, [])

  const handleBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      // E15: lock dicek di handleDetected (terpusat untuk semua sumber).
      handleDetected(data)
    },
    [handleDetected],
  )

  const closeResult = useCallback(() => {
    setDetected(null)
    // Buka kunci agar bisa memindai kode berikutnya.
    scanLock.current = false
  }, [])

  // ── Galeri: decode QR dari gambar via expo-camera (FE-IMP-4 item 19) ──
  const handlePickFromGallery = useCallback(async () => {
    try {
      const res = await pickImage({ source: "library" })
      if (res.status === "picked") {
        if (isWeb) {
          toast.show({
            title: "Hanya tersedia di aplikasi",
            description: "Pindai dari galeri membutuhkan aplikasi Kahade.",
            tone: "info",
          })
          return
        }
        const results = await scanFromURLAsync(res.asset.uri, ["qr"])
        const data = results[0]?.data?.trim()
        if (data) {
          handleDetected(data)
        } else {
          toast.show({
            title: "Tidak ada kode QR",
            description: "Tidak ditemukan kode QR pada gambar tersebut.",
            tone: "warning",
          })
        }
      } else if (res.status === "denied") {
        toast.show({
          title: "Izin galeri ditolak",
          description: "Aktifkan izin galeri untuk memilih foto.",
          tone: "danger",
        })
      }
    } catch {
      toast.show({ title: "Gagal membaca gambar", tone: "danger" })
    }
  }, [toast, handleDetected])

  // ── Input manual + validasi live (FE-IMP-4 item 20) ──
  const manualTarget = manualCode.trim() ? parseQrCode(manualCode) : null
  const handleManualSubmit = useCallback(() => {
    if (!manualCode.trim()) return
    setManualInputOpen(false)
    handleDetected(manualCode)
    setManualCode("")
  }, [manualCode, handleDetected])

  // ── Aksi hasil pindaian (FE-IMP-4 item 23: konfirmasi sebelum navigasi) ──
  const handleResultAction = useCallback(
    (result: DetectedResult) => {
      const { target } = result
      closeResult()
      switch (target.type) {
        case "profile":
          if (target.username) router.push(ROUTES.userProfile(target.username))
          break
        case "order":
          if (target.orderId) router.push(ROUTES.orderDetail(target.orderId))
          break
        case "order-link":
          if (target.linkToken) router.push(ROUTES.orderLink(target.linkToken))
          break
        case "showcase":
          if (target.showcaseId) router.push(ROUTES.showcaseDetail(target.showcaseId))
          break
        case "transfer": {
          // FE-IMP-4 item 27: nominal dari QR di-prefill di layar transfer.
          const params =
            target.amount != null
              ? `?to=${encodeURIComponent(target.username ?? "")}&amount=${target.amount}`
              : `?to=${encodeURIComponent(target.username ?? "")}`
          router.push(`/transfer${params}` as never)
          break
        }
        case "external-url": {
          // Anti-phishing: hanya dibuka atas ketukan eksplisit di sheet
          // (sheet konfirmasi anti-phishing tetap dipertahankan), DAN hanya
          // URL https bersih (tanpa kredensial) yang lolos gate R-1.
          const safe = target.url ? safeHttpsLink(target.url) : undefined
          if (safe) {
            void Linking.openURL(safe).catch(() => undefined)
          } else {
            toast.show({
              title: translate("Tautan tidak aman — tidak dibuka"),
              tone: "danger",
            })
          }
          break
        }
        case "text":
          void copy(result.raw)
          toast.show({ title: "Kode disalin", tone: "success" })
          break
      }
    },
    [closeResult, router, copy, toast],
  )

  // ── QR Saya: layar penuh + kecerahan (FE-IMP-4 item 28) ──
  const [qrZoomed, setQrZoomed] = useState(false)
  const prevBrightness = useRef<number | null>(null)
  const openQrZoom = useCallback(async () => {
    setQrZoomed(true)
    if (!isWeb) {
      try {
        if (await Brightness.isAvailableAsync()) {
          prevBrightness.current = await Brightness.getBrightnessAsync()
          await Brightness.setBrightnessAsync(1)
        }
      } catch {
        // Abaikan — QR tetap tampil, hanya tanpa boost kecerahan.
      }
    }
  }, [])
  const closeQrZoom = useCallback(async () => {
    setQrZoomed(false)
    if (!isWeb && prevBrightness.current != null) {
      try {
        await Brightness.setBrightnessAsync(prevBrightness.current)
      } catch {
        // Abaikan — sistem mengembalikan kecerahan saat app dijeda.
      }
      prevBrightness.current = null
    }
  }, [])

  // ── QR Saya: simpan sebagai gambar (FE-IMP-4 item 29) ──
  const qrCardRef = useRef<View | null>(null)
  const handleSaveQr = useCallback(async () => {
    try {
      const uri = await captureView(qrCardRef, {
        format: "png",
        quality: 1,
        result: isWeb ? "data-uri" : "tmpfile",
      })
      if (isWeb && typeof document !== "undefined") {
        const anchor = document.createElement("a")
        anchor.href = uri
        anchor.download = `qr-profil-${myUsername || "kahade"}.png`
        document.body.appendChild(anchor)
        anchor.click()
        document.body.removeChild(anchor)
        toast.show({ title: "Gambar QR diunduh", tone: "success" })
      } else {
        await shareContent({
          fileUri: uri,
          mimeType: "image/png",
          dialogTitle: "QR Profil Kahade",
        })
      }
    } catch {
      toast.show({
        title: "Gagal menyimpan gambar",
        description: "Coba lagi, atau gunakan tombol Bagikan.",
        tone: "danger",
      })
    }
  }, [myUsername, toast])

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

  const cameraGranted = !isWeb && permission?.granted === true

  // Batch 139 E16: salinan sheet hasil pindaian mengikuti jenis target
  // (profil/pesanan/etalase/transfer/tautan luar/teks) — bukan generik.
  const resultCopy = detected ? getScanResultCopy(detected.target) : null

  return (
    <Screen edges={["top"]} padded={false} className="bg-background">
      <Header
        title="Pindai QR"
        showBack
        right={
          activeTab === "scan" && cameraGranted ? (
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

      <View className="px-5 pt-3 pb-2">
        <SegmentedControl
          items={SCAN_TABS}
          value={activeTab}
          onChange={setActiveTab}
          accessibilityLabel="Mode pemindai"
        />
      </View>

      {activeTab === "scan" ? (
        <View className="flex-1 px-5 pb-8 pt-4">
          <Text variant="caption" tone="secondary" className="text-center px-4">
            Arahkan kamera ke kode QR untuk memindai transaksi, profil pengguna, atau tautan Kahade.
          </Text>

          {/* ── Area kamera nyata / fallback ── */}
          <View className="items-center py-4">
            {isWeb ? (
              // Fallback web rapi (FE-IMP-4 item 17): kamera tidak tersedia.
              <View className="w-64 items-center gap-3 rounded-2xl border border-border bg-surface-raised p-6">
                <Icon icon={Camera} size="lg" tone="default" />
                <Text variant="body" weight={600} className="text-center">
                  Kamera tidak tersedia di web
                </Text>
                <Text variant="caption" tone="secondary" className="text-center">
                  Buka aplikasi Kahade untuk memindai dengan kamera, atau ketik kode secara manual.
                </Text>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={Keyboard}
                  onPress={() => setManualInputOpen(true)}
                >
                  Ketik Manual
                </Button>
              </View>
            ) : cameraGranted ? (
              <View className="relative h-64 w-64 overflow-hidden rounded-2xl bg-black">
                <CameraView
                  style={{ flex: 1 }}
                  facing="back"
                  enableTorch={torchOn}
                  barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                  onBarcodeScanned={handleBarcodeScanned}
                />
                {/* Bingkai sudut di atas preview */}
                <View className="pointer-events-none absolute inset-0">
                  <View className="absolute left-2 top-2 h-6 w-6 border-l-2 border-t-2 border-primary rounded-tl-md" />
                  <View className="absolute right-2 top-2 h-6 w-6 border-r-2 border-t-2 border-primary rounded-tr-md" />
                  <View className="absolute bottom-2 left-2 h-6 w-6 border-b-2 border-l-2 border-primary rounded-bl-md" />
                  <View className="absolute bottom-2 right-2 h-6 w-6 border-b-2 border-b-2 border-r-2 border-primary rounded-br-md" />
                </View>
              </View>
            ) : (
              // Status izin kamera (FE-IMP-4 item 17).
              <View className="w-64 items-center gap-3 rounded-2xl border border-border bg-surface-raised p-6">
                <Icon icon={Camera} size="lg" tone="default" />
                {permission == null ? (
                  <>
                    <Text variant="body" weight={600} className="text-center">
                      Izinkan akses kamera
                    </Text>
                    <Text variant="caption" tone="secondary" className="text-center">
                      Kamera dipakai untuk memindai kode QR.
                    </Text>
                    <Button
                      variant="primary"
                      size="sm"
                      onPress={() => void requestPermission()}
                    >
                      Aktifkan Kamera
                    </Button>
                  </>
                ) : permission.canAskAgain ? (
                  // Batch 139 E13: penolakan SEMENTARA — masih bisa minta
                  // ulang langsung, jangan lempar ke Pengaturan.
                  <>
                    <Text variant="body" weight={600} className="text-center">
                      Izin kamera belum diberikan
                    </Text>
                    <Text variant="caption" tone="secondary" className="text-center">
                      Kami membutuhkan akses kamera untuk memindai kode QR. Anda masih bisa memberikannya sekarang.
                    </Text>
                    <Button
                      variant="primary"
                      size="sm"
                      onPress={() => void requestPermission()}
                    >
                      Coba Lagi
                    </Button>
                  </>
                ) : (
                  // Batch 139 E13: penolakan PERMANEN ("jangan tanya lagi") —
                  // satu-satunya jalan adalah Pengaturan perangkat.
                  <>
                    <Text variant="body" weight={600} className="text-center">
                      Akses kamera diblokir
                    </Text>
                    <Text variant="caption" tone="secondary" className="text-center">
                      Izin kamera dimatikan secara permanen di pengaturan perangkat. Aktifkan manual untuk memindai kode QR.
                    </Text>
                    <Button
                      variant="secondary"
                      size="sm"
                      onPress={() => void Linking.openSettings().catch(() => undefined)}
                    >
                      Buka Pengaturan
                    </Button>
                  </>
                )}
              </View>
            )}
          </View>

          {/* ── Tombol aksi ── */}
          {!isWeb ? (
            <View className="w-full gap-3">
              <View className="flex-row items-center gap-3">
                <Button
                  variant="secondary"
                  size="md"
                  leftIcon={ImageIcon}
                  onPress={() => void handlePickFromGallery()}
                  containerClassName="flex-1"
                >
                  Dari Galeri
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  leftIcon={Keyboard}
                  onPress={() => setManualInputOpen(true)}
                  containerClassName="flex-1"
                >
                  Ketik Manual
                </Button>
              </View>
              {/* Batch 139 E14: preferensi umpan balik pindaian (per perangkat,
                  tersimpan lokal via ui-prefs). */}
              <View className="w-full flex-row items-center justify-between rounded-xl border border-border bg-surface px-4 py-3">
                <View className="min-w-0 flex-1 pr-3">
                  <Text variant="body" weight={600}>
                    Getaran saat berhasil
                  </Text>
                  <Text variant="caption" tone="secondary">
                    Bergetar setiap kode QR berhasil dipindai.
                  </Text>
                </View>
                <Switch
                  value={prefs.scanFeedback}
                  onChange={(v) => setPrefs({ scanFeedback: v })}
                  accessibilityLabel="Getaran saat pindai berhasil"
                />
              </View>
            </View>
          ) : null}

          {/* ── Riwayat pindaian (FE-IMP-4 item 21) ── */}
          {history.length > 0 ? (
            <View className="mt-6 gap-2">
              <View className="flex-row items-center justify-between">
                <Text variant="label" tone="secondary">
                  Riwayat pindaian
                </Text>
                <Button
                  variant="ghost"
                  size="sm"
                  fullWidth={false}
                  onPress={() => void clearScanHistory().then(setHistory)}
                >
                  Hapus semua
                </Button>
              </View>
              {history.slice(0, 5).map((item) => (
                <View
                  key={item.id}
                  className="flex-row items-center gap-3 rounded-md border border-border bg-surface px-3 py-2"
                >
                  <Icon icon={QrCode} size="sm" tone="default" />
                  <View className="min-w-0 flex-1">
                    <Text variant="body" weight={600} numberOfLines={1}>
                      {item.label}
                    </Text>
                    <Text variant="caption" tone="secondary" numberOfLines={1}>
                      {item.detail}
                    </Text>
                  </View>
                  <IconButton
                    icon={Trash}
                    size="sm"
                    variant="ghost"
                    accessibilityLabel={`Hapus riwayat ${item.label}`}
                    onPress={() => void removeScanHistory(item.id).then(setHistory)}
                  />
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : (
        /* ── Mode 2: Kode QR Saya ── */
        <View className="flex-1 items-center justify-center px-5 pb-8 pt-2">
          {hasSession ? (
            <View className="w-full max-w-sm items-center gap-5 rounded-2xl border border-border bg-surface p-6 shadow-sm">
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

              {myProfileUrl ? (
                <>
                  {/* FE-IMP-4 item 30: label eksplisit "Kode QR Profil". */}
                  <Text variant="label" tone="secondary">
                    Kode QR Profil
                  </Text>
                  <View
                    ref={qrCardRef}
                    collapsable={false}
                    className="items-center justify-center rounded-xl bg-surface-raised p-4 border border-border"
                  >
                    <QRCodeDisplay
                      value={myProfileUrl}
                      size={200}
                      caption={myProfileUrl}
                      accessibilityLabel="Kode QR profil saya"
                    />
                  </View>

                  <Text variant="caption" tone="secondary" className="text-center px-2">
                    Tunjukkan kode ini kepada pembeli atau mitra untuk membuka profil dan bertransaksi escrow secara aman.
                  </Text>

                  <View className="w-full flex-row gap-3 pt-1">
                    <Button
                      variant="secondary"
                      size="md"
                      leftIcon={ArrowsOut}
                      onPress={() => void openQrZoom()}
                      containerClassName="flex-1"
                      accessibilityLabel="Perbesar kode QR"
                    >
                      Perbesar
                    </Button>
                    <Button
                      variant="secondary"
                      size="md"
                      leftIcon={DownloadSimple}
                      onPress={() => void handleSaveQr()}
                      containerClassName="flex-1"
                    >
                      Simpan
                    </Button>
                  </View>
                  <View className="w-full flex-row gap-3">
                    <Button
                      variant="secondary"
                      size="md"
                      leftIcon={Copy}
                      onPress={() => {
                        void copy(myProfileUrl)
                        toast.show({ title: "Tautan disalin ke papan klip", tone: "success" })
                      }}
                      containerClassName="flex-1"
                    >
                      Salin
                    </Button>
                    <Button
                      variant="primary"
                      size="md"
                      leftIcon={ShareNetwork}
                      onPress={() => void handleShareProfile()}
                      containerClassName="flex-1"
                    >
                      Bagikan
                    </Button>
                  </View>
                </>
              ) : (
                <View className="w-full items-center gap-2 rounded-xl border border-border bg-surface-raised p-6">
                  <Icon icon={QrCode} size="lg" tone="default" />
                  <Text variant="body" tone="secondary" className="text-center">
                    {meQuery.loading
                      ? translate("Memuat profil Anda…")
                      : translate(
                          "Profil belum dapat dimuat, sehingga kode QR belum tersedia. Periksa koneksi lalu buka kembali tab ini.",
                        )}
                  </Text>
                </View>
              )}
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

      {/* ── Dialog input manual + validasi live ── */}
      <BottomSheet
        visible={manualInputOpen}
        onRequestClose={() => setManualInputOpen(false)}
        title="Masukkan Kode atau Tautan"
        // FRM-014: input autoFocus — keyboard jangan sampai menutupi field di layar kecil.
        avoidKeyboard
        footer={
          <View className="flex-row gap-3">
            <Button
              variant="secondary"
              onPress={() => setManualInputOpen(false)}
              containerClassName="flex-1"
            >
              Batal
            </Button>
            <Button
              variant="primary"
              disabled={!manualCode.trim()}
              onPress={handleManualSubmit}
              containerClassName="flex-1"
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
          {/* Contoh ketuk-isi */}
          <View className="flex-row flex-wrap gap-2">
            {MANUAL_EXAMPLES.map((example) => (
              <Button
                key={example}
                variant="ghost"
                size="sm"
                fullWidth={false}
                onPress={() => setManualCode(example)}
              >
                {example.length > 24 ? `${example.slice(0, 24)}…` : example}
              </Button>
            ))}
          </View>
          {/* Validasi live */}
          {manualTarget ? (
            <View className="flex-row items-center gap-3 rounded-xl bg-surface p-4 border border-border">
              <Icon
                icon={manualTarget.risky ? Warning : CheckCircle}
                size="md"
                tone={manualTarget.risky ? "warning" : "active"}
              />
              <View className="flex-1 min-w-0">
                <Text variant="label" tone="secondary">
                  {manualTarget.label}
                </Text>
                <Text variant="bodyLarge" weight={600} numberOfLines={2}>
                  {manualTarget.detail || manualCode.trim()}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      </BottomSheet>

      {/* ── Hasil pindaian: konfirmasi sebelum aksi (FE-IMP-4 item 23) ── */}
      <BottomSheet
        visible={detected !== null}
        onRequestClose={closeResult}
        title={resultCopy?.title ?? "Kode Terdeteksi"}
        footer={
          <View className="flex-row gap-3">
            <Button
              variant="secondary"
              onPress={closeResult}
              containerClassName="flex-1"
            >
              Pindai Lagi
            </Button>
            {detected?.target.type === "external-url" ? (
              <>
                <Button
                  variant="secondary"
                  onPress={() => {
                    if (detected?.target.url) void copy(detected.target.url)
                    closeResult()
                  }}
                  containerClassName="flex-1"
                >
                  Salin Tautan
                </Button>
                <Button
                  variant="primary"
                  onPress={() => detected && handleResultAction(detected)}
                  containerClassName="flex-1"
                >
                  Buka Tautan
                </Button>
              </>
            ) : (
              <Button
                variant="primary"
                onPress={() => detected && handleResultAction(detected)}
                containerClassName="flex-1"
              >
                {resultCopy?.primaryCta ?? "Buka Sekarang"}
              </Button>
            )}
          </View>
        }
      >
        {detected && resultCopy ? (
          <View className="gap-3 px-5 py-3">
            <View className="flex-row items-center gap-3 rounded-xl bg-surface p-4 border border-border">
              <View className="h-10 w-10 items-center justify-center rounded-full bg-surface-raised">
                <Icon
                  icon={detected.target.risky ? Warning : resultCopy.icon}
                  size="md"
                  tone={detected.target.risky ? "warning" : resultCopy.iconTone}
                />
              </View>
              <View className="flex-1 min-w-0">
                <Text variant="label" tone="secondary">
                  {detected.target.label}
                </Text>
                <Text variant="bodyLarge" weight={600} numberOfLines={2}>
                  {detected.target.detail || detected.raw}
                </Text>
              </View>
            </View>
            {/* E16: penjelasan per jenis — pengguna tahu apa yang akan terjadi. */}
            <Text variant="caption" tone="secondary">
              {resultCopy.explainer}
            </Text>
            {resultCopy.warnTransfer ? (
              // E16: transfer tidak pernah dieksekusi dari sheet — hanya
              // membuka layar transfer untuk direview pengguna.
              <Alert tone="warning" title="Periksa sebelum mengirim">
                Pastikan nama penerima dan nominal benar. Dana baru berpindah
                setelah Anda menekan tombol kirim di layar berikutnya.
              </Alert>
            ) : null}
            {detected.target.risky ? (
              // Anti-phishing: kode asing tidak pernah dibuka otomatis.
              <Alert tone="warning" title="Tautan luar Kahade">
                Kode ini mengarah ke situs di luar Kahade. Pastikan Anda
                percaya sumbernya sebelum membuka — Kahade tidak bertanggung
                jawab atas situs luar.
              </Alert>
            ) : null}
          </View>
        ) : null}
      </BottomSheet>

      {/* ── QR layar penuh + kecerahan maksimal (FE-IMP-4 item 28) ── */}
      {qrZoomed && myProfileUrl ? (
        <View className="absolute inset-0 z-50 items-center justify-center bg-black px-8">
          <View className="items-center gap-6">
            <Text variant="label" className="text-white">
              Kode QR Profil
            </Text>
            <View className="rounded-2xl bg-white p-6">
              <QRCodeDisplay
                value={myProfileUrl}
                size={280}
                accessibilityLabel="Kode QR profil saya, layar penuh"
              />
            </View>
            <Text variant="body" className="text-white text-center">
              @{myUsername}
            </Text>
            <Button
              variant="secondary"
              leftIcon={X}
              onPress={() => void closeQrZoom()}
            >
              Tutup
            </Button>
          </View>
        </View>
      ) : null}
    </Screen>
  )
}
