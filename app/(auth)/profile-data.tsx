/**
 * Kahade — Data Diri (screen #5 alur auth): form data + submit phone-register.
 *
 * Struktur:
 *   <Header title="Data Diri" progress=4/4>
 *   H1 "Lengkapi data Anda" + body penjelasan
 *   <Input>         Nama lengkap        (required, 2–60 char)
 *   <UsernameField> Nama pengguna        (required, 3–20 char, format validated)
 *   <DateField>     Tanggal lahir        (required, tap → BottomSheet Calendar)
 *   <EmailField>    Email                (required, format validated)
 *   <RadioGroup>    Jenis kelamin        (required, 4 opsi)
 *   <TextArea>      Alamat               (optional, max 500 char)
 *   <Input>         Kode referral        (optional, max 20 char)
 *   [Alert error form]
 *   ── footer: [Daftar]  (disabled sampai semua field wajib valid)
 *
 * Kontrak API (docs/api/kahade-api-mobile.json):
 *   POST /v1/auth/phone-register  body PhoneRegisterDto
 *   - tempToken  : dari verify-otp (registration state)
 *   - fullName   : 2–60 char
 *   - username   : 3–30 char (frontend batasi 20 via UsernameField)
 *   - dateOfBirth: ISO 8601 "YYYY-MM-DD"
 *   - gender     : "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY"
 *   - email      : max 254 char (WAJIB meski daftar via HP)
 *   - password   : dari screen #4 (registration state)
 *   - pin        : dari screen #4 (registration state)
 *   - address    : opsional, max 500 char
 *   - referralCode: opsional, max 20 char
 *   - deviceId   : auto-inject oleh auth.ts
 *
 *   Response (UNVERIFIED): AuthTokens & { user?: AuthUser }
 *   - Token disimpan otomatis oleh phoneRegister() di auth.ts
 *
 * Keputusan non-obvious:
 *   - Tanggal lahir via BottomSheet + Calendar (bukan native picker): konsisten
 *     lintas platform dan mengikuti §10 (pilihan pendek = BottomSheet).
 *     maxDate = hari ini (tidak bisa tanggal masa depan). minDate = 120 tahun
 *     lalu — cukup untuk verifikasi usia tanpa membatasi user lansia.
 *   - Gender = RadioGroup inline (bukan Select + sheet): 4 opsi tidak perlu
 *     BottomSheet terpisah — langsung terlihat di form, satu tap untuk pilih.
 *     Ini penyimpangan kecil dari §10 (form pendek = sheet) tapi lebih efisien
 *     untuk pilihan yang sedikit dan tetap mengikuti §9.5 Radio.
 *   - Username TIDAK ada availability check (debounced API call). Kalau nama
 *     sudah dipakai, server return 409 CONFLICT saat phone-register — error
 *     ditempel ke UsernameField. Ini menghemat satu API call per registrasi
 *     dan tetap memberi feedback yang jelas.
 *   - Tombol "Daftar" di footer (fixed, tidak scroll) — user selalu melihat
 *     CTA. ScrollView padding bawah cukup agar field terakhir tidak tertutup.
 *   - Setelah berhasil: `clearRegistrationState()` (data tidak dipakai lagi),
 *     token sudah disimpan otomatis → redirect ke home (fallback: login
 *     sampai dashboard dibuat).
 *   - Referral code: tidak divalidasi format (KH...) di klien — server yang
 *     menentukan. Kalau invalid, server return error yang ditempel ke Alert.
 */
import { Redirect, useRouter } from "expo-router"
import { useCallback, useMemo, useState } from "react"
import { ScrollView } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { FooterBar } from "@/components/ui/footer-bar"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { DateField } from "@/components/ui/date-field"
import { EmailField, isValidEmail } from "@/components/ui/email-field"
import { FieldLabel } from "@/components/ui/field"
import { HEADER_BAR_HEIGHT, Header } from "@/components/ui/header"
import { Heading } from "@/components/ui/heading"
import { Input } from "@/components/ui/input"
import { KeyboardAvoiding } from "@/components/ui/keyboard-avoiding"
import { Radio, RadioGroup } from "@/components/ui/radio"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"
import { UsernameField, validateUsername } from "@/components/ui/username-field"
import { Alert } from "@/components/ui/alert"
import { VStack } from "@/components/ui/stack"
import {
  api,
  isApiError,
  userMessage,
  type PhoneRegisterDto,
} from "@/lib/api"
import { getPendingReferralCode, getRegistrationState, setRegistrationState } from "@/lib/registration"
import { ROUTES } from "@/lib/routes"

/** Progress: registrasi via HP = 4 langkah, ini langkah ke-4 (terakhir) */
const STEP_PROGRESS = 4 / 4

type Gender = PhoneRegisterDto["gender"]

const GENDER_OPTIONS: readonly { value: Gender; label: string }[] = [
  { value: "MALE", label: "Laki-laki" },
  { value: "FEMALE", label: "Perempuan" },
  { value: "OTHER", label: "Lainnya" },
  { value: "PREFER_NOT_TO_SAY", label: "Tidak ingin memberitahu" },
]

