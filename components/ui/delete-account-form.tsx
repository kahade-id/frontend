/**
 * Kahade — <DeleteAccountForm> (§11 Form, §9.11 Alert, §2.3 danger).
 * API: POST /v1/users/me/delete-request
 *
 * Permintaan hapus akun (soft-delete dengan masa tenggang): Alert danger
 * berisi konsekuensi -> alasan opsional -> checkbox konfirmasi -> ketik
 * "HAPUS" -> tombol destructive.
 *
 * Keputusan non-obvious:
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
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"
import { cn } from "@/lib/cn"

export type DeleteAccountLabels = {
  warningTitle: string
  warning: (days: number) => string
  blockersTitle: string
  reasonLabel: string
  reasonPlaceholder: string
  confirmCheckbox: string
  phraseLabel: string
  phraseHelper: (phrase: string) => string
  submit: string
}

export type DeleteAccountFormProps = Omit<ViewProps, "children"> & {
  /** Hari masa tenggang sebelum penghapusan permanen */
  gracePeriodDays?: number
  /** Hal yang menghalangi penghapusan, mis. ["Saldo Rp150.000 belum ditarik"] */
  blockers?: readonly string[]
  confirmPhrase?: string
  onSubmit: (payload: { reason: string }) => void
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
  confirmCheckbox: "Saya memahami bahwa data saya akan dihapus dan tidak dapat dipulihkan.",
  phraseLabel: "Ketik untuk mengonfirmasi",
  phraseHelper: (phrase) => `Ketik "${phrase}" untuk melanjutkan`,
  submit: "Hapus akun saya",
}

export function DeleteAccountForm({
  gracePeriodDays = 30,
  blockers = [],
  confirmPhrase = "HAPUS",
  onSubmit,
  submitting = false,
  labels,
  className,
  ...rest
}: DeleteAccountFormProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const [reason, setReason] = useState("")
  const [agreed, setAgreed] = useState(false)
  const [phrase, setPhrase] = useState("")

  const hasBlockers = blockers.length > 0
  const phraseOk = phrase.trim() === confirmPhrase
  const canSubmit = !hasBlockers && agreed && phraseOk && !submitting

  return (
    <View className={cn("gap-5", className)} {...rest}>
      <Alert tone="danger" variant="soft" title={t.warningTitle}>
        {t.warning(gracePeriodDays)}
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

      <Checkbox
        checked={agreed}
        onChange={setAgreed}
        disabled={hasBlockers}
        label={<Text variant="body" tone="primary" className="leading-6">{t.confirmCheckbox}</Text>}
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

      <Button variant="destructive" onPress={() => onSubmit({ reason })} disabled={!canSubmit} loading={submitting}>
        {t.submit}
      </Button>
    </View>
  )
}
