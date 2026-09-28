/**
 * Screen — Hubungi Kami: form tiket baru (POST /v1/support/tickets).
 * Daftar tiket ada di layar Tiket Bantuan (Support) — bukan diulang di sini.
 *
 * Mega-batch FE-IMP-5:
 * - Item 123: dibuka dari artikel bantuan dengan `?relatedArticleId=` —
 *   dikirim di DTO (CreateTicketDto.relatedArticleId).
 * - Item 125: label kategori dari TICKET_CATEGORY_LABELS (satu sumber).
 * - Item 131: draft form disimpan otomatis (debounced) dan dipulihkan saat
 *   form dibuka lagi; dihapus setelah tiket terkirim.
 * - Item 132: kategori ORDER menampilkan pemilih order (20 order terbaru) —
 *   `orderId` dikirim di DTO.
 * - Item 133: dibuka dari detail order dengan `?category=ORDER&orderId=`.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { Pressable, ScrollView, View } from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { api, userMessage } from "@/lib/api"
import type { CreateTicketDto } from "@/lib/api/types"
import { pickImages } from "@/lib/image-picker"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"
import { deleteRawItem, getRawItem, setRawItem } from "@/lib/secure-storage"
import { TICKET_CATEGORY_LABELS } from "@/lib/labels/ticket"
import { shortId } from "@/lib/short-id"
import { formatDateTime } from "@/lib/format"

import { Button } from "@/components/ui/button"
import { Chip } from "@/components/ui/chip"
import { Field } from "@/components/ui/field"
import { FormSection } from "@/components/ui/form-section"
import { Header } from "@/components/ui/header"
import { Icon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"
import { TextLink } from "@/components/ui/text-link"
import { useToast } from "@/components/ui/toast"
import { CheckCircle } from "phosphor-react-native"

/** Kategori tiket yang valid — selaras CreateTicketDto.category (backend). */
export type TicketCategory = NonNullable<CreateTicketDto["category"]>

const TICKET_CATEGORY_VALUES = Object.keys(TICKET_CATEGORY_LABELS) as TicketCategory[]

/** Guard fail-closed: string mentah → kategori valid atau null. */
function asTicketCategory(v: string): TicketCategory | null {
  return (TICKET_CATEGORY_VALUES as readonly string[]).includes(v)
    ? (v as TicketCategory)
    : null
}

/** Maksimal lampiran per tiket — selaras CreateTicketDto (maxItems 5). */
const MAX_ATTACHMENTS = 5

/** Kunci draft form (perangkat, bukan akun — draft bukan data sensitif). */
const DRAFT_KEY = "kahade.contact_draft.v1"

type ContactDraft = {
  subject: string
  message: string
  category: string
}

