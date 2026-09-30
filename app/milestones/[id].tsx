/**
 * Screen — Detail Tahap Milestone (escrow bertahap).
 *
 * KONTRAK (asumsi sementara; endpoint backend /v1/milestones/:id/* sedang
 * dibangun worker lain — sesuaikan bila final berbeda):
 * - GET  /v1/milestones/:id            → detail tahap + evidence + events
 * - POST /v1/milestones/:id/submit    { evidenceKeys?, note? }
 * - POST /v1/milestones/:id/accept
 * - POST /v1/milestones/:id/request-revision  { note }
 * - POST /v1/milestones/:id/propose-change    { title?, amount?, deadline?, note }
 * - POST /v1/milestones/:id/approve-change
 * - POST /v1/milestones/:id/evidence  { fileKey, caption? }
 *
 * Peran & identitas dibaca dari order (GET /orders/{orderId} → myRole),
 * seperti layar sengketa — bukan dari param rute.
 *
 * Kerangka <DataScreen> (S3): urutan state loading → error → konten,
 * bottom inset, dan pull-to-refresh konsisten dengan layar data lain.
 * `keyboardAvoiding` dipertahankan untuk TextArea inline (catatan revisi /
 * usulan perubahan).
 *
 * Escrow satu tahap existing TIDAK disentuh: layar ini hanya dapat dibuka
 * dari order yang memang punya milestone.
 */
import { useCallback, useState } from "react"
import { View } from "react-native"
import { useLocalSearchParams } from "expo-router"
import { Image } from "phosphor-react-native"

import {
  api,
  remainingRevisions,
  userMessage,
  type Order,
  type OrderMilestone,
} from "@/lib/api"
import {
  disbursementStatusCopy,
  getDisbursements,
  type Disbursement,
} from "@/lib/api/disbursements"
import { logWarn } from "@/lib/telemetry"
import { formatDateTime, formatDateTimeWIB, formatRupiah, parseRupiah } from "@/lib/format"
import { pickImage } from "@/lib/image-picker"
import { translate } from "@/lib/i18n"
import { useApiQuery } from "@/lib/use-api-query"
import { useWalletEnabled } from "@/lib/use-wallet-enabled"

import { Button } from "@/components/ui/button"
import { AmountInput } from "@/components/ui/amount-input"
import { DataScreen } from "@/components/ui/data-screen"
import { DateField } from "@/components/ui/date-field"
import { normalizePickerDate } from "@/components/ui/date-picker-sheet"
import { Dialog } from "@/components/ui/modal"
import { EmptyState } from "@/components/ui/empty-state"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { KeyValue, KeyValueList } from "@/components/ui/key-value"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"
import { useToast } from "@/components/ui/toast"
import { UPLOAD_DEFAULT_MAX_MB } from "@/components/ui/upload-field"

import { MILESTONE_STATUS_LABEL, MILESTONE_STATUS_TONE } from "@/components/order-milestones"
import { Badge } from "@/components/ui/badge"

const EVENT_LABEL: Record<string, string> = {
  CREATED: "Tahap dibuat",
  UPDATED: "Tahap diperbarui",
  ACTIVATED: "Tahap diaktifkan",
  SUBMITTED: "Hasil dikirim penjual",
  REVISION_REQUESTED: "Revisi diminta",
  ACCEPTED: "Tahap diterima pembeli",
  RELEASED: "Dana dicairkan",
  CHANGE_PROPOSED: "Perubahan diusulkan",
  CHANGE_APPROVED: "Perubahan disetujui",
  DISPUTED: "Tahap disengketakan",
  CANCELLED: "Tahap dibatalkan",
}

const SUBMITTABLE = ["AWAITING_ACTIVATION", "REVISION_REQUESTED"] as const

