/**
 * Screen — Verifikasi Identitas (KYC).
 *
 * GET /v1/kyc/status + /v1/kyc/history → kartu status + riwayat.
 * Submit/resubmit POST /v1/kyc/submit|resubmit dengan NIK + fileKey
 * KTP & selfie (upload presigned: purpose KYC_KTP / KYC_SELFIE).
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Fingerprint } from "phosphor-react-native"
import * as ImagePicker from "expo-image-picker"

import { api } from "@/lib/api"
import type { KycState, KycHistoryEntry } from "@/lib/api/kyc"
import type { PresignedUrlDto } from "@/lib/api/types"
import { formatDateTime } from "@/lib/format"
import { tokens } from "@/lib/tokens"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Field } from "@/components/ui/field"
import { FormSection } from "@/components/ui/form-section"
import { Header } from "@/components/ui/header"
import { Input } from "@/components/ui/input"
import { KycHistoryListItem } from "@/components/ui/kyc-history-list-item"
import { KycStatusCard } from "@/components/ui/kyc-status-card"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"
import { UploadField, type UploadFile } from "@/components/ui/upload-field"

async function pickImage(): Promise<ImagePicker.ImagePickerAsset | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!perm.granted) return null
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [3, 2],
    quality: 0.7,
  })
  return res.canceled ? null : res.assets[0]
}

export default function KycScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [state, setState] = useState<KycState | null>(null)
  const [history, setHistory] = useState<KycHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const [nik, setNik] = useState("")
  const [ktp, setKtp] = useState<string | null>(null)
  const [selfie, setSelfie] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [s, h] = await Promise.all([api.kyc.getKycStatus(), api.kyc.getKycHistory()])
      setState(s)
      setHistory(h ?? [])
    } catch {
      setError("Gagal memuat status verifikasi.")
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

  const handlePickKtp = useCallback(async () => {
    const asset = await pickImage()
    if (asset) setKtp(asset.uri)
  }, [])

  const handlePickSelfie = useCallback(async () => {
    const asset = await pickImage()
    if (asset) setSelfie(asset.uri)
  }, [])

  const handleUpload = useCallback(
    async (purpose: PresignedUrlDto["purpose"], uri: string): Promise<string> => {
      const name = uri.split("/").pop() ?? "upload.jpg"
      const res = await fetch(uri)
      const blob = await res.blob()
      const contentType = blob.type || "image/jpeg"
      const { fileKey } = await api.upload.uploadPresigned(purpose, name, contentType, blob)
      return fileKey
    },
    [],
  )

  const handleSubmit = useCallback(async () => {
    if (!ktp || !selfie || nik.length !== 16) return
    setSubmitting(true)
    try {
      const [ktpKey, selfieKey] = await Promise.all([
        handleUpload("KYC_KTP", ktp),
        handleUpload("KYC_SELFIE", selfie),
      ])
      const dto = { ktpFileKey: ktpKey, selfieFileKey: selfieKey, nik }
      await api.kyc.submitKyc(dto)
      toast.show({ title: "Verifikasi dikirim", description: "Dokumen Anda sedang ditinjau.", tone: "success", duration: 4000 })
      setKtp(null)
      setSelfie(null)
      setNik("")
      await fetchAll()
    } catch {
      toast.show({ title: "Gagal mengirim verifikasi", tone: "danger" })
    } finally {
      setSubmitting(false)
    }
  }, [ktp, selfie, nik, handleUpload, toast.show, fetchAll])

  const canSubmit = state?.status === "UNSUBMITTED" || state?.status === "REJECTED"

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Verifikasi Identitas" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{ style: { paddingBottom: insets.bottom + tokens.space[8] } }}
      >
        <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
          {loading ? (
            <EmptyState icon={Fingerprint} title="Memuat status verifikasi…" />
          ) : error ? (
            <ErrorState title="Gagal memuat" description={error} onRetry={() => void fetchAll()} />
          ) : (
            <>
              <KycStatusCard
                status={state?.status ?? "UNSUBMITTED"}
                rejectionReason={state?.rejectionReason ?? undefined}
                submittedAt={state?.submittedAt ? formatDateTime(state.submittedAt) : undefined}
                approvedAt={state?.reviewedAt ? formatDateTime(state.reviewedAt) : undefined}
                onSubmit={canSubmit ? () => setKtp(null) : undefined}
                onResubmit={canSubmit ? () => setKtp(null) : undefined}
              />

              {canSubmit ? (
                <FormSection title="Kirim dokumen" description="NIK harus 16 digit sesuai KTP.">
                  <Field label="NIK" required>
                    <Input
                      value={nik}
                      onChangeText={(t) => setNik(t.replace(/\D/g, ""))}
                      keyboardType="number-pad"
                      maxLength={16}
                      placeholder="16 digit"
                    />
                  </Field>
                  <View className="gap-2">
                    <UploadField
                      label="Foto KTP"
                      file={
                        ktp
                          ? {
                              name: ktp.split("/").pop() ?? "ktp.jpg",
                              size: 0,
                              mimeType: "image/jpeg",
                              uri: ktp,
                            }
                          : null
                      }
                      status={ktp ? "done" : "idle"}
                      onPick={() => void handlePickKtp()}
                      onRemove={() => setKtp(null)}
                    />
                    <UploadField
                      label="Selfie dengan KTP"
                      file={
                        selfie
                          ? {
                              name: "selfie.jpg",
                              size: 0,
                              mimeType: "image/jpeg",
                              uri: selfie,
                            }
                          : null
                      }
                      status={selfie ? "done" : "idle"}
                      onPick={() => void handlePickSelfie()}
                      onRemove={() => setSelfie(null)}
                    />
                  </View>
                  <Button
                    loading={submitting}
                    disabled={!ktp || !selfie || nik.length !== 16}
                    onPress={() => void handleSubmit()}
                  >
                    Kirim Verifikasi
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
                      status={h.status}
                      submittedAt={formatDateTime(h.submittedAt)}
                      reviewedAt={h.reviewedAt ? formatDateTime(h.reviewedAt) : undefined}
                      rejectionReason={h.rejectionReason ?? undefined}
                      requestId={h.id}
                    />
                  ))}
                </>
              ) : null}

              {state?.status === "VERIFIED" ? (
                <Text variant="body" tone="secondary">
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
