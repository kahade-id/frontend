/**
 * Screen — Ganti Email (POST /v1/auth/correct-email).
 *
 * Pintu masuk: Pengaturan → Keamanan → "Ganti Email". Sebelumnya satu-satunya
 * jalan mengganti email adalah banner "Email belum diverifikasi" di Edit Profil
 * → layar Verifikasi Email → BottomSheet "Email salah?" — alur yang hanya
 * muncul selama email BELUM diverifikasi, sehingga akun yang emailnya sudah
 * terverifikasi tidak punya cara mengganti alamatnya.
 *
 * Kontrak (docs/api/kahade-api-mobile.json):
 *   POST /v1/auth/correct-email   CorrectEmailDto { newEmail ≤254, password ≤72,
 *     mfaCode? ≤16 }
 *   → backend mengganti alamat DAN mengirim ulang OTP verifikasi ke alamat baru.
 *
 * Keputusan non-obvious:
 *   - Endpoint ini WAJIB Bearer (BFE-041): backend mewajibkan JWT (JwtAuthGuard
 *     global, tanpa @Public()) — versi lama memanggilnya tanpa Bearer <redacted>
 *     selalu 401. Password akun tetap WAJIB sebagai bukti kepemilikan
 *     (tidak pernah disimpan), dan akun ber-2FA WAJIB menyertakan `mfaCode`
 *     — backend menjawab 403 TWO_FA_REQUIRED bila tidak ada (BFE-042, pola
 *     yang sama dengan change-password).
 *   - Setelah sukses, layar ini `router.replace(ROUTES.verifyEmail(newEmail))`
 *     — BUKAN `back()`: alamat baru belum terverifikasi, dan membiarkan
 *     pengguna kembali ke Keamanan dengan status "belum diverifikasi" tanpa
 *     jalan memasukkan OTP berarti email barunya tidak pernah aktif.
 *     `replace` supaya tombol Back tidak mengembalikan pengguna ke form yang
 *     sudah berhasil dikirim.
 *   - Tombol simpan mati bila alamat sama dengan yang terdaftar (case-insensitive):
 *     correct-email akan mengirim OTP yang tidak diperlukan dan menghanguskan
 *     kuota kirim.
 */
import { useCallback, useState } from "react"
import { ScrollView } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { router } from "expo-router"

import { api, isApiError, type UserProfile, userMessage } from "@/lib/api"
import { PASSWORD_MAX } from "@/lib/auth-constants"
import { MFA_CODE_MAX_LENGTH, normalizeMfaCode } from "@/lib/auth-ui"
import { setPendingVerifyEmail } from "@/lib/email-verify"
import { translate } from "@/lib/i18n/translate"
import { queryKeys } from "@/lib/query-keys"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { EmailField, isValidEmail } from "@/components/ui/email-field"
import { Header } from "@/components/ui/header"
import { Input } from "@/components/ui/input"
import { PasswordField } from "@/components/ui/password-field"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { SensitiveConfirmDialog } from "@/components/ui/sensitive-confirm"
import { SensitiveText } from "@/components/ui/sensitive-text"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/toast"

