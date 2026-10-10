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
 *   - E-30 (audit 2026-10-10): fileKey hasil unggah disimpan per aset
 *     (`uploadedKeys`, uri → fileKey). Bila submit JSON gagal SETELAH semua
 *     dokumen terunggah, percobaan ulang tidak mengunggah ulang aset yang
 *     sudah punya fileKey. Peta dikosongkan saat form direset dan entri
 *     dibuang saat aset dihapus pengguna.
 *   - E-15: semua teks UI lewat `translate()`; `useLanguage()` membuat layar
 *     ikut ter-render saat bahasa berganti (prop string ke komponen anak
 *     dihitung di sini, bukan di <Text>).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Platform, View, type TextInputInstance } from "react-native"
import { useNavigation, usePreventRemove, type NavigationAction } from "expo-router"
import { Plus } from "phosphor-react-native"
import { translate, useLanguage } from "@/lib/i18n"

import { api } from "@/lib/api"
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
import { showMutationError } from "@/lib/mutation-toast"
import { uploadMessage } from "@/lib/upload-errors"

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
  // E-15: prop string (title/label/placeholder) dihitung di layar ini, bukan
  // di <Text> — subscribe ke bahasa agar ikut ter-render saat bahasa berganti.
  const language = useLanguage()

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
  // resubmit hanya untuk REJECTED (backend menolak selain itu); pengajuan
  // pertama memakai submit. REVOKED TIDAK bisa mengajukan lewat jalur mana pun:
  // backend `assertNoActiveSubmission` melempar 403 BUSINESS_VERIFICATION_REVOKED
  // untuk submit maupun resubmit (harus lewat CS) — karena itu `canSubmit`
  // sengaja mengecualikan REVOKED (E-31).
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
  const npwpRef = useRef<TextInputInstance>(null)
  const deedRef = useRef<TextInputInstance>(null)
  const siupRef = useRef<TextInputInstance>(null)
  const [docs, setDocs] = useState<PickedImage[]>([])
  const [submitting, setSubmitting] = useState(false)
  // E-30: fileKey hasil unggah per aset (uri → fileKey). Tidak dirender, jadi
  // ref (bukan state) — dibaca saat submit, dikosongkan di resetForm.
  const uploadedKeys = useRef<Map<string, string>>(new Map())

  const resetForm = useCallback(() => {
    setBusinessName("")
    setNpwpNumber("")
    setDeedNumber("")
    setSiupNumber("")
    setDocs([])
    uploadedKeys.current.clear()
  }, [])

  const openForm = useCallback(() => {
    resetForm()
    setFormOpen(true)
  }, [resetForm])

  const pickDoc = useCallback(async () => {
    const res = await pickImage(DOC_PICKER)
    if (res.status === "denied") {
      toast.show({
        title: translate("Izin galeri ditolak"),
        description: translate("Aktifkan di pengaturan perangkat untuk melanjutkan verifikasi."),
        tone: "danger",
      })
      return
    }
    if (res.status !== "picked") return
    setDocs((d) => (d.length >= MAX_DOCUMENTS ? d : [...d, res.asset]))
  }, [toast.show])

  const removeDoc = useCallback((index: number) => {
    setDocs((d) => {
      const removed = d[index]
      // E-30: aset diganti/dihapus → fileKey lamanya tidak boleh dipakai lagi
      // (kecuali uri yang sama masih ada di posisi lain).
      if (removed && !d.some((x, i) => i !== index && x.uri === removed.uri)) {
        uploadedKeys.current.delete(removed.uri)
      }
      return d.filter((_, i) => i !== index)
    })
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
        title: translate("Verifikasi sedang dikirim"),
        description: translate("Tunggu sampai pengiriman selesai sebelum meninggalkan layar."),
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
        // E-30: aset yang sudah terunggah pada percobaan sebelumnya (submit
        // JSON gagal) tidak diunggah ulang — pakai fileKey tersimpan.
        const cached = uploadedKeys.current.get(img.uri)
        if (cached) {
          documentFileKeys.push(cached)
          continue
        }
        // Self-hosted (2026-09-26): presigned URL dimatikan backend —
        // upload langsung multipart ke POST /v1/upload/direct.
        const { fileKey } = await api.upload.uploadDirectImage(img, "BUSINESS_DOCUMENT")
        uploadedKeys.current.set(img.uri, fileKey)
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
        title: translate("Verifikasi bisnis dikirim"),
        description: translate("Dokumen Anda sedang ditinjau. Kami beri tahu hasilnya lewat notifikasi."),
        tone: "success",
      })
      setFormOpen(false)
      resetForm()
      await query.refresh()
    } catch (err) {
      // Klasifikasi toast: error mutasi non-blokir via showMutationError.
      // Audit 2026-10-09 (F1): describe = uploadMessage — kegagalan UPLOAD
      // dokumen (loop di atas) kini menyebut batas 10 MB / timeout = koneksi
      // lambat / offline terverifikasi; kegagalan submit (JSON) jatuh ke
      // userMessage via fallback internal uploadMessage.
      if (
        showMutationError(toast.show, {
          failTitle: translate("Gagal mengirim verifikasi bisnis"),
          uncertainHint: translate("Aksi mungkin sudah diproses — memuat ulang…"),
          err: err,
          scope: "business-verification:mengirim-verifikasi-bisnis",
          describe: (e) => uploadMessage(e, { purpose: "BUSINESS_DOCUMENT" }),
        })
      ) {
        void query.refresh()
      }
    } finally {
      setSubmitting(false)
    }
  }, [formValid, docs, businessName, npwpNumber, deedNumber, siupNumber, isResubmit, resetForm, query, toast.show])

  const latest = state?.latestRequest ?? null
  const decidedAt = latest?.approvedAt ?? latest?.reviewedAt ?? null

  // E-15: label statis dibangun ulang hanya saat bahasa berganti (pola
  // `defaultLabels()` username-field, di-memo karena dipakai berulang di JSX).
  const L = useMemo(
    () => ({
      screenTitle: translate("Verifikasi Bisnis"),
      loading: translate("Memuat status verifikasi bisnis…"),
      businessName: translate("Nama badan usaha"),
      deedShort: translate("No. akta"),
      siupShort: translate("No. SIUP/NIB"),
      formTitle: translate("Kirim dokumen"),
      formTitleResubmit: translate("Kirim ulang dokumen"),
      formDescription: translate(
        "Foto NPWP, akta pendirian, atau SIUP/NIB. Pastikan terang dan seluruh dokumen terlihat. Kirim minimal 1, maksimal {x} dokumen.",
        { x: MAX_DOCUMENTS },
      ),
      businessNamePlaceholder: translate("Sesuai akta/NPWP"),
      npwp: translate("NPWP badan usaha"),
      npwpHelper: translate("{x}–{y} digit; titik & strip diizinkan.", {
        x: NPWP_DIGITS_MIN,
        y: NPWP_DIGITS_MAX,
      }),
      deed: translate("No. akta pendirian"),
      deedHelper: translate("Isi akta atau SIUP — minimal satu."),
      deedPlaceholder: translate("Opsional bila sudah isi SIUP"),
      siup: translate("No. SIUP / NIB"),
      siupPlaceholder: translate("Opsional bila sudah isi akta"),
      remove: translate("Hapus"),
      addDocument: translate("Tambah dokumen"),
      pickPhoto: translate("Pilih foto (maks {x}MB)", { x: MAX_SIZE_MB }),
      pickDocument: translate("Pilih dokumen"),
      submit: translate("Kirim verifikasi"),
      submitResubmit: translate("Kirim ulang verifikasi"),
      cancel: translate("Batal"),
      historyTitle: translate("Riwayat pengajuan"),
      approvedCaption: translate(
        'Bisnis Anda sudah terverifikasi. Badge "Business Verified" tampil di profil Anda.',
      ),
      discardTitle: translate("Buang isian verifikasi?"),
      discardDescription: translate(
        "Data dan dokumen yang sudah dipilih akan dihapus jika Anda keluar sekarang.",
      ),
      discardConfirm: translate("Buang isian"),
      discardCancel: translate("Lanjutkan mengisi"),
    }),
    // `language` = pemicu rebuild saat bahasa berganti (nilainya tidak dibaca).
    [language],
  )

  return (
    <DataScreen
      title={L.screenTitle}
      keyboardAvoiding
      state={query}
      loadingMessage={L.loading}
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
              <KeyValue label={L.businessName} value={latest.businessName} />
              {latest.deedNumber ? <KeyValue label={L.deedShort} value={latest.deedNumber} /> : null}
              {latest.siupNumber ? <KeyValue label={L.siupShort} value={latest.siupNumber} /> : null}
            </KeyValueList>
          ) : null}

          {canSubmit && formOpen ? (
            <FormSection
              title={isResubmit ? L.formTitleResubmit : L.formTitle}
              description={L.formDescription}
            >
              <Field label={L.businessName} required>
                <Input
                  value={businessName}
                  onChangeText={setBusinessName}
                  returnKeyType="next"
                  // FRM-010: Next memindahkan fokus ke field berikutnya.
                  onSubmitEditing={() => npwpRef.current?.focus()}
                  maxLength={150}
                  placeholder={L.businessNamePlaceholder}
                />
              </Field>
              <Field label={L.npwp} required helperText={L.npwpHelper}>
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
              <Field label={L.deed} helperText={L.deedHelper}>
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
                  placeholder={L.deedPlaceholder}
                />
              </Field>
              <Field label={L.siup}>
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
                  placeholder={L.siupPlaceholder}
                />
              </Field>

              {/* Children campuran tidak diterjemahkan otomatis oleh <Text> —
                  pakai translate() dengan placeholder. */}
              <Text variant="label" tone="secondary">
                {translate("Dokumen ({x}/{y})", { x: docs.length, y: MAX_DOCUMENTS })}
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
                    {L.remove}
                  </Button>
                </View>
              ))}
              {docs.length < MAX_DOCUMENTS ? (
                <UploadField
                  label={L.addDocument}
                  required={docs.length === 0}
                  file={null}
                  status="idle"
                  onPick={() => void pickDoc()}
                  accept={["jpg", "png"]}
                  maxSizeMB={MAX_SIZE_MB}
                  title={L.pickPhoto}
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
                    {L.pickDocument}
                  </Button>
                </View>
              ) : null}

              <Button loading={submitting} disabled={!formValid} onPress={() => void handleSubmit()}>
                {isResubmit ? L.submitResubmit : L.submit}
              </Button>
              <Button
                variant="ghost"
                fullWidth={false}
                disabled={submitting}
                onPress={requestCloseForm}
              >
                {L.cancel}
              </Button>
            </FormSection>
          ) : null}

          {history.length > 0 ? (
            <>
              <SectionHeader title={L.historyTitle} />
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
              {L.approvedCaption}
            </Text>
          ) : null}
      <Dialog
        title={L.discardTitle}
        description={L.discardDescription}
        visible={discardOpen}
        destructive
        confirmLabel={L.discardConfirm}
        cancelLabel={L.discardCancel}
        onConfirm={confirmDiscard}
        onCancel={cancelDiscard}
        onRequestClose={cancelDiscard}
      />
    </DataScreen>
  )
}
