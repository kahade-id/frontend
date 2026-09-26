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

import { Crossfade } from "@/components/ui/fade-in"
import { DetailLoading } from "@/components/ui/paginated-list"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useApiQuery } from "@/lib/use-api-query"
import { usePolling } from "@/lib/use-polling"
import { Text } from "@/components/ui/text"
import { Pressable, View } from "react-native"
import { useLocalSearchParams } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Package } from "phosphor-react-native"

import { api, createIdempotencyKey, isApiError, userMessage, type Order } from "@/lib/api"
import { showMutationError } from "@/lib/mutation-toast"
import { orderPartyName, type DeliveryProof } from "@/lib/api/orders"
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
import { UPLOAD_DEFAULT_MAX_MB } from "@/components/ui/upload-field"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { useToast } from "@/components/ui/toast"
import { translate } from "@/lib/i18n/translate"

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

/**
 * E-01 + L-01 (audit escrow 2026-09-24): dulu SEMUA `fileUrls` dipetakan ke
 * `kind:"image"` — PDF bukti kirim dirender sebagai gambar rusak; object key
 * mentah dipakai apa adanya sebagai `uri`. `fileUrls` dari GET adalah URL siap
 * tampil (lihat normalizeDeliveryProof) — yang bukan http(s) TIDAK dirender
 * (object key bukan URL publik), dan jenisnya dibaca dari ekstensinya.
 */
function isRenderableUrl(uri: string): boolean {
  return /^https?:\/\//i.test(uri)
}

function toAttachments(p: DeliveryProof): { items: DeliveryProofAttachment[]; dropped: number } {
  const imgs: DeliveryProofAttachment[] = []
  const pdfs: DeliveryProofAttachment[] = []
  // R2 (audit ronde-2, butir #47): URI tak renderable tidak lagi hilang tanpa
  // jejak — dihitung di `dropped` dan dilaporkan ke UI sebagai placeholder.
  let dropped = 0
  for (const uri of p.fileUrls ?? []) {
    if (!isRenderableUrl(uri)) {
      dropped += 1
      continue
    }
    if (/\.pdf($|\?)/i.test(uri)) {
      pdfs.push({ kind: "pdf", uri, name: fileNameFromUrl(uri, FALLBACK_FILE_NAME) })
    } else {
      imgs.push({ kind: "image", uri })
    }
  }
  for (const uri of p.linkUrls ?? []) {
    if (!isRenderableUrl(uri)) {
      dropped += 1
      continue
    }
    pdfs.push({ kind: "pdf", uri, name: fileNameFromUrl(uri, FALLBACK_FILE_NAME) })
  }
  return { items: [...imgs, ...pdfs], dropped }
}

/** R2 (butir #46): label status riwayat yang JUJUR — nilai tak dikenal tidak
 *  diturunkan menjadi "Menunggu konfirmasi" (lihat juga #48). */
function proofHistoryLabel(status: string): string {
  if (status === "PENDING") return "Menunggu konfirmasi"
  if (status === "CONFIRMED") return "Dikonfirmasi"
  if (status === "REJECTED") return "Ditolak"
  return status || "Status tidak dikenal"
}

