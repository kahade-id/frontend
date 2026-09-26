/**
 * Screen — Verifikasi Bisnis (badge "Business Verified").
 *
 * GET /v1/business-verification/status + /history → kartu status + riwayat.
 * POST /v1/business-verification/submit (pertama kali) atau /resubmit
 * (setelah REJECTED, cooldown 24 jam) dengan businessName + npwpNumber +
 * (deedNumber | siupNumber) + 1–5 fileKey dokumen — upload langsung
 * (purpose BUSINESS_DOCUMENT) lewat `api.upload.uploadDirectImage`
 * (self-hosted storage, 2026-09-26; presigned URL sudah dimatikan backend).
 *
 * Keputusan non-obvious:
 *   - Kerangka layar via <DataScreen> (aturan S3 check:screens): urutan
 *     loading → error → konten, inset bawah, dan padding ditangani kerangka.
 *   - Gerbang UI: hanya akun `accountType === "BUSINESS"` yang boleh submit
 *     (backend juga menolak 403 selain itu). Akun PERSONAL melihat kartu
 *     penunjuk ke layar Tipe Akun, bukan form — submit pasti gagal.
 *   - Dokumen diambil lewat kamera/galeri (foto NPWP / akta / SIUP), sama
 *     seperti alur KYC & bukti sengketa: expo-image-picker belum mendukung
 *     file PDF (repo tidak memasang expo-document-picker). Backend menerima
 *     jpg/png/pdf; batasan 10MB & maks 5 berkas mengikuti backend.
 *   - Backend mewajibkan SALAH SATU dari deedNumber/siupNumber — direfleksikan
 *     di `formValid` + helper text, bukan dibiarkan 400 di server.
 *   - Upload dilakukan saat submit (bukan saat pilih), persis pola KYC:
 *     tombol submit `loading` selama semua berkas diupload.
 */
import { useCallback, useState } from "react"
import { View } from "react-native"
import { Plus } from "phosphor-react-native"
import { translate } from "@/lib/i18n/translate"

import { api, isApiError, userMessage } from "@/lib/api"
import {
  toBusinessVerificationUiStatus,
  type BusinessVerificationHistoryEntry,
  type BusinessVerificationState,
} from "@/lib/api/business-verification"
import type { SubmitBusinessVerificationDto } from "@/lib/api/types"
import { formatDateTime } from "@/lib/format"
import {
  pickImage,
  type PickedImage,
  type PickImageOptions,
} from "@/lib/image-picker"
import { ROUTES } from "@/lib/routes"
import { useApiQuery } from "@/lib/use-api-query"

import { Button } from "@/components/ui/button"
import { DataScreen } from "@/components/ui/data-screen"
import { Field } from "@/components/ui/field"
import { FormSection } from "@/components/ui/form-section"
import { Input } from "@/components/ui/input"
import { KeyValue, KeyValueList } from "@/components/ui/key-value"
import { KycHistoryListItem } from "@/components/ui/kyc-history-list-item"
import { KycStatusCard } from "@/components/ui/kyc-status-card"
import { RouteLink } from "@/components/ui/route-link"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"
import { UploadField } from "@/components/ui/upload-field"

/** Batas dokumen (backend: ArrayMinSize 1, ArrayMaxSize 5, maks 10MB). */
const MAX_DOCUMENTS = 5
const MAX_SIZE_MB = 10
/** NPWP: 15 digit (format lama) atau 16 digit (format NIK). */
const NPWP_DIGITS_MIN = 15
const NPWP_DIGITS_MAX = 16
/** Foto: tanpa crop paksa, galeri default (dokumen difoto, bukan selfie). */
const DOC_PICKER: PickImageOptions = { allowsEditing: false }
/** Batas riwayat yang ditampilkan (limit maks spec 100). */
const HISTORY_LIMIT = 20

function npwpDigits(value: string): number {
  return value.replace(/\D/g, "").length
}

