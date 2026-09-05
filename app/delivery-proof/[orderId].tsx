import { DetailLoading } from "@/components/ui/paginated-list"
/**
 * Screen — Bukti pengiriman satu pesanan.
 *
 * GET  /v1/orders/{orderId} + /delivery-proof (daftar bukti)
 * POST /v1/orders/{orderId}/delivery-proof          (penjual: kirim bukti)
 * PUT  /v1/orders/{orderId}/shipping                (penjual: resi/kurir)
 * POST /v1/orders/{orderId}/confirm-delivery|reject-delivery (pembeli)
 *
 * Dua sisi dalam satu route (peran dari `order.myRole`):
 *   - PENJUAL : <DeliveryProofForm> — unggah foto (galeri → presigned upload
 *               DELIVERY_PROOF) + resi opsional + catatan → submit. Resi
 *               dikirim terpisah lewat `updateShipping` (DTO bukti tidak
 *               punya field resi) hanya bila diisi; kegagalan resi tidak
 *               membatalkan bukti yang sudah terkirim (toast peringatan).
 *               Bukti yang sudah ada tetap tampil di bawah sebagai riwayat.
 *   - PEMBELI : <DeliveryProofViewer> bukti terbaru — konfirmasi (Dialog)
 *               atau tolak dengan alasan (membuka sengketa).
 *
 * Keputusan non-obvious:
 *   - Pratinjau lampiran memakai <MediaViewer> (sebelumnya toast stub).
 *   - `fileUrls` di DTO adalah S3 object key (hasil presigned upload), bukan
 *     URL publik — respons GET mengembalikan URL siap tampil.
 *   - Form penjual disembunyikan bila bukti terakhir sudah CONFIRMED (order
 *     selesai) — tidak ada alasan mengirim bukti lagi.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { View } from "react-native"
import { useLocalSearchParams } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Package } from "phosphor-react-native"

import { api, isApiError, userMessage, type Order } from "@/lib/api"
import type { DeliveryProof } from "@/lib/api/orders"
import { pickImage, pickedImageToBlob } from "@/lib/image-picker"
import { formatDateTime } from "@/lib/format"
import { tokens } from "@/lib/tokens"

import { DeliveryProofForm, type DeliveryProofFormValue } from "@/components/ui/delivery-proof"
import {
  DeliveryProofViewer,
  type DeliveryProofAttachment,
  type DeliveryProofStatus,
} from "@/components/ui/delivery-proof-viewer"
import { Dialog } from "@/components/ui/modal"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import type { EvidenceItem } from "@/components/ui/evidence-grid"
import { Header } from "@/components/ui/header"
import { MediaViewer, fileNameFromUrl, type MediaViewerItem } from "@/components/ui/media-viewer"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { useToast } from "@/components/ui/toast"

const MAX_PROOF_FILES = 10
const MIN_DESCRIPTION = 10
const FALLBACK_FILE_NAME = "bukti.pdf"

/** Lampiran lokal yang sudah terunggah (key S3 untuk DTO, uri lokal untuk pratinjau). */
type UploadedProof = EvidenceItem & { fileKey: string }

function toStatus(status: string): DeliveryProofStatus {
  if (status === "CONFIRMED") return "confirmed"
  if (status === "REJECTED") return "rejected"
  return "pending"
}

function toAttachments(p: DeliveryProof): DeliveryProofAttachment[] {
  const imgs: DeliveryProofAttachment[] = (p.fileUrls ?? []).map((uri) => ({ kind: "image", uri }))
  const pdfs: DeliveryProofAttachment[] = (p.linkUrls ?? []).map((uri) => ({
    kind: "pdf",
    uri,
    name: fileNameFromUrl(uri, FALLBACK_FILE_NAME),
  }))
  return [...imgs, ...pdfs]
}