export default function ChangeEmailScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const query = useApiQuery<UserProfile>(queryKeys.me(), (signal) => api.users.getMe(signal))
  const currentEmail = query.data?.email ?? ""

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)
  /** BFE-042: kode MFA — dimunculkan bila backend menjawab TWO_FA_REQUIRED. */
  const [mfa, setMfa] = useState("")
  const [mfaRequired, setMfaRequired] = useState(false)

  const trimmed = email.trim()
  const emailValid = isValidEmail(trimmed)
  const unchanged = trimmed.toLowerCase() === currentEmail.trim().toLowerCase()
  // Audit 2026-10-10: setelah backend meminta kode 2FA, tombol tidak boleh
  // aktif dengan kolom MFA kosong — kirim ulang hanya menghasilkan toast
  // TWO_FA_REQUIRED yang sama.
  const mfaOk = !mfaRequired || mfa.trim().length > 0
  const canSubmit = emailValid && !unchanged && password.length > 0 && mfaOk && !submitting
  // A11 (batch 139): konfirmasi sensitif seragam sebelum email diganti.
  const [confirmOpen, setConfirmOpen] = useState(false)

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await api.auth.correctEmail({
        newEmail: trimmed,
        password,
        // BFE-042: kirim bila diisi; wajib bila 2FA aktif (backend yang menilai).
        mfaCode: mfa.trim() ? mfa.trim() : undefined,
      })
      toast.show({
        title: "Email diperbarui",
        description: "Masukkan kode yang dikirim ke alamat baru untuk mengaktifkannya.",
        tone: "success",
        duration: 4000,
      })
      // #FE-I9: alamat baru lewat holder memori, bukan route param (PII di
      // history/Referer web).
      setPendingVerifyEmail(trimmed)
      router.replace(ROUTES.verifyEmailScreen)
    } catch (err: unknown) {
      // BFE-042: akun ber-2FA tanpa mfaCode → 403 TWO_FA_REQUIRED.
      // Munculkan field MFA dengan penjelasan, jangan toast generik.
      if (isApiError(err) && err.backendCode === "TWO_FA_REQUIRED") {
        setMfaRequired(true)
        toast.show({
          title: "Kode verifikasi dua langkah dibutuhkan",
          description:
            "Akun Anda memakai verifikasi dua langkah. Masukkan kode dari aplikasi autentikator (atau kode cadangan), lalu coba lagi.",
          tone: "warning",
        })
        setSubmitting(false)
        return
      }
      toast.show({
        title: "Email belum dapat diubah",
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setSubmitting(false)
    }
  }, [canSubmit, password, mfa, toast.show, trimmed])

  return (
    <Screen keyboardAvoiding edges={["top"]} padded={false}>
      <Header title="Ganti Email" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-4 px-5 py-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + tokens.space[8] }}
      >
        <SectionHeader title="Email terdaftar" />
        {/* Audit 2026-10-10: "Belum ada email terdaftar" hanya boleh tampil
            bila profil SUDAH termuat dan memang kosong — sebelumnya kalimat
            itu muncul selama memuat/offline (klaim salah soal data akun). */}
        {currentEmail ? (
          <Alert tone="neutral" title="Email saat ini">
            <SensitiveText
              value={currentEmail}
              mask="email"
              mono={false}
              variant="body"
              toggleable={false}
            />
          </Alert>
        ) : query.loading ? (
          <Skeleton height={56} shape="card" />
        ) : query.data ? (
          <Alert tone="info">
            Belum ada email terdaftar. Menambahkan email mengaktifkan pemulihan akun dan notifikasi
            penting.
          </Alert>
        ) : null}

        <SectionHeader title="Email baru" />
        <EmailField
          label="Alamat email baru"
          value={email}
          onChangeText={setEmail}
          required
          validate={trimmed.length > 0}
          autoComplete="email"
          reserveHelperSpace
          helperText={
            unchanged
              ? "Alamat ini sama dengan email terdaftar."
              : "Kode verifikasi akan dikirim ke alamat baru."
          }
        />
        <PasswordField
          label="Kata sandi akun"
          value={password}
          onChangeText={setPassword}
          maxLength={PASSWORD_MAX}
          required
          helperText="Dibutuhkan untuk membuktikan kepemilikan akun."
        />
        {/* BFE-042: hanya tampil bila 2FA aktif (backend menjawab
            TWO_FA_REQUIRED) — akun tanpa 2FA tidak diganggu field ekstra. */}
        {mfaRequired ? (
          <Input
            label="Kode autentikator / kode cadangan"
            value={mfa}
            // #FE-I5: normalisasi spasi + one-time-code (kode tempel berspasi).
            onChangeText={(value) => setMfa(normalizeMfaCode(value))}
            required
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={MFA_CODE_MAX_LENGTH}
            helperText="6 digit dari aplikasi autentikator, atau kode cadangan 10–16 karakter."
          />
        ) : null}

        {/* P3 (overhaul auth 2026-10-10): tombol aksi mengikuti konten, bukan
            FooterBar berpemisah `border-t`. Setelah field terakhir dibaca,
            tombolnya satu ketukan di bawahnya — dan tidak lagi menutupi isi
            form saat keyboard naik. */}
        <Button
          fullWidth
          loading={submitting}
          disabled={!canSubmit}
          onPress={() => setConfirmOpen(true)}
        >
          Simpan email baru
        </Button>
      </ScrollView>

      {/* A11: konfirmasi sensitif seragam sebelum email benar-benar diganti. */}
      <SensitiveConfirmDialog
        visible={confirmOpen}
        title="Ganti email?"
        consequences={[
          translate("Email {x} akan menjadi email utama akun Anda.", { x: trimmed || translate("baru") }),
          "Kode aktivasi dikirim ke alamat baru — email lama tidak bisa dipakai lagi setelah aktif.",
        ]}
        confirmLabel="Ya, ganti email"
        loading={submitting}
        onConfirm={() => { setConfirmOpen(false); void handleSubmit() }}
        onCancel={() => setConfirmOpen(false)}
      />
    </Screen>
  )
}
