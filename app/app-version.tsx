/**
 * Screen — Versi Aplikasi: AppVersionInfoRow + check OTA (public/app-version)
 * dan status update expo-updates. Menunjukkan minimum & latest dari server.
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Info } from "phosphor-react-native"
import Constants from "expo-constants"
import * as Updates from "expo-updates"

import { api } from "@/lib/api"
import { tokens } from "@/lib/tokens"

import { AppVersionInfoRow } from "@/components/ui/app-version-info-row"
import { Button } from "@/components/ui/button"
import { Header } from "@/components/ui/header"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"

export default function AppVersionScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [latest, setLatest] = useState<Awaited<ReturnType<typeof api.public.getAppVersion>> | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [checking, setChecking] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState(false)

  const fetchVersion = useCallback(async () => {
    try {
      const res = await api.public.getAppVersion()
      setLatest(res)
    } catch {
      // versi lokal tetap tampil
    }
  }, [])

  useEffect(() => {
    void fetchVersion()
  }, [fetchVersion])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchVersion()
    setRefreshing(false)
  }, [fetchVersion])

  const handleCheckUpdate = useCallback(async () => {
    setChecking(true)
    try {
      const r = await Updates.checkForUpdateAsync()
      setUpdateAvailable(!!r.isAvailable)
      toast.show({
        title: r.isAvailable ? "Update tersedia" : "Aplikasi sudah terbaru",
        tone: r.isAvailable ? "info" : "success",
        duration: 3000,
      })
    } catch {
      toast.show({ title: "Gagal memeriksa update", tone: "danger" })
    } finally {
      setChecking(false)
    }
  }, [toast.show])

  /** Terapkan update: unduh bundle baru lalu reload — tanpa error mental. */
  const handleApplyUpdate = useCallback(async () => {
    setChecking(true)
    try {
      const r = await Updates.fetchUpdateAsync()
      if (r.isNew) {
        toast.show({ title: "Update berhasil diunduh", tone: "success", duration: 3000 })
        await Updates.reloadAsync()
      } else {
        toast.show({ title: "Aplikasi sudah terbaru", tone: "success", duration: 3000 })
        setUpdateAvailable(false)
      }
    } catch {
      toast.show({ title: "Gagal menerapkan update", tone: "danger" })
    } finally {
      setChecking(false)
    }
  }, [toast.show])

  const version = Constants.expoConfig?.version ?? "0.1.0"
  const build = (Constants.expoConfig?.ios?.buildNumber as string | undefined) ??
    (Constants.expoConfig?.android?.versionCode as number | undefined)

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Versi Aplikasi" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{ style: { paddingBottom: insets.bottom + tokens.space[8] } }}
      >
        <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
          <AppVersionInfoRow
            appName="Kahade"
            version={version}
            build={build}
            channel={Updates.channel ?? "production"}
            onLongPress={(summary) => toast.show({ title: "Versi", description: summary, tone: "info", duration: 4000 })}
          />

          {latest ? (
            <>
              <SectionHeader title="Server" inset />
              <Text variant="body" tone="secondary">
                Versi minimum: <Text variant="monoBody">{latest.minVersion}</Text> · terbaru:{" "}
                <Text variant="monoBody">{latest.latestVersion}</Text>
              </Text>
              {latest.message ? (
                <Text variant="caption" tone="secondary">{latest.message}</Text>
              ) : null}
              <Button
                variant="secondary"
                loading={checking}
                onPress={() => void (updateAvailable ? handleApplyUpdate() : handleCheckUpdate())}
              >
                {updateAvailable ? "Terapkan Pembaruan" : "Periksa Pembaruan"}
              </Button>
            </>
          ) : (
            <Button variant="secondary" loading={checking} onPress={() => void handleCheckUpdate()}>
              Periksa Pembaruan
            </Button>
          )}
          <View style={{ marginTop: tokens.space[4] }} className="items-center">
            <Text variant="caption" tone="tertiary">
              Kahade © 2026 · Dibuat di Indonesia
            </Text>
          </View>
        </View>
      </PullToRefresh>
    </Screen>
  )
}
