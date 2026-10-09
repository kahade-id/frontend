/**
 * Screen — Verifikasi Identitas (KYC).
 *
 * GET /v1/kyc/status + /v1/kyc/history → kartu status + riwayat.
 * POST /v1/kyc/submit (pertama kali) atau /v1/kyc/resubmit (setelah
 * REJECTED/REVOKED) dengan NIK + fileKey KTP & selfie — upload langsung
 * (purpose KYC_KTP / KYC_SELFIE) lewat `api.upload.uploadDirectImage`
 * (self-hosted storage, 2026-09-26; presigned URL sudah dimatikan backend).
 *
 * Keputusan non-obvious:
 *   - Status dari server dinormalkan `toKycUiStatus()` (lib/api/kyc.ts):
 *     tipe API memakai kosakata resmi backend
 *     (UNVERIFIED/PENDING/APPROVED/REJECTED/REVOKED) dan dipetakan ke
 *     kosakata UI (NOT_SUBMITTED/PENDING/APPROVED/REJECTED/REVOKED).
 *     Nilai lama (UNSUBMITTED/VERIFIED/EXPIRED) tak pernah dikirim backend —
 *     ESI-005 audit integrasi 2026-09-30.
 *   - Endpoint dipilih dari status: `resubmit` HANYA untuk REJECTED,
 *     `submit` untuk NOT_SUBMITTED. REVOKED tidak bisa submit/resubmit
 *     (backend 403 KYC_REVOKED) — user diarahkan hubungi dukungan, bukan
 *     memanggil endpoint yang pasti ditolak backend.
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
import { useCallback, useRef, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { api } from "@/lib/api"
import { toKycUiStatus, type KycHistoryEntry, type KycState } from "@/lib/api/kyc"
import { formatDateTime } from "@/lib/format"
import { logWarn } from "@/lib/telemetry"
// D-08 (audit): validasi STRUKTUR NIK (kode wilayah, tanggal lahir terkode
// +40 perempuan, nomor urut) — sebelumnya hanya panjang 16 digit sehingga
// NIK mustahil (mis. digit tanggal 99) lolos ke antrian review backend.
import { NIK_LENGTH, nikRejectionMessage, validateNikStructure } from "@/lib/nik"
import {
  pickImage,
  type PickedImage,
  type PickImageOptions,
} from "@/lib/image-picker"
import { tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"

import { Button } from "@/components/ui/button"
import { ErrorState } from "@/components/ui/error-state"
import { Crossfade } from "@/components/ui/fade-in"
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
import { UploadField, validateUploadFile, type UploadStatus } from "@/components/ui/upload-field"
import { translate } from "@/lib/i18n/translate"
import { showMutationError } from "@/lib/mutation-toast"
import { uploadMessage } from "@/lib/upload-errors"


/** KTP: lanskap 3:2 seperti kartu fisik; selfie tanpa crop paksa. */
const KTP_PICKER: PickImageOptions = { allowsEditing: true }
const SELFIE_PICKER: PickImageOptions = { source: "camera" }
/** Batas riwayat yang ditampilkan (limit maks spec 100). */
const HISTORY_LIMIT = 20
/**
 * UMD-003: batas ukuran dokumen KYC = 5 MB, samakan dengan backend
 * (`MAX_FILE_SIZE[KYC_KTP/KYC_SELFIE] = 5 MiB`). UploadField menampilkan
 * "maks 5 MB" via prop maxSizeMB; validasi dini di pickDoc menolak berkas
 * kebesaran SEBELUM upload (sebelumnya 6–10 MB terunggah penuh baru gagal
 * di server dengan pesan Inggris generik).
 */
const KYC_DOC_MAX_MB = 5
const KYC_DOC_ACCEPT = ["jpg", "png"] as const

type DocKey = "ktp" | "selfie"

