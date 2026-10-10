/** WhatsApp login is an OTP-only flow; it never renders a password field. */
import { useCallback, useRef, useState } from "react"
import { type TextInputInstance } from "react-native"
import { WhatsappLogo } from "phosphor-react-native"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { PhoneInput, isValidPhoneId, toE164Id } from "@/components/ui/phone-input"
import { VStack } from "@/components/ui/stack"
import { api, isApiError, userMessage } from "@/lib/api"
import { getAuthLocation } from "@/lib/location"
import { ROUTES } from "@/lib/routes"
import { setOtpFlow } from "@/lib/otp-flow"
import { retryAfterMessage, useRetryCooldown } from "@/lib/retry-cooldown"
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
  const cooldown = useRetryCooldown()

  const requestCode = useCallback(async () => {
    if (submitting || cooldown.isCoolingDown) return
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
          // #FE-I13: jangan konfirmasi "belum terdaftar" — alur daftar/lupa
          // sandi sengaja anti-enumerasi; copy generik + arah daftar.
          setFormError(
            "Kode belum bisa diminta untuk nomor ini. Periksa nomor HP, atau daftar bila belum punya akun.",
          )
          return
        }
        if (cooldown.startFromError(err)) {
          setFormError(
            retryAfterMessage(err, "Terlalu banyak percobaan. Tunggu beberapa saat sebelum mencoba lagi."),
          )
          return
        }
      }
      setFormError(userMessage(err))
    } finally {
      setSubmitting(false)
    }
  }, [submitting, digits, beginLogin, router, cooldown])

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
        disabled={cooldown.isCoolingDown}
        leftIcon={WhatsappLogo}
      >
        {cooldown.label("Minta kode verifikasi")}
      </Button>
    </VStack>
  )
}
