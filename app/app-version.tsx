import { useCallback, useRef, useState } from "react"
import { Platform, ScrollView } from "react-native"
import Constants from "expo-constants"
import * as Updates from "expo-updates"
import { api } from "@/lib/api"
import { installedAppVersion, installedBuildNumber } from "@/lib/runtime-info"
import { useApiQuery } from "@/lib/use-api-query"
import { AppVersionInfoRow } from "@/components/ui/app-version-info-row"
import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"

export default function AppVersionScreen() {
  const toast = useToast()
  const version = useApiQuery(
    "server-app-version",
    () => api.public.getAppVersion(),
    Platform.OS !== "web",
  )
  const [checking, setChecking] = useState(false)
  const [available, setAvailable] = useState(false)
  const busy = useRef(false)
  const canUpdate = Platform.OS !== "web" && !__DEV__ && Updates.isEnabled
  const update = useCallback(async () => {
    if (!canUpdate || busy.current) return
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
        toast.show({
          title: result.isAvailable
            ? "Pembaruan OTA tersedia"
            : "Tidak ada OTA baru untuk runtime ini",
          tone: "info",
        })
      }
    } catch {
      toast.show({
        title: "Pembaruan belum dapat diproses",
        description: "Periksa koneksi, lalu coba lagi.",
        tone: "danger",
      })
    } finally {
      busy.current = false
      setChecking(false)
    }
  }, [canUpdate, available, toast.show])
  return (
    <Screen edges={["top"]} padded={false}>
      {/* Header di LUAR area scroll: tombol kembali harus tetap terjangkau
          saat konten panjang digulir (pola sama dengan <DataScreen>). */}
      <Header title="Versi Aplikasi" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="gap-4 px-6 py-4"
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
        {version.error ? (
          <ErrorState
            compact
            title="Versi server belum dapat diperiksa"
            description={version.error}
            onRetry={() => void version.reload()}
          />
        ) : version.data ? (
          <>
            <SectionHeader title="Versi di toko aplikasi" />
            <Text variant="body">
              Minimum: {version.data.minVersion ?? "Belum tersedia"} · terbaru:{" "}
              {version.data.latestVersion ?? "Belum tersedia"}
            </Text>
          </>
        ) : null}
        {canUpdate ? (
          <Button variant="secondary" loading={checking} onPress={() => void update()}>
            {available ? "Unduh & Terapkan OTA" : "Periksa Pembaruan OTA"}
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
      </ScrollView>
    </Screen>
  )
}
