/**
 * Kahade — seksi detail sengketa (pesan, penyelesaian bersama, panggilan
 * video, header ringkasan, sheet usulan).
 *
 * R2 (audit ronde-2, butir #95): diekstrak dari `app/dispute/[id].tsx`
 * (1.223 baris, pelanggar ratchet S9). Seluruh JSX & komentar audit dipindah
 * apa adanya; state & mutasi tetap di layar.
 */
import { View } from "react-native"
import { router } from "expo-router"
import { Handshake, VideoCamera } from "phosphor-react-native"

import type { DisputeCall, DisputeDetail, MutualResolutionProposal } from "@/lib/api/disputes"
import type { Order } from "@/lib/api/orders"
import { formatDateTime, formatRupiah } from "@/lib/format"
import { mapValue } from "@/lib/has-own"
import { orderFallbackLabel } from "@/lib/short-id"
import { DISPUTE_CATEGORY_LABELS, type DisputeCategoryValue } from "@/lib/labels/dispute"
import { translate } from "@/lib/i18n/translate"
import { ROUTES } from "@/lib/routes"

import { AmountInput } from "@/components/ui/amount-input"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/modal"
import { DisputeCallLogItem, type DisputeCallOutcome } from "@/components/ui/dispute-call-log-item"
import { DisputeStatusBadge } from "@/components/ui/dispute-status-badge"
import { ListGroup } from "@/components/ui/list-item"
import { MutualResolutionCard } from "@/components/ui/mutual-resolution-card"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"

type Role = "buyer" | "seller"
type RespondAction = "ACCEPT" | "REJECT" | "WITHDRAW"

/** Status panggilan API → outcome komponen (status asing dianggap selesai). */
const CALL_OUTCOME: Partial<Record<string, DisputeCallOutcome>> = {
  REQUESTED: "REQUESTED",
  ACCEPTED: "ACCEPTED",
  ONGOING: "ONGOING",
  ENDED: "COMPLETED",
  MISSED: "MISSED",
  CANCELLED: "CANCELLED",
}

/* ------------------------------------------------------------------ */
/* Header ringkasan (judul, tanggal, peran, nilai, badge) + jalur aksi  */
/* ------------------------------------------------------------------ */

