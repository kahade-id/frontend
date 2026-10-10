/**
 * Kahade — Chat dengan tim Kahade (livechat websocket).
 *
 * Poin 5, GELOMBANG 2 (2026-10-04): layar ini kini client chat betulan —
 * menggantikan shell jujur "segera hadir" dari gelombang 1.
 *
 * Alur:
 * 1. `POST /v1/support/chat/conversations` `{source:"APP"}` (idempoten).
 * 2. Connect socket bersama (`RealtimeProvider`, namespace `/`) →
 *    `support.join` { conversationId } → ack
 *    { success, conversation, messages[30], agentOnline, queuePosition }.
 * 3. Kirim: `support.message` { conversationId, content } → ack
 *    { success, data?, message? }.
 * 4. Terima: `support.message.new`, `support.typing` (expiry otomatis),
 *    `support.agent_joined`/`support.agent_left`, `support.assigned`,
 *    `support.escalated` (→ info tiket di thread).
 * 5. Tutup: `support.leave` (otomatis saat layar dilepas) + REST close;
 *    rating 1–5 setelah tutup.
 *
 * Edge yang ditangani:
 * - Koneksi putus → reconnect + re-join otomatis (hook); riwayat
 *   `messages[30]` dari ack join ulang di-merge (pesan yang terlewat).
 * - Kirim gagal → status gagal + tombol "Coba lagi" di bubble.
 *
 * Layar ini terdaftar di AUTHENTICATED_SCREENS — chat butuh sesi.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { FlatList, View } from "react-native"
import { Star, X } from "phosphor-react-native"

import {
  closeSupportConversation,
  createSupportConversation,
  rateSupportConversation,
} from "@/lib/api/support"
import { formatDateTime } from "@/lib/format"
import { translate } from "@/lib/i18n"
import { logWarn } from "@/lib/telemetry"
import {
  normalizeSupportChatMessage,
  type SupportChatMessage,
  type SupportEscalatedPayload,
  type SupportJoinAck,
} from "@/lib/realtime/support-chat-events"
import { useSupportChatRealtime } from "@/lib/realtime/use-support-chat"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ChatComposer } from "@/components/ui/chat-composer"
import { ChatMessageBubble } from "@/components/ui/chat-message-bubble"
import { Dialog } from "@/components/ui/modal"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"
import { useToast } from "@/components/ui/toast"
import { focusRingInset } from "@/lib/focus-ring"
import { showMutationError } from "@/lib/mutation-toast"

/** Fase layar: membuat percakapan → chat → tutup → rating → selesai. */
type SupportChatPhase = "creating" | "error" | "chat" | "rating" | "done"

/** Pesan di UI = pesan server + status kirim lokal untuk pesan optimistic. */
type UiSupportMessage = SupportChatMessage & {
  /** true = dibuat lokal, belum dikonfirmasi server (id sementara `tmp:*`). */
  optimistic?: boolean
  /** Status kirim pesan sendiri. */
  sendStatus?: "sending" | "failed"
}

const AGENT_FALLBACK_NAME = "Tim Kahade"

let optimisticSeq = 0
function nextTempId(): string {
  optimisticSeq += 1
  return `tmp:${Date.now()}:${optimisticSeq}`
}

function nextSystemId(): string {
  optimisticSeq += 1
  return `sys:${Date.now()}:${optimisticSeq}`
}

function makeSystemMessage(content: string): UiSupportMessage {
  return {
    id: nextSystemId(),
    conversationId: "",
    senderType: "SYSTEM",
    senderId: null,
    senderName: null,
    content,
    attachments: [],
    createdAt: new Date().toISOString(),
  }
}

/**
 * Gabung pesan baru ke daftar: dedup by id (server = sumber kebenaran),
 * sisipkan yang benar-benar baru, urut menaik by createdAt.
 */
