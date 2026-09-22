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
import type { ReportReasonOption } from "@/lib/labels/report"
import { Button } from "@/components/ui/button"
import { Radio, RadioGroup } from "@/components/ui/radio"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"
import { API_CONSTRAINTS } from "@/lib/api/constraints"
import { cn } from "@/lib/cn"

/**
 * I-06 (audit 2026-09-22): daftar alasan TIDAK lagi didefinisikan di sini.
 *
 * Sebelumnya komponen ini punya `ReportReason`/`REPORT_REASONS` sendiri di
 * samping `USER_REPORT_REASONS`/`CONTENT_REPORT_REASONS` di
 * `lib/labels/report.ts` — dua taksonomi dengan enum berbeda untuk alur yang
 * sama, dan layar mana pun yang lupa mengirim `reasons` diam-diam memakai set
 * yang salah (kategori terkirim mentah ke endpoint enum → 400 di produksi).
 * Sekarang daftarnya WAJIB dikirim pemanggil dari satu sumber itu.
 */
export type ReportFormValue = {
  reason: string
  detail: string
}

export type ReportFormProps = Omit<ViewProps, "children"> & {
  /** Mis. "@budisantoso" atau "pesanan ORD-2026-0912" */
  targetName?: string
  reasons: readonly ReportReasonOption[]
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

/**
 * Batas atas kolom detail = batas `ReportUserSettingsDto.description` di spec.
 *
 * Sebelumnya angka ini ditulis tangan sebagai 1000. Padahal spec hanya
 * menerima 500 karakter, sehingga pengguna yang menulis 501-1000 karakter
 * (penghitung di bawah kolom justru memberi lampu hijau sampai 1000) baru
 * ditolak backend saat submit — "Gagal mengirim laporan" tanpa sebab yang
 * jelas. Diturunkan dari `API_CONSTRAINTS` supaya bila backend mengubah batas,
 * `npm run gen:api` langsung menyeret angka ini ikut berubah.
 */
const MAX_DETAIL = API_CONSTRAINTS.ReportUserSettingsDto.description.maxLength

/**
 * Detail WAJIB hanya untuk alasan "OTHER". Spec tidak menetapkan `minLength`
 * pada `ReportUserSettingsDto.description` (beda dari `ReportUserDto` yang
 * menuntut 20), jadi 20 di sini murni keputusan produk, bukan tiruan spec.
 */
const OTHER_MIN = 20

export function ReportForm({
  targetName,
  reasons,
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
    const trimmed = v.detail.trim()
    // Panjang dicek lebih dulu: tanpa ini, `maxLength` TextInput adalah satu-
    // satunya pagar — dan pemanggil yang mengendalikan `value` (mis. memuat
    // draf tersimpan) bisa melewati batas lalu ditolak backend.
    if (trimmed.length > MAX_DETAIL) return `Maksimal ${MAX_DETAIL} karakter`
    if (!detailRequired) return undefined
    if (trimmed.length === 0) return "Jelaskan alasan laporan Anda"
    if (trimmed.length < OTHER_MIN) return `Minimal ${OTHER_MIN} karakter`
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
        maxLength={MAX_DETAIL}
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