export default function DeliveryProofScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>()
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [order, setOrder] = useState<Order | null>(null)
  const [proofs, setProofs] = useState<DeliveryProof[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [viewerItem, setViewerItem] = useState<MediaViewerItem | null>(null)

  // Sisi penjual
  const [uploads, setUploads] = useState<UploadedProof[]>([])
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState<DeliveryProofFormValue>({ trackingNumber: "", note: "" })
  const [submitting, setSubmitting] = useState(false)

  const latest = useMemo(() => {
    if (proofs.length === 0) return null
    return [...proofs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0]
  }, [proofs])

  const isSeller = order?.myRole === "SELLER"
  const sellerName = order ? (order.seller.fullName ?? order.seller.username) : undefined
  const attachments = useMemo(() => (latest ? toAttachments(latest) : []), [latest])

  const fetchAll = useCallback(async () => {
    if (!orderId) return
    setLoading(true)
    setError(null)
    try {
      const [o, ps] = await Promise.all([
        api.orders.getOrder(orderId),
        api.orders.listDeliveryProofs(orderId),
      ])
      setOrder(o ?? null)
      setProofs(ps ?? [])
      setForm((f) => ({ ...f, trackingNumber: f.trackingNumber || (o?.trackingNumber ?? "") }))
    } catch (err) {
      setError(isApiError(err) ? userMessage(err) : "Gagal memuat bukti pengiriman.")
    } finally {
      setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchAll()
    setRefreshing(false)
  }, [fetchAll])

  const handleConfirm = useCallback(async () => {
    if (!latest || !orderId) return
    setConfirming(true)
    try {
      await api.orders.confirmDelivery(orderId, { proofId: latest.id })
      toast.show({ title: "Penerimaan dikonfirmasi", tone: "success", duration: 3000 })
      setConfirmOpen(false)
      await fetchAll()
    } catch (err) {
      toast.show({
        title: "Gagal mengonfirmasi penerimaan",
        description: isApiError(err) ? userMessage(err) : undefined,
        tone: "danger",
      })
    } finally {
      setConfirming(false)
    }
  }, [latest, orderId, toast.show, fetchAll])

  const handleReject = useCallback(
    async (note: string) => {
      if (!latest || !orderId) return
      setRejecting(true)
      try {
        await api.orders.rejectDelivery(orderId, { note, proofId: latest.id })
        toast.show({ title: "Bukti ditolak, sengketa dibuka", tone: "danger", duration: 3000 })
        await fetchAll()
      } catch (err) {
        toast.show({
          title: "Gagal menolak bukti",
          description: isApiError(err) ? userMessage(err) : undefined,
          tone: "danger",
        })
      } finally {
        setRejecting(false)
      }
    },
    [latest, orderId, toast.show, fetchAll],
  )

  const handleAddEvidence = useCallback(async () => {
    if (uploads.length >= MAX_PROOF_FILES) return
    const picked = await pickImage()
    if (picked.status === "denied") {
      toast.show({ title: "Akses galeri ditolak", tone: "danger" })
      return
    }
    if (picked.status !== "picked") return
    setUploading(true)
    try {
      const asset = picked.asset
      const blob = await pickedImageToBlob(asset)
      const { fileKey } = await api.upload.uploadPresigned(
        "DELIVERY_PROOF",
        asset.name,
        asset.mimeType,
        blob,
      )
      setUploads((prev) => [
        ...prev,
        {
          id: fileKey,
          fileKey,
          url: asset.uri,
          mimeType: asset.mimeType,
          mine: true,
          uploadedAt: formatDateTime(new Date().toISOString()),
        },
      ])
    } catch (err) {
      toast.show({
        title: "Gagal mengunggah foto",
        description: isApiError(err) ? userMessage(err) : undefined,
        tone: "danger",
      })
    } finally {
      setUploading(false)
    }
  }, [uploads.length, toast.show])

  const handleSubmitProof = useCallback(
    async (value: DeliveryProofFormValue) => {
      if (!orderId || uploads.length === 0) return
      const description = value.note.trim()
      if (description.length < MIN_DESCRIPTION) {
        toast.show({
          title: "Catatan terlalu pendek",
          description: `Minimal ${MIN_DESCRIPTION} karakter.`,
          tone: "warning",
        })
        return
      }
      setSubmitting(true)
      try {
        await api.orders.submitDeliveryProof(orderId, {
          description,
          fileUrls: uploads.map((u) => u.fileKey),
        })
        const tracking = value.trackingNumber.trim()
        if (tracking && tracking !== (order?.trackingNumber ?? "")) {
          try {
            await api.orders.updateShipping(orderId, { trackingNumber: tracking })
          } catch {
            toast.show({
              title: "Bukti terkirim, resi gagal disimpan",
              description: "Perbarui resi dari detail pesanan.",
              tone: "warning",
            })
          }
        }
        setUploads([])
        setForm({ trackingNumber: tracking, note: "" })
        toast.show({
          title: "Bukti pengiriman terkirim",
          description: "Menunggu konfirmasi pembeli.",
          tone: "success",
          duration: 4000,
        })
        await fetchAll()
      } catch (err) {
        toast.show({
          title: "Gagal mengirim bukti",
          description: isApiError(err) ? userMessage(err) : undefined,
          tone: "danger",
        })
      } finally {
        setSubmitting(false)
      }
    },
    [orderId, uploads, order?.trackingNumber, toast.show, fetchAll],
  )

  const openAttachment = useCallback(
    (index: number) => {
      const a = attachments[index]
      if (!a || !latest) return
      setViewerItem({
        url: a.uri,
        mimeType: a.kind === "pdf" ? "application/pdf" : "image/jpeg",
        title: `Bukti ${index + 1} dari ${attachments.length}`,
        caption: [latest.description, formatDateTime(latest.createdAt)].filter(Boolean).join(" · "),
        fileName: a.kind === "pdf" ? a.name : undefined,
      })
    },
    [attachments, latest],
  )

  const showSellerForm = isSeller && latest?.status !== "CONFIRMED"

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Bukti Pengiriman" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        {loading && !order ? (
          <DetailLoading />
        ) : error ? (
          <ErrorState title="Gagal memuat" description={error} onRetry={() => void fetchAll()} />
        ) : (
          <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
            {showSellerForm ? (
              <>
                <SectionHeader
                  title={latest ? "Kirim bukti baru" : "Kirim bukti pengiriman"}
                  subtitle={
                    latest?.status === "REJECTED"
                      ? "Bukti sebelumnya ditolak pembeli — unggah bukti yang lebih jelas."
                      : "Foto paket/resi/hasil kerja agar pembeli bisa mengonfirmasi."
                  }
                />
                <DeliveryProofForm
                  items={uploads}
                  onAddEvidence={() => void handleAddEvidence()}
                  onRemoveEvidence={(item) =>
                    setUploads((prev) => prev.filter((u) => u.id !== item.id))
                  }
                  onOpenEvidence={(item) =>
                    setViewerItem({ url: item.url, mimeType: item.mimeType, title: "Foto bukti" })
                  }
                  maxItems={MAX_PROOF_FILES}
                  value={form}
                  onChange={setForm}
                  onSubmit={(v) => void handleSubmitProof(v)}
                  submitting={submitting || uploading}
                  hideTracking={order?.orderType !== "PHYSICAL_GOODS"}
                />
              </>
            ) : null}

            {latest ? (
              <>
                {showSellerForm ? <SectionHeader title="Bukti terakhir" /> : null}
                <DeliveryProofViewer
                  status={toStatus(latest.status)}
                  attachments={attachments}
                  sellerName={sellerName}
                  note={latest.description}
                  uploadedAtLabel={formatDateTime(latest.createdAt)}
                  rejectionReason={latest.note ?? undefined}
                  viewer={isSeller ? "seller" : "buyer"}
                  onConfirm={() => setConfirmOpen(true)}
                  onReject={(note) => void handleReject(note)}
                  confirming={confirming}
                  rejecting={rejecting}
                  onOpenAttachment={openAttachment}
                />
              </>
            ) : !showSellerForm ? (
              <EmptyState
                icon={Package}
                title="Belum ada bukti pengiriman"
                description={
                  isSeller
                    ? undefined
                    : "Penjual belum mengunggah bukti. Anda akan diberi tahu saat tersedia."
                }
              />
            ) : null}
          </View>
        )}
      </PullToRefresh>

      <MediaViewer
        item={viewerItem}
        onClose={() => setViewerItem(null)}
        onOpenError={(m) => toast.show({ title: m, tone: "danger" })}
      />

      <Dialog
        title="Konfirmasi penerimaan"
        description="Dana di escrow akan dilepas ke penjual. Pastikan barang sudah sesuai sebelum melanjutkan."
        visible={confirmOpen}
        loading={confirming}
        confirmLabel="Ya, sudah diterima"
        cancelLabel="Batal"
        onConfirm={() => void handleConfirm()}
        onCancel={() => setConfirmOpen(false)}
        onRequestClose={() => setConfirmOpen(false)}
      />
    </Screen>
  )
}
