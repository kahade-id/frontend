/**
 * Kahade — Live Support: kanal chat resmi ke Tim Kahade (G-020).
 *
 * Arsitektur: layar ini BUKAN bot lokal lagi. Percakapan didukung backend
 * tiket bantuan yang sudah ada:
 *   - GET  /v1/support/tickets              → cari tiket "Live Chat" terbuka
 *   - POST /v1/support/tickets              → buat tiket saat memulai percakapan
 *   - GET  /v1/support/tickets/{id}          → detail + balasan (di-poll)
 *   - POST /v1/support/tickets/{id}/reply    → kirim pesan
 *   - POST /v1/support/tickets/{id}/close    → tutup percakapan
 *   - POST /v1/support/tickets/{id}/reopen   → buka kembali
 * Admin membalas dari panel admin (/v1/admin/support/*); balasan masuk lewat
 * polling 10 detik saat layar fokus.
 *
 * Asisten Otomatis hanya memberi sapaan pembuka berlabel jelas — setelah tiket
 * dibuat, seluruh pesan diteruskan ke Tim Kahade dan tersimpan di akun.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ScrollView, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useIsFocused } from "@react-navigation/native"
import { Lifebuoy } from "phosphor-react-native"

import { api, userMessage } from "@/lib/api"
import type { SupportTicket } from "@/lib/api/support"
import { formatTime } from "@/lib/format"
import { tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"
import { translate } from "@/lib/i18n"

import { Button } from "@/components/ui/button"
import { ChatComposer, type ChatComposerPayload } from "@/components/ui/chat-composer"
import { ChatMessageBubble } from "@/components/ui/chat-message-bubble"
import { Chip } from "@/components/ui/chip"
import { Dialog } from "@/components/ui/modal"
import { ErrorState } from "@/components/ui/error-state"
import { HEADER_BAR_HEIGHT, Header } from "@/components/ui/header"
import { Icon } from "@/components/ui/icon"
import { KeyboardAvoiding } from "@/components/ui/keyboard-avoiding"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"

// ---------------------------------------------------------------------------

/** Subject tiket yang dipakai layar ini — dipakai untuk menemukan tiket terbuka. */
const LIVE_CHAT_SUBJECT = "Live Chat"
const POLL_INTERVAL_MS = 10_000
const OPEN_STATUSES = new Set(["OPEN", "IN_PROGRESS", "WAITING_USER"])

const QUICK_TOPICS: { label: string; text: string }[] = [
  { label: "Isi saldo", text: "Saya butuh bantuan isi saldo/top-up" },
  { label: "Transfer", text: "Saya butuh bantuan transfer saldo" },
  { label: "Tarik dana", text: "Saya butuh bantuan tarik dana" },
  { label: "Transaksi", text: "Transaksi escrow saya bermasalah" },
  { label: "Sengketa", text: "Saya ingin menanyakan sengketa" },
  { label: "Akun", text: "Saya tidak bisa masuk ke akun" },
]

type ChatItem = {
  id: string
  fromSelf: boolean
  text: string
  at: Date
  /** Nama pengirim untuk pesan masuk: "Asisten Otomatis" atau "Tim Kahade". */
  senderName?: string
  status?: "sending" | "sent"
}

let seq = 0
const nextId = () => `ls-${Date.now()}-${seq++}`

function isLiveChatTicket(t: SupportTicket): boolean {
  return (
    OPEN_STATUSES.has(t.status) &&
    t.subject.toLowerCase().includes(LIVE_CHAT_SUBJECT.toLowerCase())
  )
}

function autoGreeting(): ChatItem {
  return {
    id: "auto-greeting",
    fromSelf: false,
    senderName: translate("Asisten Otomatis"),
    text: translate(
      "Halo, saya Asisten Otomatis Kahade. Tulis pesan Anda dan Tim Kahade akan menindaklanjuti lewat percakapan ini.",
    ),
    at: new Date(),
  }
}

// ---------------------------------------------------------------------------