export default function MilestoneDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const toast = useToast()
  // Mode Tanpa Wallet Internal: pencairan tahap = disbursement DANA ke
  // rekening bank penjual (bukan ke dompet) — copy disesuaikan.
  const walletEnabled = useWalletEnabled()

  const query = useApiQuery<{
    milestone: OrderMilestone
    order: Order | null
    disbursement: Disbursement | null
  }>(
    `milestone-detail:${id}`,
    async (signal) => {
      const mid = id as string
      const milestone = await api.milestones.getMilestone(mid, signal)
      if (!milestone) throw new Error("Tahap tidak ditemukan.")
      const order = milestone.orderId
        ? await api.orders.getOrder(milestone.orderId, signal).catch((err) => {
            logWarn("milestone:order", err)
            return null
          })
        : null
      // BFI-082: status transfer DANA aktual (scope MILESTONE) — defensif:
      // gagal/tidak ada → null, UI tetap tampil seperti sebelumnya.
      const disbursement = await getDisbursements({ scope: "MILESTONE", limit: 100, signal })
        .then(
          (items) =>
            items.find((d) => d.scopeRefId === mid || d.orderId === milestone.orderId) ?? null,
        )
        .catch((err) => {
          logWarn("milestone:disbursement", err)
          return null
        })
      return { milestone, order, disbursement }
    },
    Boolean(id),
  )

  const milestone = query.data?.milestone ?? null
  const order = query.data?.order ?? null
  const disbursement = query.data?.disbursement ?? null
  const myRole = order?.myRole === "BUYER" || order?.myRole === "SELLER" ? order.myRole : undefined
  const isBuyer = myRole === "BUYER"
  const isSeller = myRole === "SELLER"

  const [busy, setBusy] = useState(false)
  const [confirmAccept, setConfirmAccept] = useState(false)
  const [revisionNote, setRevisionNote] = useState("")
  const [revisionOpen, setRevisionOpen] = useState(false)
  const [submitNote, setSubmitNote] = useState("")
  const [uploading, setUploading] = useState(false)
  const [proposeOpen, setProposeOpen] = useState(false)
  const [propTitle, setPropTitle] = useState("")
  const [propAmount, setPropAmount] = useState("")
  // UI-T005 (audit UI/UX 2026-09-27): tenggat dipilih lewat kalender, bukan
  // ketik ISO mentah — format yang dikirim ke API tetap string ISO.
  const [propDeadlineDate, setPropDeadlineDate] = useState<Date | null>(null)
  const [propNote, setPropNote] = useState("")

  const runAction = useCallback(
    async (fn: () => Promise<unknown>, okTitle: string, failTitle: string) => {
      if (busy) return
      setBusy(true)
      try {
        await fn()
        await query.refresh()
        toast.show({ title: okTitle, tone: "success" })
      } catch (e) {
        toast.show({ title: failTitle, description: userMessage(e), tone: "danger" })
      } finally {
        setBusy(false)
      }
    },
    [busy, query, toast],
  )

  const handleAttachEvidence = useCallback(async () => {
    if (!milestone || uploading) return
    const picked = await pickImage({ allowVideos: false })
    if (picked.status === "denied") {
      toast.show({ title: "Akses galeri ditolak", tone: "danger" })
      return
    }
    if (picked.status !== "picked") return
    // UI-T008 (audit UI/UX 2026-09-27): validasi ukuran SEBELUM upload —
    // pola yang sama dengan bukti pengiriman (F7), satu batas 10 MB.
    if (picked.asset.size > 0 && picked.asset.size > UPLOAD_DEFAULT_MAX_MB * 1024 * 1024) {
      toast.show({
        title: "Berkas terlalu besar",
        description: translate("Ukuran berkas melebihi {x} MB.", { x: UPLOAD_DEFAULT_MAX_MB }),
        tone: "danger",
      })
      return
    }
    setUploading(true)
    try {
      const { fileKey } = await api.upload.uploadDirectImage(picked.asset, "MILESTONE_EVIDENCE")
      await api.milestones.attachMilestoneEvidence(milestone.id, { fileKey })
      await query.refresh()
      toast.show({ title: "Bukti dilampirkan", tone: "success" })
    } catch (e) {
      toast.show({ title: "Gagal mengunggah bukti", description: userMessage(e), tone: "danger" })
    } finally {
      setUploading(false)
    }
  }, [milestone, uploading, query, toast])

  const canSubmit =
    milestone != null &&
    isSeller &&
    SUBMITTABLE.includes(milestone.status as (typeof SUBMITTABLE)[number])
  const canAccept = isBuyer && milestone?.status === "SUBMITTED"
  const revisionsLeft = milestone ? remainingRevisions(milestone) : 0
  const canRevise = isBuyer && milestone?.status === "SUBMITTED" && revisionsLeft > 0
  const change = milestone?.changeRequest
  const changePending =
    change != null &&
    milestone != null &&
    ["AWAITING_ACTIVATION", "SUBMITTED", "REVISION_REQUESTED"].includes(milestone.status)
  const approvedByMe =
    milestone == null ? false : isBuyer ? milestone.buyerApprovedChange : milestone.sellerApprovedChange
  const canPropose =
    milestone != null &&
    (isBuyer || isSeller) &&
    ["AWAITING_ACTIVATION", "SUBMITTED", "REVISION_REQUESTED"].includes(milestone.status) &&
    !changePending

  return (
    <DataScreen
      title={milestone ? `Tahap ${milestone.seq}: ${milestone.title}` : "Detail Tahap"}
      state={query}
      loadingMessage="Memuat tahap…"
      errorTitle="Gagal memuat tahap"
      keyboardAvoiding
      empty={
        !query.loading && !query.error && !milestone
          ? {
              icon: Image,
              title: "Tahap tidak ditemukan",
              description: "Tahap yang diminta tidak tersedia.",
            }
          : undefined
      }
    >
      {milestone ? (
        <>
          <View className="gap-5">
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1">
                <Text variant="h2" numberOfLines={3}>
                  {milestone.title}
                </Text>
                {milestone.description ? (
                  <Text variant="body" tone="secondary" className="mt-1">
                    {milestone.description}
                  </Text>
                ) : null}
              </View>
              <Badge tone={MILESTONE_STATUS_TONE[milestone.status] ?? "neutral"}>
                {MILESTONE_STATUS_LABEL[milestone.status] ?? milestone.status}
              </Badge>
            </View>

            <KeyValueList>
              <KeyValue
                label="Nilai tahap"
                value={<Text variant="monoBody">{formatRupiah(milestone.amount)}</Text>}
                emphasis
              />
              <KeyValue
                label={walletEnabled ? "Dicairkan ke penjual" : "Cair ke rekening penjual"}
                value={<Text variant="monoBody">{formatRupiah(milestone.sellerAmount)}</Text>}
              />
              {/* BFI-082: status RELEASED = milestone disetujui, BUKAN bukti dana
                  sampai — tampilkan status transfer DANA aktual bila ada. */}
              {disbursement ? (
                <KeyValue
                  label="Status transfer bank"
                  value={<Text>{disbursementStatusCopy(disbursement).title}</Text>}
                />
              ) : null}
              {milestone.escrowHeld > 0 ? (
                <KeyValue
                  label="Escrow ditahan"
                  value={<Text variant="monoBody">{formatRupiah(milestone.escrowHeld)}</Text>}
                />
              ) : null}
              {milestone.deadline ? (
                <KeyValue label="Tenggat pengerjaan" value={formatDateTimeWIB(milestone.deadline)} />
              ) : null}
              {milestone.reviewDeadline ? (
                <KeyValue label="Tenggat review" value={formatDateTimeWIB(milestone.reviewDeadline)} />
              ) : null}
              <KeyValue
                label="Putaran revisi tersisa"
                value={`${revisionsLeft} dari ${milestone.maxRevisionRounds}`}
              />
            </KeyValueList>

            {changePending && change ? (
              <View className="gap-2 rounded-lg bg-warning-soft p-3">
                <Text variant="body" weight={600}>
                  Usulan perubahan menunggu persetujuan
                </Text>
                {change.title ? <Text variant="body">{change.title}</Text> : null}
                {typeof change.amount === "number" ? (
                  <Text variant="monoBody">{formatRupiah(change.amount)}</Text>
                ) : null}
                {change.deadline ? (
                  <Text variant="caption" tone="secondary">
                    Tenggat baru: {formatDateTimeWIB(change.deadline)}
                  </Text>
                ) : null}
                {change.note ? (
                  <Text variant="caption" tone="secondary">
                    {change.note}
                  </Text>
                ) : null}
                {!approvedByMe && (isBuyer || isSeller) ? (
                  <Button
                    size="sm"
                    loading={busy}
                    onPress={() =>
                      void runAction(
                        () => api.milestones.approveMilestoneChange(milestone.id),
                        "Perubahan disetujui",
                        "Gagal menyetujui perubahan",
                      )
                    }
                  >
                    Setujui perubahan
                  </Button>
                ) : (
                  <Text variant="caption" tone="secondary">
                    Anda sudah menyetujui — menunggu pihak lain.
                  </Text>
                )}
              </View>
            ) : null}

            {/* ── Aksi seller: kirim hasil + lampirkan bukti ── */}
            {canSubmit ? (
              <View className="gap-3">
                <SectionHeader title="Kirim hasil" />
                <Field label="Catatan hasil (opsional)">
                  <TextArea
                    value={submitNote}
                    onChangeText={setSubmitNote}
                    placeholder="Jelaskan hasil pekerjaan tahap ini…"
                    maxLength={2000}
                    multiline
                    numberOfLines={4}
                  />
                </Field>
                <Button
                  variant="secondary"
                  loading={uploading}
                  onPress={() => void handleAttachEvidence()}
                >
                  Lampirkan bukti
                </Button>
                {(milestone.evidence?.length ?? 0) > 0 ? (
                  <Text variant="caption" tone="secondary">
                    {milestone.evidence!.length} bukti dilampirkan.
                  </Text>
                ) : null}
                <Button
                  loading={busy}
                  onPress={() =>
                    void runAction(
                      () =>
                        api.milestones.submitMilestone(milestone.id, {
                          note: submitNote.trim() || undefined,
                        }),
                      "Hasil tahap terkirim — menunggu review pembeli",
                      "Gagal mengirim hasil",
                    )
                  }
                >
                  Kirim hasil
                </Button>
              </View>
            ) : null}

            {/* ── Aksi buyer: terima & cairkan / minta revisi ── */}
            {canAccept ? (
              <View className="gap-2">
                <SectionHeader title="Review hasil" />
                <Button onPress={() => setConfirmAccept(true)}>
                  Terima &amp; cairkan
                </Button>
                {canRevise ? (
                  <Button variant="secondary" onPress={() => setRevisionOpen(true)}>
                    Minta revisi ({revisionsLeft} putaran tersisa)
                  </Button>
                ) : (
                  <Text variant="caption" tone="secondary">
                    Putaran revisi sudah habis.
                  </Text>
                )}
              </View>
            ) : null}

            {revisionOpen ? (
              <View className="gap-3">
                <Field
                  label="Catatan revisi"
                  required
                  helperText={`Sisa putaran revisi: ${revisionsLeft}`}
                >
                  <TextArea
                    value={revisionNote}
                    onChangeText={setRevisionNote}
                    placeholder="Jelaskan yang perlu diperbaiki…"
                    maxLength={2000}
                    multiline
                    numberOfLines={4}
                  />
                </Field>
                <View className="flex-row gap-2">
                  <View className="flex-1">
                    <Button variant="secondary" onPress={() => setRevisionOpen(false)}>
                      Batal
                    </Button>
                  </View>
                  <View className="flex-1">
                    <Button
                      loading={busy}
                      disabled={revisionNote.trim().length === 0}
                      onPress={() =>
                        void runAction(
                          () => api.milestones.requestMilestoneRevision(milestone.id, revisionNote.trim()),
                          "Revisi diminta",
                          "Gagal meminta revisi",
                        ).then(() => setRevisionOpen(false))
                      }
                    >
                      Kirim permintaan
                    </Button>
                  </View>
                </View>
              </View>
            ) : null}

            {/* ── Usulkan perubahan (kedua pihak) ── */}
            {canPropose ? (
              <View className="gap-3">
                <Button variant="ghost" onPress={() => setProposeOpen((v) => !v)}>
                  Usulkan perubahan
                </Button>
                {proposeOpen ? (
                  <View className="gap-3">
                    <Field label="Judul baru (opsional)">
                      <Input
                        value={propTitle}
                        onChangeText={setPropTitle}
                        placeholder="Judul tahap"
                        maxLength={120}
                      />
                    </Field>
                    {/* FE-052: <AmountInput> tervalidasi — pemisah ribuan saat
                        mengetik; state digit mentah (string) — nilai ke
                        backend tidak berubah. */}
                    <AmountInput
                      label="Nilai baru (opsional, rupiah)"
                      value={propAmount ? Number(propAmount) : 0}
                      onChange={(n) => setPropAmount(n > 0 ? String(n) : "")}
                      placeholder="cth. 1.500.000"
                      reserveHelperSpace={false}
                    />
                    <DateField
                      label="Tenggat baru (opsional)"
                      value={propDeadlineDate}
                      onChange={(d) => setPropDeadlineDate(normalizePickerDate(d))}
                      title="Tenggat baru"
                    />
                    <Field label="Catatan">
                      <TextArea
                        value={propNote}
                        onChangeText={setPropNote}
                        placeholder="Alasan perubahan…"
                        maxLength={2000}
                        multiline
                        numberOfLines={3}
                      />
                    </Field>
                    <Button
                      loading={busy}
                      disabled={propNote.trim().length === 0}
                      onPress={() => {
                        const amountNum = propAmount.trim() ? parseRupiah(propAmount) : undefined
                        if (propAmount.trim() && (amountNum === 0 || amountNum == null)) {
                          toast.show({ title: "Nilai tidak valid", tone: "danger" })
                          return
                        }
                        void runAction(
                          () =>
                            api.milestones.proposeMilestoneChange(milestone.id, {
                              title: propTitle.trim() || undefined,
                              amount: amountNum,
                              deadline: propDeadlineDate ? propDeadlineDate.toISOString() : undefined,
                              note: propNote.trim(),
                            }),
                          "Usulan perubahan dikirim",
                          "Gagal mengusulkan perubahan",
                        ).then(() => {
                          setProposeOpen(false)
                          setPropTitle("")
                          setPropAmount("")
                          setPropDeadlineDate(null)
                          setPropNote("")
                        })
                      }}
                    >
                      Kirim usulan
                    </Button>
                    <Text variant="caption" tone="secondary">
                      Perubahan berlaku bila disetujui kedua pihak.
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* ── Bukti ── */}
            <View className="gap-2">
              <SectionHeader title="Bukti" subtitle={`${milestone.evidence?.length ?? 0} berkas`} />
              {(milestone.evidence?.length ?? 0) === 0 ? (
                <EmptyState
                  compact
                  icon={Image}
                  title="Belum ada bukti"
                  description="Bukti hasil pekerjaan akan tampil di sini."
                />
              ) : (
                <View className="gap-2">
                  {milestone.evidence!.map((e) => (
                    <View key={e.id} className="rounded-lg border border-border bg-surface p-3">
                      <Text variant="monoBody" tone="secondary" numberOfLines={1}>
                        {e.fileKey.split("/").pop() ?? e.fileKey}
                      </Text>
                      {e.caption ? (
                        <Text variant="caption" tone="secondary" className="mt-1">
                          {e.caption}
                        </Text>
                      ) : null}
                      <Text variant="caption" tone="tertiary">
                        {formatDateTime(e.createdAt)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* ── Timeline ── */}
            <View className="gap-2">
              <SectionHeader title="Timeline" />
              {(milestone.events?.length ?? 0) === 0 ? (
                <Text variant="body" tone="secondary">
                  Belum ada kejadian tercatat.
                </Text>
              ) : (
                <View className="gap-3">
                  {milestone.events!.map((ev) => (
                    <View key={ev.id} className="flex-row gap-3">
                      <View className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-border" />
                      <View className="flex-1 gap-0.5">
                        <Text variant="body" weight={600}>
                          {EVENT_LABEL[ev.eventType] ?? ev.eventType}
                        </Text>
                        <Text variant="caption" tone="tertiary">
                          {formatDateTime(ev.createdAt)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>

          <Dialog
            title="Terima tahap ini?"
            description={translate(
              walletEnabled
                ? "Dana {x} akan dicairkan ke penjual. Lanjutkan?"
                : "Dana {x} akan dicairkan ke rekening bank penjual. Lanjutkan?",
              {
                x: formatRupiah(milestone.sellerAmount),
              },
            )}
            visible={confirmAccept}
            loading={busy}
            confirmLabel="Ya, terima & cairkan"
            cancelLabel="Batal"
            onConfirm={() =>
              void runAction(
                () => api.milestones.acceptMilestone(milestone.id),
                walletEnabled
                  ? "Tahap diterima — dana dicairkan ke penjual"
                  : "Tahap diterima — dana dicairkan ke rekening bank penjual",
                "Gagal menerima tahap",
              ).then(() => setConfirmAccept(false))
            }
            onRequestClose={() => setConfirmAccept(false)}
          />
        </>
      ) : null}
    </DataScreen>
  )
}
