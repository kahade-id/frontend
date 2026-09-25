/**
 * Screen — Detail Sengketa.
 *
 * GET  /v1/disputes/{id} · /evidence · /messages · /mutual-resolution · /calls
 * POST /claim · /evidence · /messages · /mutual-resolution ·
 *      /mutual-resolution/{proposalId}/respond · /call/request ·
 *      /call/accept · /call/reject · /call/end
 * DELETE /evidence/{evidenceId} · /mutual-resolution/{proposalId}
 *
 * Komponen: DisputeClaimForm, EvidenceGrid, ChatMessageBubble + ChatComposer,
 * MutualResolutionCard, DisputeCallLogItem, MediaViewer.
 *
 * Keputusan non-obvious:
 *   - Peran & identitas dibaca dari order (`GET /orders/{orderId}` →
 *     `myRole`, `buyer`, `seller`) — sebelumnya `role="buyer"` dan
 *     `proposedByMe` di-hardcode sehingga penjual melihat tombol yang salah.
 *   - `proposedByMe` = `proposal.proposerId === myId`; myId diambil dari
 *     party order yang sesuai `myRole` (tanpa panggilan `/users/me` ekstra).
 *   - Pratinjau bukti memakai <MediaViewer> (gambar layar penuh / PDF buka
 *     eksternal) — bukan toast URL. Bukti milik sendiri bisa dihapus dari
 *     viewer (DELETE evidence) setelah Dialog konfirmasi.
 *   - Usulan penyelesaian: form nominal "kembali ke pembeli" (AmountInput,
 *     0..nilai order) di BottomSheet; body lihat catatan UNVERIFIED di
 *     lib/api/disputes.ts. Hanya ditawarkan bila belum ada usulan PENDING.
 *   - Log panggilan hanya ditampilkan + tombol "Minta panggilan video"
 *     (POST /call/request). Sesi video (WebRTC) di luar cakupan layar ini;
 *     accept/reject/end dipakai saat ada prompt panggilan masuk (real-time).
 *   - Pesan: ChatComposer di footer sticky; setelah kirim daftar di-refetch
 *     (endpoint tidak mengembalikan daftar). Lampiran composer tidak
 *     diaktifkan — bukti dikirim lewat EvidenceGrid supaya tercatat sebagai
 *     evidence, bukan pesan.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { View } from "react-native"
import { useLocalSearchParams } from "expo-router"

import { api, createIdempotencyKey } from "@/lib/api"
import { showMutationError } from "@/lib/mutation-toast"
import type { Order } from "@/lib/api/orders"
import { EVIDENCE_FILE_TYPES, type EvidenceFileType } from "@/lib/api/disputes"
import type {
  DisputeCall,
  DisputeDetail,
  DisputeEvidence,
  DisputeMessage,
  MutualResolutionProposal,
  MutualResolutionProposeBody,
  MutualResolutionRespondBody,
} from "@/lib/api/disputes"
import { useApiQuery } from "@/lib/use-api-query"
import { usePolling } from "@/lib/use-polling"
import { pickImage, pickedImageToBlob } from "@/lib/image-picker"
import { formatDateTime } from "@/lib/format"
import { tokens } from "@/lib/tokens"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { Button } from "@/components/ui/button"
import { ChatComposer } from "@/components/ui/chat-composer"
import { DisputeClaimForm } from "@/components/ui/dispute-claim-form"
import { ErrorState } from "@/components/ui/error-state"
import { EvidenceGrid, type EvidenceItem } from "@/components/ui/evidence-grid"
import { InCallControlsBar } from "@/components/ui/in-call-controls-bar"
import { Crossfade } from "@/components/ui/fade-in"
import { Header } from "@/components/ui/header"
import { MediaViewer, type MediaViewerItem } from "@/components/ui/media-viewer"
import { DetailLoading } from "@/components/ui/paginated-list"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { DisputeMessagesSection } from "@/components/dispute-messages-section"
import {
  DisputeActionDialogs,
  DisputeCallsSection,
  DisputeDetailHeader,
  DisputeMutualSection,
  DisputeProposeSheet,
} from "@/components/dispute-detail-sections"
import { SectionHeader } from "@/components/ui/section"
import { useToast } from "@/components/ui/toast"
import { logWarn } from "@/lib/telemetry"

/* E-09: enum 7 MIME pindah ke lib/api/disputes (EVIDENCE_FILE_TYPES) —
   di layar, literal MIME dipindai generator katalog sebagai "teks UI"
   (artefak `video/mp{x}`). */

const PROPOSAL_NOTE_MAX = 2000

/**
 * MIME picker → enum DTO. Yang sudah ada di enum diteruskan apa adanya;
 * di luar enum jatuh ke JPEG (picker gambar sudah mengompres ke JPEG).
 * E-09: jangan pernah mengirim label MIME yang tidak sesuai isi berkas.
 */
