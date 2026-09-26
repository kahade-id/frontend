/**
 * Admin — Moderasi Chat (Trust & Safety).
 *
 * - Kartu statistik: getModerationStats() (angka kunci: antrean pending,
 *   24 jam terakhir, rincian severity/aksi).
 * - Daftar event moderasi (listModerationEvents) dengan filter status
 *   (PENDING/REVIEWED/DISMISSED/ACTIONED), pull-to-refresh + muat lagi.
 * - Ketuk event → BottomSheet detail (getModerationEventDetail) + tombol
 *   "Review": aksi REVIEWED/DISMISSED/ACTIONED + catatan opsional via
 *   reviewModerationEvent. Bila event punya roomId, tersedia "Lihat pesan
 *   room" (getRoomMessages, read-only).
 *
 * Catatan: kontrak API dikunci di lib/api/admin/chat.ts — layar ini hanya
 * memakai fungsi yang sudah ada, tanpa mengubahnya.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { View } from "react-native"
import { useIsFocused } from "@react-navigation/native"
import { ShieldCheck } from "phosphor-react-native"

import { translate } from "@/lib/i18n/translate"
import { userMessage } from "@/lib/api/errors"
import { handleAdminApiError } from "@/lib/admin-session"
import { formatDateTimeWIB } from "@/lib/format"
import { usePaginatedQuery } from "@/lib/use-paginated-query"
import {
  getModerationEventDetail,
  getModerationStats,
  getRoomMessages,
  listModerationEvents,
  reviewModerationEvent,
  type ModerationEvent,
} from "@/lib/api/admin/chat"

import { Badge, type BadgeTone } from "@/components/ui/badge"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { KeyValue } from "@/components/ui/key-value"
import { LoadingScreen } from "@/components/ui/loading-screen"
import { PaginatedList } from "@/components/ui/paginated-list"
import { Screen } from "@/components/ui/screen"
import { Section } from "@/components/ui/section"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { Spinner } from "@/components/ui/spinner"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"
import { useToast } from "@/components/ui/toast"

const PAGE_LIMIT = 20
const ROOM_MESSAGE_LIMIT = 50

type StatusFilter = "all" | "PENDING" | "REVIEWED" | "DISMISSED" | "ACTIONED"

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "Semua" },
  { value: "PENDING", label: "Pending" },
  { value: "REVIEWED", label: "Ditinjau" },
  { value: "DISMISSED", label: "Diabaikan" },
  { value: "ACTIONED", label: "Ditindak" },
]

const STATUS_TONE: Record<string, BadgeTone> = {
  PENDING: "warning",
  REVIEWED: "info",
  DISMISSED: "neutral",
  ACTIONED: "success",
}

const KIND_LABEL: Record<string, string> = {
  CIRCUMVENTION: "Pengelakan filter",
  CONTACT_SHARING: "Berbagi kontak",
  PROFANITY: "Kata kasar",
  SPAM: "Spam",
}

const ACTION_LABEL: Record<string, string> = {
  BLOCKED: "Diblokir",
  REDACTED: "Disensor",
  FLAGGED: "Ditandai",
}

function eventKindLabel(event: ModerationEvent): string {
  const raw = String(event.kind ?? event.type ?? "").toUpperCase()
  return translate(KIND_LABEL[raw] ?? ACTION_LABEL[raw] ?? raw)
}

function formatStatValue(value: unknown): string {
  if (typeof value === "number") return value.toLocaleString("id-ID")
  if (typeof value === "string") return value
  if (typeof value === "boolean") return value ? translate("Ya") : translate("Tidak")
  return "—"
}

function prettifyStatKey(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase())
}

function messageText(message: unknown): string {
  const obj = (message ?? {}) as Record<string, unknown>
  for (const key of ["content", "text", "body", "message", "caption"]) {
    const value = obj[key]
    if (typeof value === "string" && value.trim()) return value
  }
  return translate("Pesan tanpa teks")
}

function messageSenderLabel(message: unknown): string {
  const obj = (message ?? {}) as Record<string, unknown>
  const sender = obj.sender ?? obj.user ?? obj.author
  if (sender && typeof sender === "object") {
    const name = (sender as Record<string, unknown>).fullName ??
      (sender as Record<string, unknown>).username ??
      (sender as Record<string, unknown>).name
    if (typeof name === "string" && name.trim()) return name
  }
  const id = obj.senderId ?? obj.userId
  if (typeof id === "string" && id) return id.slice(0, 12)
  return "—"
}

function messageTime(message: unknown): string {
  const obj = (message ?? {}) as Record<string, unknown>
  const raw = obj.createdAt ?? obj.sentAt ?? obj.timestamp
  return typeof raw === "string" ? formatDateTimeWIB(raw) : ""
}

function EventCard({
  event,
  onPress,
}: {
  event: ModerationEvent
  onPress: () => void
}) {
  const status = String(event.status ?? "")
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={translate("Tinjau laporan {x}", {
        x: eventKindLabel(event),
      })}
    >
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text variant="body" weight={600} numberOfLines={1}>
            {eventKindLabel(event)}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1} className="mt-0.5">
            {event.reason
              ? String(event.reason)
              : translate("Tanpa alasan tercatat")}
          </Text>
          <Text variant="caption" tone="tertiary" numberOfLines={1} className="mt-0.5">
            {event.userId
              ? translate("Pengguna {x}", { x: String(event.userId).slice(0, 12) })
              : translate("Pengguna tidak diketahui")}
            {event.roomId ? ` • ${translate("Ruang chat")}` : ""}
          </Text>
          <Text variant="caption" tone="tertiary" className="mt-0.5">
            {formatDateTimeWIB(event.createdAt)}
          </Text>
        </View>
        <Badge tone={STATUS_TONE[status] ?? "neutral"}>{translate(status)}</Badge>
      </View>
    </Card>
  )
}

function ReviewActionPicker({
  value,
  onChange,
}: {
  value: ReviewAction
  onChange: (value: ReviewAction) => void
}) {
  return (
    <SegmentedControl<ReviewAction>
      items={[
        { value: "REVIEWED", label: translate("Ditinjau") },
        { value: "DISMISSED", label: translate("Diabaikan") },
        { value: "ACTIONED", label: translate("Ditindak") },
      ]}
      value={value}
      onChange={onChange}
      accessibilityLabel={translate("Pilih aksi review")}
    />
  )
}

type ReviewAction = "REVIEWED" | "DISMISSED" | "ACTIONED"

export default function AdminChatModerationScreen() {
  const toast = useToast()
  const isFocused = useIsFocused()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")

  const [stats, setStats] = useState<Record<string, unknown> | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsError, setStatsError] = useState<string | null>(null)

  const events = usePaginatedQuery<ModerationEvent>(
    `admin-moderation-events|${statusFilter}`,
    (page) =>
      listModerationEvents({
        page,
        limit: PAGE_LIMIT,
        status: statusFilter === "all" ? undefined : statusFilter,
      }).then((res) => ({
        data: res.data,
        meta: {
          page,
          limit: PAGE_LIMIT,
          total: res.total ?? res.data.length,
          totalPages: res.meta?.totalPages ?? 1,
        },
      })),
    { refreshOnFocus: true },
  )

  const [detailId, setDetailId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ModerationEvent | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  const [reviewAction, setReviewAction] = useState<ReviewAction>("REVIEWED")
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const [messagesVisible, setMessagesVisible] = useState(false)
  const [messages, setMessages] = useState<unknown[] | null>(null)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [messagesError, setMessagesError] = useState<string | null>(null)

  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    setStatsError(null)
    try {
      setStats(await getModerationStats())
    } catch (err) {
      if (!handleAdminApiError(err)) setStatsError(userMessage(err))
    } finally {
      setStatsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isFocused) void loadStats()
  }, [isFocused, loadStats])

  const handleRefresh = useCallback(async () => {
    await Promise.all([loadStats(), events.refresh()])
  }, [loadStats, events])

  const statCards = useMemo(() => {
    if (!stats) return []
    return Object.entries(stats)
      .filter(([, value]) => ["number", "string", "boolean"].includes(typeof value))
      .slice(0, 6)
      .map(([key, value]) => ({
        key,
        label: prettifyStatKey(key),
        value: formatStatValue(value),
      }))
  }, [stats])

  const openDetail = useCallback(
    async (id: string) => {
      setDetailId(id)
      setDetail(null)
      setDetailError(null)
      setDetailLoading(true)
      setReviewAction("REVIEWED")
      setNotes("")
      setMessagesVisible(false)
      setMessages(null)
      setMessagesError(null)
      try {
        setDetail(await getModerationEventDetail(id))
      } catch (err) {
        if (!handleAdminApiError(err)) setDetailError(userMessage(err))
      } finally {
        setDetailLoading(false)
      }
    },
    [],
  )

  const closeDetail = useCallback(() => {
    if (submitting) return
    setDetailId(null)
  }, [submitting])

  const loadRoomMessages = useCallback(
    async (roomId: string) => {
      setMessagesVisible(true)
      if (messages !== null || messagesLoading) return
      setMessagesLoading(true)
      setMessagesError(null)
      try {
        setMessages(await getRoomMessages(roomId, { limit: ROOM_MESSAGE_LIMIT }))
      } catch (err) {
        if (!handleAdminApiError(err)) setMessagesError(userMessage(err))
      } finally {
        setMessagesLoading(false)
      }
    },
    [messages, messagesLoading],
  )

  const handleSubmitReview = useCallback(async () => {
    if (!detailId || submitting) return
    setSubmitting(true)
    try {
      await reviewModerationEvent(detailId, {
        action: reviewAction,
        notes: notes.trim() || undefined,
      })
      toast.show({
        title: translate("Review terkirim"),
        tone: "success",
      })
      setDetailId(null)
      await handleRefresh()
    } catch (err) {
      if (!handleAdminApiError(err)) {
        toast.show({
          title: translate("Gagal mengirim review"),
          description: userMessage(err),
          tone: "danger",
        })
      }
    } finally {
      setSubmitting(false)
    }
  }, [detailId, submitting, reviewAction, notes, toast, handleRefresh])

  const listHeader = useMemo(
    () => (
      <View className="gap-4">
        <SegmentedControl<StatusFilter>
          items={STATUS_FILTERS.map((item) => ({
            value: item.value,
            label: translate(item.label),
          }))}
          value={statusFilter}
          onChange={setStatusFilter}
          accessibilityLabel={translate("Filter status moderasi")}
        />
        <Section title={translate("Statistik")}>
          {statsLoading ? (
            <LoadingScreen message={translate("Memuat statistik moderasi…")} />
          ) : statsError ? (
            <ErrorState
              title={translate("Gagal memuat statistik")}
              description={statsError}
              onRetry={loadStats}
              compact
            />
          ) : statCards.length === 0 ? (
            <Text variant="caption" tone="secondary">
              {translate("Belum ada data statistik.")}
            </Text>
          ) : (
            <View className="gap-3">
              {Array.from({ length: Math.ceil(statCards.length / 2) }, (_, row) => (
                <View key={row} className="flex-row gap-3">
                  {statCards.slice(row * 2, row * 2 + 2).map((card) => (
                    <Card key={card.key} className="flex-1" padded>
                      <Text variant="caption" tone="secondary" numberOfLines={2}>
                        {card.label}
                      </Text>
                      <Text variant="h3" className="mt-1">
                        {card.value}
                      </Text>
                    </Card>
                  ))}
                </View>
              ))}
            </View>
          )}
        </Section>
        <Text variant="label" tone="secondary">
          {translate("Event moderasi")}
        </Text>
      </View>
    ),
    [statusFilter, statsLoading, statsError, statCards, loadStats],
  )

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title={translate("Moderasi Chat")} />
      <View className="flex-1 px-5 pt-3">
        <PaginatedList
          data={events.data}
          renderItem={({ item }) => (
            <EventCard event={item} onPress={() => void openDetail(item.id)} />
          )}
          loading={events.loading}
          error={events.error}
          loadMoreError={events.loadMoreError}
          refreshing={events.refreshing}
          loadingMore={events.loadingMore}
          hasMore={events.hasMore}
          onRefresh={handleRefresh}
          onRetry={events.reload}
          onLoadMore={events.loadMore}
          header={listHeader}
          gap={12}
          empty={
            <EmptyState
              icon={ShieldCheck}
              title={translate("Tidak ada event moderasi")}
              description={translate(
                "Semua laporan chat sudah ditinjau pada filter ini.",
              )}
            />
          }
        />
      </View>

      {/* BottomSheet detail event + review */}
      <BottomSheet
        visible={detailId !== null}
        onRequestClose={closeDetail}
        title={translate("Detail moderasi")}
        avoidKeyboard
      >
        {detailLoading ? (
          <View className="items-center py-8">
            <Spinner accessibilityLabel={translate("Memuat detail moderasi")} />
          </View>
        ) : detailError ? (
          <ErrorState
            title={translate("Gagal memuat detail")}
            description={detailError}
            onRetry={() => detailId && void openDetail(detailId)}
            compact
          />
        ) : detail ? (
          <View className="gap-4">
            <View className="gap-1">
              <View className="flex-row items-center justify-between gap-2">
                <Text variant="bodyLarge" weight={600}>
                  {eventKindLabel(detail)}
                </Text>
                <Badge tone={STATUS_TONE[String(detail.status ?? "")] ?? "neutral"}>
                  {translate(String(detail.status ?? ""))}
                </Badge>
              </View>
              {detail.reason ? (
                <Text variant="body" tone="secondary">
                  {String(detail.reason)}
                </Text>
              ) : null}
            </View>

            <View className="gap-1.5">
              {detail.userId ? (
                <KeyValue
                  label={translate("Pengguna")}
                  value={
                    <Text variant="body" numberOfLines={1}>
                      {String(detail.userId)}
                    </Text>
                  }
                />
              ) : null}
              {detail.roomId ? (
                <KeyValue
                  label={translate("Ruang chat")}
                  value={
                    <Text variant="body" numberOfLines={1}>
                      {String(detail.roomId)}
                    </Text>
                  }
                />
              ) : null}
              <KeyValue
                label={translate("Waktu")}
                value={
                  <Text variant="body">{formatDateTimeWIB(detail.createdAt)}</Text>
                }
              />
            </View>

            {detail.roomId ? (
              <View className="gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onPress={() =>
                    messagesVisible
                      ? setMessagesVisible(false)
                      : void loadRoomMessages(String(detail.roomId))
                  }
                  accessibilityLabel={translate("Lihat pesan room")}
                >
                  {messagesVisible
                    ? translate("Sembunyikan pesan")
                    : translate("Lihat pesan room")}
                </Button>
                {messagesVisible ? (
                  messagesLoading ? (
                    <View className="items-center py-4">
                      <Spinner
                        accessibilityLabel={translate("Memuat pesan room")}
                      />
                    </View>
                  ) : messagesError ? (
                    <ErrorState
                      title={translate("Gagal memuat pesan")}
                      description={messagesError}
                      onRetry={() =>
                        detail.roomId &&
                        void loadRoomMessages(String(detail.roomId))
                      }
                      compact
                    />
                  ) : messages && messages.length > 0 ? (
                    <View className="gap-2">
                      {messages.map((message, index) => (
                        <View
                          key={index}
                          className="rounded-xl border border-border bg-surface p-3"
                        >
                          <View className="flex-row items-center justify-between gap-2">
                            <Text variant="caption" weight={600} numberOfLines={1}>
                              {messageSenderLabel(message)}
                            </Text>
                            <Text variant="caption" tone="tertiary">
                              {messageTime(message)}
                            </Text>
                          </View>
                          <Text variant="body" className="mt-1">
                            {messageText(message)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text variant="caption" tone="secondary">
                      {translate("Tidak ada pesan di room ini.")}
                    </Text>
                  )
                ) : null}
              </View>
            ) : null}

            <View className="gap-2">
              <Text variant="label">{translate("Review")}</Text>
              <ReviewActionPicker value={reviewAction} onChange={setReviewAction} />
              <TextArea
                label={translate("Catatan")}
                placeholder={translate("Catatan review (opsional)…")}
                value={notes}
                onChangeText={setNotes}
                maxLength={500}
                accessibilityLabel={translate("Catatan review")}
              />
              <Button
                onPress={handleSubmitReview}
                loading={submitting}
                accessibilityLabel={translate("Kirim review moderasi")}
              >
                {translate("Kirim review")}
              </Button>
            </View>
          </View>
        ) : null}
      </BottomSheet>
    </Screen>
  )
}
