/** WhatsApp login is an OTP-only flow; it never renders a password field. */
import { useCallback, useRef, useState } from "react"
import { type TextInputInstance } from "react-native"
import { WhatsappLogo } from "phosphor-react-native"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { PhoneInput, isValidPhoneId, toE164Id } from "@/components/ui/phone-input"
import { Text } from "@/components/ui/text"
import { VStack } from "@/components/ui/stack"
import { api, isApiError, userMessage } from "@/lib/api"
import { getAuthLocation } from "@/lib/location"
import { ROUTES } from "@/lib/routes"
import { setOtpFlow } from "@/lib/otp-flow"
import { useLoginNavigation } from "@/components/auth/use-login-navigation"

type Props = {
  nextPath?: string
}

export function LoginWhatsappForm({ nextPath }: Props) {
  const { router, beginLogin } = useLoginNavigation(nextPath)
  const [digits, setDigits] = useState("")
  const [phoneError, setPhoneError] = useState<string | undefined>()
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const phoneRef = useRef<TextInputInstance>(null)

  const requestCode = useCallback(async () => {
    if (submitting) return
    setPhoneError(undefined)
    setFormError(null)

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
    beginLogin()
    try {
      const trigger = await api.auth.requestOtpTrigger({
        phoneNumber,
        purpose: "login",
        location: (await getAuthLocation()) ?? undefined,
      })
      // Keep the OTP reference and phone out of route params.
      setOtpFlow({
        phoneNumber,
        purpose: "login",
        refCode: trigger.refCode,
        whatsappUrl: trigger.whatsappUrl,
        triggerText: trigger.triggerText,
        expiresAt: trigger.expiresAt,
      })
      router.push(ROUTES.whatsappTrigger)
    } catch (err) {
      if (isApiError(err)) {
        if (err.code === "NOT_FOUND") {
          setFormError("Nomor HP ini belum terdaftar. Silakan daftar akun baru terlebih dahulu.")
          return
        }
        if (err.code === "RATE_LIMITED") {
          setFormError("Terlalu banyak percobaan. Tunggu beberapa saat sebelum mencoba lagi.")
          return
        }
      }
      setFormError(userMessage(err))
    } finally {
      setSubmitting(false)
    }
  }, [submitting, digits, beginLogin, router])

  return (
    <VStack gap={4}>
      <PhoneInput
        accessibilityLabel="Nomor HP Indonesia"
        ref={phoneRef}
        value={digits}
        onChangeText={(value) => {
          setDigits(value)
          setPhoneError(undefined)
          setFormError(null)
        }}
        errorText={phoneError}
        reserveHelperSpace
        required
        returnKeyType="done"
        onSubmitEditing={() => void requestCode()}
        disabled={submitting}
      />
      {formError ? (
        <Alert tone="danger" title="Gagal meminta kode" onDismiss={() => setFormError(null)}>
          {formError}
        </Alert>
      ) : null}
      <Button
        onPress={() => void requestCode()}
        loading={submitting}
        leftIcon={WhatsappLogo}
      >
        Minta kode verifikasi
      </Button>
      <Text variant="caption" tone="secondary" className="text-pretty">
        Kami akan meminta Anda mengirim pesan ke WhatsApp resmi Kahade, lalu membalas kode verifikasi 6 digit.
      </Text>
      <Text variant="caption" tone="secondary" className="text-center text-pretty">
        Demi keamanan, lokasi perangkat dapat dicatat jika Anda mengizinkan akses.
      </Text>
    </VStack>
  )
}