function toEvidenceFileType(mime: string): EvidenceFileType {
  return (EVIDENCE_FILE_TYPES as readonly string[]).includes(mime)
    ? (mime as EvidenceFileType)
    : "image/jpeg"
}


export default function DisputeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const toast = useToast()

  /**
   * Audit: enam state data + loading/error/refreshing dirakit manual. Cacat
   * terbukti dari kode lama: `handleRefresh` memanggil `fetchAll()` yang sama
   * dengan muat-awal, dan fungsi itu membuka dengan `setLoading(true)` —
   * tarik-untuk-menyegarkan mengganti detail sengketa, bukti, pesan, proposal,
   * dan riwayat panggilan dengan kerangka sekaligus. Request juga tidak
   * dibatalkan saat layar ditutup.
   *
   * `.catch(() => null)` pada order DIPERTAHANKAN: order pelengkap,
   * kegagalannya tidak boleh mematikan sengketa.
   *
   * Pemetaan error lama `isApiError(err) ? userMessage(err) : "Gagal memuat
   * sengketa."` TIDAK punya cabang status khusus, jadi setara dengan perilaku
   * useApiQuery untuk semua error API nyata — aman dimigrasi. (Bandingkan
   * app/user/[username].tsx yang memetakan 404 secara khusus dan karena itu
   * sengaja TIDAK dimigrasi.)
   */
  const query = useApiQuery<{
    dispute: DisputeDetail
    order: Order | null
    evidence: DisputeEvidence[]
    messages: DisputeMessage[]
    proposals: MutualResolutionProposal[]
    calls: DisputeCall[]
  }>(
    `dispute-detail:${id}`,
    async (signal) => {
      const did = id as string
      // R2 (audit ronde-2, butir #109): 4 dari 5 endpoint hanya bergantung
      // pada `did` yang sudah diketahui dari rute — dulu SELURUH bundel
      // menunggu getDispute selesai duluan (~1 RTT layar-beku sia-sia di
      // jalur paling HOT). Kini semuanya paralel sejak frame pertama;
      // getOrder tetap menunggu getDispute karena butuh orderId.
      const dPromise = api.disputes.getDispute(did, signal)
      const [d, ev, msgs, props, cl, o] = await Promise.all([
        dPromise,
        api.disputes.getDisputeEvidence(did, signal),
        api.disputes.getDisputeMessages(did, signal),
        api.disputes.getMutualResolution(did, signal),
        api.disputes.getDisputeCalls(did, signal),
        dPromise.then((d) =>
          d.orderId
            ? api.orders.getOrder(d.orderId, signal).catch((err) => {
                logWarn("dispute:order", err)
                return null
              })
            : null,
        ),
      ])
      return {
        dispute: d,
        order: o,
        evidence: ev ?? [],
        messages: msgs ?? [],
        proposals: props ?? [],
        calls: cl ?? [],
      }
    },
    Boolean(id),
  )
  const bundle = query.data
  const dispute = bundle?.dispute ?? null
  const order = bundle?.order ?? null
  const evidence = bundle?.evidence ?? []
  const messages = bundle?.messages ?? []
  const proposals = bundle?.proposals ?? []
  const calls = bundle?.calls ?? []
  const { loading, error, refreshing } = query

  // R2 (audit ronde-2, butir #22): mediasi adalah PERCAKAPAN — pesan/proposal/
  // bukti pihak lawan tiba tiap 15 detik tanpa menunggu pull-to-refresh.
  // Effect E-04 menjamin draft klaim yang sedang diketik tidak tertimpa.
  usePolling(
    async () => {
      await query.refresh().catch(() => {})
    },
    15_000,
    Boolean(id) && dispute != null && dispute.status !== "RESOLVED" && dispute.status !== "CLOSED",
  )
  /** Klaim = textarea yang bisa diedit user; tetap state UI lokal. */
  const [claim, setClaim] = useState("")
  const [submitting, setSubmitting] = useState(false)
  // R2 (audit ronde-2, butir #40): unggah bukti & kirim klaim adalah dua alur
  // mandiri — state kunci dipisah agar menunggu unggahan tidak membekukan
  // form klaim (dan sebaliknya).
  const [uploadingEvidence, setUploadingEvidence] = useState(false)

  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)

  const [viewerItem, setViewerItem] = useState<
    (MediaViewerItem & { evidenceId?: string; mine?: boolean }) | null
  >(null)
  const [deleteEvidenceId, setDeleteEvidenceId] = useState<string | null>(null)
  const [deletingEvidence, setDeletingEvidence] = useState(false)

  const [proposeOpen, setProposeOpen] = useState(false)
  const [proposeAmount, setProposeAmount] = useState(0)
  const [proposeNote, setProposeNote] = useState("")
  const [proposing, setProposing] = useState(false)
  // E-06 (audit escrow 2026-09-24): catatan tanggapan opsional untuk
  // `MutualResolutionRespondDto.responseNote` (≤2000) — dulu tidak pernah
  // dikirim meski kontrak mendukungnya.
  const [respondNote, setRespondNote] = useState("")
  const [respondingAction, setRespondingAction] = useState<"ACCEPT" | "REJECT" | "WITHDRAW" | null>(
    null,
  )
  const [requestingCall, setRequestingCall] = useState(false)

  // Eskalasi manual ke admin (8.3): maksimal 2x per sengketa (aturan backend),
  // hanya oleh pihak sengketa, dan tidak untuk status RESOLVED/ESCALATED.
  const [escalateOpen, setEscalateOpen] = useState(false)
  const [escalateReason, setEscalateReason] = useState("")
  const [escalating, setEscalating] = useState(false)

  // In-call controls
  const [callMuted, setCallMuted] = useState(false)
  const [callSpeaker, setCallSpeaker] = useState(false)
  const [callVideo, setCallVideo] = useState(true)

  const activeCall = calls.find((c) => c.status === "ONGOING")

  const handleEscalate = useCallback(async () => {
    if (!id) return
    setEscalating(true)
    try {
      await api.disputes.escalateDispute(id, escalateReason.trim() || undefined)
      toast.show({
        title: "Sengketa diedskalasi ke admin",
        description: "Tim Kahade akan meninjau dan memberi keputusan.",
        tone: "success",
        duration: 4000,
      })
      setEscalateOpen(false)
      setEscalateReason("")
      await query.reload()
    } catch (err: unknown) {
      // R2 (audit escrow ronde-2, butir #6): kalembakan kwota eskalasi (maks 2×)
      // tidak boleh dibakar oleh kegagalan yang sebenarnya mungkin sudah tercatat.
      if (
        showMutationError(toast.show, {
          failTitle: "Gagal mengeskalasi sengketa",
          uncertainHint: "Eskalasi mungkin sudah diproses — memuat ulang status…",
          err,
        })
      ) {
        void query.reload()
      }
    } finally {
      setEscalating(false)
    }
  }, [id, escalateReason, toast.show, query])

  const myRole =
    order?.myRole === "SELLER" ? "seller" : order?.myRole === "BUYER" ? "buyer" : undefined
  const me = order && myRole ? (myRole === "seller" ? order.seller : order.buyer) : null
  const counterpart = order && myRole ? (myRole === "seller" ? order.buyer : order.seller) : null
  const counterpartName =
    counterpart?.fullName ??
    (counterpart?.username ? `@${counterpart.username}` : "Lawan transaksi")
  const orderValue = order?.orderValue ?? Number.NaN

  // Eskalasi manual ke admin (8.3): maksimal 2x per sengketa (aturan backend),
  // hanya oleh pihak sengketa, dan tidak untuk status RESOLVED/ESCALATED.
  // E-08 (audit escrow 2026-09-24): bila server mengirim `escalationCount`,
  // batas 2x ditegakkan di klien juga — tombol tidak menawarkan percobaan yang
  // pasti ditolak. Tanpa hitungan, tombol tetap aktif dan penolakan backend
  // yang spesifik ditampilkan apa adanya (fallback jujur).
  const escalationCount =
    typeof (dispute as { escalationCount?: unknown } | null)?.escalationCount === "number"
      ? ((dispute as { escalationCount?: number }).escalationCount ?? 0)
      : undefined
  const canEscalate =
    dispute !== null &&
    !["RESOLVED", "ESCALATED"].includes(dispute.status) &&
    myRole !== undefined &&
    (escalationCount === undefined || escalationCount < 2)

  /**
   * E-04 (audit escrow 2026-09-24): pra-isi klaim HANYA saat sengketa
   * berganti identitas atau server benar-benar mengubah nilainya (pola yang
   * dipakai `app/order/[id].tsx` untuk resi). Versi lama menimpa draft klaim
   * yang sedang dikikti setiap `query.refresh()` — pengguna kehilangan tulisan.
   */
  const trackedClaimRef = useRef<{ id: string; claim: string } | null>(null)
  // R2 (audit ronde-2, butir #17): satu kunci idempotensi per proposal agar
  // percobaan ACCEPT berulang (timeout / ketuk ganda) tidak membagi dana dua
  // kali di server yang mendukung header. Kunci baru dibuat setelah final.
  const respondKeyRef = useRef<Map<string, string>>(new Map())
  useEffect(() => {
    if (!dispute) return
    const serverClaim = dispute.claim ?? ""
    const previous = trackedClaimRef.current
    const differentDispute = previous === null || previous.id !== dispute.id
    const serverChanged = previous !== null && previous.claim !== serverClaim
    if (differentDispute || serverChanged) {
      setClaim(serverClaim)
      trackedClaimRef.current = { id: dispute.id, claim: serverClaim }
    }
  }, [dispute])

  const handleSubmitClaim = useCallback(
    async (text: string) => {
      if (!id) return
      setSubmitting(true)
      try {
        await api.disputes.submitDisputeClaim(id, { claim: text.trim() })
        toast.show({ title: "Klaim diperbarui", tone: "success", duration: 3000 })
        // M-45 (audit end-to-end, issue #46): refetch BUKAN bagian mutasi —
        // dulu satu `try`; `query.refresh()` gagal → toast "Gagal menyimpan
        // klaim" padahal klaim SUDAH tersimpan (toast sukses sudah tampil lalu
        // tertimpa kontradiksi).
        void query.refresh().catch(() => {})
      } catch (err) {
        // R2 (audit escrow ronde-2, butir #5): klaim bisa sudah tertulis saat
        // respons hilang — jangan tampilkan kegagalan yang tidak diketahui.
        if (
          showMutationError(toast.show, {
            failTitle: "Gagal menyimpan klaim",
            uncertainHint: "Klaim mungkin sudah tersimpan — memuat ulang status…",
            err,
          })
        ) {
          void query.refresh().catch(() => {})
        }
      } finally {
        setSubmitting(false)
      }
    },
    [id, toast.show, query],
  )

  const handleSend = useCallback(
    async (content: string) => {
      const text = content.trim()
      if (!id || !text) return
      setSending(true)
      try {
        await api.disputes.sendDisputeMessage(id, text)
        setDraft("")
        // M-45 (audit end-to-end, issue #44): refetch pesan TERPISAH — dulu
        // `sendDisputeMessage` + `getDisputeMessages` satu `try` dan draft sudah
        // dikosongkan: refetch gagal → "Gagal mengirim pesan" padahal pesan
        // TERKIRIM dan draft user HILANG.
        try {
          const rows = await api.disputes.getDisputeMessages(id)
          query.setData((prev) => (prev ? { ...prev, messages: rows } : prev))
        } catch {
          // Pesan sudah terkirim — daftar menyusul saat penyegaran berikutnya.
        }
      } catch (err) {
        // R2 (audit escrow ronde-2, butir #8): pesan mediasi adalah bukti
        // permanen — kegagalan tak pasti harus diakui sebelum pengguna mengirim
        // ulang teks yang sama.
        if (
          showMutationError(toast.show, {
            failTitle: "Gagal mengirim pesan",
            uncertainHint: "Pesan mungkin sudah terkirim — memuat ulang pesan…",
            uncertainDetail: "Periksa daftar pesan sebelum mengirim ulang.",
            err,
          })
        ) {
          try {
            const rows = await api.disputes.getDisputeMessages(id)
            query.setData((prev) => (prev ? { ...prev, messages: rows } : prev))
          } catch {
            /* daftar menyusul saat penyegaran berikutnya */
          }
        }
      } finally {
        setSending(false)
      }
    },
    [id, toast.show, query],
  )

  const handleAddEvidence = useCallback(async () => {
    if (!id) return
    // R2 (audit ronde-2, butir #34): bukti video (rekaman unboxing) diizinkan
    // — kontrak SubmitEvidenceDto mendukung video/mp4|quicktime|webm.
    const picked = await pickImage({ allowVideos: true })
    if (picked.status === "denied") {
      toast.show({ title: "Akses galeri ditolak", tone: "danger" })
      return
    }
    if (picked.status !== "picked") return
    setUploadingEvidence(true)
    try {
      const asset = picked.asset
      const blob = await pickedImageToBlob(asset)
      const { fileKey } = await api.upload.uploadPresigned(
        "DISPUTE_EVIDENCE",
        asset.name,
        asset.mimeType,
        blob,
      )
      await api.disputes.submitDisputeEvidence(id, {
        // R2 (audit ronde-2, butir #41): deskripsi = nama berkas mentah
        // (IMG_20260924_183344.heic) mengotori arsip mediasi. Karena belum ada
        // input deskripsi di UI, kirim label jenis yang bermakna saja.
        description: asset.mimeType.startsWith("video/") ? "Bukti video" : "Bukti foto",
        fileUrls: [fileKey],
        fileTypes: [toEvidenceFileType(asset.mimeType)],
      })
      // M-45 (audit end-toend, issue #45): toast sukses LANGSUNG setelah bukti
      // tersimpan, refetch TERPISAH — dulu toast baru muncul setelah refetch dan
      // refetch gagal = "Gagal mengunggah bukti" padahal bukti SUDAH tersimpan.
      toast.show({ title: "Bukti terkirim", tone: "success", duration: 3000 })
      try {
        const rows = await api.disputes.getDisputeEvidence(id)
        query.setData((prev) => (prev ? { ...prev, evidence: rows } : prev))
      } catch {
        // Bukti sudah tersimpan — daftar menyusul saat penyegaran berikutnya.
      }
    } catch (err) {
      // R2 (audit escrow ronde-2, butir #9): unggahan dua langkah (presign +
      // submit) mungkin sudah selesai sebagian/sepenuhnya saat respons hilang —
      // muat ulang daftar bukti sebelum pengguna mengunggah berkas yang sama.
      if (
        showMutationError(toast.show, {
          failTitle: "Gagal mengunggah bukti",
          uncertainHint: "Bukti mungkin sudah terunggah — memuat ulang daftar…",
          uncertainDetail: "Periksa daftar bukti sebelum mengunggah kembali.",
          err,
        })
      ) {
        try {
          const rows = await api.disputes.getDisputeEvidence(id)
          query.setData((prev) => (prev ? { ...prev, evidence: rows } : prev))
        } catch {
          /* daftar menyusul saat penyegaran berikutnya */
        }
      }
    } finally {
      setUploadingEvidence(false)
    }
  }, [id, toast.show, query])

  const handleDeleteEvidence = useCallback(async () => {
    if (!id || !deleteEvidenceId) return
    setDeletingEvidence(true)
    try {
      await api.disputes.deleteDisputeEvidence(id, deleteEvidenceId)
      query.setData((prev) =>
        prev ? { ...prev, evidence: prev.evidence.filter((e) => e.id !== deleteEvidenceId) } : prev,
      )
      setDeleteEvidenceId(null)
      setViewerItem(null)
      toast.show({ title: "Bukti dihapus", tone: "success", duration: 3000 })
    } catch (err) {
      // R2 (uniform): kegagalan tak pasti — bukti bisa sudah terhapus.
      if (
        showMutationError(toast.show, {
          failTitle: "Gagal menghapus bukti",
          uncertainHint: "Bukti mungkin sudah terhapus — memuat ulang daftar…",
          err,
        })
      ) {
        try {
          const rows = await api.disputes.getDisputeEvidence(id)
          query.setData((prev) => (prev ? { ...prev, evidence: rows } : prev))
        } catch {
          /* daftar menyusul saat penyegaran berikutnya */
        }
      }
    } finally {
      setDeletingEvidence(false)
    }
  }, [id, deleteEvidenceId, toast.show, query])

  const handlePropose = useCallback(async () => {
    // Kontrak produksi: buyerPercent + sellerPercent = 100 (integer) + reason
    // 10–2000 char. Nominal rupiah dari UI dikonversi ke persentase pembagian.
    //
    // E-03 (audit escrow 2026-09-24): nominal yang tidak jatuh tepat di
    // kelipatan `orderValue/100` dulu dibulatkan persennya saja, sehingga
    // pembagian backend ≠ nominal pratinjau (mis. 3.333 dari 10.000 → 33/67
    // = 3.300/6.700). `proposeAmount` dinormalkan ke bagi-persen DULU
    // (`Math.round(x/100)`), dan angka itulah yang tampil di pratinjau.
    const buyerPercent =
      orderValue > 0 ? Math.min(100, Math.max(0, Math.round((proposeAmount / orderValue) * 100))) : 0
    const sellerPercent = 100 - buyerPercent
    const reason = proposeNote.trim()
    if (!id || !myRole || proposing || !order) {
      // E-10: order gagal dimuat = usulan tidak akan terkirim — beri tahu,
      // jangan diam-diam return.
      if (!order)
        toast.show({
          title: "Detail order belum termuat",
          description: "Segarkan layar sebelum mengirim usulan penyelesaian.",
          tone: "danger",
        })
      return
    }
    if (
      !Number.isSafeInteger(orderValue) ||
      !Number.isSafeInteger(proposeAmount) ||
      proposeAmount < 0 ||
      proposeAmount > orderValue ||
      reason.length < 10
    )
      return
    setProposing(true)
    try {
      await api.disputes.proposeMutualResolution(id, {
        buyerPercent,
        sellerPercent,
        reason,
      } satisfies MutualResolutionProposeBody)
      setProposeOpen(false)
      setProposeNote("")
      toast.show({
        title: "Usulan dikirim",
        description: "Menunggu tanggapan lawan transaksi.",
        tone: "success",
        duration: 3000,
      })
      // M-45 (audit end-to-end, issue #48): refetch daftar usulan TERPISAH —
      // dulu satu `try`; `getMutualResolution` gagal → "Gagal mengirim usulan"
      // padahal usulan SUDAH terkirim.
      try {
        const rows = await api.disputes.getMutualResolution(id)
        query.setData((prev) => (prev ? { ...prev, proposals: rows } : prev))
      } catch {
        // Usulan sudah terkirim — daftar menyusul saat penyegaran berikutnya.
      }
    } catch (err) {
      // R2 (audit escrow ronde-2, butir #4): usulan bisa sudah tercatat saat
      // respons hilang — muat ulang daftar sebelum pengguna membuat duplikat.
      if (
        showMutationError(toast.show, {
          failTitle: "Gagal mengirim usulan",
          uncertainHint: "Usulan mungkin sudah terkirim — memuat ulang usulan…",
          uncertainDetail: "Periksa daftar usulan sebelum mengirim kembali.",
          err,
        })
      ) {
        try {
          const rows = await api.disputes.getMutualResolution(id)
          query.setData((prev) => (prev ? { ...prev, proposals: rows } : prev))
        } catch {
          /* daftar menyusul saat penyegaran berikutnya */
        }
      }
    } finally {
      setProposing(false)
    }
    // M-46 (audit end-to-end, issue #53): `order` masuk deps — guard di atas
    // membaca `order`, dulu closure hanya disegarkan oleh `orderValue`/`myRole`
    // sehingga bisa menahan `order` basi.
  }, [id, proposeAmount, proposeNote, orderValue, myRole, order, proposing, toast.show])

  const handleRespond = useCallback(
    async (
      proposal: MutualResolutionProposal,
      action: "ACCEPT" | "REJECT" | "WITHDRAW",
      responseNote?: string,
    ) => {
      if (!id) return
      setRespondingAction(action)
      try {
        if (action === "WITHDRAW") await api.disputes.withdrawMutualResolution(id, proposal.id)
        else {
          // E-06 (audit escrow 2026-09-24): `MutualResolutionRespondDto`
          // mendukung `responseNote` (≤2000) — dulu tidak pernah dikirim.
          const note = responseNote?.trim()
          const key =
            action === "ACCEPT"
              ? (respondKeyRef.current.get(proposal.id) ??
                createIdempotencyKey())
              : undefined
          if (action === "ACCEPT") respondKeyRef.current.set(proposal.id, key!)
          await api.disputes.respondMutualResolution(id, proposal.id, {
            action,
            ...(note ? { responseNote: note } : {}),
          } satisfies MutualResolutionRespondBody, key)
          if (key) respondKeyRef.current.delete(proposal.id)
        }
      // R2 (audit escrow ronde-2, butir #43): catatan tanggapan bersama untuk
      // semua proposal — bersihkan setelah tanggapan apa pun SUKSES agar teks
      // yang dimaksudkan proposal A tidak menempel pada proposal B.
      setRespondNote("")
      toast.show({
        title:
          action === "ACCEPT"
            ? "Kesepakatan diterima"
            : action === "REJECT"
              ? "Usulan ditolak"
              : "Usulan ditarik",
        tone: "success",
        duration: 3000,
      })
      // M-45 (audit end-to-end, issue #47): refetch TERPISAH — menerima usulan
      // MEMBELAH dana escrow; dulu refetch gagal → "Gagal menanggapi usulan"
      // padahal pembagian dana SUDAH dieksekusi server (paling menyesatkan).
      void query.refresh().catch(() => {})
    } catch (err) {
        // R2 (audit escrow ronde-2, butir #1): menerima usulan MENGERAKKAN DANA
        // escrow — timeout/PARSE tidak berarti tidak dieksekusi. Tampilkan
        // peringatan jujur dan MUTLAK muat ulang state dari server.
        if (
          showMutationError(toast.show, {
            failTitle: "Gagal menanggapi usulan",
            uncertainHint: "Tanggapan mungkin sudah diproses — memuat ulang sengketa…",
            uncertainDetail:
              action === "ACCEPT"
                ? "Keputusan pembagian dana bisa sudah dieksekusi — jangan menanggapi ulang sebelum status termuat."
                : undefined,
            err,
          })
        ) {
          await query.reload().catch(() => {})
        }
      } finally {
        setRespondingAction(null)
      }
    },
    [id, toast.show, query],
  )

  const handleRequestCall = useCallback(async () => {
    if (!id) return
    setRequestingCall(true)
    try {
      await api.disputes.requestDisputeCall(id)
      toast.show({
        title: "Permintaan panggilan dikirim",
        description: "Anda akan diberi tahu saat lawan menerima.",
        tone: "success",
        duration: 4000,
      })
      const nextCalls = await api.disputes.getDisputeCalls(id).catch((err) => {
          logWarn("dispute:calls", err)
          return null
        })
      query.setData((prev) => (prev ? { ...prev, calls: nextCalls ?? prev.calls } : prev))
    } catch (err) {
      // R2 (audit escrow ronde-2, butir #7): permintaan panggilan bisa sudah
      // dibuat saat respons hilang — jangan menampilkan kegagalan palsu.
      if (
        showMutationError(toast.show, {
          failTitle: "Gagal meminta panggilan",
          uncertainHint: "Permintaan mungkin sudah terkirim — memuat ulang…",
          err,
        })
      ) {
        const nextCalls = await api.disputes.getDisputeCalls(id).catch(() => null)
        if (nextCalls) query.setData((prev) => (prev ? { ...prev, calls: nextCalls } : prev))
      }
    } finally {
      setRequestingCall(false)
    }
    // E-07 (audit escrow 2026-09-24): `calls` pernah ada di dep padahal tidak
    // dipakai (re-render percuma); `query` justru hilang dari dep handler lain.
  }, [id, toast.show, query])

  /**
   * Terima / tolak permintaan lawan, atau akhiri panggilan yang berjalan.
   * Produksi menuntut callId (CallActionDto) — diambil dari baris panggilan
   * yang sedang di-tindak-lanjuti. Sesi video (WebRTC) tidak ada di app;
   * "terima" hanya menandai kesediaan, mediator menghubungi lewat kanal
   * yang ditentukan backend.
   */
  const [callActionBusy, setCallActionBusy] = useState<"accept" | "reject" | "end" | null>(null)
  const handleCallAction = useCallback(
    async (action: "accept" | "reject" | "end", callId?: string) => {
      if (!id || callActionBusy) return
      if (!callId) {
        toast.show({ title: "Panggilan tidak ditemukan", tone: "danger" })
        return
      }
      setCallActionBusy(action)
      try {
        if (action === "accept") await api.disputes.acceptDisputeCall(id, callId)
        else if (action === "reject") await api.disputes.rejectDisputeCall(id, callId)
        else await api.disputes.endDisputeCall(id, callId)
        toast.show({
          title:
            action === "accept"
              ? "Panggilan diterima"
              : action === "reject"
                ? "Panggilan ditolak"
                : "Panggilan diakhiri",
          tone: action === "reject" ? "neutral" : "success",
          duration: 3000,
        })
        const nextCalls = await api.disputes.getDisputeCalls(id).catch((err) => {
          logWarn("dispute:calls", err)
          return null
        })
        query.setData((prev) => (prev ? { ...prev, calls: nextCalls ?? prev.calls } : prev))
      } catch (err) {
        // R2 (audit escrow ronde-2, butir #7): cabang kegagalan tak pasti.
        if (
          showMutationError(toast.show, {
            failTitle: "Gagal memproses panggilan",
            uncertainHint: "Aksi mungkin sudah diproses — memuat ulang panggilan…",
            err,
          })
        ) {
          const nextCalls = await api.disputes.getDisputeCalls(id).catch(() => null)
          if (nextCalls) query.setData((prev) => (prev ? { ...prev, calls: nextCalls } : prev))
        }
      } finally {
        setCallActionBusy(null)
      }
    },
    [id, callActionBusy, calls, toast.show],
  )

  const evidenceItems = useMemo<EvidenceItem[]>(() => {
    const meId = me?.id
    // R2 (butir #37): flatMap — lampiran tanpa URL renderable gugur dari grid.
    return evidence.flatMap((e) => {
      // E-05 (audit escrow 2026-09-24): flag `mine`/`uploadedByMe` default
      // `false` membuat bukti sendiri tidak bisa dihapus & berjudul "Bukti
      // {lawan}". Fallback terakhir: cocokkan `uploadedBy`/`userId` dengan
      // `me.id`; benar-benar tak dikenal → `false` (aman: tanpa tombol hapus).
      const record = e as unknown as Record<string, unknown>
      const uploadedBy =
        typeof record.uploadedBy === "string"
          ? record.uploadedBy
          : typeof record.userId === "string"
            ? record.userId
            : undefined
      const mine =
        e.mine ?? e.uploadedByMe ?? (uploadedBy != null && meId != null ? uploadedBy === meId : false)
      // R2 (audit ronde-2, butir #37): `fileKey` bisa berupa kunci objek S3
      // mentah yang tidak bisa dirender/diunduh langsung — jalur delivery-
      // proof sudah menyaringnya (isRenderableUrl), sengketa menyusul. URL
      // tidak renderable DIBUANG dari ubin, bukan tampil sebagai tautan rusak.
      const url = e.url ?? e.fileKey ?? ""
      if (url && !/^https?:\/\//i.test(url)) return []
      return [
        {
          id: e.id,
          url,
          mimeType: e.fileType ?? "image/jpeg",
          mine,
          description: e.description,
          uploadedAt: formatDateTime(e.createdAt),
        },
      ]
    })
  }, [evidence, me?.id])

  const openEvidence = useCallback(
    (item: EvidenceItem) =>
      setViewerItem({
        url: item.url,
        mimeType: item.mimeType,
        title: item.mine ? "Bukti Anda" : `Bukti ${counterpartName}`,
        caption: [item.description, item.uploadedAt].filter(Boolean).join(" · ") || undefined,
        evidenceId: item.id,
        mine: item.mine,
      }),
    [counterpartName],
  )

  const pendingProposal = proposals.find((p) => p.status === "PENDING")
  const hasCallInProgress = calls.some((c) =>
    ["REQUESTED", "ACCEPTED", "ONGOING"].includes(c.status),
  )

  return (
    <Screen
      edges={["top"]}
      padded={false}
      footer={
        activeCall ? (
          <InCallControlsBar
            durationSec={activeCall.durationSeconds}
            muted={callMuted}
            onToggleMute={() => setCallMuted((m) => !m)}
            speakerOn={callSpeaker}
            onToggleSpeaker={() => setCallSpeaker((s) => !s)}
            videoOn={callVideo}
            onToggleVideo={() => setCallVideo((v) => !v)}
            onEnd={() => void handleCallAction("end", activeCall.id)}
            // R2 (audit ronde-2, butir #42): mute/speaker/video di sini HANYA
            // state lokal — tidak tersambung ke media WebRTC mana pun. Tombol
            // dinonaktifkan + dijelaskan, bukan membiarkan pengguna "membisu"
            // palsu di mediasi resmi. Akhiri panggilan tetap aktif.
            mediaControlsUnavailableReason="Mikrofon, speaker, dan kamera dikelola aplikasi panggilan bawaan — tombol di sini hanya mengakhiri panggilan."
          />
        ) : dispute ? (
          <ChatComposer
            value={draft}
            onChangeText={setDraft}
            onSend={(p) => void handleSend(p.content)}
            sending={sending}
            disabled={loading}
            labels={{ placeholder: "Tulis pesan untuk mediator & lawan transaksi…" }}
          />
        ) : undefined
      }
    >
      <Header title="Detail Sengketa" />
      <PullToRefresh
        onRefresh={() => void query.refresh()}
        refreshing={refreshing}
        contentContainerClassName="px-5"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[4] },
        }}
      >
        {/* v2: skeleton → sengketa crossfade (signature moment). */}
        <Crossfade loading={loading && !dispute} skeleton={<DetailLoading />}>
          {error ? (
          <ErrorState title="Gagal memuat" description={error} onRetry={() => void query.reload()} />
        ) : dispute ? (
          <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
            <DisputeDetailHeader
              dispute={dispute}
              order={order}
              myRole={myRole}
              canEscalate={canEscalate}
              onEscalate={() => setEscalateOpen(true)}
            />

            <DisputeClaimForm
              value={claim}
              onChange={setClaim}
              onSubmit={(t) => void handleSubmitClaim(t)}
              submitting={submitting}
              existingClaim={dispute.claim || undefined}
              updatedAt={dispute.updatedAt ? formatDateTime(dispute.updatedAt) : undefined}
            />

            <DisputeMessagesSection messages={messages} />

            <SectionHeader
              title="Bukti"
              subtitle="Ketuk untuk melihat; bukti Anda bisa dihapus dari pratinjau."
            />
            <EvidenceGrid
              items={evidenceItems}
              onOpen={openEvidence}
              onAdd={() => void handleAddEvidence()}
              addDisabled={uploadingEvidence}
            />

            <DisputeMutualSection
              proposals={proposals}
              orderValue={orderValue}
              myRole={myRole}
              meId={me?.id}
              counterpartName={counterpartName}
              counterpartAvatar={counterpart?.avatarUrl ?? undefined}
              hasOrder={Boolean(order)}
              hasPendingProposal={Boolean(pendingProposal)}
              respondNote={respondNote}
              onChangeRespondNote={setRespondNote} respondingAction={respondingAction}
              onRespond={(p, action, note) => void handleRespond(p, action, note)}
              onOpenPropose={() => setProposeOpen(true)}
            />

            <DisputeCallsSection
              calls={calls}
              meId={me?.id}
              counterpartName={counterpartName}
              myRoleKnown={Boolean(myRole)} hasCallInProgress={hasCallInProgress}
              requestingCall={requestingCall}
              callActionBusy={callActionBusy}
              onCallAction={(action, callId) => void handleCallAction(action, callId)}
              onRequestCall={() => void handleRequestCall()}
            />
            </View>
          ) : null}
        </Crossfade>
      </PullToRefresh>

      <MediaViewer
        item={viewerItem}
        onClose={() => setViewerItem(null)}
        onOpenError={(message) => toast.show({ title: message, tone: "danger" })}
        actions={
          viewerItem?.mine && viewerItem.evidenceId ? (
            <Button
              variant="destructive"
              size="sm"
              fullWidth={false}
              onPress={() => setDeleteEvidenceId(viewerItem.evidenceId ?? null)}
            >
              Hapus bukti
            </Button>
          ) : undefined
        }
      />

      <DisputeActionDialogs
        deleteOpen={deleteEvidenceId != null} deleting={deletingEvidence}
        onConfirmDelete={() => void handleDeleteEvidence()}
        onCloseDelete={() => setDeleteEvidenceId(null)}
        escalateOpen={escalateOpen} escalating={escalating}
        escalateReason={escalateReason}
        onChangeEscalateReason={setEscalateReason}
        onConfirmEscalate={() => void handleEscalate()}
        onCloseEscalate={() => setEscalateOpen(false)}
      />

      <DisputeProposeSheet
        open={proposeOpen} onClose={() => setProposeOpen(false)}
        orderLoaded={Boolean(order)}
        orderValue={orderValue}
        proposeAmount={proposeAmount} onChangeAmount={setProposeAmount}
        proposeNote={proposeNote} onChangeNote={setProposeNote}
        noteMax={PROPOSAL_NOTE_MAX}
        proposing={proposing}
        onSubmit={() => void handlePropose()}
      />
    </Screen>
  )
}