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
 *   - Gerbang UI DIBUKA untuk semua tipe akun (POIN 3, 2026-10-04):
 *     self-claim tipe akun dihapus, jadi semua user PERSONAL — verifikasi
 *     bisnis tetap bisa diajukan siapa pun; APPROVED otomatis menaikkan
 *     accountType ke BUSINESS di backend (BAI-064). Akun yang sudah
 *     BUSINESS ditolak backend (sudah terverifikasi, tak perlu mengajukan).
 *   - Dokumen diambil lewat kamera/galeri (foto NPWP / akta / SIUP), sama
 *     seperti alur KYC & bukti sengketa: expo-image-picker belum mendukung
 *     file PDF (repo tidak memasang expo-document-picker). Backend menerima
 *     jpg/png/pdf; batasan 10MB & maks 5 berkas mengikuti backend.
 *   - Backend mewajibkan SALAH SATU dari deedNumber/siupNumber — direfleksikan
 *     di `formValid` + helper text, bukan dibiarkan 400 di server.
 *   - Upload dilakukan saat submit (bukan saat pilih), persis pola KYC:
 *     tombol submit `loading` selama semua berkas diupload.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { Platform, TextInput, View } from "react-native"
import { useNavigation, usePreventRemove, type NavigationAction } from "@react-navigation/native"
import { Plus } from "phosphor-react-native"
import { translate } from "@/lib/i18n/translate"

import { api, userMessage } from "@/lib/api"
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
import { useApiQuery } from "@/lib/use-api-query"

