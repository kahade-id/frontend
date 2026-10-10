/**
 * Kahade — Migrasi Nomor HP (akun lama yang login tanpa nomor HP).
 *
 * Kapan muncul: login mengembalikan `{ requiresPhoneMigration: true,
 * migrationToken }` — akun ada tapi belum punya nomor HP. migrationToken
 * short-lived untuk satu alur ini (diterima via route params, bukan memori).
 *
 * Struktur:
 *   <Header title="Tambah Nomor HP" showBack={false}>
 *   VStack gap={8}:
 *     VStack (H1 + penjelasan)
 *     PhoneInput
 *     Button "Kirim kode"
 *     Alert error (jika ada)
 *
 * Kontrak API (kontrak auth-rework 2026-09-26, frozen):
 *   POST /v1/auth/otp-trigger  body { phoneNumber, purpose: "migrate_phone",
 *     migrationToken, deviceId, location? }
 *   - verify-otp dengan status migration_verified → confirmPhoneMigration({
 *     tempToken, location? }) → sesi penuh → Beranda (U5-003: tanpa welcome).
 *   - migrationToken diteruskan saat resend di verify-otp via otp-flow state.
 *
 * Keputusan non-obvious:
 *   - Tanpa migrationToken (deep-link langsung) layar tidak bisa dipakai —
 *     kembali ke /login. `migrationToken` dari useLocalSearchParams.
 *   - Migrasi tetap wajib untuk memakai akun, tetapi selalu tersedia jalan
 *     kembali ke Masuk bila sesi migrasi hilang atau pengguna ingin keluar.
 *   - Nomor HP diverifikasi via WhatsApp customer-initiated, sama seperti
 *     registrasi; setelah verify-otp status migration_verified,
 *     confirmPhoneMigration menukar tempToken jadi sesi penuh.
 */
import { useCallback, useRef, useState } from "react"
import { ScrollView, type TextInputInstance } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useRouter } from "expo-router"

import { AuthSecurityInfo } from "@/components/auth/auth-security-info"
import { Alert } from "@/components/ui/alert"
import { FadeIn } from "@/components/ui/fade-in"
import { FooterBar } from "@/components/ui/footer-bar"
import { Button } from "@/components/ui/button"
import { HEADER_BAR_HEIGHT, Header } from "@/components/ui/header"
import { Heading } from "@/components/ui/heading"
import { KeyboardAvoiding } from "@/components/ui/keyboard-avoiding"
import { isValidPhoneId, PhoneInput, toE164Id } from "@/components/ui/phone-input"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { TextLink } from "@/components/ui/text-link"
import { VStack } from "@/components/ui/stack"
import { api, userMessage } from "@/lib/api"
import { getAuthLocation } from "@/lib/location"
import { setOtpFlow } from "@/lib/otp-flow"
import {
  clearPendingMigrationToken,
  getPendingMigrationToken,
} from "@/lib/phone-migration-token"
import { ROUTES } from "@/lib/routes"
import { retryAfterMessage, useRetryCooldown } from "@/lib/retry-cooldown"

