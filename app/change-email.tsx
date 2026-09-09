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
 *   POST /v1/auth/correct-email   CorrectEmailDto { newEmail ≤254, password ≤72 }
 *   → backend mengganti alamat DAN mengirim ulang OTP verifikasi ke alamat baru.
 *
 * Keputusan non-obvious:
 *   - Endpoint ini `security` kosong di spec → dipanggil tanpa Bearer
 *     (lihat lib/api/auth.ts `auth: "none"`). Password akun adalah
 *     pembuktiannya, jadi field password WAJIB dan tidak pernah disimpan.
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
import { ScrollView, View } from "react-native"
import { router } from "expo-router"

import { api, type UserProfile, userMessage } from "@/lib/api"
import { PASSWORD_MAX } from "@/lib/auth-constants"
import { ROUTES } from "@/lib/routes"
import { useApiQuery } from "@/lib/use-api-query"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { EmailField, isValidEmail } from "@/components/ui/email-field"
import { Header } from "@/components/ui/header"
import { PasswordField } from "@/components/ui/password-field"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { SensitiveText } from "@/components/ui/sensitive-text"
import { useToast } from "@/components/ui/toast"

export default function ChangeEmailScreen() {
  const toast = useToast()

  const query = useApiQuery<UserProfile>("change-email-me", (signal) => api.users.getMe(signal))
  const currentEmail = query.data?.email ?? ""

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const trimmed = email.trim()
  const emailValid = isValidEmail(trimmed)
  const unchanged = trimmed.toLowerCase() === currentEmail.trim().toLowerCase()
  const canSubmit = emailValid && !unchanged && password.length > 0 && !submitting

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await api.auth.correctEmail({ newEmail: trimmed, password })
      toast.show({
        title: "Email diperbarui",
        description: "Masukkan kode yang dikirim ke alamat baru untuk mengaktifkannya.",
        tone: "success",
        duration: 4000,
      })
      router.replace(ROUTES.verifyEmail(trimmed))
    } catch (err: unknown) {
      toast.show({
        title: "Email belum dapat diubah",
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setSubmitting(false)
    }
  }, [canSubmit, password, toast.show, trimmed])

  return (
    <Screen
      keyboardAvoiding
      edges={["top"]}
      padded={false}
      footer={
        <View>
          <Button fullWidth loading={submitting} disabled={!canSubmit} onPress={() => void handleSubmit()}>
            Simpan email baru
          </Button>
        </View>
      }
    >
      <Header title="Ganti Email" />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-4 px-6 py-4">
        <SectionHeader title="Email terdaftar" />
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
        ) : (
          <Alert tone="info">
            Belum ada email terdaftar. Menambahkan email mengaktifkan pemulihan akun dan notifikasi
            penting.
          </Alert>
        )}

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
          label="Password akun"
          value={password}
          onChangeText={setPassword}
          maxLength={PASSWORD_MAX}
          required
          helperText="Dibutuhkan untuk membuktikan kepemilikan akun."
        />
      </ScrollView>
    </Screen>
  )
}
