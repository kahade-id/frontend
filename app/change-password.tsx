/**
 * Screen — Ubah Password (POST /v1/auth/change-password).
 *
 * Kontrak sensitif (BFI-037/038):
 *  - Akun ber-2FA WAJIB menyertakan `mfaCode` (TOTP 6 digit / kode cadangan)
 *    — backend menjawab 403 TWO_FA_REQUIRED bila tidak ada. Field MFA
 *    dimunculkan saat backend memintanya (pola sama seperti change-phone).
 *  - Backend MENCABUT semua sesi (termasuk sesi ini) saat password berubah —
 *    layar menampilkan dialog login-ulang yang jelas, bukan toast lalu
 *    terlempar 401 misterius.
 */
import { useCallback, useState } from "react"
import { ScrollView, View } from "react-native"

import { api, isApiError, userMessage } from "@/lib/api"
import { clearSession, emitSessionExpired } from "@/lib/api/session"
import { isCommonPassword, isPasswordValid } from "@/lib/auth-constants"

import { Button } from "@/components/ui/button"
import { Header } from "@/components/ui/header"
import { Input } from "@/components/ui/input"
import { Dialog } from "@/components/ui/modal"
import { PasswordField } from "@/components/ui/password-field"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { useToast } from "@/components/ui/toast"

export default function ChangePasswordScreen() {
  const toast = useToast()

  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  /** BFI-037: kode MFA — dimunculkan bila backend menjawab TWO_FA_REQUIRED. */
  const [mfa, setMfa] = useState("")
  const [mfaRequired, setMfaRequired] = useState(false)
  /** BFI-038: sesi dicabut server — dialog login-ulang satu aksi. */
  const [reloginDialog, setReloginDialog] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = useCallback(async () => {
    if (!current || !isPasswordValid(next) || next !== confirm) return
    // BFI-043: blocklist password umum — umpan balik dini sebelum 400 server.
    if (isCommonPassword(next)) {
      toast.show({
        title: "Kata sandi terlalu umum",
        description: "Gunakan kombinasi yang lebih unik dan sulit ditebak.",
        tone: "danger",
      })
      return
    }
    setSubmitting(true)
    try {
      await api.auth.changePassword({
        currentPassword: current,
        newPassword: next,
        confirmPassword: confirm,
        // BFI-037: kirim bila diisi; wajib bila 2FA aktif (backend yang menilai).
        mfaCode: mfa.trim() ? mfa.trim() : undefined,
      })
      // BFI-038: JANGAN toast + kembali seolah sesi hidup — server sudah
      // mencabut SEMUA sesi. Dialog login-ulang yang jelas, lalu keluar bersih.
      setCurrent("")
      setNext("")
      setConfirm("")
      setMfa("")
      setMfaRequired(false)
      setReloginDialog(true)
    } catch (err: unknown) {
      // BFI-037: akun ber-2FA tanpa mfaCode → 403 TWO_FA_REQUIRED.
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
      // Alasan asli backend (password salah / rate limit / password pernah
      // dipakai) harus sampai ke pengguna — menebak "Periksa password saat ini"
      // menyesatkan saat yang terjadi sebenarnya adalah pembatasan percobaan.
      toast.show({
        title: "Gagal mengubah kata sandi",
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setSubmitting(false)
    }
  }, [current, next, confirm, mfa, toast.show])

  /** BFI-038: keluar bersih → /login (native) / guest gate (web). */
  const handleRelogin = useCallback(async () => {
    setReloginDialog(false)
    await clearSession()
    emitSessionExpired()
  }, [])

  return (
    <Screen
      keyboardAvoiding
      edges={["top"]}
      padded={false}
      footer={
        <View>
          <Button
            fullWidth
            loading={submitting}
            disabled={!current || !isPasswordValid(next) || next !== confirm}
            onPress={() => void handleSubmit()}
          >
            Simpan password
          </Button>
        </View>
      }
    >
      <Header title="Ubah Kata Sandi" />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-4 px-5 py-4">
        <PasswordField
          label="Kata sandi saat ini"
          value={current}
          onChangeText={setCurrent}
          required
        />
        <SectionHeader title="Kata sandi baru" />
        <PasswordField
          label="Kata sandi baru"
          value={next}
          onChangeText={setNext}
          required
          showStrength
          helperText="Minimal 8 karakter."
        />
        <PasswordField
          label="Ulangi kata sandi baru"
          value={confirm}
          onChangeText={setConfirm}
          confirmOf={next}
          required
        />
        {/* BFI-037: hanya tampil bila 2FA aktif (backend menjawab
            TWO_FA_REQUIRED) — akun tanpa 2FA tidak diganggu field ekstra. */}
        {mfaRequired ? (
          <Input
            label="Kode autentikator / kode cadangan"
            value={mfa}
            onChangeText={setMfa}
            required
            autoCapitalize="none"
            autoCorrect={false}
            helperText="6 digit dari aplikasi autentikator, atau kode cadangan 10–16 karakter."
          />
        ) : null}
      </ScrollView>

      {/* BFI-038: sesi dicabut server — dialog satu aksi, tidak bisa
          di-dismiss (sesi ini memang sudah mati). */}
      <Dialog
        title="Kata sandi berhasil diubah"
        description="Demi keamanan, semua sesi Anda telah dicabut. Silakan masuk kembali untuk melanjutkan."
        visible={reloginDialog}
        confirmLabel="Masuk kembali"
        hideCancel
        dismissOnBackdrop={false}
        onConfirm={() => void handleRelogin()}
        onRequestClose={() => {}}
      />
    </Screen>
  )
}
