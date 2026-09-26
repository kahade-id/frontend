/**
 * Kahade — Register (screen #2 alur auth): nomor HP → OTP WhatsApp.
 *
 * Struktur:
 *   <Header title="Buat Akun" progress=1/4>          ← §9.22 bar tipis
 *   H1 "Masukkan nomor HP Anda" + body penjelasan
 *   <PhoneInput>                                     ← +62 tetap, digit nasional
 *   [Alert error form, bila ada]
 *   ── footer: [Kirim Kode]  •  Sudah punya akun? Masuk
 *
 * Kontrak API (kontrak auth-rework 2026-09-26, frozen):
 *   POST /v1/auth/otp-trigger  body { phoneNumber, purpose: "register", deviceId, location? }
 *   - `phoneNumber` dikirim E.164 (`toE164Id`) — bentuk kanonik yang sama
 *     dipakai lagi di `verify-otp`.
 *   - OTP HANYA via WhatsApp customer-initiated: user mengirim pesan pemicu
 *     (berisi refCode 12 hex) ke bot resmi, bot membalas kode 6 digit.
 *   - TIDAK ADA pilihan metode SMS/WhatsApp dan TIDAK ADA jalur kirim
 *     langsung — keduanya dihapus dari kontrak.
 *   - 409 = nomor sudah terdaftar → arahkan ke Masuk.
 *
 * Keputusan non-obvious:
 *   - Progress 0.25: registrasi via HP = 4 langkah (nomor → trigger WA →
 *     OTP → kata sandi + data diri → phone-register).
 *   - <Screen padded={false}> supaya border-b Header dan border-t footer
 *     full-width; body & footer memakai px-5 sendiri. Footer tidak lewat slot
 *     `footer` Screen karena harus berada DI DALAM <KeyboardAvoiding> agar CTA
 *     terangkat bersama body saat keyboard terbuka (slot Screen ada di luar).
 *   - Header `safeArea={false}`: Screen sudah menambah paddingTop inset;
 *     kalau keduanya aktif, header turun dua kali inset.
 *   - Validasi nomor terjadi saat submit (bukan on-change) — memerahkan field
 *     saat user baru mengetik 3 digit terasa menghakimi (§12 tone tenang).
 *     Error hilang begitu user mengubah nilai.
 *   - 409 defensif: endpoint /v1/auth/otp-trigger TIDAK melempar 409 untuk
 *     nomor yang sudah terdaftar (backend mengembalikan payload "decoy" 200
 *     demi anti-enumerasi; lihat whatsapp-trigger). Cabang CONFLICT
 *     dipertahankan sebagai pengaman bila kontrak berubah.
 *   - Error validasi backend yang menyebut nomor ditempel ke field; sisanya ke
 *     <Alert tone="danger"> (sudah role=alert + live region assertive).
 *   - State alur (nomor + refCode + deeplink WA) disimpan di memori modul
 *     (lib/otp-flow), BUKAN query param URL — B-07/B-14.
 */
import { useCallback, useRef, useState } from "react"
import { ScrollView, TextInput, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useRouter } from "expo-router"

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
import { api, isApiError, userMessage } from "@/lib/api"
import { getAuthLocation } from "@/lib/location"
import { setOtpFlow } from "@/lib/otp-flow"
import { ROUTES } from "@/lib/routes"

/** Registrasi via HP: 4 langkah sebelum akun jadi; ini langkah ke-1 */
const STEP_PROGRESS = 1 / 4

type FormError = { kind: "generic"; message: string } | { kind: "conflict"; message: string }

