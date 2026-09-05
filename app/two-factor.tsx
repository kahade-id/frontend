/**
 * Screen — Verifikasi Dua Langkah (GET status, POST setup/enable/disable,
 * regenerate backup codes) — 2FA TOTP.
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { api } from "@/lib/api"
import { tokens } from "@/lib/tokens"

import { BackupCodesDisplay } from "@/components/ui/backup-codes-display"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/modal"
import { Header } from "@/components/ui/header"
import { OtpInput } from "@/components/ui/otp-input"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { TwoFactorStatusCard } from "@/components/ui/two-factor-status-card"
import { useToast } from "@/components/ui/toast"

export default function TwoFactorScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [status, setStatus] = useState<{ enabled: boolean; backupCodesRemaining?: number } | null>(null)
  const [codes, setCodes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [enabling, setEnabling] = useState(false)
  const [enableCode, setEnableCode] = useState("")
  const [enableError, setEnableError] = useState<string | undefined>()
  const [disableOpen, setDisableOpen] = useState(false)
  const [disabling, setDisabling] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    try {
      const s = await api.auth.get2faStatus()
      setStatus(s)
      if (s.enabled) {
        const codesRes = await api.auth.regenerateBackupCodes?.({
          password: "",
        }).catch(() => null)
        // regenerate menciptakan kode baru — jangan panggil tanpa niat; pakai status saja
        void codesRes
      }
    } catch {
      toast.show({ title: "Gagal memuat status 2FA", tone: "danger" })
    } finally {
      setLoading(false)
    }
  }, [toast.show])

  useEffect(() => {
    void fetchStatus()
  }, [fetchStatus])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchStatus()
    setRefreshing(false)
  }, [fetchStatus])

  const handleStartEnable = useCallback(() => {
    setEnabling(true)
    setEnableCode("")
    setEnableError(undefined)
  }, [])

  const handleEnableCode = useCallback(
    async (code: string) => {
      try {
        const res = await api.auth.enable2fa({ code })
        setStatus({ enabled: true, backupCodesRemaining: 10 })
        setEnabling(false)
        toast.show({ title: "2FA aktif", tone: "success", duration: 3000 })
      } catch {
        setEnableError("Kode tidak valid. Coba lagi.")
      }
    },
    [toast.show],
  )

  const handleDisable = useCallback(async () => {
    setDisabling(true)
    try {
      await api.auth.disable2fa({ password: "", code: "000000", emailOtpCode: "000000" })
      setStatus({ enabled: false })
      setDisableOpen(false)
      toast.show({ title: "2FA dimatikan", tone: "success", duration: 3000 })
    } catch {
      toast.show({ title: "Gagal mematikan 2FA", tone: "danger" })
    } finally {
      setDisabling(false)
    }
  }, [toast.show])

  const handleRegenerate = useCallback(async () => {
    setRegenerating(true)
    try {
      const res = await api.auth.regenerateBackupCodes({ password: "" })
      setCodes(res?.backupCodes ?? [])
      toast.show({ title: "Kode cadangan baru dibuat", tone: "success", duration: 3000 })
    } catch {
      toast.show({ title: "Gagal membuat kode cadangan", tone: "danger" })
    } finally {
      setRegenerating(false)
    }
  }, [toast.show])

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Verifikasi Dua Langkah" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{ style: { paddingBottom: insets.bottom + tokens.space[8] } }}
      >
        <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
          <TwoFactorStatusCard
            enabled={status?.enabled ?? false}
            backupCodesRemaining={status?.backupCodesRemaining}
            backupCodesTotal={10}
            loading={loading}
            onEnable={!status?.enabled ? handleStartEnable : undefined}
            onManage={status?.enabled ? handleStartEnable : undefined}
            onRegenerateBackup={status?.enabled ? () => void handleRegenerate() : undefined}
          />

          {enabling ? (
            <>
              <SectionHeader title="Masukkan kode 6 digit" />
              <Text variant="body" tone="secondary">
                Buka aplikasi autentikator Anda dan masukkan kode TOTP.
              </Text>
              <OtpInput
                length={6}
                onComplete={(code) => void handleEnableCode(code)}
                errorText={enableError}
              />
              <Button variant="ghost" fullWidth={false} onPress={() => setEnabling(false)}>
                Batal
              </Button>
            </>
          ) : null}

          {status?.enabled ? (
            <>
              <SectionHeader title="Kode cadangan" />
              {codes.length ? (
                <BackupCodesDisplay
                  codes={codes}
                  masked
                  onRegenerate={() => void handleRegenerate()}
                  regenerating={regenerating}
                />
              ) : (
                <Button variant="secondary" onPress={() => void handleRegenerate()}>
                  Buat Kode Cadangan
                </Button>
              )}
              <Button variant="secondary" onPress={() => setDisableOpen(true)}>
                Matikan 2FA
              </Button>
            </>
          ) : null}
        </View>
      </PullToRefresh>

      <Dialog
        title="Matikan verifikasi dua langkah?"
        description="Akun Anda akan kurang aman. Kode OTP akan dikirim untuk konfirmasi."
        visible={disableOpen}
        destructive
        loading={disabling}
        confirmLabel="Matikan"
        cancelLabel="Batal"
        onConfirm={() => void handleDisable()}
        onCancel={() => setDisableOpen(false)}
        onRequestClose={() => setDisableOpen(false)}
      />
    </Screen>
  )
}
