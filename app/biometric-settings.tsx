/**
 * Screen — Biometrik (toggle + status 2FA + kode cadangan).
 * Biometrik aktif disimpan via SecureStore (biometrics.ts); 2FA via API auth.
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { api } from "@/lib/api"
import { getSecureItem, setSecureItem, SecureKeys } from "@/lib/secure-storage"
import { formatDateTime } from "@/lib/format"
import { tokens } from "@/lib/tokens"

import { BackupCodesDisplay } from "@/components/ui/backup-codes-display"
import { Header } from "@/components/ui/header"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { Switch } from "@/components/ui/switch"
import { Text } from "@/components/ui/text"
import { TwoFactorStatusCard } from "@/components/ui/two-factor-status-card"
import { useToast } from "@/components/ui/toast"

export default function BiometricSettingsScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [biometric, setBiometric] = useState(false)
  const [status, setStatus] = useState<Awaited<ReturnType<typeof api.auth.get2faStatus>> | null>(null)
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [bio, s] = await Promise.all([getSecureItem(SecureKeys.biometricEnabled), api.auth.get2faStatus().catch(() => null)])
      setBiometric(bio === "1")
      setStatus(s)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchAll()
    setRefreshing(false)
  }, [fetchAll])

  const handleToggle = useCallback(async (next: boolean) => {
    setBiometric(next)
    await setSecureItem(SecureKeys.biometricEnabled, next ? "1" : "0")
    toast.show({
      title: next ? "Biometrik diaktifkan" : "Biometrik dimatikan",
      tone: "success",
      duration: 3000,
    })
  }, [toast.show])

  const handleRegenerate = useCallback(async () => {
    setRegenerating(true)
    try {
      const res = await api.auth.regenerateBackupCodes({ password: "" })
      setBackupCodes(res?.backupCodes ?? [])
      toast.show({ title: "Kode cadangan baru dibuat", tone: "success", duration: 3000 })
    } catch {
      toast.show({ title: "Gagal membuat kode cadangan", tone: "danger" })
    } finally {
      setRegenerating(false)
    }
  }, [toast.show])

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Biometrik & Keamanan" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{ style: { paddingBottom: insets.bottom + tokens.space[8] } }}
      >
        <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
          <Switch
            value={biometric}
            onChange={(v) => void handleToggle(v)}
            label="Gunakan Face ID / sidik jari"
            description="Untuk membuka aplikasi dan konfirmasi transaksi tanpa PIN."
            disabled={loading}
          />

          <TwoFactorStatusCard
            enabled={status?.enabled ?? false}
            method={status?.enabled ? "authenticator" : undefined}
            backupCodesRemaining={status?.backupCodesRemaining}
            onRegenerateBackup={() => void handleRegenerate()}
            loading={loading}
          />

          {backupCodes.length > 0 ? (
            <BackupCodesDisplay codes={backupCodes} masked onRegenerate={() => void handleRegenerate()} regenerating={regenerating} />
          ) : null}
          <Text variant="caption" tone="secondary">
            Terakhir diperbarui: {formatDateTime(new Date())}
          </Text>
        </View>
      </PullToRefresh>
    </Screen>
  )
}