export default function LiveSupportScreen() {
  const insets = useSafeAreaInsets()
  const isFocused = useIsFocused()
  const toast = useToast()

  const [ticketId, setTicketId] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [pending, setPending] = useState<ChatItem[]>([])
  const [sending, setSending] = useState(false)
  const [starting, setStarting] = useState(false)
  const [closeOpen, setCloseOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [reopening, setReopening] = useState(false)

  const listRef = useRef<ScrollView | null>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  // ---- Tahap 1: cari tiket Live Chat yang masih terbuka -------------------
  const listQuery = useApiQuery<SupportTicket[]>(
    "support-tickets:live-chat",
    (signal) => api.support.listSupportTickets(signal),
    ticketId === null,
  )

  useEffect(() => {
    if (ticketId || !listQuery.data) return
    const found = listQuery.data.find(isLiveChatTicket)
    if (found) setTicketId(found.id)
  }, [listQuery.data, ticketId])

  // ---- Tahap 2: detail tiket + polling saat fokus --------------------------
  const ticketQuery = useApiQuery<SupportTicket>(
    `support-ticket:${ticketId ?? "none"}`,
    (signal) => api.support.getSupportTicket(ticketId as string, signal),
    ticketId !== null,
  )
  const ticket = ticketQuery.data
  const isClosedLike =
    ticket != null && (ticket.status === "CLOSED" || ticket.status === "RESOLVED")

  useEffect(() => {
    if (!isFocused || !ticketId || isClosedLike) return
    const t = setInterval(() => {
      void ticketQuery.refresh()
    }, POLL_INTERVAL_MS)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFocused, ticketId, isClosedLike])

  // ---- Pesan gabungan: sapaan otomatis + pesan tiket + pesan optimistis ----
  const items: ChatItem[] = useMemo(() => {
    const base: ChatItem[] = [autoGreeting()]
    for (const m of ticket?.messages ?? []) {
      base.push({
        id: m.id,
        fromSelf: m.fromUser,
        text: m.text,
        at: m.createdAt ? new Date(m.createdAt) : new Date(),
        senderName: m.fromUser ? undefined : translate("Tim Kahade"),
        status: "sent",
      })
    }
    return [...base, ...pending]
  }, [ticket?.messages, pending])

  const scrollToEnd = useCallback((delay = 120) => {
    const t = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true })
    }, delay)
    timers.current.push(t)
  }, [])

  useEffect(() => {
    scrollToEnd()
    return () => {
      timers.current.forEach(clearTimeout)
      timers.current = []
    }
  }, [items.length, scrollToEnd])

  // ---- Aksi ---------------------------------------------------------------
  const startConversation = useCallback(
    async (firstMessage?: string) => {
      if (starting) return
      setStarting(true)
      try {
        const created = await api.support.createSupportTicket({
          subject: LIVE_CHAT_SUBJECT,
          message: translate("Percakapan live chat dimulai."),
          category: "GENERAL",
        })
        const createdId =
          (created as SupportTicket).id ??
          (created as unknown as Record<string, string>).id
        if (firstMessage?.trim()) {
          await api.support.replySupportTicket(createdId, firstMessage.trim())
        }
        setTicketId(createdId)
        toast.show({ title: translate("Percakapan dimulai"), tone: "success", duration: 2500 })
      } catch (err: unknown) {
        toast.show({
          title: translate("Gagal memulai percakapan"),
          description: userMessage(err),
          tone: "danger",
        })
      } finally {
        setStarting(false)
      }
    },
    [starting, toast.show],
  )

  const sendText = useCallback(
    async (text: string) => {
      const clean = text.trim()
      if (!clean || !ticketId || sending || isClosedLike) return
      const optimistic: ChatItem = {
        id: nextId(),
        fromSelf: true,
        text: clean,
        at: new Date(),
        status: "sending",
      }
      setPending((prev) => [...prev, optimistic])
      setSending(true)
      try {
        await api.support.replySupportTicket(ticketId, clean)
        await ticketQuery.refresh()
        setPending((prev) => prev.filter((p) => p.id !== optimistic.id))
      } catch (err: unknown) {
        setPending((prev) => prev.filter((p) => p.id !== optimistic.id))
        toast.show({
          title: translate("Gagal mengirim pesan"),
          description: userMessage(err),
          tone: "danger",
        })
      } finally {
        setSending(false)
      }
    },
    [ticketId, sending, isClosedLike, ticketQuery, toast.show],
  )

  const handleSend = useCallback(
    (payload: ChatComposerPayload) => {
      if (ticketId) {
        void sendText(payload.content)
      } else {
        // Belum ada tiket: ketuk kirim = mulai percakapan dengan teks ini.
        void startConversation(payload.content)
      }
      setDraft("")
    },
    [ticketId, sendText, startConversation],
  )

  const handleClose = useCallback(async () => {
    if (!ticketId) return
    setClosing(true)
    try {
      await api.support.closeSupportTicket(ticketId)
      toast.show({ title: translate("Percakapan ditutup"), tone: "success", duration: 2500 })
      setCloseOpen(false)
      await ticketQuery.reload()
    } catch (err: unknown) {
      toast.show({
        title: translate("Gagal menutup percakapan"),
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setClosing(false)
    }
  }, [ticketId, ticketQuery, toast.show])

  const handleReopen = useCallback(async () => {
    if (!ticketId) return
    setReopening(true)
    try {
      await api.support.reopenSupportTicket(ticketId)
      toast.show({ title: translate("Percakapan dibuka kembali"), tone: "success", duration: 2500 })
      await ticketQuery.reload()
    } catch (err: unknown) {
      toast.show({
        title: translate("Gagal membuka percakapan"),
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setReopening(false)
    }
  }, [ticketId, ticketQuery, toast.show])

  // ---- Render --------------------------------------------------------------
  const showWelcome = ticketId === null && !listQuery.loading && !listQuery.error
  const statusOpen = ticket != null && !isClosedLike

  return (
    <Screen edges={["top"]} padded={false}>
      <Header
        title={translate("Live Support")}
        right={
          ticketId && statusOpen ? (
            <Button
              variant="ghost"
              size="sm"
              onPress={() => setCloseOpen(true)}
              accessibilityLabel={translate("Tutup percakapan")}
            >
              {translate("Tutup")}
            </Button>
          ) : undefined
        }
      />

      {/* Status kanal resmi */}
      <View className="flex-row items-center justify-center gap-2 border-b border-border bg-surface py-2">
        <View
          className={`h-2 w-2 rounded-full ${statusOpen || showWelcome ? "bg-success" : "bg-border"}`}
        />
        <Text variant="caption" tone="secondary">
          {ticketId
            ? isClosedLike
              ? translate("Percakapan ditutup")
              : translate("Percakapan terbuka · Tim Kahade")
            : translate("Kanal bantuan resmi Kahade")}
        </Text>
      </View>

      {listQuery.error && ticketId === null ? (
        <View className="flex-1 items-center justify-center px-6">
          <ErrorState
            title={translate("Tidak dapat memuat percakapan")}
            description={userMessage(listQuery.error)}
            onRetry={() => listQuery.reload()}
            retryLabel={translate("Coba lagi")}
          />
        </View>
      ) : (
        <KeyboardAvoiding offset={insets.top + HEADER_BAR_HEIGHT} className="flex-1">
          <ScrollView
            ref={listRef}
            className="flex-1"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerClassName="px-4 py-4"
            contentContainerStyle={{
              gap: tokens.space[2],
              paddingBottom: tokens.space[4],
            }}
          >
            <Text variant="caption" tone="secondary" className="text-center">
              {translate("Jangan membagikan kata sandi, PIN, atau OTP kepada siapa pun.")}
            </Text>

            {showWelcome ? (
              <View className="items-center gap-3 px-2 py-6">
                <View className="h-14 w-14 items-center justify-center rounded-full bg-surface">
                  <Icon icon={Lifebuoy} size={28} tone="active" />
                </View>
                <Text variant="h3" className="text-center">
                  {translate("Butuh bantuan?")}
                </Text>
                <Text variant="body" tone="secondary" className="text-center">
                  {translate(
                    "Mulai percakapan dan Tim Kahade akan menindaklanjuti. Riwayat percakapan tersimpan di akun Anda.",
                  )}
                </Text>
                <Button
                  onPress={() => void startConversation()}
                  loading={starting}
                  disabled={starting}
                >
                  {translate("Mulai percakapan")}
                </Button>
              </View>
            ) : (
              items.map((message, index) => {
                const prev = items[index - 1]
                const grouped = prev ? prev.fromSelf === message.fromSelf : false
                return (
                  <ChatMessageBubble
                    key={message.id}
                    direction={message.fromSelf ? "outgoing" : "incoming"}
                    text={message.text}
                    time={formatTime(message.at)}
                    status={message.fromSelf ? message.status : undefined}
                    grouped={grouped}
                    senderName={message.fromSelf ? undefined : message.senderName}
                  />
                )
              })
            )}

            {ticketQuery.loading && ticketId ? (
              <Text variant="caption" tone="secondary" className="text-center">
                {translate("Memuat percakapan…")}
              </Text>
            ) : null}

            {isClosedLike ? (
              <View className="items-center gap-2 py-2">
                <Text variant="caption" tone="secondary" className="text-center">
                  {translate("Percakapan ini sudah ditutup.")}
                </Text>
                <Button
                  variant="secondary"
                  size="sm"
                  onPress={() => void handleReopen()}
                  loading={reopening}
                  disabled={reopening}
                >
                  {translate("Buka kembali")}
                </Button>
              </View>
            ) : null}
          </ScrollView>

          {!isClosedLike ? (
            <>
              {/* Topik cepat — satu baris di atas composer */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerClassName="gap-2 px-4 py-2"
              >
                {QUICK_TOPICS.map((topic) => (
                  <Chip
                    key={topic.label}
                    onPress={() =>
                      ticketId ? void sendText(topic.text) : void startConversation(topic.text)
                    }
                  >
                    {topic.label}
                  </Chip>
                ))}
              </ScrollView>

              <View style={{ paddingBottom: Math.max(0, insets.bottom - tokens.space[2]) }}>
                <ChatComposer
                  value={draft}
                  onChangeText={setDraft}
                  onSend={handleSend}
                  sending={sending || starting}
                  labels={{
                    placeholder: translate("Tulis pesan…"),
                    send: translate("Kirim"),
                  }}
                />
              </View>
            </>
          ) : null}
        </KeyboardAvoiding>
      )}

      <Dialog
        title={translate("Tutup percakapan?")}
        description={translate(
          "Percakapan ditutup dan tidak bisa dilanjutkan. Anda tetap bisa membukanya kembali kapan saja bila masalahnya belum selesai.",
        )}
        visible={closeOpen}
        destructive
        loading={closing}
        confirmLabel={translate("Tutup percakapan")}
        cancelLabel={translate("Tetap di sini")}
        onConfirm={() => void handleClose()}
        onCancel={() => setCloseOpen(false)}
        onRequestClose={() => setCloseOpen(false)}
      />
    </Screen>
  )
}
