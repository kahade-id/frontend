/**
 * Screen — Ganti Nomor HP (PUT /v1/users/me).
 *
 * Pintu masuk: Pengaturan → Keamanan → "Ganti Nomor HP". Sebelumnya nomor HP
 * akun hanya bisa diubah dari layar Edit Profil yang mengirim SEMUA field
 * profil sekaligus (dan meminta password lewat Dialog terpisah) — tidak ada
 * alur khusus untuk satu perubahan yang paling berisiko ini.
 *
 * Kontrak:
 *   UpdateProfileDto.phoneNumber  → nomor E.164 ("+62812…")
 *   UpdateProfileDto.currentPassword → WAJIB untuk field sensitif (komentar DTO)
 *
 * Keputusan non-obvious:
 *   - Nomor disimpan di state sebagai DIGIT NASIONAL ("81234567890") dan
 *     dikonversi `toE164Id()` saat kirim — persis pola Edit Profil, supaya
 *     kedua layar tidak menghasilkan bentuk nomor yang berbeda.
 *   - Nomor sekarang ditampilkan <SensitiveText mask="phone" toggleable={false}>
 *     (bukan teks polos): layar ini sering dibuka di tempat umum dan empat
 *     digit terakhir sudah cukup bagi pengguna untuk memastikan nomor mana
 *     yang akan diganti.
 *   - Tombol simpan mati bila nomor sama dengan yang tersimpan: PUT dengan
 *     nilai lama tetap meminta password dan tetap dihitung sebagai perubahan
 *     oleh log keamanan backend — request yang tidak perlu.
 *   - Sukses → toast + `goBackOrNavigate(ROUTES.security)`: layar ini bisa
 *     dibuka dari deep link, dan `router.back()` sendirian bisa jadi no-op.
 */
import { useCallback, useMemo, useState } from "react"
import { ScrollView, View } from "react-native"

import { api, type UserProfile, userMessage } from "@/lib/api"
import { normalizePhoneId, toE164Id, isValidPhoneId } from "@/components/ui/phone-input"
import { goBackOrNavigate } from "@/lib/navigation"
import { ROUTES } from "@/lib/routes"
import { useApiQuery } from "@/lib/use-api-query"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Header } from "@/components/ui/header"
import { PasswordField } from "@/components/ui/password-field"
import { PhoneInput } from "@/components/ui/phone-input"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { SensitiveText } from "@/components/ui/sensitive-text"
import { useToast } from "@/components/ui/toast"

export default function ChangePhoneScreen() {
  const toast = useToast()

  const query = useApiQuery<UserProfile>("change-phone-me", (signal) => api.users.getMe(signal))
  const currentPhone = query.data?.phoneNumber ?? ""

  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const phoneValid = isValidPhoneId(phone)
  const unchanged = useMemo(
    () => phone.length > 0 && toE164Id(phone) === currentPhone,
    [phone, currentPhone],
  )
  const canSubmit = phoneValid && !unchanged && password.length > 0 && !submitting

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await api.users.updateProfile({
        phoneNumber: toE164Id(phone),
        currentPassword: password,
      })
      toast.show({
        title: "Nomor HP diperbarui",
        description: "Gunakan nomor baru untuk masuk dan menerima kode OTP.",
        tone: "success",
        duration: 4000,
      })
      goBackOrNavigate(ROUTES.security)
    } catch (err: unknown) {
      // Alasan backend (password salah, nomor sudah dipakai, butuh verifikasi)
      // harus sampai apa adanya — copy lokal akan menyesatkan.
      toast.show({
        title: "Nomor HP belum dapat diubah",
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setSubmitting(false)
    }
  }, [canSubmit, password, phone, toast.show])

  return (
    <Screen
      keyboardAvoiding
      edges={["top"]}
      padded={false}
      footer={
        <View>
          <Button fullWidth loading={submitting} disabled={!canSubmit} onPress={() => void handleSubmit()}>
            Simpan nomor baru
          </Button>
        </View>
      }
    >
      <Header title="Ganti Nomor HP" />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerClassName="gap-4 px-6 py-4">
        <SectionHeader title="Nomor terdaftar" />
        {currentPhone ? (
          <Alert tone="neutral" title="Nomor saat ini">
            <SensitiveText
              value={currentPhone}
              mask="phone"
              mono={false}
              variant="body"
              toggleable={false}
            />
          </Alert>
        ) : (
          <Alert tone="info">
            Belum ada nomor HP terdaftar di akun ini. Menambahkan nomor mengaktifkan masuk lewat OTP.
          </Alert>
        )}

        <SectionHeader title="Nomor baru" />
        <PhoneInput
          label="Nomor HP baru"
          value={phone}
          onChangeText={(digits) => setPhone(normalizePhoneId(digits))}
          required
          reserveHelperSpace
          helperText={
            unchanged
              ? "Nomor ini sama dengan nomor terdaftar."
              : "Format Indonesia, mis. 812-3456-7890."
          }
          errorText={phone.length > 0 && !phoneValid ? "Nomor tidak valid" : undefined}
        />
        <PasswordField
          label="Password akun"
          value={password}
          onChangeText={setPassword}
          required
          helperText="Dibutuhkan untuk mengubah nomor HP."
        />
      </ScrollView>
    </Screen>
  )
}
