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
 *     tempToken, location? }) → sesi penuh → welcome.
 *   - migrationToken diteruskan saat resend di verify-otp via otp-flow state.
 *
 * Keputusan non-obvious:
 *   - Tanpa migrationToken (deep-link langsung) layar tidak bisa dipakai —
 *     kembali ke /login. `migrationToken` dari useLocalSearchParams.
 *   - showBack={false}: user tidak boleh kembali ke layar login dan "lupa"
 *     migrasi — akunnya belum bisa dipakai sampai nomor ditambahkan.
 *   - Nomor HP diverifikasi via WhatsApp customer-initiated, sama seperti
 *     registrasi; setelah verify-otp status migration_verified,
 *     confirmPhoneMigration menukar tempToken jadi sesi penuh.
 */
import { useCallback, useRef, useState } from "react"
import { ScrollView, TextInput } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useLocalSearchParams, useRouter } from "expo-router"

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
import { VStack } from "@/components/ui/stack"
import { api, userMessage } from "@/lib/api"
import { getAuthLocation } from "@/lib/location"
import { setOtpFlow } from "@/lib/otp-flow"
import { ROUTES } from "@/lib/routes"

export default function PhoneMigrationScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const phoneRef = useRef<TextInput>(null)
  const { migrationToken } = useLocalSearchParams<{ migrationToken?: string }>()

  const [digits, setDigits] = useState("")
  const [phoneError, setPhoneError] = useState<string | undefined>()
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = useCallback(async () => {
    if (submitting) return
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
      router.push(ROUTES.whatsappTrigger)
    } catch (err) {
      setFormError(userMessage(err))
    } finally {
      setSubmitting(false)
    }
  }, [digits, migrationToken, router, submitting])

  return (
    <Screen padded={false} edges={["top"]}>
      <Header title="Tambah Nomor HP" safeArea={false} showBack={false} />

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
                autoFocus
                returnKeyType="done"
                onSubmitEditing={() => void handleSubmit()}
                disabled={submitting}
              />

              <Text variant="caption" tone="secondary" className="text-pretty">
                Kami akan memverifikasi nomor ini lewat WhatsApp — Anda akan
                diminta mengirim pesan ke WhatsApp resmi Kahade.
              </Text>

              {formError ? (
                <Alert tone="danger" title="Gagal" onDismiss={() => setFormError(null)}>
                  {formError}
                </Alert>
              ) : null}
            </VStack>
          </FadeIn>
        </ScrollView>

        <FooterBar>
          <Button onPress={() => void handleSubmit()} loading={submitting}>
            Kirim kode
          </Button>
        </FooterBar>
      </KeyboardAvoiding>
    </Screen>
  )
}
