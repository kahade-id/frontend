/**
 * Screen — Hubungi Kami: form tiket baru (POST /v1/support/tickets).
 * Daftar tiket ada di layar Tiket Bantuan (Support) — bukan diulang di sini.
 *
 * Item mega-batch:
 * - 131: draft otomatis (restore/autosave/clear, akun-spesifik via clearSession).
 * - 132: pemilih pesanan terkait (bottom sheet, order terbaru).
 * - 133: prefill category/orderId/relatedArticleId dari search params.
 *
 * Item batch 139:
 * - F08: validasi lampiran (tipe/ukuran/jumlah) sejak pemilihan + batas
 *   dijelaskan eksplisit.
 * - F09: urutan lampiran bisa diubah + keterangan singkat per lampiran.
 * - F10: pratinjau data diagnostik (kategori Teknis) — daftar transparan,
 *   item opsional bisa dihapus, wajib persetujuan sebelum ikut terkirim.
 * - F11: draft dipisahkan PER KATEGORI + waktu kedaluwarsa yang jelas.
 * - F14: peringatan tiket duplikat — tiket aktif terkait + pilihan
 *   melanjutkan thread tersebut.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ScrollView, View, type TextInputInstance } from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { ArrowDown, ArrowUp, Paperclip, X } from "phosphor-react-native"

import { api, userMessage } from "@/lib/api"
import type { Order } from "@/lib/api/orders-shared"
import type { SupportTicket } from "@/lib/api/support"
import { pickImages } from "@/lib/image-picker"
import { formatRupiah } from "@/lib/format"
import { ORDER_STATUS_LABELS } from "@/lib/labels/status"
import { ROUTES } from "@/lib/routes"
import { serverNow } from "@/lib/server-time"
import { translate } from "@/lib/i18n"
import {
  attachmentLimitSummary,
  validateTicketAttachments,
  TICKET_ATTACHMENT_MAX_COUNT,
} from "@/lib/ticket-attachment-validation"
import {
  clearSupportDraft,
  draftTtlLabel,
  isEmptyDraft,
  listDraftCategories,
  loadSupportDraft,
  saveSupportDraft,
  type SupportDraft,
} from "@/lib/support-draft"
import {
  collectDiagnosticItems,
  renderDiagnosticsBlock,
  type DiagnosticItem,
} from "@/lib/support-diagnostics"
import { tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"
import { logWarn } from "@/lib/telemetry"

import { Alert } from "@/components/ui/alert"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { IconButton } from "@/components/ui/icon-button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Chip } from "@/components/ui/chip"
import { Field } from "@/components/ui/field"
import { FormSection } from "@/components/ui/form-section"
import { Header } from "@/components/ui/header"
import { Icon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { Screen } from "@/components/ui/screen"
import { Spinner } from "@/components/ui/spinner"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"
import { TextLink } from "@/components/ui/text-link"
import { useToast } from "@/components/ui/toast"

const TICKET_CATEGORIES = [
  { value: "GENERAL", label: "Umum" },
  { value: "ORDER", label: "Pesanan" },
  { value: "PAYMENT", label: "Pembayaran" },
  { value: "ACCOUNT", label: "Akun" },
  { value: "KYC", label: "Verifikasi" },
  { value: "TECHNICAL", label: "Teknis" },
  { value: "OTHER", label: "Lainnya" },
] as const

type TicketCategory = (typeof TICKET_CATEGORIES)[number]["value"]

function isTicketCategory(v: string): v is TicketCategory {
  return TICKET_CATEGORIES.some((c) => c.value === v)
}

/** Maksimal lampiran per tiket — selaras CreateTicketDto (maxItems 5). */
const MAX_ATTACHMENTS = TICKET_ATTACHMENT_MAX_COUNT

type AttachmentItem = {
  fileKey: string
  caption: string
}

const ACTIVE_TICKET_STATUSES = new Set(["OPEN", "IN_PROGRESS", "WAITING_USER"])

