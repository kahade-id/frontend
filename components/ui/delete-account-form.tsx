/**
 * Kahade — <DeleteAccountForm> (§11 Form, §9.11 Alert, §2.3 danger).
 * API: POST /v1/users/me/delete-request
 *
 * Permintaan hapus akun (soft-delete dengan masa tenggang): Alert danger
 * berisi konsekuensi -> alasan opsional -> password (+ kode 2FA bila aktif)
 * -> checkbox konfirmasi -> ketik "HAPUS" -> tombol destructive.
 *
 * Keputusan non-obvious:
 *   - `RequestAccountDeletionDto` MEWAJIBKAN `password` (dan `mfaCode` bila
 *     2FA aktif). Field-nya ada di form ini — bukan di layar — supaya semua
 *     gerbang konfirmasi berada di satu komponen dan `onSubmit` sudah
 *     membawa payload lengkap siap kirim.
 *   - Tiga gerbang berlapis (checkbox + frasa konfirmasi + tombol) sengaja
 *     menambah gesekan: aksi ireversibel setelah masa tenggang. Ini
 *     satu-satunya form Kahade yang mensyaratkan mengetik frasa.
 *   - Blocker (`blockers`: saldo tersisa, pesanan aktif, sengketa terbuka)
 *     dirender sebagai Alert warning dengan daftar; bila ada, tombol
 *     dinonaktifkan — backend juga menolak, tapi kita jelaskan lebih dulu.
 *   - Masa tenggang (`gracePeriodDays`) disebut eksplisit di Alert agar
 *     pengguna tahu masih bisa membatalkan; menurunkan penghapusan impulsif.
 *   - Frasa konfirmasi dibandingkan case-sensitive & di-trim; autoCapitalize
 *     "characters" agar keyboard mobile langsung kapital.
 */
import { useState } from "react"
import { View, type ViewProps } from "react-native"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { PasswordField } from "@/components/ui/password-field"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"
import { cn } from "@/lib/cn"

/** Panjang kode TOTP (RFC 6238) — sama dengan <OtpInput> default. */
const MFA_CODE_LENGTH = 6

export type DeleteAccountLabels = {
  warningTitle: string
  warning: (days: number) => string
  blockersTitle: string
  reasonLabel: string
  reasonPlaceholder: string
  passwordLabel: string
  mfaLabel: string
  mfaHelper: string
  confirmCheckbox: string
  phraseLabel: string
  phraseHelper: (phrase: string) => string
  submit: string
}

export type DeleteAccountPayload = {
  reason: string
  password: string
  /** Hanya terisi bila `requireMfa` */
  mfaCode?: string
}

export type DeleteAccountFormProps = Omit<ViewProps, "children"> & {
  /** Hari masa tenggang sebelum penghapusan permanen */
  gracePeriodDays?: number
  /** Hal yang menghalangi penghapusan, mis. ["Saldo Rp150.000 belum ditarik"] */
  blockers?: readonly string[]
  confirmPhrase?: string
  /** Tampilkan field kode autentikator (akun dengan 2FA aktif) */
  requireMfa?: boolean
  /** Pesan error dari server (password/kode salah) — ditempel ke field password */
  errorText?: string
  onSubmit: (payload: DeleteAccountPayload) => void
  submitting?: boolean
  labels?: Partial<DeleteAccountLabels>
  className?: string
}

const DEFAULT_LABELS: DeleteAccountLabels = {
  warningTitle: "Tindakan ini tidak dapat dibatalkan",
  warning: (days) =>
    `Akun akan dinonaktifkan sekarang dan dihapus permanen setelah ${days} hari. Riwayat transaksi, ulasan, dan saldo yang tersisa akan hilang.`,
  blockersTitle: "Selesaikan dulu sebelum menghapus akun",
  reasonLabel: "Alasan (opsional)",
  reasonPlaceholder: "Bantu kami memahami alasan Anda…",
  passwordLabel: "Password akun",
  mfaLabel: "Kode autentikator",
  mfaHelper: "6 digit dari aplikasi autentikator Anda",
  confirmCheckbox: "Saya memahami bahwa data saya akan dihapus dan tidak dapat dipulihkan.",
  phraseLabel: "Ketik untuk mengonfirmasi",
  phraseHelper: (phrase) => `Ketik "${phrase}" untuk melanjutkan`,
  submit: "Hapus akun saya",
}

