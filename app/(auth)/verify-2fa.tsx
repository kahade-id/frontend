/**
 * Kahade — Verifikasi 2FA saat login (screen #7b alur auth).
 *
 * Masuk ke sini dari Login ketika `POST /v1/auth/login` menjawab
 * `{ requiresTwoFactor: true, tempToken }`. tempToken dibaca dari
 * `lib/two-factor-login.ts` (memori), BUKAN route param.
 *
 * Struktur:
 *   <Header title="Verifikasi dua langkah">
 *   H1 "Masukkan kode autentikator" + body (email Mono)
 *   Mode "totp"   → <OtpInput> 6 digit
 *   Mode "backup" → <Input> kode cadangan 10–16 karakter
 *   [Button Verifikasi]
 *   [Alert error]
 *   ── footer: toggle "Pakai kode cadangan" / "Pakai aplikasi autentikator"
 *              • "Masuk dengan akun lain" → kembali ke login
 *
 * Kontrak API (docs/api/kahade-api-mobile.json):
 *   POST /v1/auth/2fa/verify-login  body Verify2faLoginDto
 *     { tempToken (≤512), code (6–16: TOTP 6 digit ATAU backup code 10–16),
 *       deviceId, deviceInfo? }  ← deviceId/deviceInfo diinjeksi `withDevice()`.
 *   Response: token → disimpan otomatis oleh auth.ts → Welcome (user lama).
 *
 * Keputusan non-obvious:
 *   - Dua mode input, bukan satu field bebas: TOTP hampir selalu 6 digit dan
 *     <OtpInput> memberi UX numerik yang benar; backup code bersifat
 *     alfanumerik & lebih panjang sehingga butuh <Input> biasa. Batas panjang
 *     mengikuti DTO (6 / 10–16) — validasi lokal hanya mencegah request yang
 *     pasti ditolak, pesan akhir tetap dari server.
 *   - Tanpa tombol "kirim ulang": TOTP dihasilkan di perangkat user, tidak ada
 *     yang dikirim server. Bantuan berupa teks + tautan ke kode cadangan.
 *   - Bila tempToken tidak ada (mis. app di-restart), langsung `replace` ke
 *     login — tidak ada yang bisa diverifikasi.
 *   - Kode kedaluwarsa/salah (UNAUTHORIZED/BAD_REQUEST) ditempel ke field;
 *     bila tempToken sendiri kedaluwarsa (server biasanya 401 dengan pesan
 *     "token"), user diarahkan login ulang lewat Alert + tautan.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { ScrollView, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useRouter } from "expo-router"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { HEADER_BAR_HEIGHT, Header } from "@/components/ui/header"
import { Heading } from "@/components/ui/heading"
import { Input } from "@/components/ui/input"
import { KeyboardAvoiding } from "@/components/ui/keyboard-avoiding"
import { OtpInput, type OtpInputHandle } from "@/components/ui/otp-input"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { TextLink } from "@/components/ui/text-link"
import { api, isApiError, userMessage } from "@/lib/api"
import { haptic } from "@/lib/haptics"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { clearPendingTwoFactorLogin, getPendingTwoFactorLogin } from "@/lib/two-factor-login"

/** Panjang TOTP (RFC 6238) — sama dengan `minLength` Verify2faLoginDto.code */
const TOTP_LENGTH = 6
/** Rentang backup code menurut deskripsi DTO ("10–16 character backup code") */
const BACKUP_MIN = 10
const BACKUP_MAX = 16

type Mode = "totp" | "backup"