function mergeMessages(
  prev: UiSupportMessage[],
  incoming: readonly SupportChatMessage[],
): UiSupportMessage[] {
  const known = new Set(prev.map((m) => m.id))
  const fresh = incoming.filter((m) => !known.has(m.id))
  if (fresh.length === 0) return prev
  return [...prev, ...fresh].sort(
    (a, b) => +new Date(a.createdAt) - +new Date(b.createdAt),
  )
}

export default function SupportChatScreen() {
  const toast = useToast()
  const [phase, setPhase] = useState<SupportChatPhase>("creating")
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<UiSupportMessage[]>([])
  const [agentOnline, setAgentOnline] = useState(false)
  const [agentName, setAgentName] = useState<string | null>(null)
  const [queuePosition, setQueuePosition] = useState<number | null>(null)
  const [typingName, setTypingName] = useState<string | null>(null)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const [draft, setDraft] = useState("")
  const [closeDialogOpen, setCloseDialogOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [rating, setRating] = useState(0)
  const [ratingComment, setRatingComment] = useState("")
  const [ratingSubmitting, setRatingSubmitting] = useState(false)
  const [escalatedTicket, setEscalatedTicket] = useState<{
    ticketNumber: string | null
    subject: string | null
  } | null>(null)

  // ── 1. Buat / ambil percakapan (REST, idempoten) ──────────────────────
  const createConversation = useCallback(() => {
    setPhase("creating")
    // Audit 2026-10-10: "Mulai chat baru" memakai fungsi ini lagi, tetapi
    // state thread lama (pesan, agen, antrean, tiket eskalasi) tidak pernah
    // direset — percakapan baru tampil dengan isi percakapan yang sudah
    // ditutup. Bersihkan semua state per-percakapan di sini.
    setConversationId(null)
    setMessages([])
    setAgentOnline(false)
    setAgentName(null)
    setQueuePosition(null)
    setTypingName(null)
    setJoinError(null)
    setEscalatedTicket(null)
    const controller = new AbortController()
    void createSupportConversation(controller.signal)
      .then((conversation) => {
        if (!conversation.id) {
          throw new Error("respons percakapan tanpa id")
        }
        setConversationId(conversation.id)
        if (
          typeof conversation.assignedAgentName === "string" &&
          conversation.assignedAgentName
        ) {
          setAgentName(conversation.assignedAgentName)
        }
        setPhase("chat")
      })
      .catch((err: unknown) => {
        logWarn("support-chat:create", err)
        setPhase("error")
      })
    return () => controller.abort()
  }, [])

  useEffect(() => createConversation(), [createConversation])

  // ── 2. Realtime: join, pesan masuk, typing, agen, eskalasi ────────────
  const handleJoinAck = useCallback((ack: SupportJoinAck) => {
    if (!ack.success) {
      setJoinError(
        ack.message ?? translate("Gagal bergabung ke chat. Coba lagi."),
      )
      return
    }
    setJoinError(null)
    setAgentOnline(ack.agentOnline)
    if (ack.queuePosition !== null) setQueuePosition(ack.queuePosition)
    if (ack.conversation) {
      const assigned = ack.conversation.assignedAgentName
      if (typeof assigned === "string" && assigned) setAgentName(assigned)
    }
    setMessages((prev) => mergeMessages(prev, ack.messages))
  }, [])

  /**
   * Pesan masuk dari server (`support.message.new` — sudah dinormalisasi
   * hook): exact-id = update; bila cocok dengan pesan optimistic sendiri
   * (isi sama, masih `sending`) = swap id sementara → id server; selain
   * itu = pesan baru.
   */
  const upsertIncoming = useCallback((raw: unknown) => {
    const msg = normalizeSupportChatMessage(raw)
    if (!msg) return
    setMessages((prev) => {
      const byId = prev.findIndex((m) => m.id === msg.id)
      if (byId >= 0) {
        const next = [...prev]
        next[byId] = { ...next[byId], ...msg, optimistic: false, sendStatus: undefined }
        return next
      }
      const optimisticIdx = prev.findIndex(
        (m) =>
          m.optimistic &&
          m.senderType === "USER" &&
          msg.senderType === "USER" &&
          m.content === msg.content,
      )
      if (optimisticIdx >= 0) {
        const next = [...prev]
        next[optimisticIdx] = {
          ...next[optimisticIdx],
          ...msg,
          optimistic: false,
          sendStatus: undefined,
        }
        return next.sort(
          (a, b) => +new Date(a.createdAt) - +new Date(b.createdAt),
        )
      }
      return mergeMessages(prev, [msg])
    })
  }, [])

  const pushSystemMessage = useCallback((content: string) => {
    setMessages((prev) => mergeMessages(prev, [makeSystemMessage(content)]))
  }, [])

  const handleAssigned = useCallback(
    (raw: unknown) => {
      const record = raw as Partial<{ agentName?: unknown }>
      const name =
        typeof record.agentName === "string" && record.agentName
          ? record.agentName
          : null
      if (name) {
        setAgentName(name)
        setQueuePosition(0)
        pushSystemMessage(
          translate("Anda terhubung dengan {name}.", { name }),
        )
      }
    },
    [pushSystemMessage],
  )

  const handleEscalated = useCallback(
    (raw: unknown) => {
      const record = raw as Partial<SupportEscalatedPayload>
      const ticketNumber =
        typeof record.ticketNumber === "string" && record.ticketNumber
          ? record.ticketNumber
          : typeof record.ticketId === "string"
            ? record.ticketId
            : null
      const subject =
        typeof record.subject === "string" && record.subject
          ? record.subject
          : null
      setEscalatedTicket({ ticketNumber, subject })
      pushSystemMessage(
        ticketNumber
          ? translate(
              "Percakapan ini dilanjutkan sebagai tiket {ticket}. Tim kami akan menindaklanjuti.",
              { ticket: ticketNumber },
            )
          : translate(
              "Percakapan ini dilanjutkan sebagai tiket. Tim kami akan menindaklanjuti.",
            ),
      )
    },
    [pushSystemMessage],
  )

  const { status, sendMessage } = useSupportChatRealtime(
    conversationId ?? undefined,
    {
      onJoinAck: handleJoinAck,
      onMessage: upsertIncoming,
      onTyping: (isTyping, name) =>
        setTypingName(isTyping ? (name ?? AGENT_FALLBACK_NAME) : null),
      onAgentJoined: () => {
        setAgentOnline(true)
        pushSystemMessage(translate("Agen bergabung ke percakapan."))
      },
      onAgentLeft: () => {
        setAgentOnline(false)
        pushSystemMessage(translate("Agen keluar dari percakapan."))
      },
      onAssigned: handleAssigned,
      onEscalated: handleEscalated,
    },
    { retryKey },
  )

  const connecting = status === "connecting" || status === "reconnecting"

  // ── 3. Kirim pesan ────────────────────────────────────────────────────
  const sendOptimistic = useCallback(
    (targetId: string, content: string) => {
      void sendMessage(content).then((ack) => {
        if (ack.success) {
          // Ack membawa id server → ganti id sementara; broadcast
          // `support.message.new` yang datang susulan ter-dedup by id.
          setMessages((prev) =>
            prev.map((m) =>
              m.id === targetId
                ? {
                    ...m,
                    id: ack.messageId ?? m.id,
                    optimistic: false,
                    sendStatus: undefined,
                  }
                : m,
            ),
          )
        } else {
          logWarn(
            "support-chat:send",
            new Error(`kirim gagal: ${ack.message ?? "unknown"}`),
          )
          setMessages((prev) =>
            prev.map((m) =>
              m.id === targetId ? { ...m, sendStatus: "failed" } : m,
            ),
          )
        }
      })
    },
    [sendMessage],
  )

  const handleSend = useCallback(
    (payload: { content: string }) => {
      const content = payload.content.trim()
      if (!content || phase !== "chat" || !conversationId) return
      const tempId = nextTempId()
      const optimistic: UiSupportMessage = {
        id: tempId,
        conversationId,
        senderType: "USER",
        senderId: null,
        senderName: null,
        content,
        attachments: [],
        createdAt: new Date().toISOString(),
        optimistic: true,
        sendStatus: "sending",
      }
      setMessages((prev) => mergeMessages(prev, [optimistic]))
      setDraft("")
      sendOptimistic(tempId, content)
    },
    [phase, conversationId, sendOptimistic],
  )

  const handleRetrySend = useCallback(
    (id: string) => {
      const target = messages.find((m) => m.id === id)
      if (!target || target.sendStatus !== "failed") return
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, sendStatus: "sending" } : m)),
      )
      sendOptimistic(id, target.content)
    },
    [messages, sendOptimistic],
  )

  // ── 4. Tutup percakapan + rating ──────────────────────────────────────
  const handleCloseConfirm = useCallback(() => {
    if (!conversationId || closing) return
    setClosing(true)
    void closeSupportConversation(conversationId)
      .then(() => {
        setCloseDialogOpen(false)
        setPhase("rating")
      })
      .catch((err: unknown) => {
        // Klasifikasi toast: error mutasi non-blokir via showMutationError.
        showMutationError(toast.show, {
          failTitle: translate("Gagal menutup chat"),
          uncertainHint: translate("Aksi mungkin sudah diproses — periksa kembali sebelum mencoba lagi."),
          err: err,
          scope: "support-chat:menutup-chat",
        })
      })
      .finally(() => setClosing(false))
  }, [conversationId, closing, toast])

  const handleSubmitRating = useCallback(() => {
    if (!conversationId || rating < 1 || ratingSubmitting) return
    setRatingSubmitting(true)
    void rateSupportConversation(conversationId, rating, ratingComment)
      .then(() => setPhase("done"))
      .catch((err: unknown) => {
        // Klasifikasi toast: error mutasi non-blokir via showMutationError.
        showMutationError(toast.show, {
          failTitle: translate("Gagal mengirim rating"),
          uncertainHint: translate("Aksi mungkin sudah diproses — periksa kembali sebelum mencoba lagi."),
          err: err,
          scope: "support-chat:mengirim-rating",
        })
      })
      .finally(() => setRatingSubmitting(false))
  }, [conversationId, rating, ratingComment, ratingSubmitting, toast])

  // ── Render ────────────────────────────────────────────────────────────
  /** Terbaru dulu (untuk FlatList inverted). */
  const data = useMemo(
    () =>
      [...messages].sort(
        (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
      ),
    [messages],
  )

  const renderMessage = useCallback(
    ({ item, index }: { item: UiSupportMessage; index: number }) => {
      // Di daftar inverted, pesan yang lebih tua ada di indeks lebih besar.
      const older = data[index + 1]
      const grouped =
        !!older &&
        older.senderType === item.senderType &&
        older.senderName === item.senderName &&
        item.senderType !== "SYSTEM"
      const direction =
        item.senderType === "USER"
          ? "outgoing"
          : item.senderType === "AGENT"
            ? "incoming"
            : "system"
      const agentDisplayName =
        item.senderType === "AGENT"
          ? (item.senderName ?? agentName ?? AGENT_FALLBACK_NAME)
          : undefined
      return (
        <ChatMessageBubble
          direction={direction}
          text={item.content}
          time={formatDateTime(item.createdAt)}
          grouped={grouped}
          senderName={agentDisplayName}
          avatarName={agentDisplayName}
          status={
            item.senderType === "USER"
              ? item.sendStatus === "failed"
                ? "failed"
                : item.sendStatus === "sending"
                  ? "sending"
                  : "sent"
              : undefined
          }
          onRetry={
            item.sendStatus === "failed"
              ? () => handleRetrySend(item.id)
              : undefined
          }
        />
      )
    },
    [data, agentName, handleRetrySend],
  )

  const keyExtractor = useCallback((item: UiSupportMessage) => item.id, [])

  /**
   * Slot footer <Screen> (dibungkus <FooterBar>: divider + px-5 + safe-area)
   * — composer di atas keyboard, konsisten dengan ruang chat.
   */
  const composerFooter =
    phase === "chat" ? (
      <>
        {typingName ? (
          <Text variant="caption" tone="secondary">
            {translate("{name} sedang mengetik…", { name: typingName })}
          </Text>
        ) : null}
        <ChatComposer
          value={draft}
          onChangeText={setDraft}
          onSend={handleSend}
          quickReplies={false}
          // P1 (audit 2026-10-06): backend support-chat.dto.ts @MaxLength(5000)
          // — samakan agar pesan panjang tidak terpotong diam-diam.
          maxLength={5000}
          labels={{ placeholder: translate("Tulis pesan") }}
        />
      </>
    ) : undefined

  const starRow = (
    <View className="flex-row gap-2">
      {[1, 2, 3, 4, 5].map((n) => (
        <PressableScale
          key={n}
          scaleOnPress={false}
          haptic
          onPress={() => setRating(n)}
          accessibilityRole="button"
          accessibilityState={{ selected: rating === n }}
          accessibilityLabel={translate("{x} bintang", { x: n })}
          containerClassName={focusRingInset}
          hitSlop={10}
        >
          <Icon
            icon={Star}
            size="md"
            tone={n <= rating ? "accent" : "default"}
            weight={n <= rating ? "fill" : "regular"}
          />
        </PressableScale>
      ))}
    </View>
  )

  const queueBanner =
    phase === "chat" && queuePosition !== null && queuePosition > 0 ? (
      <View className="mx-5 mt-3 rounded-md bg-surface px-4 py-3">
        <Text variant="body" tone="secondary" className="text-center">
          {translate("Anda nomor {n} dalam antrean.", { n: queuePosition })}
        </Text>
      </View>
    ) : null

  const agentBanner =
    phase === "chat" &&
    !(queuePosition !== null && queuePosition > 0) ? (
      <View className="mx-5 mt-3 flex-row items-center justify-center gap-2">
        <View
          className={
            agentOnline ? "h-2 w-2 rounded-full bg-success" : "h-2 w-2 rounded-full bg-border"
          }
        />
        <Text variant="caption" tone="secondary">
          {agentName
            ? agentOnline
              ? translate("{name} online", { name: agentName })
              : translate("{name} — menunggu respons", { name: agentName })
            : agentOnline
              ? translate("Agen online")
              : translate("Menunggu agen…")}
        </Text>
      </View>
    ) : null

  // Audit 2026-10-10: "offline" ≠ "menghubungkan ulang" — saat perangkat
  // memang tanpa internet, katakan itu (CLAUDE.md §3: pesan jujur).
  const reconnectBanner =
    phase === "chat" && (connecting || status === "offline") ? (
      <View className="mx-5 mt-3 rounded-md bg-warning-soft px-4 py-2">
        <Text variant="caption" tone="warning" className="text-center">
          {status === "offline"
            ? translate("Tidak ada koneksi internet")
            : translate("Menghubungkan ulang…")}
        </Text>
      </View>
    ) : null

  return (
    <Screen
      keyboardAvoiding
      edges={["top"]}
      padded={false}
      footer={composerFooter}
    >
      <Header
        title={translate("Chat dengan tim Kahade")}
        right={
          phase === "chat" ? (
            <IconButton
              icon={X}
              variant="ghost"
              size="md"
              shape="pill"
              accessibilityLabel={translate("Tutup chat")}
              onPress={() => setCloseDialogOpen(true)}
            />
          ) : undefined
        }
      />

      {phase === "creating" ? (
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <Text variant="body" tone="secondary" className="text-center">
            {translate("Menyiapkan chat…")}
          </Text>
        </View>
      ) : null}

      {phase === "error" ? (
        <View className="flex-1 justify-center px-5">
          <ErrorState
            title={translate("Chat tidak dapat dimulai")}
            description={translate(
              "Kami tidak dapat menyiapkan percakapan saat ini. Silakan coba lagi.",
            )}
            onRetry={createConversation}
          />
        </View>
      ) : null}

      {phase === "chat" ? (
        <>
          {queueBanner}
          {agentBanner}
          {reconnectBanner}
          {joinError ? (
            <View className="mx-5 mt-3">
              <ErrorState
                title={translate("Gagal bergabung ke chat")}
                description={joinError}
                onRetry={() => {
                  setJoinError(null)
                  setRetryKey((k) => k + 1)
                }}
              />
            </View>
          ) : null}
          <FlatList
            data={data}
            keyExtractor={keyExtractor}
            renderItem={renderMessage}
            inverted
            className="flex-1"
            contentContainerClassName="pb-4 pt-2"
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              !joinError ? (
                <View className="items-center px-8 pt-16">
                  <Text variant="body" tone="secondary" className="text-center">
                    {translate(
                      "Belum ada pesan. Tulis pertanyaan Anda di bawah — tim kami akan membantu.",
                    )}
                  </Text>
                </View>
              ) : undefined
            }
          />
          {escalatedTicket ? (
            <View className="mx-5 mb-2 rounded-md border border-border bg-surface px-4 py-2">
              <Text variant="caption" tone="secondary" className="text-center">
                {escalatedTicket.ticketNumber
                  ? translate("Dilanjutkan sebagai tiket {ticket}.", {
                      ticket: escalatedTicket.ticketNumber,
                    })
                  : translate("Dilanjutkan sebagai tiket.")}
              </Text>
            </View>
          ) : null}
        </>
      ) : null}

      {phase === "rating" ? (
        <View className="flex-1 justify-center px-8">
          <Card className="gap-4 p-6">
            <Text variant="h3" className="text-center">
              {translate("Chat ditutup")}
            </Text>
            <Text variant="body" tone="secondary" className="text-center">
              {translate("Bagaimana pengalaman Anda dengan tim kami?")}
            </Text>
            <View className="items-center">{starRow}</View>
            <TextArea
              value={ratingComment}
              onChangeText={setRatingComment}
              label={translate("Komentar")}
              placeholder={translate("Komentar (opsional)")}
              maxLength={500}
              numberOfLines={2}
            />
            <View className="gap-2">
              <Button
                loading={ratingSubmitting}
                disabled={rating < 1}
                onPress={handleSubmitRating}
              >
                {translate("Kirim rating")}
              </Button>
              <Button variant="secondary" onPress={() => setPhase("done")}>
                {translate("Lewati")}
              </Button>
            </View>
          </Card>
        </View>
      ) : null}

      {phase === "done" ? (
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <Text variant="h3" className="text-center">
            {translate("Terima kasih")}
          </Text>
          <Text variant="body" tone="secondary" className="text-center">
            {translate(
              "Masukan Anda membantu kami melayani lebih baik. Butuh bantuan lagi? Chat ini siap dibuka kembali.",
            )}
          </Text>
          <Button
            fullWidth={false}
            onPress={() => {
              setRating(0)
              setRatingComment("")
              createConversation()
            }}
          >
            {translate("Mulai chat baru")}
          </Button>
        </View>
      ) : null}

      <Dialog
        visible={closeDialogOpen}
        onRequestClose={() => setCloseDialogOpen(false)}
        title={translate("Tutup chat?")}
        description={translate(
          "Percakapan akan ditutup. Anda bisa memberi rating setelahnya.",
        )}
        confirmLabel={translate("Tutup chat")}
        destructive
        loading={closing}
        onConfirm={handleCloseConfirm}
        onCancel={() => setCloseDialogOpen(false)}
      />
    </Screen>
  )
}