export default function PhoneMigrationScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const phoneRef = useRef<TextInputInstance>(null)
  // BATCH4-B4: migrationToken dari memori modul, bukan route params.
  // Tanpa token (app restart / deep-link langsung) → fail-closed ke /login.
  const migrationToken = getPendingMigrationToken()

  const [digits, setDigits] = useState("")
  const [phoneError, setPhoneError] = useState<string | undefined>()
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const cooldown = useRetryCooldown()
  const errorMessage = !migrationToken
    ? "Sesi migrasi tidak valid. Silakan masuk kembali."
    : formError
  const backToLogin = () => router.replace(ROUTES.login)

  const handleSubmit = useCallback(async () => {
    if (submitting || cooldown.isCoolingDown) return
    setFormError(null)

    if (!migrationToken) {
      setFormError("Sesi migrasi tidak valid. Silakan masuk kembali.")
      return
    }

    if (!isValidPhoneId(digits)) {
      setPhoneError(
        digits.length === 0
          ? "Nomor HP wajib diisi."
          : "Nomor HP tidak valid. Gunakan nomor Indonesia yang diawali 8, 9–12 digit.",
      )
      phoneRef.current?.focus()
      return
    }

    const phoneNumber = toE164Id(digits)
    setSubmitting(true)
    try {
      const trigger = await api.auth.requestOtpTrigger({
        phoneNumber,
        purpose: "migrate_phone",
        migrationToken,
        location: (await getAuthLocation()) ?? undefined,
      })
      // migrationToken disimpan di otp-flow agar resend di verify-otp bisa
      // meneruskannya tanpa lewat route params lagi.
      setOtpFlow({
        phoneNumber,
        purpose: "migrate_phone",
        migrationToken,
        refCode: trigger.refCode,
        whatsappUrl: trigger.whatsappUrl,
        triggerText: trigger.triggerText,
        expiresAt: trigger.expiresAt,
      })
      // BATCH4-B3: token di holder modul dibakar — kini hidup di otp-flow.
      clearPendingMigrationToken()
      router.push(ROUTES.whatsappTrigger)
    } catch (err) {
      // #FE-L2: 429 → kunci tombol + durasi nyata, bukan teks generik.
      if (cooldown.startFromError(err)) {
        setFormError(
          retryAfterMessage(err, "Terlalu banyak permintaan kode. Tunggu sebentar lalu coba lagi."),
        )
        return
      }
      setFormError(userMessage(err))
    } finally {
      setSubmitting(false)
    }
  }, [digits, migrationToken, router, submitting, cooldown])

  return (
    <Screen padded={false} edges={["top"]}>
      <Header title="Tambah Nomor HP" safeArea={false} showBack={false}
        right={<AuthSecurityInfo variant="signIn" />}
      />

      <KeyboardAvoiding offset={insets.top + HEADER_BAR_HEIGHT}>
        <ScrollView
          className="flex-1"
          contentContainerClassName="grow px-5 pb-8 pt-8"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <FadeIn duration="fast">
            <VStack gap={8}>
              <VStack gap={2}>
                <Heading level={1} className="text-balance">
                  Tambahkan nomor HP Anda
                </Heading>
                <Text variant="body" tone="secondary" className="text-pretty">
                  Akun Anda belum memiliki nomor HP. Kami membutuhkan nomor HP
                  yang aktif untuk keamanan akun dan verifikasi transaksi.
                </Text>
                {/*
                 * FE-IMP-3 #113 — tegaskan: akun belum bisa dipakai sampai
                 * nomor ditambahkan (migrasi wajib, bukan opsional).
                 */}
                <Alert tone="warning">
                  Tambahkan nomor HP untuk mulai memakai akun Anda.
                </Alert>
              </VStack>

              <PhoneInput
                accessibilityLabel="Nomor HP baru"
                ref={phoneRef}
                value={digits}
                onChangeText={(t) => {
                  setDigits(t)
                  setPhoneError(undefined)
                  setFormError(null)
                }}
                errorText={phoneError}
                reserveHelperSpace
                required
                autoFocus={!!migrationToken}
                returnKeyType="done"
                onSubmitEditing={() => void handleSubmit()}
                disabled={submitting || !migrationToken}
              />

              <Text variant="caption" tone="secondary" className="text-pretty">
                Kami akan memverifikasi nomor ini lewat WhatsApp — Anda akan
                diminta mengirim pesan ke WhatsApp resmi Kahade.
              </Text>

              {errorMessage ? (
                <VStack gap={3}>
                  <Alert tone="danger" title="Kode belum terkirim" onDismiss={migrationToken ? () => setFormError(null) : undefined}>
                    {errorMessage}
                  </Alert>
                  <TextLink onPress={backToLogin}>Kembali ke Masuk</TextLink>
                </VStack>
              ) : null}
            </VStack>
          </FadeIn>
        </ScrollView>

        <FooterBar>
          <VStack gap={3}>
            <Button
              onPress={() => void handleSubmit()}
              loading={submitting}
              disabled={!migrationToken || cooldown.isCoolingDown}
            >
              {cooldown.label("Kirim kode")}
            </Button>
            {!errorMessage ? <TextLink onPress={backToLogin}>Kembali ke Masuk</TextLink> : null}
          </VStack>
        </FooterBar>
      </KeyboardAvoiding>
    </Screen>
  )
}
