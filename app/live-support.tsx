/**
 * Kahade — Bantuan Langsung: kanal chat resmi ke Tim Kahade (G-020).
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
import { Platform, ScrollView, View, type ViewStyle } from "react-native"
import { router } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useIsFocused } from "@react-navigation/native"
import { Lifebuoy, Star } from "phosphor-react-native"

import { api, userMessage } from "@/lib/api"
import type { SupportTicket } from "@/lib/api/support"
import type { HelpArticle } from "@/lib/api/help-center"
import { formatTime } from "@/lib/format"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"
import { useHasSession } from "@/lib/guest-gate"
import { translate } from "@/lib/i18n"
import { onReconnect } from "@/lib/connectivity"
import {
  bumpUnsentAttempts,
  dequeueUnsentLiveMessage,
  enqueueUnsentLiveMessage,
  getUnsentLiveMessages,
  type UnsentLiveMessage,
} from "@/lib/live-support-outbox"
import {
  resolveSupportSenderRole,
  type SupportSenderRole,
} from "@/lib/support-message-meta"

import { Button } from "@/components/ui/button"
import { ChatComposer, type ChatComposerPayload } from "@/components/ui/chat-composer"
import { ChatMessageBubble } from "@/components/ui/chat-message-bubble"
import { Chip } from "@/components/ui/chip"
import { Dialog } from "@/components/ui/modal"
import { ErrorState } from "@/components/ui/error-state"
import { GuestLoginPrompt } from "@/components/web-guest-gate"
import { HEADER_BAR_HEIGHT, Header } from "@/components/ui/header"
import { Icon } from "@/components/ui/icon"
import { KeyboardAvoiding } from "@/components/ui/keyboard-avoiding"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Screen } from "@/components/ui/screen"
import { SupportMessageMeta } from "@/components/ui/support-message-meta"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"
import { TextLink } from "@/components/ui/text-link"
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
  /** F16: peran pengirim — "bot" untuk sapaan otomatis. */
  role: SupportSenderRole
  /** Nama pengirim untuk pesan masuk: "Asisten Otomatis" atau "Tim Kahade". */
  senderName?: string
  status?: "sending" | "sent"
  /** F07: pesan gagal terkirim yang menunggu di antrean lokal. */
  unsent?: boolean
  attempts?: number
}

let seq = 0
const nextId = () => `ls-${Date.now()}-${seq++}`

