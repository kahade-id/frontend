/**
 * Screen — Hubungi Kami: form tiket baru (POST /v1/support/tickets).
 * Daftar tiket ada di layar Tiket Bantuan (Support) — bukan diulang di sini.
 *
 * Item mega-batch:
 * - 131: draft otomatis (restore/autosave/clear, akun-spesifik via clearSession).
 * - 132: pemilih pesanan terkait (bottom sheet, order terbaru).
 * - 133: prefill category/orderId/relatedArticleId dari search params.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { ScrollView, View } from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { api, userMessage } from "@/lib/api"
import type { Order } from "@/lib/api/orders-shared"
import { pickImages } from "@/lib/image-picker"
import { formatRupiah } from "@/lib/format"
import { ORDER_STATUS_LABELS } from "@/lib/labels/status"
import { ROUTES } from "@/lib/routes"
import { serverNow } from "@/lib/server-time"
import {
  clearSupportDraft,
  isEmptyDraft,
  loadSupportDraft,
  saveSupportDraft,
  type SupportDraft,
} from "@/lib/support-draft"
import { tokens } from "@/lib/tokens"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Chip } from "@/components/ui/chip"
import { Field } from "@/components/ui/field"
import { FormSection } from "@/components/ui/form-section"
import { Header } from "@/components/ui/header"
import { Input } from "@/components/ui/input"
import { PressableScale } from "@/components/ui/pressable-scale"
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
const MAX_ATTACHMENTS = 5

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
  const restoredRef = useRef(false)
  // SP-024: lampiran tiket — backend POST /v1/support/tickets sudah menerima
  // `attachments` (fileKey, max 5, diverifikasi); form mengekspos picker-nya.
  const [attachments, setAttachments] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)

  // Item 131: pulihkan draft sekali saat mount; search params selalu menang.
  useEffect(() => {
    let alive = true
    void (async () => {
      const draft = await loadSupportDraft()
      if (!alive || restoredRef.current) return
      restoredRef.current = true
      if (draft && !isEmptyDraft(draft)) {
        setSubject(draft.subject)
        setMessage(draft.message)
        if (isTicketCategory(draft.category)) setCategory(draft.category)
        setAttachments(draft.attachments)
        setOrderId(draft.orderId)
        setRelatedArticleId(draft.relatedArticleId)
      }
      if (params.category && isTicketCategory(params.category)) setCategory(params.category)
      if (params.orderId) setOrderId(params.orderId)
      if (params.relatedArticleId) setRelatedArticleId(params.relatedArticleId)
    })()
    return () => {
      alive = false
    }
    // Params hanya dibaca sekali saat mount (deep link), bukan reactive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Item 131: autosave debounce 500ms setelah perubahan apa pun.
  useEffect(() => {
    if (!restoredRef.current) return
    const draft: SupportDraft = {
      category,
      subject,
      message,
      attachments,
      orderId,
      relatedArticleId,
      savedAt: serverNow(),
    }
    if (isEmptyDraft(draft)) {
      void clearSupportDraft()
      return
    }
    const t = setTimeout(() => {
      void saveSupportDraft(draft)
    }, 500)
    return () => clearTimeout(t)
  }, [category, subject, message, attachments, orderId, relatedArticleId])

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
    setUploading(true)
    try {
      const keys: string[] = []
      for (const asset of picked.assets) {
        const { fileKey } = await api.upload.uploadDirectImage(asset, "CHAT_ATTACHMENT")
        keys.push(fileKey)
      }
      setAttachments((prev) => [...prev, ...keys].slice(0, MAX_ATTACHMENTS))
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
    setAttachments((prev) => prev.filter((k) => k !== fileKey))
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!subject.trim() || !message.trim()) return
    setSubmitting(true)
    try {
      const res = await api.support.createSupportTicket({
        subject: subject.trim(),
        message: message.trim(),
        category,
        attachments,
        ...(orderId ? { orderId } : {}),
        ...(relatedArticleId ? { relatedArticleId } : {}),
      })
      toast.show({
        title: "Tiket terkirim",
        description: "Tim Kahade akan membalas lewat tiket ini.",
        tone: "success",
        duration: 4000,
      })
      // Item 131: draft bersih setelah sukses terkirim.
      await clearSupportDraft()
      setSubject("")
      setMessage("")
      setCategory("GENERAL")
      setAttachments([])
      setOrderId(undefined)
      setRelatedArticleId(undefined)
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
  }, [category, subject, message, attachments, orderId, relatedArticleId, toast.show])

  // Item 132: pemilih pesanan — muat lazy saat sheet dibuka (20 terbaru).
  const openOrderSheet = useCallback(async () => {
    setOrderSheetOpen(true)
    if (orders !== null) return
    setOrdersLoading(true)
    try {
      const res = await api.orders.listOrders({ limit: 20 })
      setOrders(res.data)
    } catch {
      setOrders([])
    } finally {
      setOrdersLoading(false)
    }
  }, [orders])

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
            disabled={!subject.trim() || !message.trim()}
            onPress={() => void handleSubmit()}
          >
            Kirim tiket
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
          <Field label="Kategori">
            <View className="flex-row flex-wrap gap-2">
              {TICKET_CATEGORIES.map((item) => (
                <Chip
                  key={item.value}
                  selected={category === item.value}
                  onPress={() => setCategory(item.value)}
                  accessibilityRole="radio"
                >
                  {item.label}
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
              maxLength={120}
            />
          </Field>
          <Field label="Pesan" required>
            <TextArea
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
          <Field label="Lampiran (opsional)">
            <View className="gap-2">
              {attachments.map((fileKey, index) => (
                <View
                  key={fileKey}
                  className="flex-row items-center justify-between rounded-xs bg-surface px-3 py-2"
                >
                  <Text variant="caption" tone="secondary" className="font-mono-500">
                    Lampiran {index + 1}
                  </Text>
                  <TextLink inline onPress={() => handleRemoveAttachment(fileKey)}>
                    Hapus
                  </TextLink>
                </View>
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
        ) : orders && orders.length > 0 ? (
          <View className="gap-2">
            {orders.map((o) => (
              <PressableScale
                key={o.id}
                onPress={() => {
                  setOrderId(o.id)
                  setOrderSheetOpen(false)
                }}
                accessibilityRole="button"
                accessibilityLabel={`Pilih pesanan ${o.title}`}
                className="gap-1 rounded-md border border-border bg-surface p-3"
              >
                <Text variant="body" numberOfLines={1}>
                  {o.title}
                </Text>
                <Text variant="caption" tone="secondary">
                  {ORDER_STATUS_LABELS[o.status]} · {formatRupiah(o.orderValue)}
                </Text>
              </PressableScale>
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