/**
 * Screen — Verifikasi Dua Langkah (2FA TOTP).
 *
 * Endpoint (lib/api/auth.ts):
 *   GET  /v1/auth/2fa/status                    → { enabled, backupCodesRemaining }
 *   POST /v1/auth/2fa/setup        { password } → { secret, otpauthUrl }
 *   POST /v1/auth/2fa/enable       { code }     → { backupCodes }
 *   POST /v1/auth/2fa/request-disable-otp       → kirim OTP email
 *   POST /v1/auth/2fa/disable      { password, code, emailOtpCode }
 *   POST /v1/auth/2fa/backup-codes/regenerate { password } → { backupCodes }
 *
 * Alur aktivasi (3 langkah, satu layar):
 *   1. "password" — verifikasi password → setup2fa
 *   2. "scan"     — tampilkan QR otpauth:// + secret (CopyableField) → masukkan
 *                   kode 6 digit dari authenticator → enable2fa
 *   3. "codes"    — tampilkan backupCodes SEKALI (server tidak mengembalikan
 *                   lagi); pengguna wajib menyalin/mengunduh.
 *
 * Keputusan non-obvious:
 *   - Kode cadangan TIDAK pernah diminta saat memuat status: endpoint
 *     regenerate membuat set kode BARU dan membatalkan yang lama — memanggilnya
 *     "hanya untuk melihat" merusak kode yang sudah disimpan pengguna.
 *   - Disable butuh TIGA bukti (password, TOTP, OTP email) sesuai
 *     `Disable2faDto`; dirender sebagai panel inline (bukan <Dialog>) karena
 *     tiga field + dua OtpInput tidak muat di dialog tengah tanpa scroll, dan
 *     OTP email diminta eksplisit lewat tombol agar tidak mengirim email
 *     setiap panel dibuka.
 *   - Setelah enable/disable, status di-REFETCH (bukan ditebak) supaya
 *     `backupCodesRemaining` selalu dari server.
 */