/** Konversi Date ke ISO 8601 "YYYY-MM-DD" untuk PhoneRegisterDto.dateOfBirth */
function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

const USERNAME_LABELS = {
  label: "Nama pengguna",
  tooShort: "Minimal 3 karakter",
  invalid: "Hanya huruf kecil, angka, titik, dan garis bawah",
  checking: "Memeriksa ketersediaan…",
  available: "Nama pengguna tersedia",
  taken: "Nama pengguna sudah dipakai",
  hint: "3–20 karakter, huruf kecil/angka/._",
}

type FormError = { kind: "generic"; message: string } | { kind: "conflict"; field: "username" | "email"; message: string } | null

export default function ProfileDataScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  /*
   * Guard: butuh registration state lengkap dari screen sebelumnya.
   *
   * Nilanya dibaca DI ATAS semua hook, tetapi `<Redirect>`-nya dirender di
   * BAWAH (sebelum return utama), bukan di sini. `getRegistrationState()`
   * adalah state modul yang bisa berubah selama layar ini hidup; kalau
   * penjaga ini memendekkan jalur render, jumlah hook berubah di tengah
   * hidup komponen dan React melempar "Rendered fewer hooks than expected"
   * — layar pendaftaran hancur tepat pada langkah terakhir.
   */
  const regState = getRegistrationState()
  const regStateReady = !!regState?.tempToken && !!regState?.password && !!regState?.pin

  // Date limits for DOB - calculated once per component mount
  const dateLimits = useMemo(() => {
    const today = new Date()
    const minDob = new Date(today.getFullYear() - 120, today.getMonth(), today.getDate())
    return { today, minDob }
  }, [])

  // Form state
  const [fullName, setFullName] = useState("")
  const [username, setUsername] = useState("")
  const [dob, setDob] = useState<Date | null>(null)
  const [gender, setGender] = useState<Gender | undefined>()
  const [email, setEmail] = useState("")
  const [address, setAddress] = useState("")
  // Prefill dari deep link `register?ref=` (tetap bisa diubah/dihapus user)
  const [referralCode, setReferralCode] = useState(() => getPendingReferralCode() ?? "")

  // UI state
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<FormError>(null)

  // Field-level errors (dari server)
  const [usernameError, setUsernameError] = useState<string | undefined>()
  const [emailError, setEmailError] = useState<string | undefined>()

  // Validasi lokal — tombol "Daftar" disabled sampai semua field wajib valid
  const isFormValid = useMemo(() => {
    const nameOk = fullName.trim().length >= 2 && fullName.trim().length <= 60
    const usernameOk =
      username.length >= 3 && validateUsername(username, USERNAME_LABELS) === undefined
    const dobOk = dob != null
    const genderOk = gender != null
    const emailOk = isValidEmail(email)
    return nameOk && usernameOk && dobOk && genderOk && emailOk
  }, [fullName, username, dob, gender, email])

  const handleDateSelect = useCallback((date: Date) => {
    setDob(date)
    setCalendarOpen(false)
  }, [])

  const handleSubmit = useCallback(async () => {
    // `regStateReady` (bukan sekadar `regState`) karena penjaga render kini
    // berada di bawah semua hook — TS tidak lagi bisa menyempitkan tipe dari
    // early return, dan submit tidak boleh bergantung pada itu.
    if (submitting || !isFormValid || !regStateReady || !regState) return
    setSubmitting(true)
    setFormError(null)
    setUsernameError(undefined)
    setEmailError(undefined)

    try {
      await api.auth.phoneRegister({
        tempToken: regState.tempToken ?? "",
        fullName: fullName.trim(),
        username: username.trim(),
        dateOfBirth: toISODate(dob!),
        gender: gender!,
        email: email.trim(),
        password: regState.password ?? "",
        pin: regState.pin ?? "",
        address: address.trim() || undefined,
        referralCode: referralCode.trim() || undefined,
      })

      // Sukses: token sudah disimpan otomatis. Simpan fullName untuk sapaan
      // di Setup Profil, lalu lanjut ke screen #6.
      setRegistrationState({
        ...regState,
        tempToken: regState.tempToken ?? "",
        fullName: fullName.trim(),
      })
      router.replace(ROUTES.setupProfile)
    } catch (err) {
      if (isApiError(err)) {
        // 409 CONFLICT — username atau email sudah dipakai
        if (err.code === "CONFLICT") {
          const msg = err.message || ""
          if (/username|nama pengguna/i.test(msg)) {
            setFormError({ kind: "conflict", field: "username", message: msg || "Nama pengguna sudah dipakai." })
            setUsernameError(msg || "Nama pengguna sudah dipakai.")
            return
          }
          if (/email/i.test(msg)) {
            setFormError({ kind: "conflict", field: "email", message: msg || "Email ini sudah terdaftar." })
            setEmailError(msg || "Email ini sudah terdaftar.")
            return
          }
          // Conflict tanpa field spesifik
          setFormError({ kind: "generic", message: msg || "Data bentrok dengan yang sudah ada." })
          return
        }

        // 400 VALIDATION — pesan validasi per field
        if (err.code === "VALIDATION" || err.code === "BAD_REQUEST") {
          const messages = err.validationMessages ?? [err.message]
          // Cek apakah ada pesan yang menyebut field tertentu
          const usernameMsg = messages.find((m) => /username|nama pengguna/i.test(m))
          if (usernameMsg) {
            setUsernameError(usernameMsg)
            return
          }
          const emailMsg = messages.find((m) => /email/i.test(m))
          if (emailMsg) {
            setEmailError(emailMsg)
            return
          }
          const referralMsg = messages.find((m) => /referral/i.test(m))
          if (referralMsg) {
            setFormError({ kind: "generic", message: referralMsg })
            return
          }
        }
      }

      setFormError({ kind: "generic", message: userMessage(err) })
    } finally {
      setSubmitting(false)
    }
  }, [
    submitting,
    isFormValid,
    regStateReady,
    regState,
    fullName,
    username,
    dob,
    gender,
    email,
    address,
    referralCode,
    router,
  ])


  if (!regStateReady) return <Redirect href={ROUTES.register} />

  return (
    <Screen padded={false} edges={["top"]}>
      <Header title="Data Diri" progress={STEP_PROGRESS} safeArea={false} />

      <KeyboardAvoiding offset={insets.top + HEADER_BAR_HEIGHT}>
        <ScrollView
          className="flex-1"
          contentContainerClassName="grow px-6 pb-8 pt-8"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <VStack gap={8}>
            {/* Intro */}
            <VStack gap={2}>
              <Heading level={1} className="text-balance">
                Lengkapi data Anda
              </Heading>
              <Text numberOfLines={1} variant="body" tone="secondary" className="text-pretty">
                Data ini digunakan untuk profil publik dan keamanan akun.
                Email wajib diisi meskipun Anda mendaftar dengan nomor HP.
              </Text>
            </VStack>

            {/* Field wajib */}
            <VStack gap={4}>
              <Input
                label="Nama lengkap"
                value={fullName}
                onChangeText={(t) => {
                  setFullName(t)
                  setFormError(null)
                }}
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
                maxLength={60}
                required
                autoFocus
                returnKeyType="next"
              />

              <UsernameField
                value={username}
                onChangeText={(v) => {
                  setUsername(v)
                  setUsernameError(undefined)
                  setFormError(null)
                }}
                labels={USERNAME_LABELS}
                errorText={usernameError}
                required
                returnKeyType="next"
              />

              <DateField
                label="Tanggal lahir"
                value={dob}
                open={calendarOpen}
                onPress={() => setCalendarOpen(true)}
                required
                placeholder="Pilih tanggal"
              />

              <EmailField
                value={email}
                onChangeText={(v) => {
                  setEmail(v)
                  setEmailError(undefined)
                  setFormError(null)
                }}
                errorText={emailError}
                required
                returnKeyType="next"
              />
            </VStack>

            {/* Gender */}
            <VStack gap={3}>
              <FieldLabel required>Jenis kelamin</FieldLabel>
              <RadioGroup
                value={gender}
                onChange={(v) => {
                  setGender(v as Gender)
                  setFormError(null)
                }}
              >
                {GENDER_OPTIONS.map((opt) => (
                  <Radio key={opt.value} value={opt.value} label={opt.label} />
                ))}
              </RadioGroup>
            </VStack>

            {/* Field opsional */}
            <VStack gap={4}>
              <TextArea
                label="Alamat"
                value={address}
                onChangeText={setAddress}
                maxLength={500}
                rows={3}
                placeholder="Opsional — untuk keamanan dan verifikasi"
              />

              <Input
                label="Kode referral"
                value={referralCode}
                onChangeText={(v) => {
                  setReferralCode(v.toUpperCase())
                  setFormError(null)
                }}
                autoCapitalize="characters"
                maxLength={20}
                placeholder="Opsional"
                returnKeyType="done"
              />
            </VStack>

            {/* Error alert */}
            {formError?.kind === "generic" ? (
              <Alert
                tone="danger"
                title="Pendaftaran gagal"
                onDismiss={() => setFormError(null)}
              >
                {formError.message}
              </Alert>
            ) : null}
          </VStack>
        </ScrollView>

        {/* Footer: CTA */}
        <FooterBar>
          <Button accessibilityHint="Ketuk untuk berinteraksi"
            onPress={() => void handleSubmit()}
            loading={submitting}
            disabled={!isFormValid}
          >
            Daftar
          </Button>

          <Text variant="caption" tone="tertiary" className="text-center">
            Dengan mendaftar, Anda setuju dengan Syarat & Ketentuan serta
            Kebijakan Privasi Kahade.
          </Text>
        </FooterBar>
      </KeyboardAvoiding>

      {/* Bottom Sheet: Calendar untuk tanggal lahir */}
      <BottomSheet
        visible={calendarOpen}
        onRequestClose={() => setCalendarOpen(false)}
        title="Pilih tanggal lahir"
      >
        <Calendar
          value={dob}
          onChange={handleDateSelect}
          minDate={dateLimits.minDob}
          maxDate={dateLimits.today}
        />
      </BottomSheet>
    </Screen>
  )
}