/**
 * Screen — Detail Tiket Dukungan.
 *
 * GET  /v1/support/tickets/{id} + POST …/reply (percakapan)
 * POST /v1/support/tickets/{id}/close   — tutup tiket (status selain CLOSED/RESOLVED)
 * POST /v1/support/tickets/{id}/reopen  — buka lagi tiket CLOSED
 * POST /v1/support/tickets/{id}/rate    — rating 1–5 + komentar (RESOLVED/CLOSED)
 */

import { Crossfade } from "@/components/ui/fade-in"
import { DetailLoading } from "@/components/ui/paginated-list"
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useLocalSearchParams } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { api, userMessage } from "@/lib/api"
import type { SupportMessage, SupportTicket } from "@/lib/api/support"
import { formatDateTime } from "@/lib/format"
import { focusRingInset } from "@/lib/focus-ring"
import { pickImages } from "@/lib/image-picker"
import { markSupportTicketOpened } from "@/lib/support-unread"
import { tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"
import { usePolling } from "@/lib/use-polling"
import { logWarn } from "@/lib/telemetry"
import { translate, useLanguage } from "@/lib/i18n"

import { Star, Paperclip, X } from "phosphor-react-native"

import { Button } from "@/components/ui/button"
import { ChatMessageBubble } from "@/components/ui/chat-message-bubble"
import { Dialog } from "@/components/ui/modal"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { Icon } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { SupportAttachmentItem } from "@/components/ui/support-attachment-item"
import { SupportTicketCard } from "@/components/ui/support-ticket-card"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"
import { useToast } from "@/components/ui/toast"

export default function SupportTicketDetailScreen() {
  // Langganan bahasa: a11y label bintang & placeholder komentar (prop string)
  // harus langsung ikut berganti saat pengguna mengubah bahasa (UI-M018).
  useLanguage()
  const { ticketId } = useLocalSearchParams<{ ticketId: string }>()
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [reply, setReply] = useState("")
  const [sending, setSending] = useState(false)
  /** Item 130: fileKey lampiran balasan (maks 5), diunggah dulu via CHAT_ATTACHMENT. */
  const [replyAttachmentKeys, setReplyAttachmentKeys] = useState<string[]>([])
  const [uploadingReply, setUploadingReply] = useState(false)

  /**
   * `useApiQuery`, bukan rakitan useState/useEffect: request dibatalkan saat
   * layar di-unmount, `refreshing` terpisah dari `loading` (tarik-untuk-
   * menyegarkan tidak lagi mengosongkan percakapan), dan error lewat
   * `userMessage(err)`. `messages` diturunkan dari tiket — sebelumnya ia state
   * terpisah yang hanya pernah diisi dari respons yang sama.
   */
  const query = useApiQuery<SupportTicket>(
    `support-ticket:${ticketId}`,
    (signal) => api.support.getSupportTicket(ticketId, signal),
    Boolean(ticketId),
  )
  const ticket = query.data
  const messages: SupportMessage[] = ticket?.messages ?? []

  const handleSend = useCallback(async () => {
    if (!ticketId || !reply.trim()) return
    setSending(true)
    try {
      await api.support.replySupportTicket(ticketId, reply.trim(), replyAttachmentKeys)
      setReply("")
      setReplyAttachmentKeys([])
      await query.reload()
      toast.show({ title: "Balasan terkirim", tone: "success", duration: 2500 })
    } catch (err: unknown) {
      toast.show({ title: "Gagal mengirim balasan", description: userMessage(err), tone: "danger" })
    } finally {
      setSending(false)
    }
  }, [ticketId, reply, replyAttachmentKeys, toast.show, query])

  /** Item 130: pilih & unggah lampiran balasan (maks 5 total). */
  const handlePickReplyAttachments = useCallback(async () => {
    const remaining = 5 - replyAttachmentKeys.length
    if (remaining <= 0) {
      toast.show({ title: "Maksimal 5 lampiran per balasan", tone: "warning" })
      return
    }
    setUploadingReply(true)
    try {
      const picked = await pickImages({ selectionLimit: remaining })
      if (picked.status !== "picked") return
      const keys: string[] = []
      for (const asset of picked.assets) {
        const { fileKey } = await api.upload.uploadDirectImage(asset, "CHAT_ATTACHMENT")
        keys.push(fileKey)
      }
      setReplyAttachmentKeys((prev) => [...prev, ...keys].slice(0, 5))
    } catch (err: unknown) {
      logWarn("support:reply-attachment", err)
      toast.show({ title: "Gagal mengunggah lampiran", description: userMessage(err), tone: "danger" })
    } finally {
      setUploadingReply(false)
    }
  }, [replyAttachmentKeys.length, toast.show])

  const handleRemoveReplyAttachment = useCallback((fileKey: string) => {
    setReplyAttachmentKeys((prev) => prev.filter((k) => k !== fileKey))
  }, [])

  // ---- Aksi pemilik tiket: tutup / buka lagi / rating -----------------
  // Aturan status di backend: close = selain CLOSED/RESOLVED; reopen =
  // hanya CLOSED; rate = hanya RESOLVED/CLOSED (rating 1–5).
  const status = ticket?.status ?? ""
  const isClosedLike = status === "CLOSED" || status === "RESOLVED"
  const isClosed = status === "CLOSED"
  const canClose = Boolean(ticket) && !isClosedLike
  const myRating = ticket?.rating ?? 0

  // Item 126: tandai tiket dibuka agar badge unread di daftar ter-reset.
  useEffect(() => {
    if (ticket) void markSupportTicketOpened(ticket.id)
  }, [ticket])

  // Item 127: polling diam tiap 10 dtk saat tiket belum selesai.
  usePolling(
    async () => {
      await query.refresh().catch(() => {})
    },
    10_000,
    Boolean(ticketId && ticket && !isClosedLike),
  )

  const [closeOpen, setCloseOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [reopening, setReopening] = useState(false)
  const [starRating, setStarRating] = useState(0)
  const [ratingComment, setRatingComment] = useState("")
  const [ratingSubmitting, setRatingSubmitting] = useState(false)

  const handleClose = useCallback(async () => {
    if (!ticketId) return
    setClosing(true)
    try {
      await api.support.closeSupportTicket(ticketId)
      toast.show({ title: "Tiket ditutup", tone: "success", duration: 2500 })
      setCloseOpen(false)
      await query.reload()
    } catch (err: unknown) {
      toast.show({ title: "Gagal menutup tiket", description: userMessage(err), tone: "danger" })
    } finally {
      setClosing(false)
    }
  }, [ticketId, toast.show, query])

  const handleReopen = useCallback(async () => {
    if (!ticketId) return
    setReopening(true)
    try {
      await api.support.reopenSupportTicket(ticketId)
      toast.show({ title: "Tiket dibuka kembali", tone: "success", duration: 2500 })
      await query.reload()
    } catch (err: unknown) {
      toast.show({ title: "Gagal membuka tiket", description: userMessage(err), tone: "danger" })
    } finally {
      setReopening(false)
    }
  }, [ticketId, toast.show, query])

  const handleRate = useCallback(async () => {
    if (!ticketId || starRating < 1 || starRating > 5) return
    setRatingSubmitting(true)
    try {
      await api.support.rateSupportTicket(ticketId, starRating, ratingComment.trim() || undefined)
      toast.show({ title: "Rating terkirim", tone: "success", duration: 2500 })
      setStarRating(0)
      setRatingComment("")
      await query.reload()
    } catch (err: unknown) {
      toast.show({ title: "Gagal mengirim rating", description: userMessage(err), tone: "danger" })
    } finally {
      setRatingSubmitting(false)
    }
  }, [ticketId, starRating, ratingComment, toast.show, query])

  const starRow = (value: number, onPick?: (n: number) => void) => (
    <View className="flex-row gap-2">
      {[1, 2, 3, 4, 5].map((n) =>
        onPick ? (
          <PressableScale
            key={n}
            scaleOnPress={false}
            haptic
            onPress={() => onPick(n)}
            accessibilityRole="button"
            accessibilityState={{ selected: value === n }}
            accessibilityLabel={translate("{x} bintang", { x: n })}
            containerClassName={focusRingInset}
          >
            <Icon
              icon={Star}
              size="md"
              tone={n <= value ? "accent" : "default"}
              weight={n <= value ? "fill" : "regular"}
            />
          </PressableScale>
        ) : (
          <Icon
            key={n}
            icon={Star}
            size="sm"
            tone={n <= value ? "accent" : "default"}
            weight={n <= value ? "fill" : "regular"}
          />
        ),
      )}
    </View>
  )

  return (
    <Screen keyboardAvoiding edges={["top"]} padded={false}>
      {/* Item 129: judul memuat nomor tiket setelah data termuat. */}
      <Header title={ticket ? `Tiket ${ticket.ticketNumber}` : "Tiket"} />
      <PullToRefresh
        onRefresh={query.refresh}
        refreshing={query.refreshing}
        contentContainerClassName="px-5"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        <Crossfade loading={query.loading} skeleton={<DetailLoading />}>
          {query.error ? (
          <ErrorState
            title="Gagal memuat"
            description={query.error}
            onRetry={() => void query.reload()}
          />
        ) : ticket ? (
          <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
            <SupportTicketCard
              ticketNumber={ticket.ticketNumber}
              subject={ticket.subject}
              status={ticket.status}
              category={ticket.category}
              updatedAt={ticket.updatedAt ? formatDateTime(ticket.updatedAt) : undefined}
            />

            {ticket.attachmentKeys && ticket.attachmentKeys.length > 0 ? (
              <View className="gap-2">
                <SectionHeader title="Lampiran" />
                {/* Item 128: lampiran bisa dibuka (pratinjau/undi) atau error eksplisit. */}
                <View className="flex-row flex-wrap gap-2">
                  {ticket.attachmentKeys.map((key, index) => (
                    <SupportAttachmentItem key={key || index} fileKey={key} index={index} />
                  ))}
                </View>
              </View>
            ) : null}

            {canClose ? (
              <Button fullWidth variant="ghost" onPress={() => setCloseOpen(true)}>
                Tutup tiket
              </Button>
            ) : null}
            {isClosed ? (
              <Button fullWidth variant="secondary" loading={reopening} onPress={() => void handleReopen()}>
                Buka kembali tiket
              </Button>
            ) : null}

            {isClosedLike ? (
              myRating >= 1 ? (
                <View className="gap-2">
                  <Text variant="label" tone="secondary">
                    Rating Anda
                  </Text>
                  <View className="flex-row items-center gap-2">
                    {starRow(myRating)}
                    <Text variant="monoBody" tone="secondary">
                      {myRating}/5
                    </Text>
                  </View>
                  {ticket.ratingComment ? (
                    <Text variant="body" tone="secondary">
                      {ticket.ratingComment}
                    </Text>
                  ) : null}
                </View>
              ) : (
                <View className="gap-3">
                  <Text variant="label" tone="secondary">
                    Beri rating pada penyelesaian tiket ini
                  </Text>
                  {starRow(starRating, setStarRating)}
                  <TextArea
                    value={ratingComment}
                    onChangeText={setRatingComment}
                    placeholder={translate(
                      starRating >= 1 && starRating <= 2
                        ? "Ceritakan kendalanya (wajib)"
                        : "Komentar (opsional)",
                    )}
                    maxLength={500}
                    numberOfLines={2}
                  />
                  {/* UI-M009: aturan "komentar wajib untuk rating 1–2" tidak
                      terlihat dari label/placeholder — jelaskan eksplisit. */}
                  {starRating >= 1 && starRating <= 2 && !ratingComment.trim() ? (
                    <Text variant="caption" tone="warning">
                      Rating 1–2 bintang membutuhkan komentar agar tim kami bisa
                      menindaklanjuti.
                    </Text>
                  ) : null}
                  <Button
                    variant="secondary"
                    loading={ratingSubmitting}
                    disabled={starRating < 1 || (starRating <= 2 && !ratingComment.trim())}
                    onPress={() => void handleRate()}
                  >
                    Kirim rating
                  </Button>
                </View>
              )
            ) : null}

            <SectionHeader title="Percakapan" />
            {!messages.length ? (
              <Text variant="body" tone="secondary">
                Belum ada pesan.
              </Text>
            ) : null}
            {messages.map((m, i) => (
              <ChatMessageBubble
                key={m.id}
                direction={m.fromUser ? "outgoing" : "incoming"}
                text={m.text}
                time={formatDateTime(m.createdAt)}
                grouped={messages[i - 1]?.fromUser === m.fromUser}
              >
                {/* Item 130: lampiran per balasan (slot children = di atas teks). */}
                {m.attachments && m.attachments.length > 0 ? (
                  <View className="gap-1">
                    {m.attachments.map((key, ai) => (
                      <SupportAttachmentItem key={key || ai} fileKey={key} index={ai} />
                    ))}
                  </View>
                ) : null}
              </ChatMessageBubble>
            ))}

            <SectionHeader title="Balas" />
            {/* Item 130: composer diblokir untuk tiket selesai; lampiran maks 5. */}
            {isClosedLike ? (
              <Text variant="caption" tone="secondary">
                Tiket sudah {status === "RESOLVED" ? "diselesaikan" : "ditutup"} — balasan
                dinonaktifkan. Buka kembali tiket bila masalahnya belum selesai.
              </Text>
            ) : (
              <View className="gap-2">
                <TextArea
                  value={reply}
                  onChangeText={setReply}
                  placeholder="Tulis balasan Anda"
                  maxLength={2000}
                  numberOfLines={4}
                />
                {replyAttachmentKeys.length > 0 ? (
                  <View className="flex-row flex-wrap gap-2">
                    {replyAttachmentKeys.map((key, i) => (
                      <View
                        key={key}
                        className="flex-row items-center gap-1 rounded-md border border-border bg-surface px-2 py-1"
                      >
                        <Icon icon={Paperclip} size="sm" tone="default" />
                        <Text variant="caption" tone="secondary">
                          {translate("Lampiran #{x}", { x: i + 1 })}
                        </Text>
                        <PressableScale
                          onPress={() => handleRemoveReplyAttachment(key)}
                          accessibilityRole="button"
                          accessibilityLabel={translate("Hapus lampiran {x}", { x: i + 1 })}
                          className="p-1"
                        >
                          <Icon icon={X} size="sm" tone="default" />
                        </PressableScale>
                      </View>
                    ))}
                  </View>
                ) : null}
                <View className="flex-row gap-2">
                  <Button
                    variant="secondary"
                    fullWidth={false}
                    loading={uploadingReply}
                    disabled={replyAttachmentKeys.length >= 5}
                    onPress={() => void handlePickReplyAttachments()}
                    accessibilityLabel="Tambah lampiran balasan"
                  >
                    <Icon icon={Paperclip} size="sm" tone="default" />
                    {" "}Lampiran
                  </Button>
                  <Button
                    loading={sending}
                    disabled={!reply.trim() || uploadingReply}
                    onPress={() => void handleSend()}
                    className="flex-1"
                  >
                    Kirim balasan
                  </Button>
                </View>
              </View>
            )}
            </View>
          ) : null}
        </Crossfade>
      </PullToRefresh>

      <Dialog
        title="Tutup tiket?"
        description="Tiket ditutup dan dukungan dihentikan. Anda tetap bisa membukanya kembali kapan saja bila masalahnya belum selesai."
        visible={closeOpen}
        destructive
        loading={closing}
        confirmLabel="Tutup tiket"
        cancelLabel="Tetap di sini"
        onConfirm={() => void handleClose()}
        onCancel={() => setCloseOpen(false)}
        onRequestClose={() => setCloseOpen(false)}
      />
    </Screen>
  )
}