export default function VerifyTwoFactorScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const otpRef = useRef<OtpInputHandle>(null)

  // Dibaca sekali saat mount; state modul bisa berubah kalau user kembali ke login.
  const [pending] = useState(() => getPendingTwoFactorLogin())

  useEffect(() => {
    if (!pending) router.replace(ROUTES.login)
  }, [pending, router])

  const [mode, setMode] = useState<Mode>("totp")
  const [totp, setTotp] = useState("")
  const [backup, setBackup] = useState("")
  const [fieldError, setFieldError] = useState<string | undefined>()
  const [formError, setFormError] = useState<string | null>(null)
  const [tokenExpired, setTokenExpired] = useState(false)
  const [verifying, setVerifying] = useState(false)

  const backupTrimmed = backup.replace(/\s+/g, "")
  const canSubmit =
    mode === "totp"
      ? totp.length === TOTP_LENGTH
      : backupTrimmed.length >= BACKUP_MIN && backupTrimmed.length <= BACKUP_MAX

  const switchMode = useCallback((next: Mode) => {
    setMode(next)
    setFieldError(undefined)
    setFormError(null)
  }, [])

  const handleVerify = useCallback(async () => {
    if (verifying || !pending || !canSubmit) return
    setVerifying(true)
    setFieldError(undefined)
    setFormError(null)

    const code = mode === "totp" ? totp : backupTrimmed

    try {
      await api.auth.verify2faLogin({ tempToken: pending.tempToken, code })
      clearPendingTwoFactorLogin()
      haptic("success")
      router.replace(ROUTES.welcome())
    } catch (err) {
      haptic("error")
      if (isApiError(err)) {
        const msg = err.message || ""
        // tempToken kedaluwarsa/tidak valid → harus login ulang
        if (err.code === "UNAUTHORIZED" && /token|sesi|session|expired|kedaluwarsa/i.test(msg)) {
          setTokenExpired(true)
          setFormError("Sesi verifikasi sudah kedaluwarsa. Silakan masuk kembali.")
          return
        }
        if (err.code === "UNAUTHORIZED" || err.code === "BAD_REQUEST" || err.code === "VALIDATION") {
          setFieldError(msg || "Kode tidak valid. Periksa kembali dan coba lagi.")
          if (mode === "totp") {
            setTotp("")
            otpRef.current?.focus()
          }
          return
        }
        if (err.code === "RATE_LIMITED") {
          setFormError(msg || "Terlalu banyak percobaan. Tunggu beberapa saat lalu coba lagi.")
          return
        }
      }
      setFormError(userMessage(err))
    } finally {
      setVerifying(false)
    }
  }, [verifying, pending, canSubmit, mode, totp, backupTrimmed, router])

  const handleBackToLogin = useCallback(() => {
    clearPendingTwoFactorLogin()
    router.replace(ROUTES.login)
  }, [router])

  if (!pending) return null

  return (
    <Screen padded={false} edges={["top"]}>
      <Header title="Verifikasi dua langkah" safeArea={false} />

      <KeyboardAvoiding offset={insets.top + HEADER_BAR_HEIGHT}>
        <ScrollView
          className="flex-1"
          contentContainerClassName="grow px-6 pb-8 pt-8"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="gap-8">
            <View className="gap-3">
              <Heading level={1} className="text-balance">
                {mode === "totp" ? "Masukkan kode autentikator" : "Masukkan kode cadangan"}
              </Heading>
              <Text variant="body" tone="secondary" className="text-pretty">
                {mode === "totp"
                  ? "Buka aplikasi autentikator (Google Authenticator, Authy, dsb.) dan masukkan kode 6 digit untuk akun:"
                  : "Gunakan salah satu kode cadangan yang Anda simpan saat mengaktifkan verifikasi dua langkah. Setiap kode hanya berlaku sekali."}
              </Text>
              <Text variant="monoBody" weight={600}>
                {pending.email}
              </Text>
            </View>

            {mode === "totp" ? (
              <OtpInput
                ref={otpRef}
                length={TOTP_LENGTH}
                value={totp}
                onChange={(next) => {
                  setTotp(next)
                  setFieldError(undefined)
                }}
                errorText={fieldError}
                helperText={fieldError ? undefined : "Kode berganti setiap 30 detik"}
                disabled={verifying || tokenExpired}
                autoFocus
                accessibilityLabel="Kode autentikator 6 digit"
              />
            ) : (
              <Input
                label="Kode cadangan"
                value={backup}
                onChangeText={(next) => {
                  setBackup(next)
                  setFieldError(undefined)
                }}
                autoCapitalize="characters"
                autoCorrect={false}
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={BACKUP_MAX + 3}
                errorText={fieldError}
                helperText={fieldError ? undefined : `${BACKUP_MIN}–${BACKUP_MAX} karakter, spasi diabaikan`}
                disabled={verifying || tokenExpired}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={() => void handleVerify()}
              />
            )}

            <Button onPress={() => void handleVerify()} loading={verifying} disabled={!canSubmit || tokenExpired}>
              Verifikasi
            </Button>

            {formError ? (
              <Alert tone="danger" title="Verifikasi gagal" onDismiss={() => setFormError(null)}>
                {formError}
              </Alert>
            ) : null}
          </View>
        </ScrollView>

        <View
          className="w-full gap-4 border-t border-border bg-background px-6 pt-4"
          style={{ paddingBottom: tokens.space[4] + insets.bottom }}
        >
          <View className="items-center">
            {mode === "totp" ? (
              <TextLink onPress={() => switchMode("backup")} disabled={verifying}>
                Tidak bisa akses aplikasi? Pakai kode cadangan
              </TextLink>
            ) : (
              <TextLink onPress={() => switchMode("totp")} disabled={verifying}>
                Pakai aplikasi autentikator
              </TextLink>
            )}
          </View>

          <Text variant="body" tone="secondary" className="text-center">
            Bukan akun Anda?{" "}
            <TextLink inline onPress={handleBackToLogin}>
              Masuk dengan akun lain
            </TextLink>
          </Text>
        </View>
      </KeyboardAvoiding>
    </Screen>
  )
}