import { useCallback, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { api, userMessage } from "@/lib/api"
import type { TwoFactorSetup } from "@/lib/api/auth"
import { useCopy } from "@/lib/clipboard"
import { tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"

import { Alert } from "@/components/ui/alert"
import { ErrorState } from "@/components/ui/error-state"
import { BackupCodesDisplay } from "@/components/ui/backup-codes-display"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import { CopyableField } from "@/components/ui/copyable-field"
import { Dialog } from "@/components/ui/modal"
import { Header } from "@/components/ui/header"
import { OtpInput } from "@/components/ui/otp-input"
import { PasswordField } from "@/components/ui/password-field"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { QRCodeDisplay } from "@/components/ui/qr-code-display"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { TwoFactorStatusCard } from "@/components/ui/two-factor-status-card"
import { useToast } from "@/components/ui/toast"

/** Panjang kode TOTP standar RFC 6238 (sama dengan default <OtpInput>). */
const TOTP_LENGTH = 6
/** Jumlah kode cadangan yang diterbitkan server per set (untuk progres kartu). */
const BACKUP_CODES_TOTAL = 10

type Panel = "idle" | "password" | "scan" | "codes" | "disable"

export default function TwoFactorScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()
  const { copiedKey, copy } = useCopy()

  /**
   * Audit — dua cacat terbukti dari kode lama:
   *
   *   1. ERROR BACKEND DITELAN. Blok catch-nya `} catch {` tanpa binding, lalu
   *      `setLoadError("Gagal memuat status verifikasi dua langkah.")`. Jadi
   *      apa pun penyebabnya — jaringan putus, 401, 500, timeout — pengguna
   *      melihat kalimat yang sama dan tidak ada petunjuk. Setiap layar lain
   *      memakai `userMessage(err)`. Catatan: celah ini lolos dari pemeriksa
   *      S2 repo karena regex-nya hanya mencocokkan identifier persis
   *      `setError("`, sedangkan setter di sini bernama `setLoadError`.
   *
   *   2. `handleRefresh` memanggil `fetchStatus()` yang sama dengan muat-awal,
   *      dan fungsi itu membuka dengan `setLoading(true)`. Layar ini TIDAK
   *      punya cabang skeleton — `loading` diteruskan sebagai prop ke
   *      <TwoFactorStatusCard> (baris ~287) — jadi efeknya kartu berkedip ke
   *      state loading dan menyembunyikan status 2FA yang sedang ditampilkan
   *      setiap kali ditarik. Bukan blanking penuh, tapi tetap regresi.
   *
   * `useApiQuery` membereskan keduanya: error lewat `userMessage(err)`,
   * `refreshing` terpisah dari `loading`, dan request dibatalkan lewat
   * AbortSignal saat layar ditutup.
   */
  const query = useApiQuery<{ enabled: boolean; backupCodesRemaining?: number }>(
    "two-factor-status",
    (signal) => api.auth.get2faStatus(signal),
  )
  const status = query.data
  const loading = query.loading
  const loadError = query.error
  const refreshing = query.refreshing

  // ── Aktivasi ───────────────────────────────────────────────────────────
  const [step, setStep] = useState<Panel>("idle")
  const [setupPassword, setSetupPassword] = useState("")
  const [setupError, setSetupError] = useState<string | undefined>()
  const [settingUp, setSettingUp] = useState(false)
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null)
  const [enableError, setEnableError] = useState<string | undefined>()
  const [enabling, setEnabling] = useState(false)
  const [codes, setCodes] = useState<string[]>([])

  // ── Nonaktifkan ────────────────────────────────────────────────────────
  const [disablePassword, setDisablePassword] = useState("")
  const [disableCode, setDisableCode] = useState("")
  const [disableEmailCode, setDisableEmailCode] = useState("")
  const [emailOtpSent, setEmailOtpSent] = useState(false)
  const [sendingEmailOtp, setSendingEmailOtp] = useState(false)
  const [disableError, setDisableError] = useState<string | undefined>()
  const [disabling, setDisabling] = useState(false)

  // ── Regenerasi kode cadangan ───────────────────────────────────────────
  const [regenOpen, setRegenOpen] = useState(false)
  const [regenPassword, setRegenPassword] = useState("")
  const [regenError, setRegenError] = useState<string | undefined>()
  const [regenerating, setRegenerating] = useState(false)



  const resetEnableFlow = useCallback(() => {
    setStep("idle")
    setSetupPassword("")
    setSetupError(undefined)
    setSetup(null)
    setEnableError(undefined)
  }, [])

  const handleStartEnable = useCallback(() => {
    resetEnableFlow()
    setStep("password")
  }, [resetEnableFlow])

  const handleSetup = useCallback(async () => {
    if (!setupPassword) return
    setSettingUp(true)
    setSetupError(undefined)
    try {
      const res = await api.auth.setup2fa({ password: setupPassword })
      setSetup(res)
      setSetupPassword("")
      setStep("scan")
    } catch {
      setSetupError("Password salah atau 2FA tidak bisa disiapkan. Coba lagi.")
    } finally {
      setSettingUp(false)
    }
  }, [setupPassword])

  const handleEnableCode = useCallback(
    async (code: string) => {
      if (enabling) return
      setEnabling(true)
      setEnableError(undefined)
      try {
        const res = await api.auth.enable2fa({ code })
        setCodes(res?.backupCodes ?? [])
        setStep("codes")
        toast.show({ title: "Verifikasi dua langkah aktif", tone: "success" })
        await query.refresh()
      } catch {
        setEnableError("Kode tidak valid. Pastikan jam perangkat akurat, lalu coba lagi.")
      } finally {
        setEnabling(false)
      }
    },
    [enabling, query, toast.show],
  )

  const openDisable = useCallback(() => {
    setDisablePassword("")
    setDisableCode("")
    setDisableEmailCode("")
    setEmailOtpSent(false)
    setDisableError(undefined)
    setSetup(null)
    setStep("disable")
  }, [])

  const handleSendEmailOtp = useCallback(async () => {
    setSendingEmailOtp(true)
    try {
      await api.auth.request2faDisableOtp()
      setEmailOtpSent(true)
      toast.show({ title: "Kode OTP dikirim ke email Anda", tone: "success" })
    } catch (err: unknown) {
      toast.show({
        title: "Gagal mengirim OTP email",
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setSendingEmailOtp(false)
    }
  }, [toast.show])

  const canDisable =
    disablePassword.length > 0 &&
    disableCode.length === TOTP_LENGTH &&
    disableEmailCode.length === TOTP_LENGTH

  const handleDisable = useCallback(async () => {
    if (!canDisable) return
    setDisabling(true)
    setDisableError(undefined)
    try {
      await api.auth.disable2fa({
        password: disablePassword,
        code: disableCode,
        emailOtpCode: disableEmailCode,
      })
      setCodes([])
      resetEnableFlow()
      toast.show({ title: "Verifikasi dua langkah dimatikan", tone: "success" })
      await query.refresh()
    } catch {
      setDisableError("Password, kode autentikator, atau OTP email tidak cocok.")
    } finally {
      setDisabling(false)
    }
  }, [
    canDisable,
    disablePassword,
    disableCode,
    disableEmailCode,
    query,
    resetEnableFlow,
    toast.show,
  ])

  const openRegenerate = useCallback(() => {
    setRegenPassword("")
    setRegenError(undefined)
    setRegenOpen(true)
  }, [])

  const handleRegenerate = useCallback(async () => {
    if (!regenPassword) return
    setRegenerating(true)
    setRegenError(undefined)
    try {
      const res = await api.auth.regenerateBackupCodes({ password: regenPassword })
      setCodes(res?.backupCodes ?? [])
      setRegenOpen(false)
      toast.show({
        title: "Kode cadangan baru dibuat",
        description: "Kode lama tidak berlaku lagi. Simpan kode yang baru.",
        tone: "success",
      })
      await query.refresh()
    } catch {
      setRegenError("Password salah. Coba lagi.")
    } finally {
      setRegenerating(false)
    }
  }, [regenPassword, query, toast.show])

  const enabled = status?.enabled ?? false

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Verifikasi Dua Langkah" />
      <PullToRefresh
        onRefresh={() => void query.refresh()}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
          {loadError ? (
            <ErrorState
              title="Gagal memuat"
              description={loadError}
              onRetry={() => void query.reload()}
            />
          ) : null}

          <TwoFactorStatusCard
            enabled={enabled}
            backupCodesRemaining={status?.backupCodesRemaining}
            backupCodesTotal={codes.length > 0 ? codes.length : BACKUP_CODES_TOTAL}
            loading={loading}
            onEnable={!enabled && step === "idle" ? handleStartEnable : undefined}
            onManage={enabled ? openDisable : undefined}
            onRegenerateBackup={enabled ? openRegenerate : undefined}
          />

          {/* ── Langkah 1: password ─────────────────────────────────────── */}
          {step === "password" ? (
            <>
              <SectionHeader title="Langkah 1 dari 3 — Verifikasi password" />
              <Text numberOfLines={1} variant="body" tone="secondary">
                Masukkan password akun untuk menyiapkan aplikasi autentikator.
              </Text>
              <PasswordField
                label="Password akun"
                value={setupPassword}
                onChangeText={setSetupPassword}
                errorText={setupError}
                required
                autoFocus
                returnKeyType="done"
                onSubmitEditing={() => void handleSetup()}
              />
              {/* equal={false}: tata letak dipertahankan apa adanya — "Batal"
                  memeluk isi, tombol utama mengisi sisa baris. ButtonGroup
                  default (equal) akan memaksa 50/50. */}
              <ButtonGroup equal={false}>
                <Button
                  variant="ghost"
                  fullWidth={false}
                  onPress={resetEnableFlow}
                  disabled={settingUp}
                >
                  Batal
                </Button>
                <Button
                  className="flex-1"
                  loading={settingUp}
                  disabled={!setupPassword}
                  onPress={() => void handleSetup()}
                >
                  Lanjut
                </Button>
              </ButtonGroup>
            </>
          ) : null}

          {/* ── Langkah 2: pindai QR + kode ─────────────────────────────── */}
          {step === "scan" && setup ? (
            <>
              <SectionHeader title="Langkah 2 dari 3 — Pindai kode QR" />
              <Text variant="body" tone="secondary">
                Buka Google Authenticator, Authy, atau aplikasi sejenis, lalu pindai kode di bawah.
                Jika tidak bisa memindai, masukkan kunci secara manual.
              </Text>
              <QRCodeDisplay
                value={setup.otpauthUrl}
                accessibilityLabel="Kode QR untuk aplikasi autentikator"
              />
              <CopyableField
                label="Kunci manual"
                value={setup.secret}
                mono
                wrap
                copied={copiedKey === "secret"}
                onCopy={(v) => void copy(v, "secret")}
              />
              <Text variant="body" tone="secondary">
                Setelah itu, masukkan kode {TOTP_LENGTH} digit yang ditampilkan aplikasi
                autentikator.
              </Text>
              <OtpInput
                length={TOTP_LENGTH}
                onComplete={(code) => void handleEnableCode(code)}
                errorText={enableError}
                disabled={enabling}
              />
              <Button
                variant="ghost"
                fullWidth={false}
                onPress={resetEnableFlow}
                disabled={enabling}
              >
                Batal
              </Button>
            </>
          ) : null}

          {/* ── Langkah 3 / hasil regenerasi: kode cadangan ─────────────── */}
          {codes.length > 0 ? (
            <>
              <SectionHeader
                title={
                  step === "codes"
                    ? "Langkah 3 dari 3 — Simpan kode cadangan"
                    : "Kode cadangan baru"
                }
              />
              <BackupCodesDisplay
                codes={codes}
                onCopyAll={(text) => void copy(text, "codes")}
                onRegenerate={openRegenerate}
                regenerating={regenerating}
              />
              {step === "codes" ? (
                <Button onPress={resetEnableFlow}>Sudah saya simpan</Button>
              ) : null}
            </>
          ) : null}

          {/* ── Panel: matikan 2FA ──────────────────────────────────────── */}
          {step === "disable" ? (
            <>
              <SectionHeader title="Matikan verifikasi dua langkah" />
              <Alert tone="warning" title="Akun Anda akan kurang aman">
                Untuk keamanan, konfirmasi dengan password, kode autentikator, dan OTP yang dikirim
                ke email Anda.
              </Alert>
              <PasswordField
                label="Password akun"
                value={disablePassword}
                onChangeText={setDisablePassword}
                required
                autoFocus
              />
              <View className="gap-2">
                <Text variant="label" tone="secondary">
                  Kode aplikasi autentikator
                </Text>
                <OtpInput
                  length={TOTP_LENGTH}
                  value={disableCode}
                  onChange={setDisableCode}
                  disabled={disabling}
                />
              </View>
              <View className="gap-2">
                <View className="flex-row items-center justify-between">
                  <Text variant="label" tone="secondary">
                    OTP email
                  </Text>
                  <Button
                    variant="ghost"
                    size="sm"
                    fullWidth={false}
                    loading={sendingEmailOtp}
                    onPress={() => void handleSendEmailOtp()}
                  >
                    {emailOtpSent ? "Kirim ulang" : "Kirim OTP"}
                  </Button>
                </View>
                <OtpInput
                  length={TOTP_LENGTH}
                  value={disableEmailCode}
                  onChange={setDisableEmailCode}
                  disabled={disabling}
                  helperText={
                    emailOtpSent
                      ? "Periksa kotak masuk email Anda."
                      : "Tekan Kirim OTP untuk menerima kode."
                  }
                  errorText={disableError}
                />
              </View>
              <ButtonGroup equal={false}>
                <Button
                  variant="ghost"
                  fullWidth={false}
                  onPress={resetEnableFlow}
                  disabled={disabling}
                >
                  Batal
                </Button>
                <Button
                  className="flex-1"
                  variant="destructive"
                  loading={disabling}
                  disabled={!canDisable}
                  onPress={() => void handleDisable()}
                >
                  Matikan
                </Button>
              </ButtonGroup>
            </>
          ) : null}

          {enabled && codes.length === 0 && step === "idle" ? (
            <>
              <SectionHeader title="Kode cadangan" />
              <Text variant="body" tone="secondary">
                Kode cadangan hanya ditampilkan sekali saat dibuat. Jika hilang, buat set baru —
                kode lama otomatis tidak berlaku. Gunakan aksi pada kartu di atas untuk membuat kode
                baru atau mematikan verifikasi dua langkah.
              </Text>
            </>
          ) : null}
        </View>
      </PullToRefresh>

      {/* ── Dialog: regenerasi kode cadangan ──────────────────────────────── */}
      <Dialog
        title="Buat kode cadangan baru?"
        description="Semua kode cadangan lama akan hangus. Masukkan password untuk melanjutkan."
        visible={regenOpen}
        loading={regenerating}
        confirmLabel="Buat Kode Baru"
        cancelLabel="Batal"
        confirmButtonProps={{ disabled: !regenPassword }}
        onConfirm={() => void handleRegenerate()}
        onCancel={() => setRegenOpen(false)}
        onRequestClose={() => setRegenOpen(false)}
      >
        <PasswordField
          label="Password akun"
          value={regenPassword}
          onChangeText={setRegenPassword}
          errorText={regenError}
          required
          returnKeyType="done"
          onSubmitEditing={() => void handleRegenerate()}
        />
      </Dialog>
    </Screen>
  )
}