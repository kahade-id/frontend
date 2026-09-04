/**
 * Kahade — <ReportForm> (§9.9 Radio card, §9.8 TextArea, §11 Form).
 * API: POST /v1/users/{userId}/report, POST /v1/settings/report,
 *      GET /v1/settings/reports
 *
 * Formulir laporan pengguna/konten: pilih satu alasan (RadioGroup varian
 * card) -> detail opsional (TextArea) -> submit. Dipakai di BottomSheet dari
 * profil, chat room, dan detail pesanan; itu sebabnya komponen ini TIDAK
 * memiliki tombol submit sendiri bila `onSubmit` tidak diberikan — pemanggil
 * boleh menaruh tombol di footer sheet.
 *
 * Keputusan non-obvious:
 *   - Alasan sebagai konstanta ekspor (`REPORT_REASONS`) dengan `value` =
 *     enum backend, `label`/`description` Bahasa Indonesia. Pemanggil bisa
 *     mengganti via `reasons` untuk konteks berbeda (laporan konten vs akun).
 *   - Detail WAJIB hanya bila alasan "OTHER" — divalidasi di sini
 *     (`errorText` internal) supaya setiap pemanggil tidak menulis ulang.
 *   - Alert info di atas: laporan bersifat rahasia — menurunkan keraguan
 *     pelapor; nada `info`, bukan warning, karena ini penjelasan, bukan
 *     peringatan.
 *   - Target (`targetName`) ditampilkan sebagai caption "Melaporkan @user"
 *     agar pengguna yakin melaporkan orang yang benar sebelum submit.
 */
import { useMemo, useState } from "react"
import { View, type ViewProps } from "react-native"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Radio, RadioGroup } from "@/components/ui/radio"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"
import { cn } from "@/lib/cn"

export type ReportReason =
  | "SCAM"
  | "HARASSMENT"
  | "FAKE_ACCOUNT"
  | "INAPPROPRIATE_CONTENT"
  | "SPAM"
  | "OTHER"

export type ReportReasonOption = {
  value: ReportReason | string
  label: string
  description?: string
}

export const REPORT_REASONS: readonly ReportReasonOption[] = [
  { value: "SCAM", label: "Penipuan", description: "Meminta pembayaran di luar escrow atau tidak mengirim barang" },
  { value: "HARASSMENT", label: "Pelecehan", description: "Kata-kata kasar, ancaman, atau intimidasi" },
  { value: "FAKE_ACCOUNT", label: "Akun palsu", description: "Mengaku sebagai orang atau bisnis lain" },
  { value: "INAPPROPRIATE_CONTENT", label: "Konten tidak pantas", description: "Gambar atau teks yang melanggar aturan" },
  { value: "SPAM", label: "Spam", description: "Pesan berulang atau promosi tidak diminta" },
  { value: "OTHER", label: "Lainnya", description: "Jelaskan di kolom detail" },
]

export type ReportFormValue = {
  reason: string
  detail: string
}

export type ReportFormProps = Omit<ViewProps, "children"> & {
  /** Mis. "@budisantoso" atau "pesanan ORD-2026-0912" */
  targetName?: string
  reasons?: readonly ReportReasonOption[]
  value?: ReportFormValue
  onChange?: (next: ReportFormValue) => void
  /** Bila ada -> tombol submit dirender di bawah form */
  onSubmit?: (value: ReportFormValue) => void
  submitting?: boolean
  submitLabel?: string
  /** Sembunyikan Alert kerahasiaan */
  hideNotice?: boolean
  className?: string
}

const OTHER_MIN = 20

export function ReportForm({
  targetName,
  reasons = REPORT_REASONS,
  value,
  onChange,
  onSubmit,
  submitting = false,
  submitLabel = "Kirim laporan",
  hideNotice = false,
  className,
  ...rest
}: ReportFormProps) {
  const [inner, setInner] = useState<ReportFormValue>({ reason: "", detail: "" })
  const v = value ?? inner
  const set = (next: ReportFormValue) => {
    if (!value) setInner(next)
    onChange?.(next)
  }

  const detailRequired = v.reason === "OTHER"
  const detailError = useMemo(() => {
    if (!detailRequired) return undefined
    if (v.detail.trim().length === 0) return "Jelaskan alasan laporan Anda"
    if (v.detail.trim().length < OTHER_MIN) return `Minimal ${OTHER_MIN} karakter`
    return undefined
  }, [detailRequired, v.detail])

  const canSubmit = v.reason.length > 0 && !detailError && !submitting

  return (
    <View className={cn("gap-5", className)} {...rest}>
      {targetName ? (
        <Text variant="caption" tone="secondary">
          Melaporkan {targetName}
        </Text>
      ) : null}

      {!hideNotice ? (
        <Alert tone="info" variant="soft">
          Laporan bersifat rahasia. Pengguna yang dilaporkan tidak akan tahu siapa yang melapor.
        </Alert>
      ) : null}

      <RadioGroup
        variant="card"
        value={v.reason || undefined}
        onChange={(reason) => set({ ...v, reason })}
        accessibilityLabel="Alasan laporan"
      >
        {reasons.map((r) => (
          <Radio key={r.value} value={r.value} label={r.label} description={r.description} />
        ))}
      </RadioGroup>

      <TextArea
        label={detailRequired ? "Detail" : "Detail (opsional)"}
        required={detailRequired}
        value={v.detail}
        onChangeText={(detail) => set({ ...v, detail })}
        placeholder="Ceritakan apa yang terjadi…"
        maxLength={1000}
        showCount
        errorText={v.detail.length > 0 || detailRequired ? detailError : undefined}
        helperText={!detailRequired ? "Detail membantu tim kami menindaklanjuti lebih cepat" : undefined}
      />

      {onSubmit ? (
        <Button variant="destructive" onPress={() => onSubmit(v)} disabled={!canSubmit} loading={submitting}>
          {submitLabel}
        </Button>
      ) : null}
    </View>
  )
}
