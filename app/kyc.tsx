/**
 * Screen — Verifikasi Identitas (KYC).
 *
 * GET /v1/kyc/status + /v1/kyc/history → kartu status + riwayat.
 * POST /v1/kyc/submit (pertama kali) atau /v1/kyc/resubmit (setelah
 * REJECTED/REVOKED) dengan NIK + fileKey KTP & selfie — upload presigned
 * (purpose KYC_KTP / KYC_SELFIE) lewat `api.upload.uploadPresigned`.
 *
 * Keputusan non-obvious:
 *   - Status dari server dinormalkan `toKycUiStatus()` (lib/api/kyc.ts):
 *     spec tidak mendefinisikan enum, komponen memakai kosakata
 *     NOT_SUBMITTED/APPROVED/REVOKED sementara tipe API memakai
 *     UNSUBMITTED/VERIFIED/EXPIRED.
 *   - Endpoint dipilih dari status: `resubmit` untuk REJECTED/REVOKED,
 *     `submit` untuk NOT_SUBMITTED — memanggil `submit` setelah penolakan
 *     ditolak backend.
 *   - Form tidak selalu terbuka: tombol "Ajukan"/"Kirim ulang" di kartu yang
 *     membukanya (`onSubmit`/`onResubmit`). Sebelumnya kedua callback no-op.
 *   - Metadata berkas (`size`, `mimeType`) diambil dari asset picker (lib/
 *     image-picker) — bukan `size: 0` / "image/jpeg" tebakan — supaya
 *     <UploadField> bisa menampilkan ukuran & menolak berkas > maxSizeMB
 *     SEBELUM upload.
 *   - Selfie dibuka lewat kamera depan (bukan galeri): tujuan selfie-dengan-
 *     KTP adalah bukti kepemilikan langsung; galeri tetap tersedia sebagai
 *     fallback bila izin kamera ditolak.
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { api, userMessage } from "@/lib/api"
import { toKycUiStatus, type KycHistoryEntry, type KycState } from "@/lib/api/kyc"
import type { PresignedUrlDto } from "@/lib/api/types"
import { formatDateTime } from "@/lib/format"
import {
  pickImage,
  pickedImageToBlob,
  type PickedImage,
  type PickImageOptions,
} from "@/lib/image-picker"
import { tokens } from "@/lib/tokens"

import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/ui/error-state"
import { Field } from "@/components/ui/field"
import { FormSection } from "@/components/ui/form-section"
import { Header } from "@/components/ui/header"
import { Input } from "@/components/ui/input"
import { KeyValue, KeyValueList } from "@/components/ui/key-value"
import { KycHistoryListItem } from "@/components/ui/kyc-history-list-item"
import { KycStatusCard } from "@/components/ui/kyc-status-card"
import { DetailLoading } from "@/components/ui/paginated-list"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"
import { UploadField, type UploadStatus } from "@/components/ui/upload-field"

/** Panjang NIK KTP Indonesia (SubmitKycDto.nik). */
const NIK_LENGTH = 16
/** KTP: lanskap 3:2 seperti kartu fisik; selfie tanpa crop paksa. */
const KTP_PICKER: PickImageOptions = { allowsEditing: true }
const SELFIE_PICKER: PickImageOptions = { source: "camera" }
/** Batas riwayat yang ditampilkan (limit maks spec 100). */
const HISTORY_LIMIT = 20

type DocKey = "ktp" | "selfie"