export function DisputeDetailHeader({
  dispute,
  order,
  myRole,
  canEscalate,
  onEscalate,
}: {
  dispute: DisputeDetail
  order: Order | null
  myRole: Role | undefined
  canEscalate: boolean
  onEscalate: () => void
}) {
  return (
    <>
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1">
          <Text variant="h3" numberOfLines={2}>
            {order?.title ?? orderFallbackLabel(dispute.orderId)}
          </Text>
          <Text variant="caption" tone="secondary">
            Dibuka {formatDateTime(dispute.createdAt)}
            {order
              ? ` · ${myRole === "buyer" ? "Anda pembeli" : myRole === "seller" ? "Anda penjual" : "Peran belum terkonfirmasi"} · ${formatRupiah(order.orderValue)}`
              : ""}
          </Text>
          {dispute.category ? (
            <Text variant="caption" tone="secondary" className="mt-1">
              {translate("Kategori:")}{" "}
              {DISPUTE_CATEGORY_LABELS[dispute.category as DisputeCategoryValue] ?? dispute.category}
            </Text>
          ) : null}
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
      {canEscalate ? (
        <Button
          variant="ghost"
          size="sm"
          fullWidth={false}
          onPress={onEscalate}
        >
          Eskalasi ke admin
        </Button>
      ) : null}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Penyelesaian bersama                                                */
/* ------------------------------------------------------------------ */

export function DisputeMutualSection({
  proposals,
  orderValue,
  myRole,
  meId,
  counterpartName,
  counterpartAvatar,
  hasOrder,
  hasPendingProposal,
  respondNote,
  onChangeRespondNote,
  respondingAction,
  onRespond,
  onOpenPropose,
}: {
  proposals: MutualResolutionProposal[]
  orderValue: number
  myRole: Role | undefined
  meId: string | undefined
  counterpartName: string
  counterpartAvatar?: string
  hasOrder: boolean
  hasPendingProposal: boolean
  respondNote: string
  onChangeRespondNote: (value: string) => void
  respondingAction: RespondAction | null
  onRespond: (proposal: MutualResolutionProposal, action: RespondAction, note?: string) => void
  onOpenPropose: () => void
}) {
  return (
    <>
      <SectionHeader
        title="Penyelesaian bersama"
        subtitle="Sepakati pembagian dana escrow tanpa menunggu keputusan mediator."
        action={
          !hasPendingProposal && hasOrder ? (
            <Button variant="secondary" size="sm" leftIcon={Handshake} onPress={onOpenPropose}>
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
        <>
          {proposals.some((p) => p.status === "PENDING" && p.proposerId !== meId) ? (
            <TextArea
              value={respondNote}
              onChangeText={onChangeRespondNote}
              placeholder="Catatan tanggapan (opsional) — disertakan saat menerima/menolak usulan"
              maxLength={2000}
              multiline
              numberOfLines={2}
            />
          ) : null}
          {proposals.map((p) => {
            const proposedByMe = Boolean(meId && p.proposerId === meId)
            const total = Number.isFinite(orderValue)
              ? orderValue
              : p.buyerAmount != null && p.sellerAmount != null
                ? p.buyerAmount + p.sellerAmount
                : Number.NaN
            // M-47 (audit end-to-end, issue #49): kontrak PRODUKSI proposal
            // bersistem PERSENTASE (buyerPercent+sellerPercent=100) — dulu
            // pembaca hanya nominal (`p.buyerAmount ?? p.amount`) sehingga
            // payload persen = "Rincian usulan belum lengkap" PERMANEN.
            // Persen dikonversi ke nominal dari orderValue; nominal eksplisit
            // tetap menang bila ada.
            const buyerAmount =
              p.buyerAmount ??
              p.amount ??
              (p.buyerPercent != null && Number.isFinite(orderValue)
                ? Math.round((p.buyerPercent / 100) * orderValue)
                : undefined)
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
                sellerAmount={
                  p.sellerAmount ??
                  (p.sellerPercent != null && Number.isFinite(orderValue)
                    ? Math.max(0, orderValue - buyerAmount)
                    : Math.max(0, total - buyerAmount))
                }
                status={p.status}
                proposedByMe={proposedByMe}
                proposerName={proposedByMe ? undefined : counterpartName}
                proposerAvatar={proposedByMe ? undefined : counterpartAvatar}
                role={myRole}
                note={p.note}
                createdAt={formatDateTime(p.createdAt)}
                respondedAt={p.respondedAt ? formatDateTime(p.respondedAt) : undefined}
                expiresAt={p.expiresAt ? new Date(p.expiresAt) : undefined}
                onAccept={
                  // M-48 (audit end-to-end, issue #98): identitas WAJIB —
                  // dulu `me` belum termuat membuat semua usulan "milik
                  // lawan" dan tombol terima/menolak ditawarkan untuk usulan
                  // SENDIRI (membalas usulan sendiri = pembagian dana aneh).
                  pending && !proposedByMe && Boolean(meId)
                    ? () => onRespond(p, "ACCEPT", respondNote)
                    : undefined
                }
                onReject={
                  pending && !proposedByMe && Boolean(meId)
                    ? () => onRespond(p, "REJECT", respondNote)
                    : undefined
                }
                onWithdraw={pending && proposedByMe ? () => onRespond(p, "WITHDRAW") : undefined}
                accepting={respondingAction === "ACCEPT"}
                rejecting={respondingAction === "REJECT"}
                withdrawing={respondingAction === "WITHDRAW"}
              />
            )
          })}
        </>
      )}
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Panggilan video                                                     */
/* ------------------------------------------------------------------ */

export function DisputeCallsSection({
  calls,
  meId,
  counterpartName,
  myRoleKnown,
  hasCallInProgress,
  requestingCall,
  callActionBusy,
  onCallAction,
  onRequestCall,
}: {
  calls: DisputeCall[]
  meId: string | undefined
  counterpartName: string
  myRoleKnown: boolean
  hasCallInProgress: boolean
  requestingCall: boolean
  callActionBusy: "accept" | "reject" | "end" | null
  onCallAction: (action: "accept" | "reject" | "end", callId: string) => void
  onRequestCall: () => void
}) {
  return (
    <>
      <SectionHeader
        title="Panggilan video"
        subtitle="Mediator Kahade dapat bergabung untuk memeriksa barang secara langsung."
        action={
          <Button
            variant="secondary"
            size="sm"
            leftIcon={VideoCamera}
            loading={requestingCall}
            disabled={!myRoleKnown || hasCallInProgress}
            onPress={onRequestCall}
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
            const requestedByMe = Boolean(meId && c.requesterId === meId)
            const isRequested = c.status === "REQUESTED"
            const isActive = c.status === "ACCEPTED" || c.status === "ONGOING"
            return (
              <View key={c.id}>
                <DisputeCallLogItem
                  outcome={mapValue(CALL_OUTCOME, c.status, c.status)}
                  requestedByMe={requestedByMe}
                  counterpartName={counterpartName}
                  timestamp={formatDateTime(c.startedAt ?? c.requestedAt ?? c.createdAt ?? "")}
                  durationSeconds={c.durationSeconds}
                  withMediator={c.withMediator}
                  divider={i < calls.length - 1 && !isRequested && !isActive}
                />
                {isRequested && !requestedByMe ? (
                  <View className="flex-row gap-2 px-5 pb-3">
                    <Button
                      size="sm"
                      variant="primary"
                      className="flex-1"
                      loading={callActionBusy === "accept"}
                      disabled={callActionBusy !== null}
                      onPress={() => onCallAction("accept", c.id)}
                    >
                      Terima
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="flex-1"
                      loading={callActionBusy === "reject"}
                      disabled={callActionBusy !== null}
                      onPress={() => onCallAction("reject", c.id)}
                    >
                      Tolak
                    </Button>
                  </View>
                ) : null}
                {isActive || (isRequested && requestedByMe) ? (
                  <View className="px-5 pb-3">
                    <Button
                      size="sm"
                      variant="destructive"
                      loading={callActionBusy === "end"}
                      disabled={callActionBusy !== null}
                      onPress={() => onCallAction("end", c.id)}
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
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Dialog aksi (hapus bukti + eskalasi)                                */
/* ------------------------------------------------------------------ */

export function DisputeActionDialogs({
  deleteOpen,
  deleting,
  onConfirmDelete,
  onCloseDelete,
  escalateOpen,
  escalating,
  escalateReason,
  onChangeEscalateReason,
  onConfirmEscalate,
  onCloseEscalate,
  acceptOpen,
  accepting,
  acceptSummary,
  onConfirmAccept,
  onCloseAccept,
}: {
  deleteOpen: boolean
  deleting: boolean
  onConfirmDelete: () => void
  onCloseDelete: () => void
  escalateOpen: boolean
  escalating: boolean
  escalateReason: string
  onChangeEscalateReason: (value: string) => void
  onConfirmEscalate: () => void
  onCloseEscalate: () => void
  /** SEC-DSP-FE-01: konfirmasi wajib sebelum ACCEPT usulan musyawarah (dana escrow terbagi, final). */
  acceptOpen: boolean
  accepting: boolean
  acceptSummary: string
  onConfirmAccept: () => void
  onCloseAccept: () => void
}) {
  return (
    <>
      <Dialog
        title="Hapus bukti ini?"
        description="Bukti yang dihapus tidak bisa dikembalikan dan tidak lagi dilihat mediator."
        visible={deleteOpen}
        destructive
        loading={deleting}
        confirmLabel="Hapus"
        cancelLabel="Batal"
        onConfirm={onConfirmDelete}
        onCancel={onCloseDelete}
        onRequestClose={onCloseDelete}
      />

      <Dialog
        title="Setujui usulan penyelesaian?"
        description={translate("Dana escrow akan langsung dibagi sesuai usulan berikut dan tidak bisa dibatalkan: {x} Pastikan kamu sudah setuju dengan pembagiannya.", { x: acceptSummary })}
        visible={acceptOpen}
        loading={accepting}
        confirmLabel="Ya, setujui"
        cancelLabel="Batal"
        onConfirm={onConfirmAccept}
        onCancel={onCloseAccept}
        onRequestClose={onCloseAccept}
      />

      <Dialog
        title="Eskalasi sengketa ke admin?"
        description="Admin Kahade akan meninjau sengketa ini dan mengambil alih keputusan. Eskalasi manual dibatasi maksimal 2x per sengketa."
        visible={escalateOpen}
        loading={escalating}
        confirmLabel="Eskalasi"
        cancelLabel="Tutup"
        onConfirm={onConfirmEscalate}
        onCancel={onCloseEscalate}
        onRequestClose={onCloseEscalate}
      >
        <TextArea
          value={escalateReason}
          onChangeText={onChangeEscalateReason}
          placeholder="Alasan eskalasi (opsional)"
          maxLength={500}
          numberOfLines={3}
        />
      </Dialog>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* Sheet usul penyelesaian                                             */
/* ------------------------------------------------------------------ */

export function DisputeProposeSheet({
  open,
  onClose,
  orderLoaded,
  orderValue,
  proposeAmount,
  onChangeAmount,
  proposeNote,
  onChangeNote,
  noteMax,
  proposing,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  orderLoaded: boolean
  orderValue: number
  proposeAmount: number
  onChangeAmount: (value: number) => void
  proposeNote: string
  onChangeNote: (value: string) => void
  noteMax: number
  proposing: boolean
  onSubmit: () => void
}) {
  return (
    <BottomSheet
      avoidKeyboard
      visible={open}
      onRequestClose={onClose}
      title="Usulkan penyelesaian"
      description={translate(
        "Tentukan berapa dari {x} yang dikembalikan ke pembeli; sisanya ke penjual.",
        { x: formatRupiah(orderValue) },
      )}
      footer={
        <Button
          fullWidth
          loading={proposing}
          disabled={
            proposeNote.trim().length < 10 ||
            !orderLoaded ||
            !Number.isSafeInteger(orderValue) ||
            proposeAmount < 0 ||
            proposeAmount > orderValue
          }
          onPress={onSubmit}
        >
          Kirim usulan
        </Button>
      }
    >
      <View className="gap-4">
        {!orderLoaded ? (
          // E-10 (audit escrow 2026-09-24): order gagal dimuat = usulan tidak
          // terkirim — alasan eksplisit, bukan tombol yang diam-diam batal.
          <Text variant="caption" tone="danger">
            Detail order belum termuat — segarkan layar sebelum mengirim usulan.
          </Text>
        ) : null}
        <AmountInput
          value={proposeAmount}
          onChange={onChangeAmount}
          min={0}
          max={orderValue || undefined}
          label="Kembali ke pembeli"
        />
        {/*
          E-03 (audit escrow 2026-09-24): backend hanya menerima persen
          integer, jadi pratinjau MENAMPILKAN hasil bagi persen yang benar-
          benar dikirim — nominal masukan yang tidak jatuh di kelipatan
          `orderValue/100` dibulatkan ke kelipatan itu (bukan ke-ribuan).
        */}
        <Text variant="caption" tone="secondary">
          Ke penjual:{" "}
          {formatRupiah(
            Math.max(
              0,
              orderValue -
                (orderValue > 0
                  ? Math.round((Math.round((proposeAmount / orderValue) * 100) / 100) * orderValue)
                  : proposeAmount),
            ),
          )}
        </Text>
        <TextArea
          value={proposeNote}
          onChangeText={onChangeNote}
          placeholder="Jelaskan alasan usulan ini (wajib, min. 10 karakter)"
          maxLength={noteMax}
          multiline
          numberOfLines={3}
        />
      </View>
    </BottomSheet>
  )
}
