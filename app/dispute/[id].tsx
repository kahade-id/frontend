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
import { useCallback, useEffect, useMemo, useState } from "react"
import { View } from "react-native"
import { useLocalSearchParams, router } from "expo-router"
import { Handshake, VideoCamera } from "phosphor-react-native"

import { api, isApiError, userMessage } from "@/lib/api"
import type { Order } from "@/lib/api/orders"
import type { SubmitEvidenceDto } from "@/lib/api/types"
import type {
  DisputeCall,
  DisputeDetail,
  DisputeEvidence,
  DisputeMessage,
  MutualResolutionProposal,
} from "@/lib/api/disputes"
import { pickImage, pickedImageToBlob } from "@/lib/image-picker"
import { formatDateTime, formatRupiah } from "@/lib/format"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"

import { AmountInput } from "@/components/ui/amount-input"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { ChatComposer } from "@/components/ui/chat-composer"
import { ChatMessageBubble } from "@/components/ui/chat-message-bubble"
import { Dialog } from "@/components/ui/modal"
import { DisputeCallLogItem, type DisputeCallOutcome } from "@/components/ui/dispute-call-log-item"
import { DisputeClaimForm } from "@/components/ui/dispute-claim-form"
import { DisputeStatusBadge } from "@/components/ui/dispute-status-badge"
import { ErrorState } from "@/components/ui/error-state"
import { EvidenceGrid, type EvidenceItem } from "@/components/ui/evidence-grid"
import { Header } from "@/components/ui/header"
import { ListGroup } from "@/components/ui/list-item"
import { MediaViewer, type MediaViewerItem } from "@/components/ui/media-viewer"
import { MutualResolutionCard } from "@/components/ui/mutual-resolution-card"
import { DetailLoading } from "@/components/ui/paginated-list"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"
import { useToast } from "@/components/ui/toast"

type EvidenceFileType = SubmitEvidenceDto["fileTypes"][number]
const EVIDENCE_FILE_TYPES: readonly EvidenceFileType[] = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]
const PROPOSAL_NOTE_MAX = 500

/** Picker bisa melaporkan MIME di luar enum DTO (mis. image/heic) → jatuh ke JPEG (picker sudah mengompres ke JPEG). */
function toEvidenceFileType(mime: string): EvidenceFileType {
  return (EVIDENCE_FILE_TYPES as readonly string[]).includes(mime)
    ? (mime as EvidenceFileType)
    : "image/jpeg"
}

/** Status panggilan API → outcome komponen (status asing dianggap selesai). */
const CALL_OUTCOME: Partial<Record<string, DisputeCallOutcome>> = {
  REQUESTED: "REQUESTED",
  ACCEPTED: "ACCEPTED",
  ONGOING: "ONGOING",
  ENDED: "COMPLETED",
  COMPLETED: "COMPLETED",
  REJECTED: "REJECTED",
  MISSED: "MISSED",
  CANCELLED: "CANCELLED",
}