export default function KycScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [state, setState] = useState<KycState | null>(null)
  const [history, setHistory] = useState<KycHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [nik, setNik] = useState("")
  const [ktp, setKtp] = useState<PickedImage | null>(null)
  const [selfie, setSelfie] = useState<PickedImage | null>(null)
  const [uploadStatus, setUploadStatus] = useState<Record<DocKey, UploadStatus>>({
    ktp: "idle",
    selfie: "idle",
  })
  const [submitting, setSubmitting] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [s, h] = await Promise.all([
        api.kyc.getKycStatus(),
        api.kyc.getKycHistory({ page: 1, limit: HISTORY_LIMIT }).catch(() => []),
      ])
      setState(s)
      setHistory(h ?? [])
    } catch (err) {
      setError(userMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchAll()
    setRefreshing(false)
  }, [fetchAll])

  const uiStatus = toKycUiStatus(state?.status)
  const isResubmit = uiStatus === "REJECTED" || uiStatus === "REVOKED"
  const canSubmit = uiStatus === "NOT_SUBMITTED" || isResubmit

  const resetForm = useCallback(() => {
    setNik("")
    setKtp(null)
    setSelfie(null)
    setUploadStatus({ ktp: "idle", selfie: "idle" })
  }, [])

  const openForm = useCallback(() => {
    resetForm()
    setFormOpen(true)
  }, [resetForm])

  const pickDoc = useCallback(
    async (key: DocKey, opts: PickImageOptions) => {
      const res = await pickImage(opts)
      if (res.status === "denied") {
        // Selfie: izin kamera ditolak → tawarkan galeri sebagai fallback
        if (opts.source === "camera") {
          const fallback = await pickImage({ ...opts, source: "library" })
          if (fallback.status === "picked") {
            setSelfie(fallback.asset)
            setUploadStatus((u) => ({ ...u, selfie: "done" }))
            return
          }
          if (fallback.status === "cancelled") return
        }
        toast.show({
          title: opts.source === "camera" ? "Izin kamera ditolak" : "Izin galeri ditolak",
          description: "Aktifkan di pengaturan perangkat untuk melanjutkan verifikasi.",
          tone: "danger",
        })
        return
      }
      if (res.status !== "picked") return
      if (key === "ktp") setKtp(res.asset)
      else setSelfie(res.asset)
      setUploadStatus((u) => ({ ...u, [key]: "done" }))
    },
    [toast.show],
  )

  const uploadDoc = useCallback(
    async (key: DocKey, purpose: PresignedUrlDto["purpose"], img: PickedImage): Promise<string> => {
      setUploadStatus((u) => ({ ...u, [key]: "uploading" }))
      try {
        const blob = await pickedImageToBlob(img)
        const { fileKey } = await api.upload.uploadPresigned(purpose, img.name, img.mimeType, blob)
        setUploadStatus((u) => ({ ...u, [key]: "done" }))
        return fileKey
      } catch (err) {
        setUploadStatus((u) => ({ ...u, [key]: "error" }))
        throw err
      }
    },
    [],
  )

  const formValid = !!ktp && !!selfie && nik.length === NIK_LENGTH

  const handleSubmit = useCallback(async () => {
    if (!ktp || !selfie || !formValid) return
    setSubmitting(true)
    try {
      const [ktpFileKey, selfieFileKey] = await Promise.all([
        uploadDoc("ktp", "KYC_KTP", ktp),
        uploadDoc("selfie", "KYC_SELFIE", selfie),
      ])
      const dto = { ktpFileKey, selfieFileKey, nik }
      if (isResubmit) await api.kyc.resubmitKyc(dto)
      else await api.kyc.submitKyc(dto)
      toast.show({
        title: "Verifikasi dikirim",
        description: "Dokumen Anda sedang ditinjau. Kami beri tahu hasilnya lewat notifikasi.",
        tone: "success",
      })
      setFormOpen(false)
      resetForm()
      await fetchAll()
    } catch {
      toast.show({
        title: "Gagal mengirim verifikasi",
        description: "Periksa koneksi dan pastikan foto jelas, lalu coba lagi.",
        tone: "danger",
      })
    } finally {
      setSubmitting(false)
    }
  }, [ktp, selfie, nik, formValid, isResubmit, uploadDoc, resetForm, fetchAll, toast.show])

  return (
    <Screen keyboardAvoiding edges={["top"]} padded={false}>
      <Header title="Verifikasi Identitas" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
          keyboardShouldPersistTaps: "handled",
        }}
      >
        <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
          {loading ? (
            // Isi layar ini = satu KycStatusCard + (opsional) form, bukan
            // daftar kartu: <ListLoading> (4 kartu) membuat tinggi menyusut
            // drastis saat data tiba.
            <DetailLoading />
          ) : error ? (
            <ErrorState title="Gagal memuat" description={error} onRetry={() => void fetchAll()} />
          ) : (
            <>
              <KycStatusCard
                status={uiStatus}
                rejectionReason={state?.rejectionReason ?? undefined}
                submittedAt={state?.submittedAt ? formatDateTime(state.submittedAt) : undefined}
                approvedAt={
                  uiStatus === "APPROVED" && state?.reviewedAt
                    ? formatDateTime(state.reviewedAt)
                    : undefined
                }
                onSubmit={canSubmit && !formOpen ? openForm : undefined}
                onResubmit={canSubmit && !formOpen ? openForm : undefined}
              />

              {uiStatus === "APPROVED" && (state?.fullName || state?.nikMasked) ? (
                <KeyValueList>
                  {state.fullName ? <KeyValue label="Nama" value={state.fullName} /> : null}
                  {state.nikMasked ? <KeyValue label="NIK" value={state.nikMasked} mono /> : null}
                </KeyValueList>
              ) : null}

              {canSubmit && formOpen ? (
                <FormSection
                  title={isResubmit ? "Kirim ulang dokumen" : "Kirim dokumen"}
                  description={`NIK harus ${NIK_LENGTH} digit sesuai KTP. Pastikan foto terang dan seluruh kartu terlihat.`}
                >
                  <Field label="NIK" required>
                    <Input
                      value={nik}
                      onChangeText={(t) => setNik(t.replace(/\D/g, "").slice(0, NIK_LENGTH))}
                      keyboardType="number-pad"
                      maxLength={NIK_LENGTH}
                      placeholder={`${NIK_LENGTH} digit`}
                    />
                  </Field>
                  <View className="gap-2">
                    <UploadField
                      label="Foto KTP"
                      required
                      file={ktp}
                      status={uploadStatus.ktp}
                      onPick={() => void pickDoc("ktp", KTP_PICKER)}
                      onRemove={() => {
                        setKtp(null)
                        setUploadStatus((u) => ({ ...u, ktp: "idle" }))
                      }}
                      onRetry={() => void pickDoc("ktp", KTP_PICKER)}
                      accept={["jpg", "png"]}
                      disabled={submitting}
                    />
                    <UploadField
                      label="Selfie dengan KTP"
                      required
                      helperText="Pegang KTP di samping wajah; jangan tertutup jari."
                      file={selfie}
                      status={uploadStatus.selfie}
                      onPick={() => void pickDoc("selfie", SELFIE_PICKER)}
                      onRemove={() => {
                        setSelfie(null)
                        setUploadStatus((u) => ({ ...u, selfie: "idle" }))
                      }}
                      onRetry={() => void pickDoc("selfie", SELFIE_PICKER)}
                      accept={["jpg", "png"]}
                      disabled={submitting}
                    />
                  </View>
                  <Button
                    loading={submitting}
                    disabled={!formValid}
                    onPress={() => void handleSubmit()}
                  >
                    {isResubmit ? "Kirim Ulang Verifikasi" : "Kirim Verifikasi"}
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
                      key={h.id}
                      attempt={history.length - i}
                      status={toKycUiStatus(h.status)}
                      submittedAt={formatDateTime(h.submittedAt)}
                      reviewedAt={h.reviewedAt ? formatDateTime(h.reviewedAt) : undefined}
                      rejectionReason={h.rejectionReason ?? undefined}
                      requestId={h.id}
                    />
                  ))}
                </>
              ) : null}

              {uiStatus === "APPROVED" ? (
                <Text variant="caption" tone="secondary">
                  Akun Anda sudah terverifikasi. Anda bisa bertransaksi tanpa batasan tambahan.
                </Text>
              ) : null}
            </>
          )}
        </View>
      </PullToRefresh>
    </Screen>
  )
}
