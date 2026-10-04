/**
 * Kahade — Buat Kata Sandi (screen #4/4 alur registrasi via HP).
 *
 * Struktur:
 *   <Header title="Buat Kata Sandi" progress=4/4>
 *   VStack gap={8}:
 *     VStack (H1 + penjelasan)
 *     Input "Nama lengkap"
 *     Input "Username" (opsional)
 *     PasswordField (kata sandi — TANPA strength meter: tidak ada syarat
 *       complexity, hanya minimal 8 karakter per keputusan produk)
 *     PasswordField (konfirmasi)
 *     Button "Buat akun"
 *     Alert error (jika ada)
 *
 * Kontrak API (kontrak auth-rework 2026-09-26, frozen):
 *   POST /v1/auth/phone-register  body { tempToken, fullName, username?,
 *     password, deviceId, location? }
 *   - tempToken hasil verify-otp (status new_user), disimpan di
 *     lib/registration.ts (memori modul, bukan route params / SecureStore).
 *   - username kosong → kirim `undefined` (backend memperlakukannya sebagai
 *     "tidak diisi").
 *   - Kata sandi: min 8, maks 72, TANPA syarat huruf besar/kecil, angka, simbol.
 *   - Token sesi disimpan otomatis oleh auth.ts → lanjut /setup-profile.
 *
 * Keputusan non-obvious:
 *   - Tidak ada lagi PIN 6 digit — kontrak baru hanya password.
 *   - Strength meter TIDAK dirender: kriteria complexity sudah dihapus dari
 *     keputusan produk; meter lama ("Lemah" untuk 8 huruf kecil) akan
 *     menyesatkan.
 *   - fullName disimpan kembali ke registration state setelah sukses supaya
 *     setup-profile bisa menyapa user tanpa meminta ulang (state hanya
 *     dihapus setelah setup-profile selesai / user keluar dari alur).
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { ScrollView, type TextInputInstance } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useRouter } from "expo-router"

import { Alert } from "@/components/ui/alert"
import { FadeIn } from "@/components/ui/fade-in"
import { FooterBar } from "@/components/ui/footer-bar"
import { Button } from "@/components/ui/button"
import { HEADER_BAR_HEIGHT, Header } from "@/components/ui/header"
import { Heading } from "@/components/ui/heading"
import { Input } from "@/components/ui/input"
import { UsernameField } from "@/components/ui/username-field"
import { KeyboardAvoiding } from "@/components/ui/keyboard-avoiding"
import { PasswordField } from "@/components/ui/password-field"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { ValidationSummary, type ValidationIssue } from "@/components/ui/validation-summary"
import { VStack } from "@/components/ui/stack"
import { api, isApiError, userMessage } from "@/lib/api"
import { PASSWORD_MAX, passwordValidationMessage } from "@/lib/auth-constants"
import { isValidRegisterUsername } from "@/lib/username"
import { focusFirstInvalid } from "@/lib/form-validation"
import { getAuthLocation } from "@/lib/location"
import {
  clearRegistrationDraft,
  getRegistrationDraft,
  saveRegistrationDraft,
} from "@/lib/registration-draft"
import {
  getRegistrationState,
  setRegistrationState,
} from "@/lib/registration"
import { AuthFlowMissing } from "@/lib/auth-flow-gate"
import { ROUTES } from "@/lib/routes"
import {
  clearPendingSocialSignup,
  getPendingSocialSignup,
} from "@/lib/social-signup"
import { useLeaveConfirm } from "@/lib/use-leave-confirm"
import { Dialog } from "@/components/ui/modal"
import { useToast } from "@/components/ui/toast"

/** Registrasi via HP: 4 langkah — ini langkah ke-4 (terakhir). */
const STEP_PROGRESS = 4 / 4