function toUnsent(item: ChatItem, ticketId: string): Omit<UnsentLiveMessage, "attempts"> {
  return { id: item.id, ticketId, text: item.text, createdAt: item.at.getTime() }
}

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
    role: "bot",
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
  /**
   * NAV-005: endpoint tiket (GET /v1/support/tickets) semuanya auth-required.
   * Gate di sini (bukan cuma overlay root) supaya layar yang ter-mount di
   * belakang overlay tidak menembak endpoint tanpa sesi. Pola = wallet.tsx.
   */
  const hasSession = useHasSession()

  const [ticketId, setTicketId] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [pending, setPending] = useState<ChatItem[]>([])
  /** F07: pesan gagal terkirim (antrean lokal, per sesi). */
  const [unsent, setUnsent] = useState<ChatItem[]>([])
  const [sending, setSending] = useState(false)
  const [starting, setStarting] = useState(false)
  const [closeOpen, setCloseOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const [reopening, setReopening] = useState(false)
  // Item 134: saran artikel sebelum percakapan dimulai (debounce draft).
  const [suggestions, setSuggestions] = useState<HelpArticle[]>([])
  // Item 135: rating inline setelah percakapan ditutup.
  const [ratingStars, setRatingStars] = useState(0)
  const [ratingComment, setRatingComment] = useState("")
  const [ratingBusy, setRatingBusy] = useState(false)

  const listRef = useRef<ScrollView | null>(null)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  // ---- Tahap 1: cari tiket Live Chat yang masih terbuka -------------------
  const listQuery = useApiQuery<SupportTicket[]>(
    "support-tickets:live-chat",
    (signal) => api.support.listSupportTickets(signal),
    hasSession && ticketId === null,
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
    hasSession && ticketId !== null,
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
      const role = resolveSupportSenderRole({
        fromUser: m.fromUser,
        senderRole: m.senderRole,
      })
      base.push({
        id: m.id,
        fromSelf: m.fromUser,
        role,
        text: m.text,
        at: m.createdAt ? new Date(m.createdAt) : new Date(),
        senderName:
          role === "bot"
            ? translate("Asisten Otomatis")
            : m.fromUser
              ? undefined
              : translate("Tim Kahade"),
        status: "sent",
      })
    }
    // F07: pesan belum terkirim tampil PALING BAWAH dengan penanda jelas.
    const failedSorted = [...unsent].sort((a, b) => a.at.getTime() - b.at.getTime())
    return [...base, ...pending, ...failedSorted]
  }, [ticket?.messages, pending, unsent])

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

  // Item 134: sebelum percakapan dimulai, debounce draft ketikan dan cari
  // artikel bantuan yang relevan. Hanya improvement — tidak mengubah alur chat.
  useEffect(() => {
    if (ticketId !== null) {
      setSuggestions([])
      return
    }
    const q = draft.trim()
    if (q.length < 3) {
      setSuggestions([])
      return
    }
    const t = setTimeout(async () => {
      try {
        const found = await api.helpCenter.searchHelpArticles(q)
        setSuggestions(found.slice(0, 3))
      } catch {
        // Saran artikel = nice-to-have; gagal diam-diam tanpa mengganggu chat.
        setSuggestions([])
      }
    }, 600)
    return () => clearTimeout(t)
  }, [draft, ticketId])

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

  /**
   * F07: kirim satu pesan. Gagal → pesan MASUK ANTREAN lokal (bukan dibuang)
   * dengan penanda "Belum terkirim" + tombol coba lagi per pesan.
   */
  const sendOne = useCallback(
    async (item: ChatItem, activeTicketId: string): Promise<boolean> => {
      try {
        await api.support.replySupportTicket(activeTicketId, item.text)
        return true
      } catch {
        return false
      }
    },
    [],
  )

  const sendText = useCallback(
    async (text: string) => {
      const clean = text.trim()
      if (!clean || !ticketId || sending || isClosedLike) return
      const optimistic: ChatItem = {
        id: nextId(),
        fromSelf: true,
        role: "user",
        text: clean,
        at: new Date(),
        status: "sending",
      }
      setPending((prev) => [...prev, optimistic])
      setSending(true)
      try {
        const ok = await sendOne(optimistic, ticketId)
        if (ok) {
          await ticketQuery.refresh()
        } else {
          // F07: gagal → antrekan lokal, tandai belum terkirim.
          await enqueueUnsentLiveMessage(toUnsent(optimistic, ticketId))
          setUnsent((prev) => [...prev, { ...optimistic, unsent: true, attempts: 1 }])
          toast.show({
            title: translate("Pesan belum terkirim"),
            description: translate("Koneksi bermasalah. Pesan disimpan dan bisa dikirim ulang."),
            tone: "warning",
            duration: 4000,
          })
        }
      } finally {
        setPending((prev) => prev.filter((p) => p.id !== optimistic.id))
        setSending(false)
      }
    },
    [ticketId, sending, isClosedLike, ticketQuery, toast.show, sendOne],
  )

  /** F07: coba lagi satu pesan dari antrean. */
  const retryUnsent = useCallback(
    async (item: ChatItem) => {
      if (!ticketId || isClosedLike) return
      const ok = await sendOne(item, ticketId)
      if (ok) {
        await dequeueUnsentLiveMessage(item.id)
        setUnsent((prev) => prev.filter((u) => u.id !== item.id))
        await ticketQuery.refresh()
        toast.show({ title: translate("Pesan terkirim"), tone: "success", duration: 2500 })
      } else {
        await bumpUnsentAttempts(item.id)
        setUnsent((prev) =>
          prev.map((u) => (u.id === item.id ? { ...u, attempts: (u.attempts ?? 0) + 1 } : u)),
        )
        toast.show({
          title: translate("Masih gagal terkirim"),
          description: translate("Periksa koneksi Anda lalu coba lagi."),
          tone: "danger",
        })
      }
    },
    [ticketId, isClosedLike, sendOne, ticketQuery, toast.show],
  )

  // F07: muat antrean pesan belum terkirim untuk sesi ini (reconnect ke sesi
  // yang sama — sesi dikenali dari tiket "Live Chat" yang masih terbuka).
  useEffect(() => {
    if (!ticketId) {
      setUnsent([])
      return
    }
    let alive = true
    void getUnsentLiveMessages(ticketId).then((list) => {
      if (!alive) return
      setUnsent(
        list.map((m) => ({
          id: m.id,
          fromSelf: true,
          role: "user" as SupportSenderRole,
          text: m.text,
          at: new Date(m.createdAt),
          status: "sent" as const,
          unsent: true,
          attempts: m.attempts,
        })),
      )
    })
    return () => {
      alive = false
    }
  }, [ticketId])

  // F07: saat koneksi pulih → segarkan sesi yang sama + coba kirim ulang
  // antrean sekali (best-effort; tombol manual tetap tersedia).
  const unsentRef = useRef(unsent)
  unsentRef.current = unsent
  useEffect(() => {
    return onReconnect(() => {
      if (!ticketId || isClosedLike) return
      toast.show({
        title: translate("Koneksi pulih"),
        description: translate("Menyambungkan ulang ke percakapan…"),
        tone: "info",
        duration: 3000,
      })
      void ticketQuery.refresh()
      const queue = [...unsentRef.current]
      void (async () => {
        for (const item of queue) {
          const ok = await sendOne(item, ticketId)
          if (ok) {
            await dequeueUnsentLiveMessage(item.id)
            setUnsent((prev) => prev.filter((u) => u.id !== item.id))
          } else {
            await bumpUnsentAttempts(item.id)
          }
        }
        if (queue.length > 0) void ticketQuery.refresh()
      })()
    })
  }, [ticketId, isClosedLike, ticketQuery, toast.show, sendOne])

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

  // Item 135: rating inline setelah percakapan ditutup (API existing
  // rateSupportTicket, sama seperti rating tiket di support/[ticketId]).
  const handleRate = useCallback(async () => {
    if (!ticketId || ratingStars < 1 || ratingStars > 5) return
    setRatingBusy(true)
    try {
      await api.support.rateSupportTicket(ticketId, ratingStars, ratingComment.trim() || undefined)
      toast.show({ title: translate("Terima kasih atas penilaian Anda"), tone: "success", duration: 2500 })
      setRatingStars(0)
      setRatingComment("")
      await ticketQuery.reload()
    } catch (err: unknown) {
      toast.show({
        title: translate("Gagal mengirim rating"),
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setRatingBusy(false)
    }
  }, [ticketId, ratingStars, ratingComment, ticketQuery, toast.show])

  // ---- Render --------------------------------------------------------------
  // NAV-005: tamu tidak melihat isi kanal — ajakan masuk (pola wallet.tsx).
  if (!hasSession) {
    return (
      <Screen edges={["top"]} padded={false}>
        <Header title={translate("Live Support")} />
        <GuestLoginPrompt bare next="/live-support" />
      </Screen>
    )
  }

  const showWelcome = ticketId === null && !listQuery.loading && !listQuery.error
  const statusOpen = ticket != null && !isClosedLike
  const showRating = isClosedLike && (ticket?.rating ?? 0) < 1

  return (
    <Screen edges={["top"]} padded={false}>
      <Header
        title={translate("Bantuan Langsung")}
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

      {/* F06: posisi antrean — dari server bila ada; TANPA janji waktu palsu. */}
      {statusOpen ? (
        <View className="border-b border-border bg-surface px-4 py-2">
          {ticket?.queuePosition != null ? (
            <Text variant="caption" tone="secondary" className="text-center">
              {translate("Posisi antrean Anda: #{x}", { x: ticket.queuePosition })}
              {ticket.estimatedWaitMinutes != null
                ? ` · estimasi ±${ticket.estimatedWaitMinutes} menit (dari server)`
                : ""}
            </Text>
          ) : (
            <Text variant="caption" tone="secondary" className="text-center">
              {translate(
                "Posisi antrean belum tersedia dari server — pesan Anda tercatat dan dibalas sesuai urutan.",
              )}
            </Text>
          )}
        </View>
      ) : null}

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
                  <View key={message.id} className="gap-1">
                    <ChatMessageBubble
                      direction={message.fromSelf ? "outgoing" : "incoming"}
                      text={message.text}
                      time={formatTime(message.at)}
                      status={message.fromSelf ? message.status : undefined}
                      grouped={grouped}
                      senderName={message.fromSelf ? undefined : message.senderName}
                    />
                    {/* F16: label peran + waktu relatif yang bisa diketuk → absolut. */}
                    {!grouped ? (
                      <SupportMessageMeta
                        role={message.role}
                        createdAt={message.at.getTime()}
                        align={message.fromSelf ? "end" : "start"}
                      />
                    ) : null}
                    {/* F07: pesan belum terkirim — penanda + aksi coba lagi. */}
                    {message.unsent ? (
                      <View className="flex-row items-center gap-2 self-end">
                        <Text variant="caption" tone="danger">
                          {translate("Belum terkirim")}
                          {(message.attempts ?? 0) > 1
                            ? ` · percobaan ke-${message.attempts}`
                            : ""}
                        </Text>
                        <TextLink
                          inline
                          onPress={() => void retryUnsent(message)}
                          accessibilityLabel={translate("Kirim ulang pesan")}
                        >
                          {translate("Coba lagi")}
                        </TextLink>
                      </View>
                    ) : null}
                  </View>
                )
              })
            )}

            {ticketQuery.loading && ticketId ? (
              <Text variant="caption" tone="secondary" className="text-center">
                {translate("Memuat percakapan…")}
              </Text>
            ) : null}

            {isClosedLike ? (
              <View className="items-center gap-3 py-2">
                <Text variant="caption" tone="secondary" className="text-center">
                  {translate("Percakapan ini sudah ditutup.")}
                </Text>
                {/* Item 135: rating inline setelah close/reload. */}
                {showRating ? (
                  <View className="w-full gap-2 rounded-lg border border-border bg-surface p-3">
                    <Text variant="label" tone="secondary" className="text-center">
                      {translate("Seberapa puas Anda dengan bantuan kami?")}
                    </Text>
                    <View className="flex-row items-center justify-center gap-2">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <PressableScale
                          key={n}
                          scaleOnPress={false}
                          haptic
                          onPress={() => setRatingStars(n)}
                          accessibilityRole="button"
                          accessibilityState={{ selected: ratingStars === n }}
                          accessibilityLabel={translate("{x} bintang", { x: n })}
                          className="p-1"
                        >
                          <Icon
                            icon={Star}
                            size="md"
                            tone={n <= ratingStars ? "accent" : "default"}
                            weight={n <= ratingStars ? "fill" : "regular"}
                          />
                        </PressableScale>
                      ))}
                    </View>
                    <TextArea
                      value={ratingComment}
                      onChangeText={setRatingComment}
                      placeholder={translate("Komentar (opsional)")}
                      maxLength={500}
                      numberOfLines={2}
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={ratingBusy}
                      disabled={ratingStars < 1}
                      onPress={() => void handleRate()}
                    >
                      {translate("Kirim rating")}
                    </Button>
                  </View>
                ) : null}
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
              {/* Item 134: saran artikel relevan sebelum percakapan dimulai. */}
              {showWelcome && suggestions.length > 0 ? (
                <View className="gap-2 border-t border-border px-4 py-3">
                  <Text variant="label" tone="secondary">
                    {translate("Mungkin membantu")}
                  </Text>
                  {suggestions.map((a) => (
                    <PressableScale
                      key={a.id}
                      onPress={() => router.push(ROUTES.helpArticle(a.slug, a.category))}
                      accessibilityRole="link"
                      accessibilityLabel={a.title}
                      className="rounded-md border border-border bg-surface px-3 py-2"
                    >
                      <Text variant="body" numberOfLines={2}>
                        {a.title}
                      </Text>
                    </PressableScale>
                  ))}
                </View>
              ) : null}
              {/* Topik cepat — satu baris di atas composer.
                  FIX 2026-09-27: di web (kahade.id) gesture geser horizontal
                  bisa diblokir ancestor yang memasang touch-action pan-y,
                  sehingga baris chip tidak bisa di-scroll dan chip terakhir
                  terlihat kepotong. touchAction pan-x pan-y mengembalikan
                  gesture horizontal. shrink-0 mencegah chip menyusut di web
                  (default flex-shrink CSS = 1). */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                style={
                  Platform.OS === "web"
                    ? ({ touchAction: "pan-x pan-y" } as unknown as ViewStyle)
                    : undefined
                }
                contentContainerClassName="gap-2 px-4 py-2"
              >
                {QUICK_TOPICS.map((topic) => (
                  <Chip
                    key={topic.label}
                    className="shrink-0"
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
                  // UI-M025: ChatComposer sudah menerapkan translateProp sendiri —
                  // teruskan string mentah, bukan hasil translate() ganda.
                  labels={{
                    placeholder: "Tulis pesan…",
                    send: "Kirim",
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
