import { useCallback, useEffect, useRef, useState } from "react"
import { Platform, ScrollView } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Constants from "expo-constants"
import * as Updates from "expo-updates"
import { installedAppVersion, installedBuildNumber } from "@/lib/runtime-info"
import { formatDateTime } from "@/lib/format"
import { getSecureItem, setSecureItem, SecureKeys } from "@/lib/secure-storage"
import { isOfflineKnown } from "@/lib/connectivity"
import { tokens } from "@/lib/tokens"
import { AppVersionInfoRow } from "@/components/ui/app-version-info-row"
import { Button } from "@/components/ui/button"
import { Header } from "@/components/ui/header"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"

export default function AppVersionScreen() {
  const toast = useToast()
  const insets = useSafeAreaInsets()
  const [checking, setChecking] = useState(false)
  const [available, setAvailable] = useState(false)
  const busy = useRef(false)
  const canUpdate = Platform.OS !== "web" && !__DEV__ && Updates.isEnabled
  // FE-IMP-3 #99 — kapan terakhir pembaruan OTA diperiksa (persisten per
  // perangkat, bukan rahasia).
  const [lastChecked, setLastChecked] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    getSecureItem(SecureKeys.otaLastChecked)
      .then((v) => {
        if (alive && v) setLastChecked(v)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])
  const markChecked = useCallback(() => {
    const now = new Date().toISOString()
    setLastChecked(now)
    void setSecureItem(SecureKeys.otaLastChecked, now).catch(() => {})
  }, [])
  const update = useCallback(async () => {
    if (!canUpdate || busy.current) return
    if (isOfflineKnown()) {
      toast.show({
        title: "Anda sedang offline",
        description: "Pembaruan dapat diperiksa setelah perangkat tersambung ke internet.",
        tone: "info",
      })
      return
    }
    busy.current = true
    setChecking(true)
    try {
      if (available) {
        const downloaded = await Updates.fetchUpdateAsync()
        if (downloaded.isNew) {
          await Updates.reloadAsync()
          return
        }
        setAvailable(false)
      } else {
        const result = await Updates.checkForUpdateAsync()
        setAvailable(result.isAvailable)
        markChecked()
        toast.show({
          title: result.isAvailable
            ? "Pembaruan OTA tersedia"
            : "Tidak ada OTA baru untuk runtime ini",
          tone: "info",
        })
      }
    } catch {
      // Cek OTA hanya aksi eksplisit. Putus koneksi ditampilkan sebagai
      // keadaan offline, bukan error layar.
      const offline = isOfflineKnown()
      toast.show({
        title: offline ? "Anda sedang offline" : "Pembaruan belum dapat diproses",
        description: offline
          ? "Pembaruan dapat diperiksa setelah perangkat tersambung ke internet."
          : "Silakan coba lagi nanti.",
        tone: "info",
      })
    } finally {
      busy.current = false
      setChecking(false)
    }
  }, [canUpdate, available, toast.show, markChecked])
  return (
    <Screen edges={["top"]} padded={false}>
      {/* Header di LUAR area scroll: tombol kembali harus tetap terjangkau
          saat konten panjang digulir (pola sama dengan <DataScreen>). */}
      <Header title="Versi Aplikasi" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="gap-4 px-5 py-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + tokens.space[8] }}
      >
        <AppVersionInfoRow
          appName={Constants.expoConfig?.name ?? "Kahade"}
          version={installedAppVersion() ?? "Tidak tersedia"}
          build={installedBuildNumber()}
          channel={Updates.channel?.trim() || "Tidak terhubung"}
          updateId={Updates.updateId ?? undefined}
        />
        <Text variant="caption" tone="secondary">
          Runtime: {Updates.runtimeVersion?.trim() || "Tidak tersedia pada lingkungan ini"}
        </Text>
        {canUpdate ? (
          <Button variant="secondary" loading={checking} onPress={() => void update()}>
            {available ? "Unduh & terapkan OTA" : "Periksa pembaruan OTA"}
          </Button>
        ) : (
          <Text variant="body" tone="secondary">
            Pembaruan OTA hanya tersedia pada build native yang terhubung ke EAS Update. Web, Expo
            Go, dan mode development tidak menerapkan OTA melalui tombol ini.
          </Text>
        )}
        <Text variant="caption" tone="secondary">
          OTA memperbarui JavaScript dan aset untuk runtime yang kompatibel. Perubahan native atau
          versi minimum membutuhkan pembaruan dari toko aplikasi.
        </Text>
        {/* FE-IMP-3 #99 — waktu terakhir pemeriksaan OTA. */}
        <Text variant="caption" tone="secondary">
          Terakhir diperiksa: {lastChecked ? formatDateTime(lastChecked) : "belum pernah"}
        </Text>
      </ScrollView>
    </Screen>
  )
}