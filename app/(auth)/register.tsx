/**
 * Kahade — Register (screen #2 alur auth): nomor HP + metode OTP.
 *
 * Struktur:
 *   <Header title="Buat Akun" progress=1/4>          ← §9.22 bar tipis
 *   H1 "Masukkan nomor HP Anda" + body penjelasan
 *   <PhoneInput>                                     ← +62 tetap, digit nasional
 *   Label "Kirim kode melalui" + <OtpMethodSelector> ← dari GET otp-methods
 *   [Alert error form, bila ada]
 *   ── footer: [Kirim Kode]  •  Sudah punya akun? Masuk
 *
 * Kontrak API (docs/api/kahade-api-mobile.json):
 *   POST /v1/auth/request-otp  body RequestOtpDto { phoneNumber, method }
 *   - `phoneNumber` dikirim E.164 (`toE164Id`) — spec menerima 08xx ATAU +62,
 *     kita pilih satu bentuk kanonik supaya string yang sama persis dipakai
 *     lagi di `verify-otp` (dibawa lewat param rute).
 *   - `method` PERSIS enum "SMS" | "WHATSAPP".
 *   - TIDAK ada `deviceId` di DTO ini (berbeda dari verify-otp/login) —
 *     jadi screen ini tidak menyentuh session.ts sama sekali.
 *
 * Keputusan non-obvious:
 *   - Progress 0.25: registrasi via HP = 4 langkah server-side (nomor → OTP →
 *     keamanan → data diri, semuanya sebelum phone-register). Setup profil
 *     (#6) tidak dihitung karena terjadi SETELAH akun jadi.
 *   - <Screen padded={false}> supaya border-b Header dan border-t footer
 *     full-width; body & footer memakai px-6 sendiri. Footer tidak lewat slot
 *     `footer` Screen karena harus berada DI DALAM <KeyboardAvoiding> agar CTA
 *     terangkat bersama body saat keyboard terbuka (slot Screen ada di luar).
 *   - Header `safeArea={false}`: Screen sudah menambah paddingTop inset;
 *     kalau keduanya aktif, header turun dua kali inset.
 *   - Validasi nomor terjadi saat submit (bukan on-change) — memerahkan field
 *     saat user baru mengetik 3 digit terasa menghakimi (§12 tone tenang).
 *     Error hilang begitu user mengubah nilai.
 *   - Metode default = item pertama dari backend (diturunkan, bukan disimpan
 *     di state) sehingga tidak ada frame "belum ada yang terpilih" dan tidak
 *     perlu effect sinkronisasi.
 *   - 409 (nomor sudah terdaftar) ditangani khusus: Alert + tautan "Masuk" —
 *     ini jalan keluar yang benar, bukan mengulang request.
 *   - Error validasi backend yang menyebut nomor ditempel ke field; sisanya ke
 *     <Alert tone="danger"> (sudah role=alert + live region assertive).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ScrollView, TextInput, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useLocalSearchParams, useRouter } from "expo-router"

import { OtpMethodSelector } from "@/components/register/otp-method-selector"
import { useOtpMethods } from "@/components/register/use-otp-methods"
import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { FieldLabel } from "@/components/ui/field"
import { HEADER_BAR_HEIGHT, Header } from "@/components/ui/header"
import { Heading } from "@/components/ui/heading"
import { KeyboardAvoiding } from "@/components/ui/keyboard-avoiding"
import { isValidPhoneId, PhoneInput, toE164Id } from "@/components/ui/phone-input"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { TextLink } from "@/components/ui/text-link"
import { api, isApiError, userMessage, type OtpMethod } from "@/lib/api"
import { setPendingReferralCode } from "@/lib/registration"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"

/** Registrasi via HP: 4 langkah sebelum akun jadi; ini langkah ke-1 */
const STEP_PROGRESS = 1 / 4

type FormError = { kind: "generic"; message: string } | { kind: "conflict"; message: string }