export default function DeliveryProofScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>()
  const insets = useSafeAreaInsets()
  const toast = useToast()

  /**
   * Audit: state async dirakit manual. Cacat terbukti dari kode lama:
   * `handleRefresh` memanggil `fetchAll()` yang sama dengan muat-awal, dan
   * fungsi itu membuka dengan `setLoading(true)` — tarik-untuk-menyegarkan
   * mengganti pesanan + bukti pengiriman dengan kerangka. Request juga tidak
   * dibatalkan saat layar ditutup.
   *
   * `enabled: Boolean(orderId)` menggantikan guard `if (!orderId) return` yang
   * dulu membuat `loading` tetap true selamanya bila param kosong.
   */
  const query = useApiQuery<{ order: Order | null; proofs: DeliveryProof[] }>(
    `delivery-proof:${orderId}`,
    async (signal) => {
      const id = orderId as string
      const [o, ps] = await Promise.all([
        api.orders.getOrder(id, signal),
        api.orders.listDeliveryProofs(id, signal),
      ])
      return { order: o ?? null, proofs: ps ?? [] }
    },
    Boolean(orderId),
  )
  const order = query.data?.order ?? null
  const proofs = query.data?.proofs ?? []
  const { loading, error, refreshing } = query
  const [confirming, setConfirming] = useState(false)
  // R2 (butir #17): kunci idempotensi konfirmasi — dibuat ulang saat siklus
  // konfirmasi dimulai ulang (sukses / gagal pasti), DIPERTAHANKAN saat hasil
  // uncertain agar retry manual memakai kunci yang sama.
  const confirmKeyRef = useRef<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const [viewerItem, setViewerItem] = useState<MediaViewerItem | null>(null)

  // Sisi penjual
  const [uploads, setUploads] = useState<UploadedProof[]>([])
  // G-10 (audit escrow 2026-09-24): reset lampiran lokal saat berpindah order
  // (deep link antar-order) — dulu unggahan order sebelumnya ikut terkirim.
  useEffect(() => {
    setUploads([])
  }, [orderId])
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState<DeliveryProofFormValue>({ trackingNumber: "", note: "" })
  const [submitting, setSubmitting] = useState(false)

  const sortedProofs = useMemo(
    () =>
      [...proofs].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [proofs],
  )
  const latest = sortedProofs[0] ?? null
  // R2 (audit ronde-2, butir #46): riwayat bukti lama yang dijanjikan JSDoc
  // layar ("tetap tampil di bawah sebagai riwayat") kini benar-benar dirender.
  const pastProofs = sortedProofs.slice(1)

  // R2 (audit ronde-2, butir #23): status bukti/penolakan pihak lawan menyegar
  // tiap 20 detik saat layar terbuka; berhenti setelah CONFIRMED (final).
  usePolling(
    async () => {
      await query.refresh().catch(() => {})
    },
    20_000,
    Boolean(orderId) && latest?.status !== "CONFIRMED",
  )

  /**
   * E-02 + H-01 (audit escrow 2026-09-24): peran TIDAK boleh default ke
   * pembeli — `viewer="buyer"` menampilkan "Konfirmasi diterima" (rilis dana
   * escrow) kepada pihak yang belum terkonfirmasi perannya. `myRole` yang
   * hilang berarti layar ini READ-ONLY dengan penjelasan, bukan tombol rilis.
   */
  const knownRole: "buyer" | "seller" | null =
    order?.myRole === "SELLER" ? "seller" : order?.myRole === "BUYER" ? "buyer" : null
  const isSeller = knownRole === "seller"
  const sellerName = order ? orderPartyName(order.seller) : undefined
  const latestAttachments = useMemo(
    () => (latest ? toAttachments(latest) : { items: [], dropped: 0 }),
    [latest],
  )
  const attachments = latestAttachments.items

  /**
   * Pra-isi nomor resi yang dulu dilakukan DI DALAM fetcher. Dipindah ke effect
   * karena ini efek samping pada state form (UI), bukan bagian data server.
   * Semantik dipertahankan persis: hanya mengisi bila input masih kosong
   * (`f.trackingNumber || …`), jadi resi yang sedang diketik user tidak
   * tertimpa saat penyegaran.
   */
  useEffect(() => {
    if (!order) return
    setForm((f) => ({ ...f, trackingNumber: f.trackingNumber || (order.trackingNumber ?? "") }))
  }, [order])

  const handleConfirm = useCallback(async () => {
    if (!latest || !orderId) return
    // M-40 (audit end-to-end, issue #33): `proofId` WAJIB (ConfirmDeliveryDto,
    // `/delivery-proof/confirm` body REQUIRED) — `latest.id` bisa "" (fallback
    // normalizer). Dulu `proofId: ""` dikirim = 400 pasti. Id kosong = jangan
    // kirim, minta muat ulang.
    if (!latest.id) {
      toast.show({
        title: "Bukti belum punya identitas server",
        description: "Muat ulang halaman, lalu konfirmasi kembali.",
        tone: "warning",
      })
      return
    }
    setConfirming(true)
    try {
      // R2 (audit ronde-2, butir #17): kunci idempotensi per siklus dialog
      // konfirmasi — ketukan ganda / retry pasca-timeout aman. Kunci disimpan
      // sampai respons final (sukses ATAU gagal pasti) lalu dibuat ulang.
      const key =
        confirmKeyRef.current ?? (confirmKeyRef.current = createIdempotencyKey())
      await api.orders.confirmDelivery(orderId, { proofId: latest.id }, key)
      confirmKeyRef.current = null
      toast.show({ title: "Penerimaan dikonfirmasi", tone: "success", duration: 3000 })
      setConfirmOpen(false)
      // M-41 (audit end-to-end, issue #37): refetch BUKAN bagian mutasi —
      // dulu satu `try`; `query.refresh()` gagal menampilkan "Gagal
      // mengonfirmasi" padahal konfirmasi SUDAH dikirim (toast sukses sudah
      // tampil, lalu tertimpa pesan gagal yang menyesatkan).
      void query.refresh().catch(() => {})
    } catch (err) {
      // R2 (audit escrow ronde-2, butir #2): konfirmasi MERILIS dana escrow ke
      // penjual — respons yang hilang bukan berarti rilis batal. Tanamkan
      // peringatan jujur dan wajib muat ulang state dari server.
      if (
        showMutationError(toast.show, {
          failTitle: "Gagal mengonfirmasi penerimaan",
          uncertainHint: "Konfirmasi mungkin sudah diproses — memuat ulang status…",
          uncertainDetail: "Dana escrow bisa sudah dirilis — jangan konfirmasi ulang.",
          err,
        })
      ) {
        await query.reload().catch(() => {})
      } else {
        // Gagal pasti (server menolak & request diterima): siklus berakhir,
        // retry berikutnya = upaya BARU dengan kunci baru.
        confirmKeyRef.current = null
      }
    } finally {
      setConfirming(false)
    }
  }, [latest, orderId, toast.show, query])

  const handleReject = useCallback(
    async (note: string) => {
      if (!latest || !orderId) return
      // M-40 (issue #35): lihat handleConfirm — proofId kosong = 400 pasti.
      if (!latest.id) {
        toast.show({
          title: "Bukti belum punya identitas server",
          description: "Muat ulang halaman, lalu tolak kembali.",
          tone: "warning",
        })
        return
      }
      setRejecting(true)
      try {
        await api.orders.rejectDelivery(orderId, { note, proofId: latest.id })
        toast.show({ title: "Bukti ditolak, sengketa dibuka", tone: "danger", duration: 3000 })
        // M-41 (issue #37): refetch dipisah dari mutasi (lihat handleConfirm).
        void query.refresh().catch(() => {})
      } catch (err) {
        // R2 (audit escrow ronde-2, butir #3): penolakan bisa membuka sengketa —
        // retry pada kegagalan tak pasti berisiko menolak/sengketa ganda.
        if (
          showMutationError(toast.show, {
            failTitle: "Gagal menolak bukti",
            uncertainHint: "Penolakan mungkin sudah diproses — memuat ulang status…",
            uncertainDetail: "Sengketa bisa sudah dibuka — periksa status sebelum menolak kembali.",
            err,
          })
        ) {
          await query.reload().catch(() => {})
        }
      } finally {
        setRejecting(false)
      }
    },
    [latest, orderId, toast.show, query],
  )

  const handleAddEvidence = useCallback(async () => {
    if (uploads.length >= MAX_PROOF_FILES) return
    // R2 (audit ronde-2, butir #34): bukti pengiriman pun boleh berupa video
    // (kontrak SubmitEvidenceDto mendukung) — selaras dengan jalur sengketa.
    const picked = await pickImage({ allowVideos: true })
    if (picked.status === "denied") {
      toast.show({ title: "Akses galeri ditolak", tone: "danger" })
      return
    }
    if (picked.status !== "picked") return
    // F7 (audit 2026-09-26): validasi ukuran SEBELUM upload dimulai — jangan
    // buang kuota/data mengunggah berkas yang pasti ditolak. Batas 10 MB
    // memakai konstanta yang sama dengan <UploadField> (satu sumber).
    const asset = picked.asset
    if (asset.size > 0 && asset.size > UPLOAD_DEFAULT_MAX_MB * 1024 * 1024) {
      toast.show({
        title: "Berkas terlalu besar",
        description: translate("Ukuran berkas melebihi {x} MB.", { x: UPLOAD_DEFAULT_MAX_MB }),
        tone: "danger",
      })
      return
    }
    setUploading(true)
    try {
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
          description: translate("Minimal {x} karakter.", { x: MIN_DESCRIPTION }),
          tone: "warning",
        })
        return
      }
      const tracking = value.trackingNumber.trim()
      // M-42 (audit end-to-end, issue #36): validasi resi SEBELUM mutasi —
      // dulu `updateShipping` (min 3) baru dicek server SETELAH bukti terkirim
      // (setengah jalan). Semua syarat dicek di depan; tidak ada mutasi parsial
      // karena alasan yang bisa diketahui lebih awal.
      if (tracking && tracking !== (order?.trackingNumber ?? "") && tracking.length < 3) {
        toast.show({
          title: "Nomor resi terlalu pendek",
          description: "Minimal 3 karakter, atau kosongkan bila tidak dikirim dari sini.",
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
        // M-41 (issue #37): refetch dipisah dari mutasi (lihat handleConfirm).
        void query.refresh().catch(() => {})
      } catch (err) {
        // M-43 (audit end-to-end, issue #38): kegagalan TAK PASTI (PARSE/
        // timeout) = bukti MUNGKIN sudah tersimpan. Unggahan TETAP dipertahankan
        // (fileKey yang sama) — tekan kirim ulang TANPA memilih file lagi
        // (memilih ulang = objek ganda di storage).
        const uncertain =
          !isApiError(err) || err.isTransient || err.code === "ABORTED" || err.code === "PARSE"
        toast.show({
          title: uncertain ? "Bukti mungkin sudah terkirim" : "Gagal mengirim bukti",
          description: uncertain
            ? "Koneksi terputus di tengah pengiriman — periksa daftar bukti; foto pilihan tetap tersimpan, tekan kirim ulang tanpa memilih ulang."
            : isApiError(err)
              ? userMessage(err)
              : undefined,
          tone: uncertain ? "warning" : "danger",
        })
      } finally {
        setSubmitting(false)
      }
    },
    [orderId, uploads, order?.trackingNumber, toast.show, query],
  )

  const openAttachment = useCallback(
    (index: number) => {
      const a = attachments[index]
      if (!a || !latest) return
      setViewerItem({
        url: a.uri,
        mimeType: a.kind === "pdf" ? "application/pdf" : "image/jpeg",
        title: translate("Bukti {x} dari {y}", { x: index + 1, y: attachments.length }),
        caption: [latest.description, formatDateTime(latest.createdAt)].filter(Boolean).join(" · "),
        fileName: a.kind === "pdf" ? a.name : undefined,
      })
    },
    [attachments, latest],
  )

  /** R2 (butir #46): buka lampiran pertama bukti riwayat dalam viewer yang sama. */
  const openProofAttachment = useCallback((proof: DeliveryProof) => {
    const first = toAttachments(proof).items[0]
    if (!first) return
    setViewerItem({
      url: first.uri,
      mimeType: first.kind === "pdf" ? "application/pdf" : "image/jpeg",
      title: proofHistoryLabel(proof.status),
      caption: [proof.description, formatDateTime(proof.createdAt)].filter(Boolean).join(" · "),
      fileName: first.kind === "pdf" ? first.name : undefined,
    })
  }, [])

  const showSellerForm = isSeller && latest?.status !== "CONFIRMED"

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Bukti Pengiriman" />
      <PullToRefresh
        onRefresh={() => void query.refresh()}
        refreshing={refreshing}
        contentContainerClassName="px-5"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        <Crossfade loading={loading && !order} skeleton={<DetailLoading />}>
          {error ? (
          <ErrorState title="Gagal memuat" description={error} onRetry={() => void query.reload()} />
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

            {order && !knownRole ? (
              // E-02/H-01: bukan pihak order / peran tidak dikirim server —
              // bukan tombol rilis dana; jelaskan mengapa read-only.
              <ErrorState
                title="Peran Anda di order ini tidak dikenal"
                description="Aksi konfirmasi disembunyikan sampai server mengirim peran Anda. Hubungi bantuan bila ini pesanan Anda."
              />
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
                  viewer={knownRole ?? undefined}
                  onConfirm={() => setConfirmOpen(true)}
                  onReject={(note) => void handleReject(note)}
                  confirming={confirming}
                  rejecting={rejecting}
                  onOpenAttachment={openAttachment}
                />
                {latestAttachments.dropped > 0 ? (
                  // R2 (butir #47): lampiran yang disaring karena bukan tautan
                  // renderable dilaporkan, bukan diam-diam hilang.
                  <Text variant="caption" tone="secondary">
                    {translate(
                      "{x} lampiran tidak dapat ditampilkan (bukan tautan unduhan langsung).",
                      { x: latestAttachments.dropped },
                    )}
                  </Text>
                ) : null}
                {(latest.unresolvedFileCount ?? 0) > 0 ? (
                  // S5 (audit 2026-09-26): file yang gagal dimuat server — buyer
                  // jangan mengonfirmasi dari bukti yang tidak lengkap.
                  <Text variant="caption" tone="warning">
                    {translate(
                      "{x} file bukti tidak dapat dimuat server. Periksa dengan penjual sebelum mengonfirmasi.",
                      { x: latest.unresolvedFileCount ?? 0 },
                    )}
                  </Text>
                ) : null}
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

            {pastProofs.length > 0 ? (
              // R2 (audit ronde-2, butir #46/#49): seluruh riwayat bukti
              // sebelumnya dirender (konfirmasi hanya berlaku untuk TERAKHIR
              // — disebutkan eksplisit agar pembeli tidak mencari tombol pada
              // bukti lama).
              <>
                <SectionHeader
                  title="Riwayat bukti sebelumnya"
                  subtitle="Konfirmasi/tolak hanya berlaku untuk bukti terbaru. Ketuk untuk melihat lampiran."
                />
                {pastProofs.map((p) => {
                  const atts = toAttachments(p)
                  return (
                    <Pressable
                      key={p.id || p.createdAt}
                      onPress={atts.items.length > 0 ? () => openProofAttachment(p) : undefined}
                      disabled={atts.items.length === 0}
                      accessibilityRole="button"
                      className="rounded-sm border border-border bg-surface p-3"
                    >
                      <View className="flex-row items-center justify-between gap-2">
                        <Text variant="body" weight={500}>
                          {proofHistoryLabel(p.status)}
                        </Text>
                        <Text variant="caption" tone="secondary">
                          {formatDateTime(p.createdAt)}
                        </Text>
                      </View>
                      {p.description ? (
                        <Text variant="caption" tone="secondary" numberOfLines={2}>
                          {p.description}
                        </Text>
                      ) : null}
                      <Text variant="caption" tone="secondary">
                        {atts.items.length > 0
                          ? translate("{x} lampiran", { x: atts.items.length })
                          : "Tanpa lampiran yang dapat ditampilkan"}
                        {atts.dropped > 0
                          ? translate(" · {x} tak dapat ditampilkan", { x: atts.dropped })
                          : ""}
                      </Text>
                    </Pressable>
                  )
                })}
              </>
            ) : null}
            </View>
          )}
        </Crossfade>
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