export default function KycScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()

  /**
   * Audit: state async dirakit manual. Cacat terbukti dari kode lama:
   * `handleRefresh` memanggil `fetchAll()` yang sama dengan muat-awal, dan
   * fungsi itu membuka dengan `setLoading(true)` — tarik-untuk-menyegarkan
   * mengganti status KYC + riwayat dengan kerangka. Request juga tidak
   * dibatalkan saat layar ditutup.
   *
   * `.catch(() => [])` pada riwayat DIPERTAHANKAN: riwayat yang gagal diambil
   * tidak boleh mematikan status KYC yang merupakan isi utama layar.
   */
  const query = useApiQuery<{ state: KycState; history: KycHistoryEntry[] }>(
    "kyc",
    async (signal) => {
      const [s, h] = await Promise.all([
        api.kyc.getKycStatus(signal),
        api.kyc.getKycHistory({ page: 1, limit: HISTORY_LIMIT }, signal).catch(() => []),
      ])
      return { state: s, history: h ?? [] }
    },
  )
  const state = query.data?.state ?? null
  const history = query.data?.history ?? []
  const { loading, error, refreshing } = query

  const [formOpen, setFormOpen] = useState(false)
  const [nik, setNik] = useState("")
  const [ktp, setKtp] = useState<PickedImage | null>(null)
  const [selfie, setSelfie] = useState<PickedImage | null>(null)
  const [uploadStatus, setUploadStatus] = useState<Record<DocKey, UploadStatus>>({
    ktp: "idle",
    selfie: "idle",
  })
  const [submitting, setSubmitting] = useState(false)
  /**
   * Audit 2026-10-09 (E2): fileKey sukses per dokumen — DIKUNCI saat submit
   * agar percobaan berikutnya TIDAK mengunggah ulang dokumen yang sudah
   * sukses (dulu: satu gagal → semua kunci dibersihkan G-04 → submit ulang
   * = KEDUA dokumen diunggah ulang dari nol, buang kuota + waktu di 4G).
   * Identitas aset = `uri` (pick baru = uri baru → cache tidak berlaku).
   * Kunci yang di-invalidate (dokumen diganti / form dibuka ulang)
   * dibersihkan best-effort — di situlah kewajiban G-04 kini dijalankan.
   */
  const uploadedFileKeysRef = useRef<Partial<Record<DocKey, { uri: string; fileKey: string }>>>({})



  const uiStatus = toKycUiStatus(state?.status)
  // REVOKED: backend menolak submit & resubmit (403 KYC_REVOKED) — pencabutan
  // hanya bisa dibuka lewat dukungan. Menampilkan tombol "Kirim ulang" di
  // sini adalah jalan buntu yang pasti gagal, jadi CTA disembunyikan dan
  // deskripsi diganti panduan hubungi dukungan.
  const isResubmit = uiStatus === "REJECTED"
  const canSubmit = uiStatus === "NOT_SUBMITTED" || isResubmit
  const revokedLabels =
    uiStatus === "REVOKED"
      ? {
          descriptions: {
            REVOKED:
              "Verifikasi Anda dicabut oleh tim kami. Untuk mengaktifkan kembali, hubungi dukungan melalui menu Bantuan.",
          },
        }
      : undefined

  const resetForm = useCallback(() => {
    setNik("")
    setKtp(null)
    setSelfie(null)
    setUploadStatus({ ktp: "idle", selfie: "idle" })
    // Audit 2026-10-09 (E2): cache fileKey ikut dibuang — pembersihan
    // (cleanup) kunci tak terpakai adalah tanggung jawab titik invalidasi
    // (openForm / pickDoc), bukan di sini.
    uploadedFileKeysRef.current = {}
  }, [])

  const openForm = useCallback(() => {
    // Audit 2026-10-09 (E2): kunci percobaan lama yang TIDAK terpakai
    // (submit gagal/ditolak) dibersihkan best-effort di titik invalidasi —
    // di situlah kewajiban G-04 dijalankan (bukan setelah tiap submit gagal,
    // yang justru memaksa kedua dokumen diunggah ulang — butir E2).
    const stale = Object.values(uploadedFileKeysRef.current)
      .map((e) => e?.fileKey)
      .filter((k): k is string => Boolean(k))
    if (stale.length > 0) {
      api.upload
        .cleanupUploads(stale)
        .catch((cleanupErr: unknown) => logWarn("kyc:cleanup", cleanupErr))
    }
    resetForm()
    setFormOpen(true)
  }, [resetForm])

  /**
   * Audit 2026-10-09 (E2): dokumen baru dipilih → fileKey lama untuk slot ini
   * tak terpakai lagi: keluarkan dari cache + bersihkan best-effort (G-04).
   */
  const invalidateDocKey = useCallback((key: DocKey) => {
    const cached = uploadedFileKeysRef.current[key]
    if (!cached) return
    uploadedFileKeysRef.current = { ...uploadedFileKeysRef.current, [key]: undefined }
    api.upload
      .cleanupUploads([cached.fileKey])
      .catch((cleanupErr: unknown) => logWarn("kyc:cleanup", cleanupErr))
  }, [])

  const pickDoc = useCallback(
    async (key: DocKey, opts: PickImageOptions) => {
      const res = await pickImage(opts)
      if (res.status === "denied") {
        // Selfie: izin kamera ditolak → tawarkan galeri sebagai fallback
        if (opts.source === "camera") {
          const fallback = await pickImage({ ...opts, source: "library" })
          if (fallback.status === "picked") {
            const fallbackError = validateUploadFile(fallback.asset, {
              accept: KYC_DOC_ACCEPT,
              maxSizeMB: KYC_DOC_MAX_MB,
            })
            if (fallbackError) {
              toast.show({ title: "Berkas tidak valid", description: fallbackError, tone: "danger" })
              return
            }
            invalidateDocKey("selfie")
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
      // UMD-003: guard klien sebelum upload — tolak format/ukuran salah dengan
      // pesan Indonesia, jangan biarkan terunggah penuh baru gagal di server.
      const validationError = validateUploadFile(res.asset, {
        accept: KYC_DOC_ACCEPT,
        maxSizeMB: KYC_DOC_MAX_MB,
      })
      if (validationError) {
        // Klasifikasi toast: KEEP manual — validasi klien pra-unggah (bukan
        // error mutasi server).
        toast.show({ title: "Berkas tidak valid", description: validationError, tone: "danger" })
        return
      }
      invalidateDocKey(key)
      if (key === "ktp") setKtp(res.asset)
      else setSelfie(res.asset)
      setUploadStatus((u) => ({ ...u, [key]: "done" }))
    },
    [toast.show, invalidateDocKey],
  )

  const uploadDoc = useCallback(
    async (key: DocKey, purpose: string, img: PickedImage): Promise<string> => {
      // Audit 2026-10-09 (E2): REUSE fileKey sukses bila aset tak berubah
      // (uri sama) — submit ulang hanya mengunggah dokumen yang GAGAL/GANTI,
      // bukan keduanya dari nol (dulu buang kuota + menit di 4G).
      const cached = uploadedFileKeysRef.current[key]
      if (cached && cached.uri === img.uri) {
        setUploadStatus((u) => ({ ...u, [key]: "done" }))
        return cached.fileKey
      }
      setUploadStatus((u) => ({ ...u, [key]: "uploading" }))
      try {
        // Self-hosted (2026-09-26): presigned URL dimatikan backend —
        // upload langsung multipart ke POST /v1/upload/direct.
        const { fileKey } = await api.upload.uploadDirectImage(img, purpose)
        // Kunci sukses masuk cache — dipakai ulang bila percobaan ini gagal
        // di dokumen saudara atau di submit-nya (invalidasi = pick/reset).
        uploadedFileKeysRef.current = {
          ...uploadedFileKeysRef.current,
          [key]: { uri: img.uri, fileKey },
        }
        setUploadStatus((u) => ({ ...u, [key]: "done" }))
        return fileKey
      } catch (err) {
        setUploadStatus((u) => ({ ...u, [key]: "error" }))
        throw err
      }
    },
    [],
  )

  /**
   * Validasi struktur hanya dinilai saat 16 digit sudah terisi — selama
   * mengetik, error tidak boleh berkedip lebih dulu.
   */
  const nikCheck = nik.length === NIK_LENGTH ? validateNikStructure(nik) : null
  const nikError =
    nikCheck && !nikCheck.valid && nikCheck.reason
      ? nikRejectionMessage(nikCheck.reason)
      : undefined

  const formValid = !!ktp && !!selfie && nikCheck?.valid === true

  const handleSubmit = useCallback(async () => {
    if (!ktp || !selfie || !formValid) return
    setSubmitting(true)
    /**
     * Audit 2026-10-09 (E2) — perubahan model G-04: kunci yang sukses TIDAK
     * lagi dibersihkan setelah tiap submit gagal (itu yang memaksa KEDUA
     * dokumen diunggah ulang dari nol). Kunci sukses hidup di
     * `uploadedFileKeysRef` dan DIKUNCI percobaan berikutnya; pembersihan
     * best-effort (G-04) dijalankan di titik invalidasi: dokumen diganti
     * (`invalidateDocKey`) atau form dibuka ulang (`openForm`).
     * `allSettled` (bukan `all`) supaya kegagalan dokumen pertama tetap
     * terlihat walau yang kedua juga gagal.
     */
    try {
      const [ktpRes, selfieRes] = await Promise.allSettled([
        uploadDoc("ktp", "KYC_KTP", ktp),
        uploadDoc("selfie", "KYC_SELFIE", selfie),
      ])
      if (ktpRes.status === "rejected") throw ktpRes.reason
      if (selfieRes.status === "rejected") throw selfieRes.reason
      const dto = { ktpFileKey: ktpRes.value, selfieFileKey: selfieRes.value, nik }
      if (isResubmit) await api.kyc.resubmitKyc(dto)
      else await api.kyc.submitKyc(dto)
      toast.show({
        title: "Verifikasi dikirim",
        description: "Dokumen Anda sedang ditinjau. Kami beri tahu hasilnya lewat notifikasi.",
        tone: "success",
      })
      // Kunci kini DIPAKAI oleh submission — keluar dari cache tanpa
      // cleanup (file sudah live; cleanup di sini akan menghapusnya).
      uploadedFileKeysRef.current = {}
      setFormOpen(false)
      resetForm()
      await query.refresh()
    } catch (err: unknown) {
      // Klasifikasi toast: error mutasi non-blokir via showMutationError.
      // Audit 2026-10-09 (F1): describe = uploadMessage — kegagalan UPLOAD
      // dokumen menyebut "maks 5 MB" (KTP & selfie sama 5 MB), timeout =
      // koneksi lambat, offline hanya terverifikasi; kegagalan submit (JSON)
      // jatuh ke userMessage via fallback internal uploadMessage.
      if (
        showMutationError(toast.show, {
          failTitle: "Gagal mengirim verifikasi",
          uncertainHint: "Aksi mungkin sudah diproses — memuat ulang…",
          err: err,
          scope: "kyc:mengirim-verifikasi",
          describe: (e) => uploadMessage(e, { purpose: "KYC_KTP" }),
        })
      ) {
        void query.refresh()
      }
    } finally {
      setSubmitting(false)
    }
  }, [ktp, selfie, nik, formValid, isResubmit, uploadDoc, resetForm, query, toast.show])

  return (
    <Screen keyboardAvoiding edges={["top"]} padded={false}>
      <Header title="Verifikasi Identitas" />
      <PullToRefresh
        onRefresh={() => void query.refresh()}
        refreshing={refreshing}
        contentContainerClassName="px-5"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
          keyboardShouldPersistTaps: "handled",
        }}
      >
        <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
          {/* v2: skeleton → status crossfade (signature moment); skeleton
              sebentuk kartu detail dipertahankan agar tinggi tidak melompat. */}
          <Crossfade
            loading={loading}
            skeleton={
              // Isi layar ini = satu KycStatusCard + (opsional) form, bukan
              // daftar kartu: <ListLoading> (4 kartu) membuat tinggi menyusut
              // drastis saat data tiba.
              <DetailLoading />
            }
          >
            {error ? (
            <ErrorState title="Gagal memuat" description={error} onRetry={() => void query.reload()} />
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
                labels={revokedLabels}
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
                  description={translate(
                    "NIK harus {x} digit sesuai KTP. Pastikan foto terang dan seluruh kartu terlihat.",
                    { x: NIK_LENGTH },
                  )}
                >
                  <Field label="NIK" required>
                    <Input
                      value={nik}
                      onChangeText={(t) => setNik(t.replace(/\D/g, "").slice(0, NIK_LENGTH))}
                      keyboardType="number-pad"
                      returnKeyType="done"
                      maxLength={NIK_LENGTH}
                      placeholder={translate("{x} digit", { x: NIK_LENGTH })}
                      errorText={nikError}
                      accessibilityLabel="NIK 16 digit sesuai KTP"
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
                      maxSizeMB={KYC_DOC_MAX_MB}
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
                      maxSizeMB={KYC_DOC_MAX_MB}
                      disabled={submitting}
                    />
                  </View>
                  <Button
                    loading={submitting}
                    disabled={!formValid}
                    onPress={() => void handleSubmit()}
                  >
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
          </Crossfade>
        </View>
      </PullToRefresh>
    </Screen>
  )
}
