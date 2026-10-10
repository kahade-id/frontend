/**
 * Kahade — Lupa Kata Sandi (phone-based, customer-initiated WhatsApp).
 *
 * Struktur:
 *   <Header title="Lupa Kata Sandi" progress={1/4} showBack>
 *   VStack gap={8}:
 *     VStack (H1 + penjelasan)
 *     PhoneInput (nomor HP akun)
 *     Button "Kirim kode"
 *     Alert error (jika ada)
 *
 * Kontrak API (kontrak auth-rework 2026-09-26, frozen):
 *   POST /v1/auth/forgot-password  body { identifier, location? }
 *   - `identifier` = nomor HP akun (login menerima username/email/nomor HP,
 *     tetapi jalur reset via OTP WhatsApp hanya bisa ke nomor HP terdaftar).
 *   - Backend men-trigger OTP WhatsApp ke nomor tersebut dan mengembalikan
 *     payload trigger: { refCode, whatsappUrl, triggerText, expiresAt }.
 *   - verify-otp dengan status password_reset → tempToken disimpan di
 *     lib/password-reset.ts → /reset-password (buat kata sandi baru).
 *
 * Keputusan non-obvious:
 *   - Tidak ada email, tidak ada captcha — alur lama dihapus.
 *   - 404 (nomor tidak terdaftar) tetap di-respons dengan instruksi WA yang
 *     sama agar tidak membocorkan akun mana yang ada (anti-enumerasi).
 *   - Lokasi opsional dicatat; null = lanjut tanpa lokasi.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { ScrollView, type TextInputInstance } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useRouter } from "expo-router"

import { translate } from "@/lib/i18n/translate"

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
import { api, isApiError, userMessage } from "@/lib/api"
import { formatCountdown } from "@/lib/format"
import { getAuthLocation } from "@/lib/location"
import { setOtpFlow } from "@/lib/otp-flow"
import { ROUTES } from "@/lib/routes"

/** FE-040: nomor → trigger WA (2/4) → OTP (3/4) → kata sandi baru (4/4). */
const STEP_PROGRESS = 1 / 4

export default function ForgotPasswordScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const phoneRef = useRef<TextInputInstance>(null)

  const [digits, setDigits] = useState("")
  const [phoneError, setPhoneError] = useState<string | undefined>()
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  /**
   * BFE-048: epoch-ms kapan throttle berakhir. Backend me-throttle
   * POST /v1/auth/forgot-password (5/jam) dan mengirim `Retry-After`;
   * `ApiError.retryAfterMs` sudah diparse client. Selama cooldown, tombol
   * dikunci dan menampilkan hitung mundur — bukan spinner tanpa akhir.
   */
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (cooldownUntil === null) return
    const id = setInterval(() => {
      const t = Date.now()
      setNow(t)
      if (t >= cooldownUntil) {
        setCooldownUntil(null)
        clearInterval(id)
      }
    }, 1000)
    return () => clearInterval(id)
  }, [cooldownUntil])

  const cooldownSeconds =
    cooldownUntil === null ? 0 : Math.max(0, Math.ceil((cooldownUntil - now) / 1000))
  const isCoolingDown = cooldownSeconds > 0

  const handleSubmit = useCallback(async () => {
    if (submitting || isCoolingDown) return
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
    try {
      // Backend memicu OTP WhatsApp ke nomor ini dan mengembalikan payload
      // trigger yang sama bentuknya dengan requestOtpTrigger.
      const result = await api.auth.forgotPassword({
        identifier: phoneNumber,
        location: (await getAuthLocation()) ?? undefined,
      })
      // parseOtpTriggerResult sudah throw bila payload tidak valid; bila
      // kembali, field trigger dijamin ada.
      setOtpFlow({
        phoneNumber,
        purpose: "forgot_password",
        refCode: result.refCode,
        whatsappUrl: result.whatsappUrl,
        triggerText: result.triggerText,
        expiresAt: result.expiresAt,
      })
      router.push(ROUTES.whatsappTrigger)
    } catch (err) {
      // BFE-048: 429 throttled → kunci tombol + countdown. Bila backend
      // mengirim Retry-After, pakai nilainya; bila tidak, fallback 60 detik
      // dengan pesan yang jelas (jangan spinner/diam tanpa info).
      if (isApiError(err) && err.status === 429) {
        const waitMs =
          typeof err.retryAfterMs === "number" && err.retryAfterMs > 0
            ? err.retryAfterMs
            : 60_000
        setCooldownUntil(Date.now() + waitMs)
        setNow(Date.now())
        setFormError(
          typeof err.retryAfterMs === "number" && err.retryAfterMs > 0
            ? translate("Terlalu banyak percobaan. Coba lagi dalam {x}.", {
                x: formatCountdown(Math.ceil(waitMs / 1000)),
              })
            : "Terlalu banyak percobaan. Tunggu sekitar 1 menit lalu coba lagi.",
        )
      } else {
        setFormError(userMessage(err))
      }
    } finally {
      setSubmitting(false)
    }
  }, [digits, isCoolingDown, router, submitting])

  return (
    <Screen padded={false} edges={["top"]}>
      <Header title="Lupa Kata Sandi" progress={STEP_PROGRESS} safeArea={false}
        right={<AuthSecurityInfo variant="whatsappOtp" />}
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
                {/* T1-008: bedakan dari H1 register ("Masukkan nomor HP
                    Anda") — satu kata "akun" cukup untuk disambiguasi. */}
                <Heading level={1} className="text-balance">
                  Nomor HP akun Anda
                </Heading>
                <Text variant="body" tone="secondary" className="text-pretty">
                  Kami akan memandu Anda mengirim pesan ke WhatsApp resmi
                  Kahade. Kode verifikasi akan dibalas lewat chat tersebut.
                </Text>
              </VStack>

              <PhoneInput
                accessibilityLabel="Nomor HP akun"
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

              {formError ? (
                // UI-A006: judul konsisten dengan register.tsx ("Kode belum terkirim").
                <Alert tone="danger" title="Kode belum terkirim" onDismiss={() => setFormError(null)}>
                  {formError}
                </Alert>
              ) : null}
            </VStack>
          </FadeIn>
        </ScrollView>

        <FooterBar>
          {/* BFE-048: saat throttle, tombol terkunci + tampilkan countdown. */}
          <Button
            onPress={() => void handleSubmit()}
            loading={submitting}
            disabled={isCoolingDown}
          >
            {isCoolingDown
              ? translate("Coba lagi dalam {x}", { x: formatCountdown(cooldownSeconds) })
              : "Lanjutkan"}
          </Button>
          {/*
           * FE-IMP-3 #112 — reset HANYA via nomor HP (tidak ada jalur email).
           * Nomor tidak aktif = tidak bisa terima balasan WA → tautan bantuan.
           */}
          <Text variant="caption" tone="secondary" className="text-center text-pretty">
            Nomor HP tidak aktif atau sudah tidak dipakai?{" "}
            <TextLink inline onPress={() => router.push(ROUTES.faq)}>
              Minta bantuan
            </TextLink>
          </Text>
        </FooterBar>
      </KeyboardAvoiding>
    </Screen>
  )
}