export default function RegisterScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const phoneRef = useRef<TextInput>(null)

  const [digits, setDigits] = useState("")
  const [phoneError, setPhoneError] = useState<string | undefined>()
  const [formError, setFormError] = useState<FormError | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleDigits = useCallback((next: string) => {
    setDigits(next)
    setPhoneError(undefined)
    setFormError(null)
  }, [])

  const goLogin = useCallback(() => {
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace(ROUTES.login)
    }
  }, [router])

  const handleSubmit = useCallback(async () => {
    if (submitting) return
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
      // Customer-initiated: user mengirim pesan pemicu sendiri, OTP dibalas
      // bot. Satu-satunya jalur OTP — tidak ada fallback kirim langsung.
      const trigger = await api.auth.requestOtpTrigger({
        phoneNumber,
        purpose: "register",
        location: (await getAuthLocation()) ?? undefined,
      })
      // B-07 (audit): nomor + refCode + deeplink WA disimpan di memori
      // alur (lib/otp-flow), BUKAN query param URL — di web param masuk
      // history/log/Referer.
      setOtpFlow({
        phoneNumber,
        purpose: "register",
        refCode: trigger.refCode,
        whatsappUrl: trigger.whatsappUrl,
        triggerText: trigger.triggerText,
        expiresAt: trigger.expiresAt,
      })
      router.push(ROUTES.whatsappTrigger)
    } catch (err) {
      if (isApiError(err)) {
        if (err.code === "CONFLICT") {
          setFormError({
            kind: "conflict",
            message: err.message || "Nomor HP ini sudah terdaftar.",
          })
          return
        }
        // Pesan validasi yang menyebut nomor -> tempel ke field, bukan Alert.
        const mentionsPhone = (err.validationMessages ?? [err.message]).find((m) =>
          /phone|nomor/i.test(m),
        )
        if ((err.code === "VALIDATION" || err.code === "BAD_REQUEST") && mentionsPhone) {
          setPhoneError(mentionsPhone)
          phoneRef.current?.focus()
          return
        }
      }
      setFormError({ kind: "generic", message: userMessage(err) })
    } finally {
      setSubmitting(false)
    }
  }, [digits, router, submitting])

  // edges top saja: inset bawah dijumlahkan di footer (bukan di Screen) agar tidak ganda
  return (
    <Screen padded={false} edges={["top"]}>
      <Header title="Buat Akun" progress={STEP_PROGRESS} safeArea={false} />

      <KeyboardAvoiding offset={insets.top + HEADER_BAR_HEIGHT}>
        <ScrollView
          className="flex-1"
          contentContainerClassName="grow px-5 pb-8 pt-8"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* v2: form reveal satu kesatuan (fast) — pola yang sama di semua
              layar auth; FooterBar di bawah tetap statis. */}
          <FadeIn duration="fast">
          <View className="gap-8">
            {/* Judul konten (H1) — Header memakai H3, jadi hanya satu H1 di layar */}
            <View className="gap-2">
              <Heading level={1} className="text-balance">
                Masukkan nomor HP Anda
              </Heading>
              <Text variant="body" tone="secondary" className="text-pretty">
                Kode verifikasi 6 digit akan dibalas lewat WhatsApp setelah
                Anda mengirim pesan ke nomor resmi Kahade. Nomor HP dipakai
                untuk masuk dan pemberitahuan transaksi.
              </Text>
            </View>

            <PhoneInput
              accessibilityLabel="Nomor HP Indonesia"
              ref={phoneRef}
              value={digits}
              onChangeText={handleDigits}
              errorText={phoneError}
              reserveHelperSpace
              required
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() => void handleSubmit()}
              disabled={submitting}
            />

            <Text variant="caption" tone="secondary" className="text-pretty">
              Langkah berikutnya: Anda akan diminta mengirim pesan ke WhatsApp
              resmi Kahade. Kode verifikasi dibalas lewat chat tersebut — bukan
              pesan mendadak dari kami.
            </Text>

            {formError ? (
              <Alert
                tone="danger"
                title={
                  formError.kind === "conflict" ? "Nomor sudah terdaftar" : "Kode belum terkirim"
                }
                action={
                  formError.kind === "conflict" ? (
                    <TextLink onPress={goLogin} variant="caption">
                      Masuk dengan akun tersebut
                    </TextLink>
                  ) : undefined
                }
                onDismiss={() => setFormError(null)}
              >
                {formError.message}
              </Alert>
            ) : null}
          </View>
          </FadeIn>
        </ScrollView>

        {/* Footer: CTA + jalan ke login. Pola border-t mengikuti slot footer Screen. */}
        <FooterBar>
          <Button
            onPress={() => void handleSubmit()}
            loading={submitting}
          >
            Kirim kode
          </Button>
          <Text variant="body" tone="secondary" className="text-center">
            Sudah punya akun?{" "}
            <TextLink inline onPress={goLogin}>
              Masuk
            </TextLink>
          </Text>
        </FooterBar>
      </KeyboardAvoiding>
    </Screen>
  )
}