export default function RegisterScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const phoneRef = useRef<TextInput>(null)

  const { methods, loading: methodsLoading } = useOtpMethods()

  // Deep link referral `kahade://register?ref=<code>` (lib/deeplinks) —
  // disimpan ke registration state, dipakai screen #5 sebagai prefill.
  const { ref } = useLocalSearchParams<{ ref?: string }>()
  useEffect(() => {
    if (ref) setPendingReferralCode(ref)
  }, [ref])

  const [digits, setDigits] = useState("")
  const [phoneError, setPhoneError] = useState<string | undefined>()
  const [pickedMethod, setPickedMethod] = useState<OtpMethod | undefined>()
  const [formError, setFormError] = useState<FormError | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Default = pilihan pertama backend; kalau user memilih yang lalu hilang
  // dari daftar (refetch), jatuh kembali ke pilihan pertama.
  const method = useMemo<OtpMethod | undefined>(
    () => (pickedMethod && methods.includes(pickedMethod) ? pickedMethod : methods[0]),
    [pickedMethod, methods],
  )

  const handleDigits = useCallback((next: string) => {
    setDigits(next)
    setPhoneError(undefined)
    setFormError(null)
  }, [])

  const goLogin = useCallback(() => router.replace(ROUTES.login), [router])

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
    if (!method) {
      setFormError({ kind: "generic", message: "Metode pengiriman kode belum tersedia. Coba lagi sebentar." })
      return
    }

    const phoneNumber = toE164Id(digits)
    setSubmitting(true)
    try {
      await api.auth.requestOtp({ phoneNumber, method })
      router.push(ROUTES.verifyOtp({ phoneNumber, method }))
    } catch (err) {
      if (isApiError(err)) {
        if (err.code === "CONFLICT") {
          setFormError({ kind: "conflict", message: err.message || "Nomor HP ini sudah terdaftar." })
          return
        }
        // Pesan validasi yang menyebut nomor -> tempel ke field, bukan Alert.
        const mentionsPhone = (err.validationMessages ?? [err.message]).find((m) => /phone|nomor/i.test(m))
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
  }, [digits, method, router, submitting])

  // edges top saja: inset bawah dijumlahkan di footer (bukan di Screen) agar tidak ganda
  return (
    <Screen padded={false} edges={["top"]}>
      <Header title="Buat Akun" progress={STEP_PROGRESS} safeArea={false} />

      <KeyboardAvoiding offset={insets.top + HEADER_BAR_HEIGHT}>
        <ScrollView
          className="flex-1"
          contentContainerClassName="grow px-6 pb-8 pt-8"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="gap-8">
            {/* Judul konten (H1) — Header memakai H3, jadi hanya satu H1 di layar */}
            <View className="gap-2">
              <Heading level={1} className="text-balance">
                Masukkan nomor HP Anda
              </Heading>
              <Text variant="body" tone="secondary" className="text-pretty">
                Kami akan mengirim kode verifikasi 6 digit ke nomor ini. Nomor HP dipakai untuk masuk dan
                pemberitahuan transaksi.
              </Text>
            </View>

            <PhoneInput
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

            <View className="gap-3">
              <FieldLabel>Kirim kode melalui</FieldLabel>
              <OtpMethodSelector
                value={method}
                onChange={setPickedMethod}
                methods={methods}
                loading={methodsLoading}
                disabled={submitting}
              />
            </View>

            {formError ? (
              <Alert
                tone="danger"
                title={formError.kind === "conflict" ? "Nomor sudah terdaftar" : "Kode belum terkirim"}
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
        </ScrollView>

        {/* Footer: CTA + jalan ke login. Pola border-t mengikuti slot footer Screen. */}
        <View
          className="w-full gap-4 border-t border-border bg-background px-6 pt-4"
          style={{ paddingBottom: tokens.space[4] + insets.bottom }}
        >
          <Button onPress={() => void handleSubmit()} loading={submitting} disabled={methodsLoading}>
            Kirim Kode
          </Button>
          <Text variant="body" tone="secondary" className="text-center">
            Sudah punya akun?{" "}
            <TextLink inline onPress={goLogin}>
              Masuk
            </TextLink>
          </Text>
        </View>
      </KeyboardAvoiding>
    </Screen>
  )
}