export default function ContactScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()
  // Item 123/133: prefill dari deep link (artikel bantuan / detail order).
  const params = useLocalSearchParams<{
    category?: string
    orderId?: string
    relatedArticleId?: string
  }>()
  const prefillCategory =
    params.category != null ? asTicketCategory(params.category) : null

  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [category, setCategory] = useState<TicketCategory>(prefillCategory ?? "GENERAL")
  const [orderId, setOrderId] = useState<string | null>(params.orderId ?? null)
  const [relatedArticleId] = useState<string | null>(params.relatedArticleId ?? null)
  const [submitting, setSubmitting] = useState(false)
  const [draftRestored, setDraftRestored] = useState(false)
  // SP-024: lampiran tiket — backend POST /v1/support/tickets sudah menerima
  // `attachments` (fileKey, max 5, diverifikasi); form mengekspos picker-nya.
  const [attachments, setAttachments] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)

  // Item 131: pulihkan draft sekali saat mount — TAPI prefill query param
  // menang (deep link dari artikel/order adalah niat eksplisit).
  useEffect(() => {
    let cancelled = false
    void getRawItem(DRAFT_KEY)
      .then((raw) => {
        if (cancelled || !raw) return
        try {
          const draft = JSON.parse(raw) as Partial<ContactDraft>
          if (typeof draft.subject === "string") setSubject(draft.subject)
          if (typeof draft.message === "string") setMessage(draft.message)
          const draftCategory =
            typeof draft.category === "string" ? asTicketCategory(draft.category) : null
          if (draftCategory && !prefillCategory) {
            setCategory(draftCategory)
          }
        } catch {
          // Draft rusak → abaikan, mulai dari kosong.
        }
      })
      .finally(() => {
        if (!cancelled) setDraftRestored(true)
      })
    return () => {
      cancelled = true
    }
  }, [prefillCategory])

  // Item 131: autosave debounced 800ms. Lampiran & orderId TIDAK disimpan
  // (fileKey bisa kedaluwarsa; orderId adalah konteks deep link).
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!draftRestored) return
    if (draftTimer.current) clearTimeout(draftTimer.current)
    draftTimer.current = setTimeout(() => {
      const draft: ContactDraft = { subject, message, category }
      if (!subject.trim() && !message.trim()) {
        void deleteRawItem(DRAFT_KEY).catch(() => undefined)
        return
      }
      void setRawItem(DRAFT_KEY, JSON.stringify(draft)).catch(() => undefined)
    }, 800)
    return () => {
      if (draftTimer.current) clearTimeout(draftTimer.current)
    }
  }, [subject, message, category, draftRestored])

  // Item 132: order terbaru untuk pemilih order (hanya diambil saat kategori
  // ORDER — hemat satu request untuk kategori lain).
  const ordersQuery = useApiQuery(
    "contact-recent-orders",
    (signal) => api.orders.listOrders({ limit: 20 }, signal),
    category === "ORDER",
  )
  const recentOrders = ordersQuery.data?.data ?? []

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
        // Item 132/123: konteks order & artikel terkait bila ada.
        ...(category === "ORDER" && orderId ? { orderId } : {}),
        ...(relatedArticleId ? { relatedArticleId } : {}),
      })
      toast.show({
        title: "Tiket terkirim",
        description: "Tim Kahade akan membalas lewat tiket ini.",
        tone: "success",
        duration: 4000,
      })
      // Item 131: draft dihapus setelah terkirim.
      void deleteRawItem(DRAFT_KEY).catch(() => undefined)
      setSubject("")
      setMessage("")
      setCategory("GENERAL")
      setOrderId(null)
      setAttachments([])
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
              {TICKET_CATEGORY_VALUES.map((value) => (
                <Chip
                  key={value}
                  selected={category === value}
                  onPress={() => setCategory(value)}
                  accessibilityRole="radio"
                >
                  {TICKET_CATEGORY_LABELS[value]}
                </Chip>
              ))}
            </View>
          </Field>
          {/* Item 132: pemilih order untuk kategori ORDER. */}
          {category === "ORDER" ? (
            <Field label="Order terkait" helperText="Opsional — membantu CS menemukan transaksi Anda.">
              {ordersQuery.loading ? (
                <Text variant="caption" tone="secondary">
                  Memuat order…
                </Text>
              ) : recentOrders.length === 0 ? (
                <Text variant="caption" tone="secondary">
                  Belum ada order.
                </Text>
              ) : (
                <View className="gap-2">
                  {recentOrders.slice(0, 10).map((order) => {
                    const selectedOrder = orderId === order.id
                    return (
                      <Pressable
                        key={order.id}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: selectedOrder }}
                        onPress={() => setOrderId(selectedOrder ? null : order.id)}
                        className={`flex-row items-center gap-2 rounded-md border px-3 py-2.5 ${
                          selectedOrder ? "border-primary bg-primary-soft" : "border-border bg-surface"
                        }`}
                      >
                        <Icon
                          icon={CheckCircle}
                          size="sm"
                          tone={selectedOrder ? "active" : "default"}
                          weight={selectedOrder ? "fill" : "regular"}
                        />
                        <View className="flex-1 gap-0.5">
                          <Text variant="body" weight={600} numberOfLines={1}>
                            {order.title || `Order #${shortId(order.id)}`}
                          </Text>
                          <Text variant="caption" tone="secondary" className="tabular-nums">
                            {`#${shortId(order.id)} · ${formatDateTime(order.createdAt)}`}
                          </Text>
                        </View>
                      </Pressable>
                    )
                  })}
                </View>
              )}
            </Field>
          ) : null}
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
    </Screen>
  )
}