export function DeleteAccountForm({
  gracePeriodDays,
  blockers = [],
  confirmPhrase = "HAPUS",
  requireMfa = false,
  errorText,
  onSubmit,
  submitting = false,
  labels,
  className,
  ...rest
}: DeleteAccountFormProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const [reason, setReason] = useState("")
  const [password, setPassword] = useState("")
  const [mfaCode, setMfaCode] = useState("")
  const [agreed, setAgreed] = useState(false)
  const [phrase, setPhrase] = useState("")

  const hasBlockers = blockers.length > 0
  const phraseOk = phrase.trim() === confirmPhrase
  const mfaOk = !requireMfa || mfaCode.length === MFA_CODE_LENGTH
  const canSubmit =
    !hasBlockers && password.length > 0 && mfaOk && agreed && phraseOk && !submitting

  return (
    <View accessible={false} className={cn("gap-5", className)} {...rest}>
      <Alert tone="danger" variant="soft" title={t.warningTitle}>
        {gracePeriodDays == null
          ? "Penghapusan akun mengikuti ketentuan resmi Kahade. Jadwal penghapusan dan ketentuan pembatalan belum tersedia pada halaman ini; hubungi dukungan bila Anda membutuhkan kepastian sebelum melanjutkan."
          : t.warning(gracePeriodDays)}
      </Alert>

      {hasBlockers ? (
        <Alert tone="warning" variant="soft" title={t.blockersTitle}>
          <View className="gap-1 pt-1">
            {blockers.map((b) => (
              <Text key={b} variant="body" tone="warning" className="leading-6">
                {"\u2022"} {b}
              </Text>
            ))}
          </View>
        </Alert>
      ) : null}

      <TextArea
        label={t.reasonLabel}
        value={reason}
        onChangeText={setReason}
        placeholder={t.reasonPlaceholder}
        maxLength={500}
        showCount
        disabled={hasBlockers}
      />

      <PasswordField
        label={t.passwordLabel}
        value={password}
        onChangeText={setPassword}
        disabled={hasBlockers}
        errorText={errorText}
        required
      />

      {requireMfa ? (
        <Input
          label={t.mfaLabel}
          value={mfaCode}
          onChangeText={(v) => setMfaCode(v.replace(/\D/g, "").slice(0, MFA_CODE_LENGTH))}
          helperText={t.mfaHelper}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={MFA_CODE_LENGTH}
          disabled={hasBlockers}
          required
        />
      ) : null}

      <Checkbox
        checked={agreed}
        onChange={setAgreed}
        disabled={hasBlockers}
        label={
          <Text variant="body" tone="primary" className="leading-6">
            {t.confirmCheckbox}
          </Text>
        }
      />

      <Input
        label={t.phraseLabel}
        value={phrase}
        onChangeText={setPhrase}
        placeholder={confirmPhrase}
        helperText={t.phraseHelper(confirmPhrase)}
        autoCapitalize="characters"
        autoCorrect={false}
        disabled={hasBlockers || !agreed}
        errorText={phrase.length > 0 && !phraseOk ? "Frasa tidak sesuai" : undefined}
      />

      <Button accessibilityHint="Ketuk untuk berinteraksi"
        variant="destructive"
        onPress={() => onSubmit({ reason, password, mfaCode: requireMfa ? mfaCode : undefined })}
        disabled={!canSubmit}
        loading={submitting}
      >
        {t.submit}
      </Button>
    </View>
  )
}