import { Button } from "@/components/ui/button"
import { DataScreen } from "@/components/ui/data-screen"
import { Dialog } from "@/components/ui/modal"
import { Field } from "@/components/ui/field"
import { FormSection } from "@/components/ui/form-section"
import { Input } from "@/components/ui/input"
import { KeyValue, KeyValueList } from "@/components/ui/key-value"
import { KycHistoryListItem } from "@/components/ui/kyc-history-list-item"
import { KycStatusCard } from "@/components/ui/kyc-status-card"
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
  const navigation = useNavigation()

  /**
   * Status, tipe akun, dan riwayat dimuat bersama (satu query): riwayat yang
   * gagal tidak mematikan status (isi utama layar), sama seperti layar KYC.
   */
  const query = useApiQuery<{
    state: BusinessVerificationState
    history: BusinessVerificationHistoryEntry[]
  }>(
    "business-verification",
    async (signal) => {
      const [s, h] = await Promise.all([
        api.businessVerification.getBusinessVerificationStatus(signal),
        api.businessVerification
          .getBusinessVerificationHistory({ page: 1, limit: HISTORY_LIMIT }, signal)
          .then((p) => p.data)
          .catch(() => []),
      ])
      return { state: s, history: h ?? [] }
    },
  )
  const state = query.data?.state ?? null
  const history = query.data?.history ?? []

  const uiStatus = toBusinessVerificationUiStatus(state?.status)
  // resubmit hanya untuk REJECTED (backend menolak selain itu); REVOKED dan
  // pengajuan pertama memakai submit.
  const isResubmit = uiStatus === "REJECTED"
  // POIN 3 (2026-10-04): gerbang tipe akun dibuka — siapa pun (semua user
  // kini PERSONAL karena self-claim dihapus) boleh mengajukan; backend
  // menaikkan ke BUSINESS saat APPROVED (BAI-064).
  const canSubmit = uiStatus === "NOT_SUBMITTED" || isResubmit

  const [formOpen, setFormOpen] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  const [intentionalLeave, setIntentionalLeave] = useState(false)
  const pendingNavigation = useRef<NavigationAction | null>(null)
  const cancelFormOnDiscard = useRef(false)
  const [businessName, setBusinessName] = useState("")
  const [npwpNumber, setNpwpNumber] = useState("")
  const [deedNumber, setDeedNumber] = useState("")
  const [siupNumber, setSiupNumber] = useState("")
  // FRM-010: rantai fokus Next antar field form verifikasi bisnis.
  const npwpRef = useRef<TextInput>(null)
  const deedRef = useRef<TextInput>(null)
  const siupRef = useRef<TextInput>(null)
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

  const hasUnsavedChanges =
    formOpen &&
    Boolean(
      businessName.trim() ||
        npwpNumber.trim() ||
        deedNumber.trim() ||
        siupNumber.trim() ||
        docs.length > 0,
    )

  usePreventRemove((hasUnsavedChanges || (formOpen && submitting)) && !intentionalLeave, ({ data }) => {
    if (formOpen && submitting) {
      toast.show({
        title: "Verifikasi sedang dikirim",
        description: "Tunggu sampai pengiriman selesai sebelum meninggalkan layar.",
        tone: "info",
      })
      return
    }
    pendingNavigation.current = data.action
    cancelFormOnDiscard.current = false
    setDiscardOpen(true)
  })

  useEffect(() => {
    if (!intentionalLeave) return
    const action = pendingNavigation.current
    pendingNavigation.current = null
    if (action) navigation.dispatch(action)
  }, [intentionalLeave, navigation])

  // The navigation guard does not cover a browser refresh/tab close.
  useEffect(() => {
    if (Platform.OS !== "web" || !hasUnsavedChanges) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    globalThis.addEventListener?.("beforeunload", warn)
    return () => globalThis.removeEventListener?.("beforeunload", warn)
  }, [hasUnsavedChanges])

  const requestCloseForm = useCallback(() => {
    if (submitting) return
    if (hasUnsavedChanges) {
      pendingNavigation.current = null
      cancelFormOnDiscard.current = true
      setDiscardOpen(true)
      return
    }
    resetForm()
    setFormOpen(false)
  }, [hasUnsavedChanges, resetForm, submitting])

  const cancelDiscard = useCallback(() => {
    pendingNavigation.current = null
    cancelFormOnDiscard.current = false
    setDiscardOpen(false)
  }, [])

  const confirmDiscard = useCallback(() => {
    setDiscardOpen(false)
    if (cancelFormOnDiscard.current) {
      cancelFormOnDiscard.current = false
      resetForm()
      setFormOpen(false)
      return
    }
    setIntentionalLeave(true)
  }, [resetForm])

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
        description: userMessage(err),
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
      keyboardAvoiding
      state={query}
      loadingMessage="Memuat status verifikasi bisnis…"
    >
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
                  // FRM-010: Next memindahkan fokus ke field berikutnya.
                  onSubmitEditing={() => npwpRef.current?.focus()}
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
                  ref={npwpRef}
                  value={npwpNumber}
                  onChangeText={(t) => setNpwpNumber(t.replace(/[^0-9.\-]/g, "").slice(0, 25))}
                  // FRM-001: helper memperbolehkan titik & strip — number-pad iOS
                  // tidak punya tombol . dan -, jadi pakai numbers-and-punctuation.
                  keyboardType="numbers-and-punctuation"
                  returnKeyType="next"
                  onSubmitEditing={() => deedRef.current?.focus()}
                  maxLength={25}
                  placeholder="01.234.567.8-901.000"
                />
              </Field>
              <Field label="No. akta pendirian" helperText="Isi akta atau SIUP — minimal satu.">
                <Input
                  ref={deedRef}
                  value={deedNumber}
                  onChangeText={setDeedNumber}
                  returnKeyType="next"
                  // FRM-015: nomor dokumen jangan kena autocapitalize/autocorrect.
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  onSubmitEditing={() => siupRef.current?.focus()}
                  maxLength={100}
                  placeholder="Opsional bila sudah isi SIUP"
                />
              </Field>
              <Field label="No. SIUP / NIB">
                <Input
                  ref={siupRef}
                  value={siupNumber}
                  onChangeText={setSiupNumber}
                  returnKeyType="done"
                  // FRM-015: nomor dokumen jangan kena autocapitalize/autocorrect.
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
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
                onPress={requestCloseForm}
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

          {/* UI-M010: caption status tidak dibatasi numberOfLines — harus utuh
              pada font OS besar (maxFontSizeMultiplier=2). */}
          {uiStatus === "APPROVED" ? (
            <Text variant="caption" tone="secondary">
              Bisnis Anda sudah terverifikasi. Badge "Business Verified" tampil di profil Anda.
            </Text>
          ) : null}
      <Dialog
        title="Buang isian verifikasi?"
        description="Data dan dokumen yang sudah dipilih akan dihapus jika Anda keluar sekarang."
        visible={discardOpen}
        destructive
        confirmLabel="Buang isian"
        cancelLabel="Lanjutkan mengisi"
        onConfirm={confirmDiscard}
        onCancel={cancelDiscard}
        onRequestClose={cancelDiscard}
      />
    </DataScreen>
  )
}