export default function RegisterSecurityScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const toast = useToast()

  // tempToken hasil verifikasi OTP (memori modul, bukan route params).
  const regRef = useState(getRegistrationState)[0]
  const tempToken = regRef?.tempToken
  const phoneNumber = regRef?.phoneNumber

  /**
   * Jalan keluar saat state registrasi (tempToken) tidak ada — SELALU
   * navigasi nyata. Audit 2026-10-01: effect "tanpa tempToken" sebelumnya
   * bisa no-op (mis. tumpukan navigasi belum sinkron setelah app kembali dari
   * background) sementara layar `return null` — layar blank permanen tanpa
   * tombol apa pun. Kini tombol eksplisit.
   */
  const leaveMissingFlow = useCallback(() => {
    if (router.canGoBack()) {
      router.back()
      return
    }
    router.replace(ROUTES.register)
  }, [router])

  const [fullName, setFullName] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  // A05 (batch 139): pulihkan draft NON-RAHASIA (nama, username) bila app
  // tertutup di tengah registrasi. Kata sandi TIDAK PERNAH dipulihkan.
  const [draftLoaded, setDraftLoaded] = useState(false)
  useEffect(() => {
    let alive = true
    void getRegistrationDraft().then((draft) => {
      if (!alive) return
      if (draft.fullName) setFullName(draft.fullName)
      if (draft.username) setUsername(draft.username)
      setDraftLoaded(true)
    })
    return () => {
      alive = false
    }
  }, [])

  // Autosave draft (debounce 600ms) — hanya field non-rahasia.
  useEffect(() => {
    if (!draftLoaded) return
    const timer = setTimeout(() => {
      void saveRegistrationDraft({ fullName, username })
    }, 600)
    return () => clearTimeout(timer)
  }, [draftLoaded, fullName, username])

  const [fullNameError, setFullNameError] = useState<string | undefined>()
  const [passwordError, setPasswordError] = useState<string | undefined>()
  const [confirmError, setConfirmError] = useState<string | undefined>()
  const [formError, setFormError] = useState<string | null>(null)
  // A04 (batch 139): ringkasan semua error validasi di atas tombol.
  const [issues, setIssues] = useState<ValidationIssue[]>([])
  const fullNameRef = useRef<TextInputInstance>(null)
  const passwordRef = useRef<TextInputInstance>(null)
  const confirmRef = useRef<TextInputInstance>(null)
  // FRM-005: ref untuk rantai fokus Next antar field.
  const usernameRef = useRef<TextInputInstance>(null)
  const [submitting, setSubmitting] = useState(false)

  // A06 (batch 139): konfirmasi bila keluar dengan data yang belum disimpan.
  const leaveConfirm = useLeaveConfirm(
    (fullName.length > 0 || username.length > 0 || password.length > 0 || confirmPassword.length > 0) && !submitting,
    {
      title: "Batalkan pendaftaran?",
      description: "Data yang sudah Anda isi akan hilang.",
      confirmLabel: "Ya, batalkan",
    },
  )
  const markLeaving = leaveConfirm.markLeaving

  const clearIssues = useCallback(() => setIssues([]), [])

  const isFormValid =
    fullName.trim().length > 0 && password.length > 0 && confirmPassword.length > 0

  const handleSubmit = useCallback(async () => {
    if (submitting || !tempToken || !phoneNumber) return
    setFormError(null)

    // A04: kumpulkan SEMUA error sekaligus (bukan berhenti di yang pertama),
    // tampilkan ringkasan di atas tombol, fokuskan field pertama yang salah.
    const found: ValidationIssue[] = []
    const trimmedName = fullName.trim()
    if (trimmedName.length === 0) {
      setFullNameError("Nama lengkap wajib diisi.")
      found.push({ field: "Nama lengkap", message: "Wajib diisi." })
    } else if (trimmedName.length < 2) {
      // BFI-042: mirror phone-register.dto — @MinLength(2).
      setFullNameError("Nama lengkap minimal 2 karakter.")
      found.push({ field: "Nama lengkap", message: "Minimal 2 karakter." })
    } else if (/[<>]/.test(trimmedName)) {
      // BFI-042: mirror phone-register.dto — @Matches(/^[^<>]*$/) (anti XSS).
      setFullNameError("Nama lengkap tidak boleh mengandung karakter < atau >.")
      found.push({ field: "Nama lengkap", message: "Tidak boleh mengandung < atau >." })
    }
    // BFI-041: aturan USERNAME KHUSUS phone-register (3–30, huruf besar &
    // titik diizinkan — disatukan dengan set-username oleh DBL-006).
    // UsernameField menormalisasi saat mengetik (lowercase, maks 30)
    // sehingga charset & panjang atas sudah aman; yang dicek di submit:
    // minimal 3 bila diisi.
    if (username.trim().length > 0 && !isValidRegisterUsername(username.trim())) {
      setFormError("Username minimal 3 karakter.")
      found.push({ field: "Username", message: "Minimal 3 karakter." })
    }
    // BFI-043/DBL-015: pesan beda untuk password umum — SAMA PERSIS dengan
    // backend ("Password terlalu umum..."), supaya user tahu alasan penolakan
    // sebelum submit. passwordValidationMessage mencakup panjang minimum +
    // blocklist umum (mirror BE).
    const pwMsg = passwordValidationMessage(password)
    if (pwMsg) {
      setPasswordError(pwMsg)
      found.push({ field: "Kata sandi", message: pwMsg })
    }
    if (confirmPassword !== password) {
      setConfirmError("Konfirmasi kata sandi tidak sama.")
      found.push({ field: "Konfirmasi kata sandi", message: "Tidak sama dengan kata sandi." })
    }
    if (found.length > 0) {
      setIssues(found)
      focusFirstInvalid([fullNameRef, passwordRef, confirmRef])
      return
    }
    setIssues([])

    setSubmitting(true)
    try {
      const socialLinkToken = getPendingSocialSignup()
      const result = await api.auth.phoneRegister({
        tempToken,
        fullName: fullName.trim(),
        // Username kosong → undefined (backend = "tidak diisi").
        username: username.trim().length > 0 ? username.trim() : undefined,
        password,
        location: (await getAuthLocation()) ?? undefined,
        // Identitas sosial baru (dari login Google/Apple): ditautkan setelah
        // nomor HP terverifikasi. Gagal menautkan tidak menggagalkan registrasi.
        socialLinkToken: socialLinkToken ?? undefined,
      })
      clearPendingSocialSignup()
      if (socialLinkToken && !(result as { socialLinked?: boolean }).socialLinked) {
        toast.show({
          title: "Pendaftaran berhasil",
          description:
            "Akun Google/Apple belum tertaut — tautkan nanti dari Pengaturan → Keamanan.",
          tone: "info",
        })
      }
      // Simpan fullName untuk sapaan di setup-profile; token sesi sudah
      // disimpan otomatis oleh auth.ts. Password TIDAK disimpan.
      // A05: draft non-rahasia tidak lagi dibutuhkan — akun sudah jadi.
      void clearRegistrationDraft()
      // A06: akun berhasil dibuat = keluar yang disengaja.
      markLeaving()
      setRegistrationState({ tempToken: "", phoneNumber, fullName: fullName.trim() })
      router.replace(ROUTES.setupProfile)
    } catch (err) {
      if (isApiError(err)) {
        // SYS-C-106: pola T4-004 — klasifikasi untuk ROUTING field, tapi
        // JANGAN tempel pesan mentah backend (bisa Inggris, mis. "Username is
        // already taken" / USERNAME_MSG class-validator). Selalu copy
        // Indonesia tetap: bedakan "sudah dipakai" vs "format salah" dari
        // pola kata kunci, tanpa merender satu kata pun dari server.
        if (err.code === "VALIDATION" || err.code === "BAD_REQUEST" || err.code === "CONFLICT") {
          const raw = (err.validationMessages ?? [err.message ?? ""]).join(" ")
          if (/username|nama pengguna/i.test(raw)) {
            setFormError(
              /taken|already|dipakai|sudah (di)?pakai/i.test(raw)
                ? "Username ini sudah dipakai. Pilih username lain."
                : "Username harus 3–30 karakter dan hanya berisi huruf, angka, titik, dan garis bawah.",
            )
            return
          }
        }
      }
      setFormError(userMessage(err))
    } finally {
      setSubmitting(false)
    }
  }, [submitting, tempToken, phoneNumber, fullName, username, password, confirmPassword, router, markLeaving])

  // Tanpa tempToken (deep-link/reload langsung ke rute ini) → layar tidak
  // bisa dipakai. JANGAN blank: pesan + tombol kembali yang berfungsi.
  if (!tempToken) {
    return (
      <AuthFlowMissing
        title="Data pendaftaran tidak ditemukan"
        description="Sesi pendaftaran tidak tersedia — kemungkinan aplikasi ditutup di tengah alur atau halaman ini dibuka langsung. Kembali dan masukkan nomor HP Anda lagi."
        backLabel="Kembali"
        onBack={leaveMissingFlow}
      />
    )
  }

  return (
    <Screen padded={false} edges={["top"]}>
      <Header title="Buat Kata Sandi" progress={STEP_PROGRESS} safeArea={false} />

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
                  Lengkapi data diri Anda
                </Heading>
                <Text variant="body" tone="secondary" className="text-pretty">
                  Nomor HP Anda sudah terverifikasi. Terakhir, buat kata sandi
                  dan isi data diri untuk menyelesaikan akun.
                </Text>
              </VStack>

              <VStack gap={4}>
                <Input
                  label="Nama lengkap"
                  ref={fullNameRef}
                  value={fullName}
                  onChangeText={(t) => {
                    setFullName(t)
                    setFullNameError(undefined)
                    setFormError(null)
                    clearIssues()
                  }}
                  errorText={fullNameError}
                  autoCapitalize="words"
                  autoCorrect={false}
                  autoComplete="name"
                  textContentType="name"
                  required
                  autoFocus
                  returnKeyType="next"
                  // FRM-005: Next memindahkan fokus ke field berikutnya.
                  onSubmitEditing={() => usernameRef.current?.focus()}
                  disabled={submitting}
                />

                {/* Batch 139 E01: UsernameField menormalisasi saat mengetik
                    (lowercase, tanpa spasi/karakter asing, maks 20) — subset
                    aman dari aturan phone-register (3–30, huruf besar & titik
                    diizinkan). Aturan MINIMAL (3) divalidasi saat submit
                    (BFI-041); backend sumber kebenaran. */}
                <UsernameField
                  label="Username"
                  ref={usernameRef}
                  value={username}
                  onChangeText={(t) => {
                    setUsername(t)
                    setFormError(null)
                  }}
                  // BFI-041 — batas MINIMAL sesuai endpoint phone-register
                  // (3–30); field membatasi input maks 20 saat mengetik.
                  helperText="Opsional — minimal 3 karakter"
                  autoComplete="username"
                  textContentType="username"
                  returnKeyType="next"
                  // FRM-005: Next memindahkan fokus ke field kata sandi.
                  onSubmitEditing={() => passwordRef.current?.focus()}
                  disabled={submitting}
                />

                {/* Tanpa strength meter: tidak ada syarat complexity, hanya
                    panjang 8–72. */}
                <PasswordField
                  label="Kata sandi"
                  ref={passwordRef}
                  value={password}
                  onChangeText={(t) => {
                    setPassword(t)
                    setPasswordError(undefined)
                    setFormError(null)
                    clearIssues()
                  }}
                  errorText={passwordError}
                  helperText="Minimal 8 karakter"
                  maxLength={PASSWORD_MAX}
                  required
                  returnKeyType="next"
                  // FRM-005: Next memindahkan fokus ke konfirmasi kata sandi.
                  onSubmitEditing={() => confirmRef.current?.focus()}
                  disabled={submitting}
                />

                <PasswordField
                  label="Konfirmasi kata sandi"
                  ref={confirmRef}
                  value={confirmPassword}
                  onChangeText={(t) => {
                    setConfirmPassword(t)
                    setConfirmError(undefined)
                    setFormError(null)
                    clearIssues()
                  }}
                  errorText={confirmError}
                  maxLength={PASSWORD_MAX}
                  required
                  returnKeyType="done"
                  onSubmitEditing={() => void handleSubmit()}
                  disabled={submitting}
                />

                {/*
                 * FE-IMP-3 #110 — indikator LIVE kata sandi cocok.
                 * Murni visual: validasi submit tetap di handleSubmit.
                 */}
                {password.length > 0 && confirmPassword.length > 0 ? (
                  <Text
                    variant="caption"
                    tone={password === confirmPassword ? "success" : "danger"}
                  >
                    {password === confirmPassword
                      ? "Kata sandi cocok"
                      : "Kata sandi belum sama"}
                  </Text>
                ) : null}
              </VStack>

              {/* A04: ringkasan validasi di atas tombol submit */}
              <ValidationSummary issues={issues} onDismiss={clearIssues} tone="danger" />

              <Button
                onPress={() => void handleSubmit()}
                loading={submitting}
                disabled={!isFormValid}
              >
                Buat akun
              </Button>

              {formError ? (
                <Alert tone="danger" title="Gagal membuat akun" onDismiss={() => setFormError(null)}>
                  {formError}
                </Alert>
              ) : null}
            </VStack>
          </FadeIn>
        </ScrollView>

        <FooterBar>
          <Text variant="caption" tone="secondary" className="text-center text-pretty">
            Dengan membuat akun, Anda menyetujui Syarat & Ketentuan serta
            Kebijakan Privasi Kahade.
          </Text>
        </FooterBar>
      </KeyboardAvoiding>

      {/* A06: dialog konfirmasi keluar — hanya bila ada data belum disimpan */}
      <Dialog {...leaveConfirm.dialogProps} />
    </Screen>
  )
}