export default function BusinessVerificationScreen() {
  const toast = useToast()

  /**
   * Status, tipe akun, dan riwayat dimuat bersama (satu query): riwayat yang
   * gagal tidak mematikan status (isi utama layar), sama seperti layar KYC.
   */
  const query = useApiQuery<{
    state: BusinessVerificationState
    accountType: string | null
    history: BusinessVerificationHistoryEntry[]
  }>(
    "business-verification",
    async (signal) => {
      const [me, s, h] = await Promise.all([
        api.users.getMe(signal),
        api.businessVerification.getBusinessVerificationStatus(signal),
        api.businessVerification
          .getBusinessVerificationHistory({ page: 1, limit: HISTORY_LIMIT }, signal)
          .then((p) => p.data)
          .catch(() => []),
      ])
      return { state: s, accountType: me.accountType ?? null, history: h ?? [] }
    },
  )
  const state = query.data?.state ?? null
  const accountType = query.data?.accountType ?? null
  const history = query.data?.history ?? []

  const isBusiness = accountType === "BUSINESS"
  const uiStatus = toBusinessVerificationUiStatus(state?.status)
  // resubmit hanya untuk REJECTED (backend menolak selain itu); REVOKED dan
  // pengajuan pertama memakai submit.
  const isResubmit = uiStatus === "REJECTED"
  const canSubmit = isBusiness && (uiStatus === "NOT_SUBMITTED" || isResubmit)

  const [formOpen, setFormOpen] = useState(false)
  const [businessName, setBusinessName] = useState("")
  const [npwpNumber, setNpwpNumber] = useState("")
  const [deedNumber, setDeedNumber] = useState("")
  const [siupNumber, setSiupNumber] = useState("")
  const [docs, setDocs] = useState<PickedImage[]>([])
  const [submitting, setSubmitting] = useState(false)

  const resetForm = useCallback(() => {
    setBusinessName("")
    setNpwpNumber("")
    setDeedNumber("")
    setSiupNumber("")
    setDocs([])
  }, [])

  const openForm = useCallback(() => {
    resetForm()
    setFormOpen(true)
  }, [resetForm])

  const pickDoc = useCallback(async () => {
    const res = await pickImage(DOC_PICKER)
    if (res.status === "denied") {
      toast.show({
        title: "Izin galeri ditolak",
        description: "Aktifkan di pengaturan perangkat untuk melanjutkan verifikasi.",
        tone: "danger",
      })
      return
    }
    if (res.status !== "picked") return
    setDocs((d) => (d.length >= MAX_DOCUMENTS ? d : [...d, res.asset]))
  }, [toast.show])

  const removeDoc = useCallback((index: number) => {
    setDocs((d) => d.filter((_, i) => i !== index))
  }, [])

  const npwpDigitsCount = npwpDigits(npwpNumber)
  const formValid =
    businessName.trim().length >= 3 &&
    npwpDigitsCount >= NPWP_DIGITS_MIN &&
    npwpDigitsCount <= NPWP_DIGITS_MAX &&
    (deedNumber.trim().length > 0 || siupNumber.trim().length > 0) &&
    docs.length >= 1 &&
    docs.length <= MAX_DOCUMENTS

  const handleSubmit = useCallback(async () => {
    if (!formValid) return
    setSubmitting(true)
    try {
      const documentFileKeys: string[] = []
      for (const img of docs) {
        // Self-hosted (2026-09-26): presigned URL dimatikan backend —
        // upload langsung multipart ke POST /v1/upload/direct.
        const { fileKey } = await api.upload.uploadDirectImage(img, "BUSINESS_DOCUMENT")
        documentFileKeys.push(fileKey)
      }
      const dto: SubmitBusinessVerificationDto = {
        businessName: businessName.trim(),
        npwpNumber: npwpNumber.trim(),
        documentFileKeys,
      }
      if (deedNumber.trim()) dto.deedNumber = deedNumber.trim()
      if (siupNumber.trim()) dto.siupNumber = siupNumber.trim()
      if (isResubmit) await api.businessVerification.resubmitBusinessVerification(dto)
      else await api.businessVerification.submitBusinessVerification(dto)
      toast.show({
        title: "Verifikasi bisnis dikirim",
        description: "Dokumen Anda sedang ditinjau. Kami beri tahu hasilnya lewat notifikasi.",
        tone: "success",
      })
      setFormOpen(false)
      resetForm()
      await query.refresh()
    } catch (err) {
      toast.show({
        title: "Gagal mengirim verifikasi bisnis",
        description: isApiError(err) ? userMessage(err) : err instanceof Error ? err.message : "Periksa koneksi dan coba lagi.",
        tone: "danger",
      })
    } finally {
      setSubmitting(false)
    }
  }, [formValid, docs, businessName, npwpNumber, deedNumber, siupNumber, isResubmit, resetForm, query, toast.show])

  const latest = state?.latestRequest ?? null
  const decidedAt = latest?.approvedAt ?? latest?.reviewedAt ?? null

  return (
    <DataScreen
      title="Verifikasi Bisnis"
      state={query}
      loadingMessage="Memuat status verifikasi bisnis…"
    >
      {!isBusiness ? (
        <>
          <KycStatusCard status="NOT_SUBMITTED" />
          <View className="gap-2 rounded-md bg-surface p-4">
            <Text variant="body">
              Verifikasi bisnis hanya tersedia untuk akun dengan tipe{" "}
              <Text variant="body" tone="primary">
                Bisnis
              </Text>
              . Ganti tipe akun terlebih dahulu, lalu ajukan kembali.
            </Text>
            <RouteLink href={ROUTES.accountType}>
              <Button variant="secondary">Ganti ke akun Bisnis</Button>
            </RouteLink>
          </View>
        </>
      ) : (
        <>
          <KycStatusCard
            status={uiStatus}
            rejectionReason={latest?.rejectionReason ?? undefined}
            submittedAt={latest?.createdAt ? formatDateTime(latest.createdAt) : undefined}
            approvedAt={uiStatus === "APPROVED" && decidedAt ? formatDateTime(decidedAt) : undefined}
            onSubmit={canSubmit && !formOpen ? openForm : undefined}
            onResubmit={canSubmit && !formOpen ? openForm : undefined}
          />

          {uiStatus === "APPROVED" && latest?.businessName ? (
            <KeyValueList>
              <KeyValue label="Nama badan usaha" value={latest.businessName} />
              {latest.deedNumber ? <KeyValue label="No. akta" value={latest.deedNumber} /> : null}
              {latest.siupNumber ? <KeyValue label="No. SIUP/NIB" value={latest.siupNumber} /> : null}
            </KeyValueList>
          ) : null}

          {canSubmit && formOpen ? (
            <FormSection
              title={isResubmit ? "Kirim ulang dokumen" : "Kirim dokumen"}
              description="Foto NPWP, akta pendirian, atau SIUP/NIB. Pastikan terang dan seluruh dokumen terlihat. Kirim minimal 1, maksimal 5 dokumen."
            >
              <Field label="Nama badan usaha" required>
                <Input
                  value={businessName}
                  onChangeText={setBusinessName}
                  returnKeyType="next"
                  maxLength={150}
                  placeholder="Sesuai akta/NPWP"
                />
              </Field>
              <Field
                label="NPWP badan usaha"
                required
                helperText={translate("{x}–{y} digit; titik & strip diizinkan.", {
                  x: NPWP_DIGITS_MIN,
                  y: NPWP_DIGITS_MAX,
                })}
              >
                <Input
                  value={npwpNumber}
                  onChangeText={(t) => setNpwpNumber(t.replace(/[^0-9.\-]/g, "").slice(0, 25))}
                  keyboardType="number-pad"
                  returnKeyType="next"
                  maxLength={25}
                  placeholder="01.234.567.8-901.000"
                />
              </Field>
              <Field label="No. akta pendirian" helperText="Isi akta atau SIUP — minimal satu.">
                <Input
                  value={deedNumber}
                  onChangeText={setDeedNumber}
                  returnKeyType="next"
                  maxLength={100}
                  placeholder="Opsional bila sudah isi SIUP"
                />
              </Field>
              <Field label="No. SIUP / NIB" helperText="Isi akta atau SIUP — minimal satu.">
                <Input
                  value={siupNumber}
                  onChangeText={setSiupNumber}
                  returnKeyType="done"
                  maxLength={100}
                  placeholder="Opsional bila sudah isi akta"
                />
              </Field>

              <Text variant="label" tone="secondary">
                Dokumen ({docs.length}/{MAX_DOCUMENTS})
              </Text>
              {docs.map((d, i) => (
                <View
                  key={`${d.uri}-${i}`}
                  className="flex-row items-center justify-between rounded-md bg-surface px-3 py-2"
                >
                  <Text variant="body" className="flex-1" numberOfLines={1}>
                    {d.name}
                  </Text>
                  <Button
                    variant="ghost"
                    fullWidth={false}
                    disabled={submitting}
                    onPress={() => removeDoc(i)}
                    accessibilityLabel={translate("Hapus dokumen {x}", { x: d.name })}
                  >
                    Hapus
                  </Button>
                </View>
              ))}
              {docs.length < MAX_DOCUMENTS ? (
                <UploadField
                  label="Tambah dokumen"
                  required={docs.length === 0}
                  file={null}
                  status="idle"
                  onPick={() => void pickDoc()}
                  accept={["jpg", "png"]}
                  maxSizeMB={MAX_SIZE_MB}
                  title={translate("Pilih foto (maks {x}MB)", { x: MAX_SIZE_MB })}
                  disabled={submitting}
                />
              ) : null}
              {docs.length === 0 ? (
                <View className="flex-row justify-center">
                  <Button
                    variant="ghost"
                    fullWidth={false}
                    size="sm"
                    leftIcon={Plus}
                    disabled={submitting}
                    onPress={() => void pickDoc()}
                  >
                    Pilih dokumen
                  </Button>
                </View>
              ) : null}

              <Button loading={submitting} disabled={!formValid} onPress={() => void handleSubmit()}>
                {isResubmit ? "Kirim ulang verifikasi" : "Kirim verifikasi"}
              </Button>
              <Button
                variant="ghost"
                fullWidth={false}
                disabled={submitting}
                onPress={() => setFormOpen(false)}
              >
                Batal
              </Button>
            </FormSection>
          ) : null}

          {history.length > 0 ? (
            <>
              <SectionHeader title="Riwayat pengajuan" />
              {history.map((h, i) => (
                <KycHistoryListItem
                  key={h.verificationId}
                  attempt={h.attemptNumber ?? history.length - i}
                  status={toBusinessVerificationUiStatus(h.status)}
                  submittedAt={formatDateTime(h.createdAt)}
                  reviewedAt={h.reviewedAt ? formatDateTime(h.reviewedAt) : undefined}
                  rejectionReason={h.rejectionReason ?? undefined}
                  requestId={h.verificationId}
                />
              ))}
            </>
          ) : null}

          {uiStatus === "APPROVED" ? (
            <Text numberOfLines={2} variant="caption" tone="secondary">
              Bisnis Anda sudah terverifikasi. Badge "Business Verified" tampil di profil Anda.
            </Text>
          ) : null}
        </>
      )}
    </DataScreen>
  )
}
