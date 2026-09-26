/**
 * Admin — Detail sengketa (GET /v1/admin/disputes/:id + riwayat pesan).
 *
 * Info sengketa, riwayat pesan (termasuk kirim pesan sebagai admin), dan
 * tombol aksi: tandai under review, assign ke admin (input ID), resolve
 * (pilih keputusan + catatan + winner opsional).
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { View } from "react-native"
import { useLocalSearchParams } from "expo-router"
import { useIsFocused } from "@react-navigation/native"
import { ChatCircleText } from "phosphor-react-native"

import {
  assignDispute,
  getDisputeDetail,
  getDisputeMessages,
  markDisputeUnderReview,
  resolveDispute,
  sendDisputeMessage,
  type AdminDisputeItem,
  type DisputeMessage,
} from "@/lib/api/admin/disputes"
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

type Resolution = "FULL_BUYER" | "FULL_SELLER" | "SPLIT"

const RESOLUTION_ITEMS = [
  { value: "FULL_BUYER", label: "Menangkan pembeli" },
  { value: "FULL_SELLER", label: "Menangkan penjual" },
  { value: "SPLIT", label: "Bagi dua (split)" },
] as const

function statusLabel(status: string): string {
  switch (status) {
    case "OPEN":
      return translate("Terbuka")
    case "ASSIGNED":
      return translate("Ditugaskan")
    case "UNDER_REVIEW":
      return translate("Ditinjau")
    case "WAITING_RESPONSE":
      return translate("Menunggu respons")
    case "ESCALATED":
      return translate("Dieskalasi")
    case "RESOLVED":
      return translate("Selesai")
    default:
      return status
  }
}

function statusTone(status: string): BadgeTone {
  switch (status) {
    case "OPEN":
      return "warning"
    case "ASSIGNED":
      return "info"
    case "UNDER_REVIEW":
      return "info"
    case "WAITING_RESPONSE":
      return "warning"
    case "ESCALATED":
      return "danger"
    case "RESOLVED":
      return "success"
    default:
      return "neutral"
  }
}

function resolutionLabel(r: Resolution): string {
  switch (r) {
    case "FULL_BUYER":
      return translate("Menangkan pembeli")
    case "FULL_SELLER":
      return translate("Menangkan penjual")
    case "SPLIT":
      return translate("Bagi dua (split)")
  }
}

export default function AdminDisputeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>()
  const disputeId = Array.isArray(id) ? id[0] : (id ?? "")
  const isFocused = useIsFocused()
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dispute, setDispute] = useState<AdminDisputeItem | null>(null)

  const [messages, setMessages] = useState<DisputeMessage[]>([])
  const [msgLoading, setMsgLoading] = useState(true)
  const [msgError, setMsgError] = useState<string | null>(null)

  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)

  const [acting, setActing] = useState<string | null>(null)
  const [assignSheetOpen, setAssignSheetOpen] = useState(false)
  const [adminId, setAdminId] = useState("")
  const [resolveSheetOpen, setResolveSheetOpen] = useState(false)
  const [resolution, setResolution] = useState<Resolution>("FULL_BUYER")
  const [notes, setNotes] = useState("")
  const [winnerId, setWinnerId] = useState("")

  const load = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (mode === "initial") setLoading(true)
      else setRefreshing(true)
      setError(null)
      try {
        const d = await getDisputeDetail(disputeId)
        setDispute(d)
      } catch (e) {
        if (!handleAdminApiError(e)) setError(userMessage(e))
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [disputeId],
  )

  const loadMessages = useCallback(async () => {
    setMsgLoading(true)
    setMsgError(null)
    try {
      const list = await getDisputeMessages(disputeId)
      setMessages(list)
    } catch (e) {
      if (!handleAdminApiError(e)) setMsgError(userMessage(e))
    } finally {
      setMsgLoading(false)
    }
  }, [disputeId])

  const reloadAll = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      await Promise.all([load(mode), loadMessages()])
    },
    [load, loadMessages],
  )

  useEffect(() => {
    if (isFocused && disputeId) void reloadAll("initial")
  }, [isFocused, disputeId, reloadAll])

  const state = useMemo(
    () => ({
      loading,
      refreshing,
      error,
      refresh: () => reloadAll("refresh"),
      reload: () => reloadAll("initial"),
    }),
    [loading, refreshing, error, reloadAll],
  )

  const showActionError = useCallback(
    (title: string, e: unknown) => {
      if (handleAdminApiError(e)) return
      toast.show({ title, description: userMessage(e), tone: "danger" })
    },
    [toast],
  )

  const handleSendMessage = useCallback(async () => {
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    try {
      await sendDisputeMessage(disputeId, text)
      setDraft("")
      await loadMessages()
      toast.show({ title: translate("Pesan terkirim"), tone: "success" })
    } catch (e) {
      showActionError(translate("Gagal mengirim pesan"), e)
    } finally {
      setSending(false)
    }
  }, [draft, sending, disputeId, loadMessages, toast, showActionError])

  const handleUnderReview = useCallback(async () => {
    setActing("under-review")
    try {
      await markDisputeUnderReview(disputeId)
      await load("refresh")
      toast.show({ title: translate("Sengketa ditandai under review"), tone: "success" })
    } catch (e) {
      showActionError(translate("Gagal menandai under review"), e)
    } finally {
      setActing(null)
    }
  }, [disputeId, load, toast, showActionError])

  const handleAssign = useCallback(async () => {
    const target = adminId.trim()
    if (!target || acting) return
    setActing("assign")
    try {
      await assignDispute(disputeId, target)
      setAssignSheetOpen(false)
      setAdminId("")
      await load("refresh")
      toast.show({ title: translate("Sengketa ditugaskan"), tone: "success" })
    } catch (e) {
      showActionError(translate("Gagal menugaskan sengketa"), e)
    } finally {
      setActing(null)
    }
  }, [adminId, acting, disputeId, load, toast, showActionError])

  const handleResolve = useCallback(async () => {
    const noteText = notes.trim()
    if (noteText.length < 100 || acting) return
    setActing("resolve")
    try {
      await resolveDispute(disputeId, {
        resolution,
        notes: noteText,
        winnerId: winnerId.trim() || undefined,
      })
      setResolveSheetOpen(false)
      setNotes("")
      setWinnerId("")
      await load("refresh")
      toast.show({ title: translate("Sengketa diselesaikan"), tone: "success" })
    } catch (e) {
      showActionError(translate("Gagal menyelesaikan sengketa"), e)
    } finally {
      setActing(null)
    }
  }, [notes, winnerId, resolution, acting, disputeId, load, toast, showActionError])

  const status = dispute ? String(dispute.status) : ""
  const canReview = status !== "" && status !== "UNDER_REVIEW" && status !== "RESOLVED"
  const canResolve = status === "UNDER_REVIEW" || status === "ESCALATED" || status === "ASSIGNED"

  return (
    <DataScreen
      title={dispute?.orderId ?? translate("Detail Sengketa")}
      state={state}
      loadingMessage={translate("Memuat detail sengketa…")}
      errorTitle={translate("Gagal memuat detail sengketa")}
    >
      {dispute ? (
        <View className="gap-4">
          <Card>
            <View className="mb-3 flex-row items-center justify-between gap-2">
              <Badge tone={statusTone(status)}>{statusLabel(status)}</Badge>
              {dispute.assignedAdminId ? (
                <Text variant="caption" tone="secondary" numberOfLines={1}>
                  {translate("Ditugaskan ke {x}", { x: dispute.assignedAdminId })}
                </Text>
              ) : null}
            </View>
            <KeyValue label={translate("ID Sengketa")} value={dispute.id} mono />
            <KeyValue label={translate("ID Order")} value={dispute.orderId} mono />
            {dispute.reason ? (
              <KeyValue label={translate("Alasan")} value={dispute.reason} />
            ) : null}
            <KeyValue
              label={translate("Dibuat")}
              value={formatDateTimeWIB(dispute.createdAt)}
            />
            {dispute.updatedAt ? (
              <KeyValue
                label={translate("Diperbarui")}
                value={formatDateTimeWIB(dispute.updatedAt)}
              />
            ) : null}
          </Card>

          <View className="flex-row gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              disabled={!canReview}
              loading={acting === "under-review"}
              onPress={() => void handleUnderReview()}
              accessibilityLabel={translate("Tandai sengketa sebagai under review")}
            >
              {translate("Mulai review")}
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              onPress={() => setAssignSheetOpen(true)}
              accessibilityLabel={translate("Tugaskan sengketa ke admin")}
            >
              {translate("Assign")}
            </Button>
          </View>
          <Button
            variant="primary"
            disabled={!canResolve}
            onPress={() => setResolveSheetOpen(true)}
            accessibilityLabel={translate("Selesaikan sengketa ini")}
          >
            {translate("Resolve")}
          </Button>
          {!canResolve ? (
            <Text variant="caption" tone="secondary">
              {translate(
                "Resolve tersedia setelah sengketa ditugaskan dan ditandai under review.",
              )}
            </Text>
          ) : null}

          <SectionHeader title={translate("Riwayat pesan")} />
          <Card>
            {msgLoading ? (
              <Text tone="secondary">{translate("Memuat pesan…")}</Text>
            ) : msgError ? (
              <View className="gap-2">
                <Text tone="danger">{msgError}</Text>
                <Button
                  variant="secondary"
                  size="sm"
                  fullWidth={false}
                  onPress={() => void loadMessages()}
                  accessibilityLabel={translate("Coba lagi memuat pesan")}
                >
                  {translate("Coba lagi")}
                </Button>
              </View>
            ) : messages.length === 0 ? (
              <Text tone="secondary">{translate("Belum ada pesan.")}</Text>
            ) : (
              <View className="gap-3">
                {messages.map((m) => (
                  <View
                    key={m.id}
                    className="rounded-xl bg-surface px-3 py-2.5"
                  >
                    <View className="mb-1 flex-row items-center gap-1.5">
                      <ChatCircleText size={14} />
                      <Text variant="caption" tone="secondary" numberOfLines={1}>
                        {m.senderId} · {formatDateTimeWIB(m.createdAt)}
                      </Text>
                    </View>
                    <Text variant="body">{m.message}</Text>
                  </View>
                ))}
              </View>
            )}
          </Card>

          <Input
            variant="multiline"
            rows={3}
            label={translate("Kirim pesan sebagai admin")}
            placeholder={translate("Tulis pesan untuk para pihak…")}
            value={draft}
            onChangeText={setDraft}
            maxLength={2000}
            accessibilityLabel={translate("Pesan sengketa")}
          />
          <Button
            variant="primary"
            loading={sending}
            disabled={draft.trim().length === 0}
            onPress={() => void handleSendMessage()}
            accessibilityLabel={translate("Kirim pesan sengketa")}
          >
            {translate("Kirim pesan")}
          </Button>
        </View>
      ) : null}

      <BottomSheet
        visible={assignSheetOpen}
        onRequestClose={() => setAssignSheetOpen(false)}
        title={translate("Assign sengketa")}
        description={translate("Masukkan ID admin yang akan menangani sengketa ini.")}
        avoidKeyboard
        footer={
          <Button
            variant="primary"
            loading={acting === "assign"}
            disabled={adminId.trim().length === 0}
            onPress={() => void handleAssign()}
            accessibilityLabel={translate("Konfirmasi penugasan sengketa")}
          >
            {translate("Tugaskan")}
          </Button>
        }
      >
        <Input
          label={translate("ID Admin")}
          placeholder={translate("cth: adm_123")}
          value={adminId}
          onChangeText={setAdminId}
          accessibilityLabel={translate("ID admin penerima tugas")}
        />
      </BottomSheet>

      <BottomSheet
        visible={resolveSheetOpen}
        onRequestClose={() => setResolveSheetOpen(false)}
        title={translate("Resolve sengketa")}
        description={translate("Keputusan ini tercatat dan tidak bisa dibatalkan.")}
        avoidKeyboard
        footer={
          <Button
            variant="primary"
            loading={acting === "resolve"}
            disabled={notes.trim().length < 100}
            onPress={() => void handleResolve()}
            accessibilityLabel={translate("Konfirmasi penyelesaian sengketa")}
          >
            {translate("Selesaikan sengketa")}
          </Button>
        }
      >
        <SegmentedControl<Resolution>
          items={RESOLUTION_ITEMS.map((r) => ({
            value: r.value,
            label: translate(r.label),
          }))}
          value={resolution}
          onChange={setResolution}
          accessibilityLabel={translate("Keputusan penyelesaian")}
        />
        <Input
          variant="multiline"
          rows={4}
          label={translate("Catatan keputusan")}
          placeholder={translate("Minimal 100 karakter untuk dokumentasi audit…")}
          value={notes}
          onChangeText={setNotes}
          maxLength={5000}
          helperText={translate("{x} / {y} karakter minimum", { x: notes.trim().length, y: 100 })}
          accessibilityLabel={translate("Catatan keputusan sengketa")}
        />
        <Input
          label={translate("ID pemenang (opsional)")}
          placeholder={translate("cth: usr_123")}
          value={winnerId}
          onChangeText={setWinnerId}
          accessibilityLabel={translate("ID pemenang sengketa")}
        />
        <Text variant="caption" tone="secondary">
          {translate("Keputusan yang dipilih: {x}", {
            x: resolutionLabel(resolution),
          })}
        </Text>
      </BottomSheet>
    </DataScreen>
  )
}