export default function ContactScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()
  // Item 133: prefill dari deep link (detail order → category=ORDER&orderId=…;
  // artikel bantuan → relatedArticleId=…).
  const params = useLocalSearchParams<{
    category?: string
    orderId?: string
    relatedArticleId?: string
  }>()
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [category, setCategory] = useState<TicketCategory>("GENERAL")
  const [submitting, setSubmitting] = useState(false)
  // Item 131/132: orderId + relatedArticleId ikut dalam draft.
  const [orderId, setOrderId] = useState<string | undefined>(undefined)
  const [relatedArticleId, setRelatedArticleId] = useState<string | undefined>(undefined)
  const [orderSheetOpen, setOrderSheetOpen] = useState(false)
  const [orders, setOrders] = useState<Order[] | null>(null)
  const [ordersLoading, setOrdersLoading] = useState(false)
  /** UX-FDB-005: failure ≠ empty — kegagalan muat dibedakan dari daftar kosong. */
  const [ordersError, setOrdersError] = useState<string | null>(null)
  const restoredRef = useRef(false)
  // FRM-009: rantai fokus Next Subjek -> Pesan.
  const messageRef = useRef<TextInputInstance>(null)
  // F09: lampiran = urutan + keterangan per item.
  const [attachments, setAttachments] = useState<AttachmentItem[]>([])
  const [uploading, setUploading] = useState(false)
  // F11: label kedaluwarsa draft yang sedang dipulihkan + kategori berdraf.
  const [draftNotice, setDraftNotice] = useState<string | null>(null)
  const [draftCategories, setDraftCategories] = useState<string[]>([])
  // F10: diagnostik (kategori Teknis).
  const [diagEnabled, setDiagEnabled] = useState(false)
  const [diagItems, setDiagItems] = useState<DiagnosticItem[] | null>(null)
  const [diagRemoved, setDiagRemoved] = useState<Set<string>>(new Set())
  const [diagConsent, setDiagConsent] = useState(false)
  // F14: peringatan duplikat — "tetap buat baru" menutup peringatan sesi ini.
  const [dismissDupWarning, setDismissDupWarning] = useState(false)

  const applyDraft = useCallback((draft: SupportDraft) => {
    setSubject(draft.subject)
    setMessage(draft.message)
    setAttachments(
      draft.attachments.map((fileKey) => ({
        fileKey,
        caption: draft.attachmentCaptions?.[fileKey] ?? "",
      })),
    )
    setOrderId(draft.orderId)
    setRelatedArticleId(draft.relatedArticleId)
    setDraftNotice(`Draft dipulihkan · kedaluwarsa ${draftTtlLabel(draft)}`)
  }, [])

  const clearForm = useCallback(() => {
    setSubject("")
    setMessage("")
    setAttachments([])
    setOrderId(undefined)
    setRelatedArticleId(undefined)
    setDraftNotice(null)
  }, [])

  // Item 131 + F11: pulihkan draft PER KATEGORI sekali saat mount; search
  // params selalu menang.
  useEffect(() => {
    let alive = true
    void (async () => {
      const initialCategory =
        params.category && isTicketCategory(params.category) ? params.category : "GENERAL"
      setCategory(initialCategory)
      const draft = await loadSupportDraft(initialCategory)
      if (!alive || restoredRef.current) return
      restoredRef.current = true
      if (draft && !isEmptyDraft(draft)) applyDraft(draft)
      if (params.category && isTicketCategory(params.category)) setCategory(params.category)
      if (params.orderId) setOrderId(params.orderId)
      if (params.relatedArticleId) setRelatedArticleId(params.relatedArticleId)
      setDraftCategories(await listDraftCategories())
    })()
    return () => {
      alive = false
    }
    // Params hanya dibaca sekali saat mount (deep link), bukan reactive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // F11: ganti kategori → simpan draft kategori lama, muat draft kategori baru.
  const selectCategory = useCallback(
    (next: TicketCategory) => {
      if (next === category || !restoredRef.current) {
        setCategory(next)
        return
      }
      const current: Omit<SupportDraft, "expiresAt"> = {
        category,
        subject,
        message,
        attachments: attachments.map((a) => a.fileKey),
        attachmentCaptions: Object.fromEntries(
          attachments.filter((a) => a.caption.trim()).map((a) => [a.fileKey, a.caption.trim()]),
        ),
        orderId,
        relatedArticleId,
        savedAt: serverNow(),
      }
      if (!isEmptyDraft({ ...current, expiresAt: 0 })) {
        void saveSupportDraft(current)
      }
      setCategory(next)
      setDraftNotice(null)
      void loadSupportDraft(next).then((draft) => {
        if (draft && !isEmptyDraft(draft)) applyDraft(draft)
        else clearForm()
      })
      void listDraftCategories().then(setDraftCategories)
    },
    [category, subject, message, attachments, orderId, relatedArticleId, applyDraft, clearForm],
  )

  // Item 131 + F11: autosave debounce 500ms ke draft kategori aktif.
  useEffect(() => {
    if (!restoredRef.current) return
    const draft: Omit<SupportDraft, "expiresAt"> = {
      category,
      subject,
      message,
      attachments: attachments.map((a) => a.fileKey),
      attachmentCaptions: Object.fromEntries(
        attachments.filter((a) => a.caption.trim()).map((a) => [a.fileKey, a.caption.trim()]),
      ),
      orderId,
      relatedArticleId,
      savedAt: serverNow(),
    }
    if (isEmptyDraft({ ...draft, expiresAt: 0 })) {
      return
    }
    const t = setTimeout(() => {
      void saveSupportDraft(draft)
      void listDraftCategories().then(setDraftCategories)
    }, 500)
    return () => clearTimeout(t)
  }, [category, subject, message, attachments, orderId, relatedArticleId])

  // ---- F08: validasi lampiran sejak pemilihan ----
  const handlePickAttachments = useCallback(async () => {
    const remaining = MAX_ATTACHMENTS - attachments.length
    if (remaining <= 0) return
    let picked: Awaited<ReturnType<typeof pickImages>>
    try {
      picked = await pickImages({ selectionLimit: remaining })
    } catch (err) {
      toast.show({
        title: "Gagal memilih foto",
        description: userMessage(err),
        tone: "danger",
      })
      return
    }
    if (picked.status === "denied") {
      toast.show({ title: "Akses galeri ditolak", tone: "danger" })
      return
    }
    if (picked.status !== "picked") return
    // F08: periksa tipe/ukuran/jumlah SEBELUM upload — yang tidak valid
    // ditolak dengan penjelasan, bukan gagal diam-diam setelah submit.
    const issues = validateTicketAttachments(
      picked.assets.map((a) => ({ name: a.name, mimeType: a.mimeType, size: a.size })),
      attachments.length,
    )
    const invalidIndexes = new Set(issues.map((i) => i.index))
    if (issues.length > 0) {
      toast.show({
        title: "Sebagian lampiran tidak valid",
        description: issues
          .slice(0, 2)
          .map((i) => i.message)
          .join(" "),
        tone: "warning",
        duration: 5000,
      })
    }
    const validAssets = picked.assets.filter((_, i) => !invalidIndexes.has(i))
    if (validAssets.length === 0) return
    setUploading(true)
    try {
      const next: AttachmentItem[] = []
      for (const asset of validAssets) {
        const { fileKey } = await api.upload.uploadDirectImage(asset, "CHAT_ATTACHMENT")
        next.push({ fileKey, caption: "" })
      }
      setAttachments((prev) => [...prev, ...next].slice(0, MAX_ATTACHMENTS))
    } catch (err) {
      toast.show({
        title: "Gagal mengunggah lampiran",
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setUploading(false)
    }
  }, [attachments.length, toast])

  const handleRemoveAttachment = useCallback((fileKey: string) => {
    setAttachments((prev) => prev.filter((a) => a.fileKey !== fileKey))
  }, [])

  // F09: ubah urutan lampiran.
  const moveAttachment = useCallback((fileKey: string, dir: -1 | 1) => {
    setAttachments((prev) => {
      const i = prev.findIndex((a) => a.fileKey === fileKey)
      const j = i + dir
      if (i < 0 || j < 0 || j >= prev.length) return prev
      const next = [...prev]
      const [item] = next.splice(i, 1)
      next.splice(j, 0, item)
      return next
    })
  }, [])

  const setAttachmentCaption = useCallback((fileKey: string, caption: string) => {
    setAttachments((prev) =>
      prev.map((a) => (a.fileKey === fileKey ? { ...a, caption: caption.slice(0, 140) } : a)),
    )
  }, [])

  // ---- F10: diagnostik (kategori Teknis = lapor bug) ----
  const toggleDiagnostics = useCallback((on: boolean) => {
    setDiagEnabled(on)
    if (on && !diagItems) {
      try {
        setDiagItems(collectDiagnosticItems())
      } catch (err) {
        logWarn("contact:diagnostics", err)
        setDiagItems([])
      }
    }
    if (!on) setDiagConsent(false)
  }, [diagItems])

  const removeDiagItem = useCallback((id: string) => {
    setDiagRemoved((prev) => new Set(prev).add(id))
  }, [])

  const activeDiagItems = (diagItems ?? []).filter((i) => !diagRemoved.has(i.id))
  const finalMessage = message.trim() + (diagEnabled && diagConsent && activeDiagItems.length > 0
    ? renderDiagnosticsBlock(activeDiagItems)
    : "")

  const handleSubmit = useCallback(async () => {
    if (!subject.trim() || !message.trim()) return
    // P1c (2026-10-03): jangan kirim saat lampiran masih diunggah — fileKey
    // belum ada sehingga lampiran hilang diam-diam. Tombol juga di-disabled
    // (lihat footer), ini pertahanan berlapis.
    if (uploading) return
    // F10: diagnostik hanya ikut bila disetujui eksplisit.
    if (category === "TECHNICAL" && diagEnabled && !diagConsent) {
      toast.show({
        title: "Persetujuan diagnostik dibutuhkan",
        description: "Centang persetujuan pengiriman data diagnostik, atau matikan opsinya.",
        tone: "warning",
      })
      return
    }
    setSubmitting(true)
    try {
      const res = await api.support.createSupportTicket({
        subject: subject.trim(),
        message: finalMessage,
        category,
        attachments: attachments.map((a) => a.fileKey),
        ...(orderId ? { orderId } : {}),
        ...(relatedArticleId ? { relatedArticleId } : {}),
      })
      toast.show({
        title: "Tiket terkirim",
        description: "Tim Kahade akan membalas lewat tiket ini.",
        tone: "success",
        duration: 4000,
      })
      // F11: draft kategori ini bersih setelah sukses terkirim.
      await clearSupportDraft(category)
      clearForm()
      setCategory("GENERAL")
      setDiagEnabled(false)
      setDiagConsent(false)
      setDiagRemoved(new Set())
      if (res?.id) router.replace(ROUTES.supportTicket(res.id))
      else router.replace(ROUTES.support)
    } catch (err: unknown) {
      // Tanpa deskripsi, pengguna tidak tahu apakah harus mengulang (jaringan)
      // atau memperbaiki isian (validasi/lampiran ditolak).
      toast.show({
        title: "Gagal mengirim tiket",
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setSubmitting(false)
    }
  }, [category, subject, message, finalMessage, attachments, orderId, relatedArticleId, diagEnabled, diagConsent, uploading, toast.show, clearForm])

  // ---- F14: peringatan tiket duplikat ----
  const ticketsQuery = useApiQuery<SupportTicket[]>(
    "support-tickets:duplicate-check",
    (signal) => api.support.listSupportTickets(signal),
    Boolean(subject.trim() || orderId),
  )
  // TIM 8 (perf): filter duplikat di-memo — sebelumnya di body render
  // (jalan tiap keystroke form).
  const duplicateTickets = useMemo(
    () =>
      (ticketsQuery.data ?? [])
        .filter((t) => {
          if (!ACTIVE_TICKET_STATUSES.has(t.status)) return false
          if (orderId) return t.orderId === orderId
          return t.category === category
        })
        .slice(0, 3),
    [ticketsQuery.data, orderId, category],
  )
  const showDupWarning =
    !dismissDupWarning && duplicateTickets.length > 0 && (Boolean(subject.trim()) || Boolean(orderId))

  // Item 132: pemilih pesanan — muat lazy saat sheet dibuka (20 terbaru).
  // UX-FDB-005: saat gagal, orders tetap null (bukan []) agar (a) UI bisa
  // menampilkan error + retry, dan (b) buka-tutup sheet memuat ulang.
  const loadOrders = useCallback(async () => {
    setOrdersLoading(true)
    setOrdersError(null)
    try {
      const res = await api.orders.listOrders({ limit: 20 })
      setOrders(res.data)
    } catch (err) {
      setOrdersError(userMessage(err))
    } finally {
      setOrdersLoading(false)
    }
  }, [])

  const openOrderSheet = useCallback(() => {
    setOrderSheetOpen(true)
    if (orders !== null) return
    void loadOrders()
  }, [orders, loadOrders])

  const selectedOrder = orderId ? orders?.find((o) => o.id === orderId) : undefined
  const selectedOrderLabel = selectedOrder
    ? `${selectedOrder.title} · ${formatRupiah(selectedOrder.orderValue)}`
    : orderId
      ? `Pesanan #${orderId.slice(-6).toUpperCase()}`
      : undefined

  return (
    <Screen
      keyboardAvoiding
      edges={["top"]}
      padded={false}
      footer={
        <View>
          <Button
            fullWidth
            loading={submitting}
            disabled={!subject.trim() || !message.trim() || uploading}
            onPress={() => void handleSubmit()}
          >
            {uploading ? "Mengunggah lampiran…" : "Kirim tiket"}
          </Button>
        </View>
      }
    >
      <Header title="Hubungi Kami" />
      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-4 px-5"
        contentContainerStyle={{
          paddingTop: tokens.space[3],
          paddingBottom: insets.bottom + tokens.space[8],
        }}
      >
        <FormSection
          title="Buat tiket baru"
          description="Jelaskan kendala Anda. Balasan tim Kahade muncul di Tiket Bantuan."
        >
          {/* F14: peringatan duplikat — tawarkan lanjutkan thread yang ada. */}
          {showDupWarning ? (
            <Alert tone="warning">
              <View className="gap-2">
                <Text variant="body" weight={600}>
                  Anda sudah punya tiket aktif yang terkait
                </Text>
                <Text variant="caption" tone="secondary">
                  {orderId
                    ? "Tiket berikut sudah membahas pesanan ini — melanjutkan di sana lebih cepat daripada membuka tiket baru."
                    : "Tiket berikut sudah membahas kategori ini — melanjutkan di sana lebih cepat daripada membuka tiket baru."}
                </Text>
                {duplicateTickets.map((t) => (
                  <TextLink
                    key={t.id}
                    inline
                    onPress={() => router.push(ROUTES.supportTicket(t.id))}
                  >
                    Lanjutkan di tiket {t.ticketNumber} — {t.subject}
                  </TextLink>
                ))}
                <TextLink inline onPress={() => setDismissDupWarning(true)}>
                  Tetap buat tiket baru
                </TextLink>
              </View>
            </Alert>
          ) : null}
          {draftNotice ? (
            <Text variant="caption" tone="secondary">
              {draftNotice}
            </Text>
          ) : null}
          <Field label="Kategori" helperText="Draft disimpan terpisah per kategori.">
            <View className="flex-row flex-wrap gap-2">
              {TICKET_CATEGORIES.map((item) => (
                <Chip
                  key={item.value}
                  selected={category === item.value}
                  onPress={() => selectCategory(item.value)}
                  accessibilityRole="radio"
                >
                  <View className="flex-row items-center gap-1.5">
                    <Text variant="label" tone={category === item.value ? "inverse" : "primary"} numberOfLines={1}>
                      {item.label}
                    </Text>
                    {/* F11: titik penanda kategori yang punya draft tersimpan. */}
                    {draftCategories.includes(item.value) && item.value !== category ? (
                      <View className="h-1.5 w-1.5 rounded-full bg-info" />
                    ) : null}
                  </View>
                </Chip>
              ))}
            </View>
          </Field>
          <Field label="Subjek" required>
            <Input
              value={subject}
              onChangeText={setSubject}
              placeholder="Ringkasan masalah"
              autoCapitalize="sentences"
              returnKeyType="next"
              // FRM-009: Next memindahkan fokus ke field Pesan.
              onSubmitEditing={() => messageRef.current?.focus()}
              maxLength={120}
            />
          </Field>
          <Field label="Pesan" required>
            <TextArea
              ref={messageRef}
              value={message}
              onChangeText={setMessage}
              placeholder="Jelaskan kendala Anda"
              maxLength={2000}
              numberOfLines={5}
            />
          </Field>
          {/* Item 132: pesanan terkait — opsional, dipilih dari 20 order terbaru. */}
          <Field label="Pesanan terkait (opsional)">
            <View className="gap-2">
              <View className="flex-row items-center gap-3">
                <Button variant="secondary" fullWidth={false} onPress={() => void openOrderSheet()}>
                  {selectedOrderLabel ?? "Pilih pesanan"}
                </Button>
                {orderId ? (
                  <TextLink inline onPress={() => setOrderId(undefined)}>
                    Hapus
                  </TextLink>
                ) : null}
              </View>
              {relatedArticleId ? (
                <Text variant="caption" tone="secondary">
                  Tiket ini dibuat dari artikel bantuan yang Anda tandai tidak membantu.
                </Text>
              ) : null}
            </View>
          </Field>
          <Field
            label="Lampiran (opsional)"
            helperText={attachmentLimitSummary()}
          >
            <View className="gap-2">
              {attachments.map((item, index) => (
                <Card
                  key={item.fileKey}
                  padded={false}
                  className="gap-2 p-3"
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2">
                      <Icon icon={Paperclip} size="sm" tone="default" />
                      <Text variant="caption" tone="secondary" weight={600}>
                        Lampiran {index + 1} dari {attachments.length}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-1">
                      {/* F09: ubah urutan. */}
                      <IconButton
                        variant="ghost"
                        size="sm"
                        icon={ArrowUp}
                        onPress={() => moveAttachment(item.fileKey, -1)}
                        disabled={index === 0}
                        accessibilityLabel={`Pindahkan lampiran ${index + 1} ke atas`}
                      />
                      <IconButton
                        variant="ghost"
                        size="sm"
                        icon={ArrowDown}
                        onPress={() => moveAttachment(item.fileKey, 1)}
                        disabled={index === attachments.length - 1}
                        accessibilityLabel={`Pindahkan lampiran ${index + 1} ke bawah`}
                      />
                      <IconButton
                        variant="ghost"
                        size="sm"
                        icon={X}
                        onPress={() => handleRemoveAttachment(item.fileKey)}
                        accessibilityLabel={`Hapus lampiran ${index + 1}`}
                      />
                    </View>
                  </View>
                  {/* F09: keterangan singkat per lampiran. */}
                  <Input
                    value={item.caption}
                    onChangeText={(v) => setAttachmentCaption(item.fileKey, v)}
                    placeholder="Keterangan singkat (opsional)"
                    maxLength={140}
                  />
                </Card>
              ))}
              {attachments.length < MAX_ATTACHMENTS ? (
                <Button
                  variant="secondary"
                  size="sm"
                  fullWidth={false}
                  loading={uploading}
                  disabled={uploading}
                  onPress={() => void handlePickAttachments()}
                >
                  {attachments.length === 0
                    ? "Tambah lampiran"
                    : `Tambah lagi (${attachments.length}/${MAX_ATTACHMENTS})`}
                </Button>
              ) : null}
            </View>
          </Field>
          {/* F10: pratinjau data diagnostik — hanya kategori Teknis (lapor bug). */}
          {category === "TECHNICAL" ? (
            <Field label="Data diagnostik (opsional)">
              <View className="gap-2">
                <Checkbox
                  checked={diagEnabled}
                  onChange={toggleDiagnostics}
                  label="Sertakan data diagnostik"
                  description="Membantu tim teknis menelusuri bug lebih cepat. Anda bisa melihat dan menghapus item sebelum dikirim."
                />
                {diagEnabled ? (
                  <Card padded={false} className="gap-2 p-3">
                    {/* FE-101: satu label saja — "Terkirim bersama tiket ini:". */}
                    <Text variant="label" tone="secondary">
                      {translate("Terkirim bersama tiket ini:")}
                    </Text>
                    {(diagItems ?? []).filter((i) => !diagRemoved.has(i.id)).map((item) => (
                      <View key={item.id} className="flex-row items-center justify-between gap-2">
                        <Text variant="caption" tone="secondary" className="flex-1">
                          {item.label}: {item.value}
                        </Text>
                        {item.removable ? (
                          <TextLink inline onPress={() => removeDiagItem(item.id)}>
                            Hapus
                          </TextLink>
                        ) : (
                          <Text variant="caption" tone="secondary">
                            wajib
                          </Text>
                        )}
                      </View>
                    ))}
                    <Checkbox
                      checked={diagConsent}
                      onChange={setDiagConsent}
                      label="Saya setuju data diagnostik di atas dikirim bersama tiket ini"
                    />
                    {diagConsent && activeDiagItems.length > 0 ? (
                      // FE-101: label "Pratinjau teks terkirim:" dihapus —
                      // isi pratinjau sudah jelas dari konteksnya.
                      <View className="gap-1 rounded-xs bg-background p-2">
                        <Text variant="caption" tone="secondary" numberOfLines={8}>
                          {finalMessage || "(tulis pesan dulu untuk melihat pratinjau)"}
                        </Text>
                      </View>
                    ) : null}
                  </Card>
                ) : null}
              </View>
            </Field>
          ) : null}
        </FormSection>
        <Text variant="body" tone="secondary">
          Sudah punya tiket?{" "}
          <TextLink inline onPress={() => router.push(ROUTES.support)}>
            Lihat tiket saya
          </TextLink>
        </Text>
      </ScrollView>
      <BottomSheet
        visible={orderSheetOpen}
        onRequestClose={() => setOrderSheetOpen(false)}
        title="Pilih pesanan"
        description="Tiket akan ditautkan ke pesanan yang dipilih."
      >
        {ordersLoading ? (
          <View className="items-center py-6">
            <Spinner />
          </View>
        ) : ordersError ? (
          /* UX-FDB-005: kegagalan muat ≠ "tidak ada pesanan" — tampilkan
              error + retry. */
          <View className="items-center gap-3 py-6">
            <Text variant="body" tone="secondary" className="text-center">
              Gagal memuat pesanan. {ordersError}
            </Text>
            <Button
              variant="secondary"
              fullWidth={false}
              onPress={() => void loadOrders()}
            >
              Coba lagi
            </Button>
          </View>
        ) : orders && orders.length > 0 ? (
          <View className="gap-2">
            {orders.map((o) => (
              <Card
                key={o.id}
                onPress={() => {
                  setOrderId(o.id)
                  setOrderSheetOpen(false)
                }}
                padded={false}
                accessibilityLabel={`Pilih pesanan ${o.title}`}
                className="gap-1 p-3"
              >
                <Text variant="body" numberOfLines={1}>
                  {o.title}
                </Text>
                <Text variant="caption" tone="secondary">
                  {ORDER_STATUS_LABELS[o.status]} · {formatRupiah(o.orderValue)}
                </Text>
              </Card>
            ))}
          </View>
        ) : (
          <Text variant="body" tone="secondary" className="py-6 text-center">
            Tidak ada pesanan.
          </Text>
        )}
      </BottomSheet>
    </Screen>
  )
}
