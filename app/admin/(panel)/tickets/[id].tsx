/**
 * Admin — Detail tiket bantuan (GET /v1/admin/support/tickets/:id).
 *
 * Subjek + pesan awal + daftar balasan, composer balasan admin, dan ubah
 * status via BottomSheet.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { View } from "react-native"
import { useLocalSearchParams } from "expo-router"
import { useIsFocused } from "@react-navigation/native"

import {
  getTicketDetail,
  replyToTicket,
  updateTicketStatus,
  type SupportTicket,
  type TicketStatus,
} from "@/lib/api/admin/support"
import { userMessage } from "@/lib/api"
import { handleAdminApiError } from "@/lib/admin-session"
import { formatDateTimeWIB } from "@/lib/format"
import { translate } from "@/lib/i18n/translate"

import { Badge, type BadgeTone } from "@/components/ui/badge"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DataScreen } from "@/components/ui/data-screen"
import { Input } from "@/components/ui/input"
import { KeyValue } from "@/components/ui/key-value"
import { SectionHeader } from "@/components/ui/section"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"

const STATUS_ITEMS = [
  { value: "OPEN", label: "Terbuka" },
  { value: "IN_PROGRESS", label: "Diproses" },
  { value: "RESOLVED", label: "Selesai" },
  { value: "CLOSED", label: "Ditutup" },
] as const

function statusLabel(status: string): string {
  switch (status) {
    case "OPEN":
      return translate("Terbuka")
    case "IN_PROGRESS":
      return translate("Diproses")
    case "RESOLVED":
      return translate("Selesai")
    case "CLOSED":
      return translate("Ditutup")
    default:
      return status
  }
}

function statusTone(status: string): BadgeTone {
  switch (status) {
    case "OPEN":
      return "warning"
    case "IN_PROGRESS":
      return "info"
    case "RESOLVED":
      return "success"
    case "CLOSED":
      return "neutral"
    default:
      return "neutral"
  }
}

export default function AdminTicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>()
  const ticketId = Array.isArray(id) ? id[0] : (id ?? "")
  const isFocused = useIsFocused()
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ticket, setTicket] = useState<SupportTicket | null>(null)

  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)

  const [statusSheetOpen, setStatusSheetOpen] = useState(false)
  const [nextStatus, setNextStatus] = useState<TicketStatus>("IN_PROGRESS")
  const [updating, setUpdating] = useState(false)

  const load = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (mode === "initial") setLoading(true)
      else setRefreshing(true)
      setError(null)
      try {
        const t = await getTicketDetail(ticketId)
        setTicket(t)
        setNextStatus(t.status)
      } catch (e) {
        if (!handleAdminApiError(e)) setError(userMessage(e))
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [ticketId],
  )

  useEffect(() => {
    if (isFocused && ticketId) void load("initial")
  }, [isFocused, ticketId, load])

  const state = useMemo(
    () => ({
      loading,
      refreshing,
      error,
      refresh: () => load("refresh"),
      reload: () => load("initial"),
    }),
    [loading, refreshing, error, load],
  )

  const handleReply = useCallback(async () => {
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    try {
      await replyToTicket(ticketId, text)
      setDraft("")
      await load("refresh")
      toast.show({ title: translate("Balasan terkirim"), tone: "success" })
    } catch (e) {
      if (!handleAdminApiError(e)) {
        toast.show({
          title: translate("Gagal mengirim balasan"),
          description: userMessage(e),
          tone: "danger",
        })
      }
    } finally {
      setSending(false)
    }
  }, [draft, sending, ticketId, load, toast])

  const handleStatusChange = useCallback(async () => {
    if (updating) return
    setUpdating(true)
    try {
      await updateTicketStatus(ticketId, nextStatus)
      setStatusSheetOpen(false)
      await load("refresh")
      toast.show({ title: translate("Status tiket diperbarui"), tone: "success" })
    } catch (e) {
      if (!handleAdminApiError(e)) {
        toast.show({
          title: translate("Gagal memperbarui status"),
          description: userMessage(e),
          tone: "danger",
        })
      }
    } finally {
      setUpdating(false)
    }
  }, [updating, ticketId, nextStatus, load, toast])

  const status = ticket ? String(ticket.status) : ""

  return (
    <DataScreen
      title={ticket?.subject ?? translate("Detail Tiket")}
      state={state}
      loadingMessage={translate("Memuat detail tiket…")}
      errorTitle={translate("Gagal memuat detail tiket")}
    >
      {ticket ? (
        <View className="gap-4">
          <Card>
            <View className="mb-3 flex-row flex-wrap items-center gap-2">
              <Badge tone={statusTone(status)}>{statusLabel(status)}</Badge>
              {ticket.category ? (
                <Badge tone="neutral">{ticket.category}</Badge>
              ) : null}
            </View>
            <Text variant="h3" className="mb-2">
              {ticket.subject}
            </Text>
            <Text variant="body">{ticket.message}</Text>
            <View className="mt-3">
              <KeyValue
                label={translate("Pengguna")}
                value={
                  ticket.user?.fullName?.trim() ||
                  ticket.user?.email ||
                  ticket.userId
                }
              />
              {ticket.user?.email && ticket.user?.fullName?.trim() ? (
                <KeyValue label={translate("Email")} value={ticket.user.email} />
              ) : null}
              <KeyValue
                label={translate("Dibuat")}
                value={formatDateTimeWIB(ticket.createdAt)}
              />
              {ticket.updatedAt ? (
                <KeyValue
                  label={translate("Diperbarui")}
                  value={formatDateTimeWIB(ticket.updatedAt)}
                />
              ) : null}
            </View>
          </Card>

          <SectionHeader title={translate("Balasan")} />
          <Card>
            {(ticket.replies?.length ?? 0) === 0 ? (
              <Text tone="secondary">{translate("Belum ada balasan.")}</Text>
            ) : (
              <View className="gap-3">
                {ticket.replies!.map((r) => (
                  <View
                    key={r.id}
                    className={
                      r.isAdminReply
                        ? "rounded-xl bg-primary/10 px-3 py-2.5"
                        : "rounded-xl bg-surface px-3 py-2.5"
                    }
                  >
                    <View className="mb-1 flex-row items-center justify-between gap-2">
                      <Badge tone={r.isAdminReply ? "accent" : "neutral"}>
                        {r.isAdminReply
                          ? translate("Admin")
                          : translate("Pengguna")}
                      </Badge>
                      <Text variant="caption" tone="secondary">
                        {formatDateTimeWIB(r.createdAt)}
                      </Text>
                    </View>
                    <Text variant="body">{r.message}</Text>
                  </View>
                ))}
              </View>
            )}
          </Card>

          <Input
            variant="multiline"
            rows={3}
            label={translate("Balas tiket")}
            placeholder={translate("Tulis balasan untuk pengguna…")}
            value={draft}
            onChangeText={setDraft}
            maxLength={2000}
            accessibilityLabel={translate("Balasan tiket bantuan")}
          />
          <View className="flex-row gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              onPress={() => {
                setNextStatus(ticket.status)
                setStatusSheetOpen(true)
              }}
              accessibilityLabel={translate("Ubah status tiket")}
            >
              {translate("Ubah status")}
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              loading={sending}
              disabled={draft.trim().length === 0}
              onPress={() => void handleReply()}
              accessibilityLabel={translate("Kirim balasan tiket")}
            >
              {translate("Kirim balasan")}
            </Button>
          </View>
        </View>
      ) : null}

      <BottomSheet
        visible={statusSheetOpen}
        onRequestClose={() => setStatusSheetOpen(false)}
        title={translate("Ubah status tiket")}
        description={ticket?.subject}
        footer={
          <Button
            variant="primary"
            loading={updating}
            onPress={() => void handleStatusChange()}
            accessibilityLabel={translate("Simpan status tiket")}
          >
            {translate("Simpan status")}
          </Button>
        }
      >
        <SegmentedControl<TicketStatus>
          items={STATUS_ITEMS.map((s) => ({
            value: s.value,
            label: translate(s.label),
          }))}
          value={nextStatus}
          onChange={setNextStatus}
          accessibilityLabel={translate("Pilih status tiket")}
        />
        <Text variant="caption" tone="secondary">
          {translate("Status baru: {x}", { x: statusLabel(nextStatus) })}
        </Text>
      </BottomSheet>
    </DataScreen>
  )
}