export default function DisputeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const toast = useToast()

  const [dispute, setDispute] = useState<DisputeDetail | null>(null)
  const [order, setOrder] = useState<Order | null>(null)
  const [evidence, setEvidence] = useState<DisputeEvidence[]>([])
  const [messages, setMessages] = useState<DisputeMessage[]>([])
  const [proposals, setProposals] = useState<MutualResolutionProposal[]>([])
  const [calls, setCalls] = useState<DisputeCall[]>([])
  const [claim, setClaim] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [submitting, setSubmitting] = useState(false)

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
  const [respondingAction, setRespondingAction] = useState<"ACCEPT" | "REJECT" | "WITHDRAW" | null>(
    null,
  )
  const [requestingCall, setRequestingCall] = useState(false)

  const myRole =
    order?.myRole === "SELLER" ? "seller" : order?.myRole === "BUYER" ? "buyer" : undefined
  const me = order && myRole ? (myRole === "seller" ? order.seller : order.buyer) : null
  const counterpart = order && myRole ? (myRole === "seller" ? order.buyer : order.seller) : null
  const counterpartName =
    counterpart?.fullName ??
    (counterpart?.username ? `@${counterpart.username}` : "Lawan transaksi")
  const orderValue = order?.orderValue ?? Number.NaN

  const fetchAll = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const d = await api.disputes.getDispute(id)
      const [ev, msgs, props, cl, o] = await Promise.all([
        api.disputes.getDisputeEvidence(id),
        api.disputes.getDisputeMessages(id),
        api.disputes.getMutualResolution(id),
        api.disputes.getDisputeCalls(id),
        d.orderId ? api.orders.getOrder(d.orderId).catch(() => null) : Promise.resolve(null),
      ])
      setDispute(d)
      setOrder(o)
      setEvidence(ev ?? [])
      setMessages(msgs ?? [])
      setProposals(props ?? [])
      setCalls(cl ?? [])
      setClaim(d.claim ?? "")
    } catch (err) {
      setError(isApiError(err) ? userMessage(err) : "Gagal memuat sengketa.")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchAll()
    setRefreshing(false)
  }, [fetchAll])

  const handleSubmitClaim = useCallback(
    async (text: string) => {
      if (!id) return
      setSubmitting(true)
      try {
        await api.disputes.submitDisputeClaim(id, { claim: text.trim() })
        toast.show({ title: "Klaim diperbarui", tone: "success", duration: 3000 })
        await fetchAll()
      } catch (err) {
        toast.show({
          title: "Gagal menyimpan klaim",
          description: isApiError(err) ? userMessage(err) : undefined,
          tone: "danger",
        })
      } finally {
        setSubmitting(false)
      }
    },
    [id, toast.show, fetchAll],
  )

  const handleSend = useCallback(
    async (content: string) => {
      const text = content.trim()
      if (!id || !text) return
      setSending(true)
      try {
        await api.disputes.sendDisputeMessage(id, text)
        setDraft("")
        setMessages(await api.disputes.getDisputeMessages(id))
      } catch (err) {
        toast.show({
          title: "Gagal mengirim pesan",
          description: isApiError(err) ? userMessage(err) : undefined,
          tone: "danger",
        })
      } finally {
        setSending(false)
      }
    },
    [id, toast.show],
  )

  const handleAddEvidence = useCallback(async () => {
    if (!id) return
    const picked = await pickImage()
    if (picked.status === "denied") {
      toast.show({ title: "Akses galeri ditolak", tone: "danger" })
      return
    }
    if (picked.status !== "picked") return
    setSubmitting(true)
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
        description: asset.name,
        fileUrls: [fileKey],
        fileTypes: [toEvidenceFileType(asset.mimeType)],
      })
      setEvidence(await api.disputes.getDisputeEvidence(id))
      toast.show({ title: "Bukti terkirim", tone: "success", duration: 3000 })
    } catch (err) {
      toast.show({
        title: "Gagal mengunggah bukti",
        description: isApiError(err) ? userMessage(err) : undefined,
        tone: "danger",
      })
    } finally {
      setSubmitting(false)
    }
  }, [id, toast.show])

  const handleDeleteEvidence = useCallback(async () => {
    if (!id || !deleteEvidenceId) return
    setDeletingEvidence(true)
    try {
      await api.disputes.deleteDisputeEvidence(id, deleteEvidenceId)
      setEvidence((prev) => prev.filter((e) => e.id !== deleteEvidenceId))
      setDeleteEvidenceId(null)
      setViewerItem(null)
      toast.show({ title: "Bukti dihapus", tone: "success", duration: 3000 })
    } catch (err) {
      toast.show({
        title: "Gagal menghapus bukti",
        description: isApiError(err) ? userMessage(err) : undefined,
        tone: "danger",
      })
    } finally {
      setDeletingEvidence(false)
    }
  }, [id, deleteEvidenceId, toast.show])

  const handlePropose = useCallback(async () => {
    if (
      !id ||
      !myRole ||
      proposing ||
      !Number.isSafeInteger(orderValue) ||
      !Number.isSafeInteger(proposeAmount) ||
      proposeAmount < 0 ||
      proposeAmount > orderValue
    )
      return
    setProposing(true)
    try {
      await api.disputes.proposeMutualResolution(id, {
        amount: proposeAmount,
        note: proposeNote.trim() || undefined,
      })
      setProposeOpen(false)
      setProposeNote("")
      toast.show({
        title: "Usulan dikirim",
        description: "Menunggu tanggapan lawan transaksi.",
        tone: "success",
        duration: 3000,
      })
      setProposals(await api.disputes.getMutualResolution(id))
    } catch (err) {
      toast.show({
        title: "Gagal mengirim usulan",
        description: isApiError(err) ? userMessage(err) : undefined,
        tone: "danger",
      })
    } finally {
      setProposing(false)
    }
  }, [id, proposeAmount, proposeNote, orderValue, myRole, proposing, toast.show])

  const handleRespond = useCallback(
    async (proposal: MutualResolutionProposal, action: "ACCEPT" | "REJECT" | "WITHDRAW") => {
      if (!id) return
      setRespondingAction(action)
      try {
        if (action === "WITHDRAW") await api.disputes.withdrawMutualResolution(id, proposal.id)
        else await api.disputes.respondMutualResolution(id, proposal.id, { action })
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
        await fetchAll()
      } catch (err) {
        toast.show({
          title: "Gagal menanggapi usulan",
          description: isApiError(err) ? userMessage(err) : undefined,
          tone: "danger",
        })
      } finally {
        setRespondingAction(null)
      }
    },
    [id, toast.show, fetchAll],
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
      setCalls(await api.disputes.getDisputeCalls(id).catch(() => calls))
    } catch (err) {
      toast.show({
        title: "Gagal meminta panggilan",
        description: isApiError(err) ? userMessage(err) : undefined,
        tone: "danger",
      })
    } finally {
      setRequestingCall(false)
    }
  }, [id, calls, toast.show])

  /**
   * Terima / tolak permintaan lawan, atau akhiri panggilan yang berjalan.
   * Endpoint tanpa id panggilan (POST /call/accept|reject|end) — berlaku
   * untuk panggilan aktif sengketa ini. Sesi video (WebRTC) tidak ada di
   * app; "terima" hanya menandai kesediaan, mediator menghubungi lewat kanal
   * yang ditentukan backend (UNVERIFIED).
   */
  const [callActionBusy, setCallActionBusy] = useState<"accept" | "reject" | "end" | null>(null)
  const handleCallAction = useCallback(
    async (action: "accept" | "reject" | "end") => {
      if (!id || callActionBusy) return
      setCallActionBusy(action)
      try {
        if (action === "accept") await api.disputes.acceptDisputeCall(id)
        else if (action === "reject") await api.disputes.rejectDisputeCall(id)
        else await api.disputes.endDisputeCall(id)
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
        setCalls(await api.disputes.getDisputeCalls(id).catch(() => calls))
      } catch (err) {
        toast.show({
          title: "Gagal memproses panggilan",
          description: isApiError(err) ? userMessage(err) : undefined,
          tone: "danger",
        })
      } finally {
        setCallActionBusy(null)
      }
    },
    [id, callActionBusy, calls, toast.show],
  )

  const evidenceItems = useMemo<EvidenceItem[]>(
    () =>
      evidence.map((e) => ({
        id: e.id,
        url: e.url ?? e.fileKey ?? "",
        mimeType: e.fileType ?? "image/jpeg",
        mine: e.mine ?? e.uploadedByMe ?? false,
        description: e.description,
        uploadedAt: formatDateTime(e.createdAt),
      })),
    [evidence],
  )

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
        dispute ? (
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
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: tokens.space[4] },
        }}
      >
        {loading && !dispute ? (
          <DetailLoading />
        ) : error ? (
          <ErrorState title="Gagal memuat" description={error} onRetry={() => void fetchAll()} />
        ) : dispute ? (
          <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-1">
                <Text variant="h3" numberOfLines={2}>
                  {order?.title ?? `Order ${dispute.orderId}`}
                </Text>
                <Text variant="caption" tone="secondary">
                  Dibuka {formatDateTime(dispute.createdAt)}
                  {order
                    ? ` · ${myRole === "buyer" ? "Anda pembeli" : myRole === "seller" ? "Anda penjual" : "Peran belum terkonfirmasi"} · ${formatRupiah(order.orderValue)}`
                    : ""}
                </Text>
              </View>
              <DisputeStatusBadge status={dispute.status} />
            </View>
            {dispute.orderId ? (
              <Button
                variant="ghost"
                size="sm"
                fullWidth={false}
                onPress={() => router.push(ROUTES.orderDetail(dispute.orderId))}
              >
                Lihat pesanan
              </Button>
            ) : null}

            <DisputeClaimForm
              value={claim}
              onChange={setClaim}
              onSubmit={(t) => void handleSubmitClaim(t)}
              submitting={submitting}
              existingClaim={dispute.claim || undefined}
              updatedAt={dispute.updatedAt ? formatDateTime(dispute.updatedAt) : undefined}
            />

            <SectionHeader title="Pesan" />
            {messages.length === 0 ? (
              <Text variant="body" tone="secondary">
                Belum ada pesan. Tulis di kolom bawah untuk mediator dan lawan transaksi.
              </Text>
            ) : (
              messages.map((m, i) => (
                <ChatMessageBubble
                  key={m.id}
                  direction={m.fromUser ? "outgoing" : "incoming"}
                  text={m.text}
                  time={formatDateTime(m.createdAt)}
                  grouped={messages[i - 1]?.fromUser === m.fromUser}
                />
              ))
            )}

            <SectionHeader
              title="Bukti"
              subtitle="Ketuk untuk melihat; bukti Anda bisa dihapus dari pratinjau."
            />
            <EvidenceGrid
              items={evidenceItems}
              onOpen={openEvidence}
              onAdd={() => void handleAddEvidence()}
              addDisabled={submitting}
            />

            <SectionHeader
              title="Penyelesaian bersama"
              subtitle="Sepakati pembagian dana escrow tanpa menunggu keputusan mediator."
              action={
                !pendingProposal && order ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={Handshake}
                    onPress={() => setProposeOpen(true)}
                  >
                    Usulkan
                  </Button>
                ) : undefined
              }
            />
            {proposals.length === 0 ? (
              <Text variant="body" tone="secondary">
                Belum ada usulan penyelesaian.
              </Text>
            ) : (
              proposals.map((p) => {
                const proposedByMe = Boolean(me?.id && p.proposerId === me.id)
                const total = Number.isFinite(orderValue)
                  ? orderValue
                  : p.buyerAmount != null && p.sellerAmount != null
                    ? p.buyerAmount + p.sellerAmount
                    : Number.NaN
                const buyerAmount = p.buyerAmount ?? p.amount
                if (
                  !myRole ||
                  buyerAmount == null ||
                  !Number.isSafeInteger(total) ||
                  buyerAmount < 0 ||
                  buyerAmount > total
                )
                  return (
                    <Text key={p.id} variant="body" tone="secondary">
                      Rincian usulan belum lengkap. Muat ulang sebelum menanggapi.
                    </Text>
                  )
                const pending = p.status === "PENDING"
                return (
                  <MutualResolutionCard
                    key={p.id}
                    totalAmount={total}
                    buyerAmount={buyerAmount}
                    sellerAmount={p.sellerAmount ?? Math.max(0, total - buyerAmount)}
                    status={p.status}
                    proposedByMe={proposedByMe}
                    proposerName={proposedByMe ? undefined : counterpartName}
                    proposerAvatar={
                      proposedByMe ? undefined : (counterpart?.avatarUrl ?? undefined)
                    }
                    role={myRole}
                    note={p.note}
                    createdAt={formatDateTime(p.createdAt)}
                    respondedAt={p.respondedAt ? formatDateTime(p.respondedAt) : undefined}
                    expiresAt={p.expiresAt ? new Date(p.expiresAt) : undefined}
                    onAccept={
                      pending && !proposedByMe ? () => void handleRespond(p, "ACCEPT") : undefined
                    }
                    onReject={
                      pending && !proposedByMe ? () => void handleRespond(p, "REJECT") : undefined
                    }
                    onWithdraw={
                      pending && proposedByMe ? () => void handleRespond(p, "WITHDRAW") : undefined
                    }
                    accepting={respondingAction === "ACCEPT"}
                    rejecting={respondingAction === "REJECT"}
                    withdrawing={respondingAction === "WITHDRAW"}
                  />
                )
              })
            )}

            <SectionHeader
              title="Panggilan video"
              subtitle="Mediator Kahade dapat bergabung untuk memeriksa barang secara langsung."
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={VideoCamera}
                  loading={requestingCall}
                  disabled={!myRole || hasCallInProgress}
                  onPress={() => void handleRequestCall()}
                >
                  Minta
                </Button>
              }
            />
            {calls.length === 0 ? (
              <Text variant="body" tone="secondary">
                Belum ada panggilan video.
              </Text>
            ) : (
              <ListGroup>
                {calls.map((c, i) => {
                  const requestedByMe = Boolean(me?.id && c.requesterId === me.id)
                  const isRequested = c.status === "REQUESTED"
                  const isActive = c.status === "ACCEPTED" || c.status === "ONGOING"
                  return (
                    <View key={c.id}>
                      <DisputeCallLogItem
                        outcome={CALL_OUTCOME[c.status] ?? c.status}
                        requestedByMe={requestedByMe}
                        counterpartName={counterpartName}
                        timestamp={formatDateTime(
                          c.startedAt ?? c.requestedAt ?? c.createdAt ?? "",
                        )}
                        durationSeconds={c.durationSeconds}
                        withMediator={c.withMediator}
                        divider={i < calls.length - 1 && !isRequested && !isActive}
                      />
                      {isRequested && !requestedByMe ? (
                        <View className="flex-row gap-2 px-6 pb-3">
                          <Button
                            size="sm"
                            variant="primary"
                            className="flex-1"
                            loading={callActionBusy === "accept"}
                            disabled={callActionBusy !== null}
                            onPress={() => void handleCallAction("accept")}
                          >
                            Terima
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            className="flex-1"
                            loading={callActionBusy === "reject"}
                            disabled={callActionBusy !== null}
                            onPress={() => void handleCallAction("reject")}
                          >
                            Tolak
                          </Button>
                        </View>
                      ) : null}
                      {isActive || (isRequested && requestedByMe) ? (
                        <View className="px-6 pb-3">
                          <Button
                            size="sm"
                            variant="destructive"
                            loading={callActionBusy === "end"}
                            disabled={callActionBusy !== null}
                            onPress={() => void handleCallAction("end")}
                          >
                            {isActive ? "Akhiri panggilan" : "Batalkan permintaan"}
                          </Button>
                        </View>
                      ) : null}
                    </View>
                  )
                })}
              </ListGroup>
            )}
          </View>
        ) : null}
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

      <Dialog
        title="Hapus bukti ini?"
        description="Bukti yang dihapus tidak bisa dikembalikan dan tidak lagi dilihat mediator."
        visible={deleteEvidenceId != null}
        destructive
        loading={deletingEvidence}
        confirmLabel="Hapus"
        cancelLabel="Batal"
        onConfirm={() => void handleDeleteEvidence()}
        onCancel={() => setDeleteEvidenceId(null)}
        onRequestClose={() => setDeleteEvidenceId(null)}
      />

      <BottomSheet
        visible={proposeOpen}
        onRequestClose={() => setProposeOpen(false)}
        title="Usulkan penyelesaian"
        description={`Tentukan berapa dari ${formatRupiah(orderValue)} yang dikembalikan ke pembeli; sisanya ke penjual.`}
        footer={
          <Button fullWidth loading={proposing} onPress={() => void handlePropose()}>
            Kirim Usulan
          </Button>
        }
      >
        <View className="gap-4">
          <AmountInput
            value={proposeAmount}
            onChange={setProposeAmount}
            min={0}
            max={orderValue || undefined}
            label="Kembali ke pembeli"
          />
          <Text variant="caption" tone="secondary">
            Ke penjual: {formatRupiah(Math.max(0, orderValue - proposeAmount))}
          </Text>
          <TextArea
            value={proposeNote}
            onChangeText={setProposeNote}
            placeholder="Catatan untuk lawan transaksi (opsional)"
            maxLength={PROPOSAL_NOTE_MAX}
            multiline
            numberOfLines={3}
          />
        </View>
      </BottomSheet>
    </Screen>
  )
}
