/**
 * Admin — Detail laporan pengguna (GET /v1/admin/reports/:id).
 *
 * Info laporan + tombol "Dismiss" dan "Resolve" dengan BottomSheet
 * konfirmasi (catatan opsional).
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { View } from "react-native"
import { useLocalSearchParams } from "expo-router"
import { useIsFocused } from "@react-navigation/native"

import {
  dismissReport,
  getReportDetail,
  resolveReport,
  type UserReport,
} from "@/lib/api/admin/reports"
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
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"

type Action = "dismiss" | "resolve"

function statusLabel(status: string): string {
  switch (status) {
    case "PENDING":
      return translate("Menunggu")
    case "UNDER_REVIEW":
      return translate("Ditinjau")
    case "RESOLVED_ACTION_TAKEN":
      return translate("Selesai · ditindak")
    case "RESOLVED_NO_ACTION":
      return translate("Selesai · tanpa tindakan")
    case "DISMISSED":
      return translate("Ditolak")
    case "RESOLVED":
      return translate("Selesai")
    default:
      return status
  }
}

function statusTone(status: string): BadgeTone {
  switch (status) {
    case "PENDING":
      return "warning"
    case "UNDER_REVIEW":
      return "info"
    case "RESOLVED_ACTION_TAKEN":
      return "success"
    case "RESOLVED_NO_ACTION":
      return "neutral"
    case "RESOLVED":
      return "success"
    case "DISMISSED":
      return "neutral"
    default:
      return "neutral"
  }
}

export default function AdminReportDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>()
  const reportId = Array.isArray(id) ? id[0] : (id ?? "")
  const isFocused = useIsFocused()
  const toast = useToast()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<UserReport | null>(null)

  const [action, setAction] = useState<Action | null>(null)
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (mode === "initial") setLoading(true)
      else setRefreshing(true)
      setError(null)
      try {
        const r = await getReportDetail(reportId)
        setReport(r)
      } catch (e) {
        if (!handleAdminApiError(e)) setError(userMessage(e))
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [reportId],
  )

  useEffect(() => {
    if (isFocused && reportId) void load("initial")
  }, [isFocused, reportId, load])

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

  const openAction = useCallback((a: Action) => {
    setAction(a)
    setNotes("")
  }, [])

  const closeAction = useCallback(() => {
    if (submitting) return
    setAction(null)
    setNotes("")
  }, [submitting])

  const handleConfirm = useCallback(async () => {
    if (!action || submitting) return
    setSubmitting(true)
    try {
      const noteText = notes.trim() || undefined
      if (action === "dismiss") {
        await dismissReport(reportId, noteText)
        toast.show({ title: translate("Laporan ditolak"), tone: "success" })
      } else {
        await resolveReport(reportId, noteText)
        toast.show({ title: translate("Laporan diselesaikan"), tone: "success" })
      }
      setAction(null)
      setNotes("")
      await load("refresh")
    } catch (e) {
      if (!handleAdminApiError(e)) {
        toast.show({
          title: translate(
            action === "dismiss" ? "Gagal menolak laporan" : "Gagal menyelesaikan laporan",
          ),
          description: userMessage(e),
          tone: "danger",
        })
      }
    } finally {
      setSubmitting(false)
    }
  }, [action, submitting, notes, reportId, load, toast])

  const status = report ? String(report.status) : ""
  const isFinal = ["DISMISSED", "RESOLVED", "RESOLVED_ACTION_TAKEN", "RESOLVED_NO_ACTION"].includes(status)

  return (
    <DataScreen
      title={translate("Detail Laporan")}
      state={state}
      loadingMessage={translate("Memuat detail laporan…")}
      errorTitle={translate("Gagal memuat detail laporan")}
    >
      {report ? (
        <View className="gap-4">
          <Card>
            <View className="mb-3 flex-row items-center justify-between gap-2">
              <Badge tone={statusTone(status)}>{statusLabel(status)}</Badge>
            </View>
            <Text variant="h3" className="mb-2">
              {report.reason}
            </Text>
            {report.description ? (
              <Text variant="body" className="mb-3">
                {report.description}
              </Text>
            ) : null}
            <KeyValue label={translate("ID Laporan")} value={report.id} mono />
            <KeyValue
              label={translate("ID Pelapor")}
              value={report.reporterId}
              mono
            />
            {report.reportedUserId ? (
              <KeyValue
                label={translate("ID Terlapor")}
                value={report.reportedUserId}
                mono
              />
            ) : null}
            <KeyValue
              label={translate("Dibuat")}
              value={formatDateTimeWIB(report.createdAt)}
            />
          </Card>

          {!isFinal ? (
            <View className="flex-row gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onPress={() => openAction("dismiss")}
                accessibilityLabel={translate("Tolak laporan ini")}
              >
                {translate("Dismiss")}
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onPress={() => openAction("resolve")}
                accessibilityLabel={translate("Selesaikan laporan ini")}
              >
                {translate("Resolve")}
              </Button>
            </View>
          ) : (
            <Text variant="caption" tone="secondary">
              {translate("Laporan ini sudah selesai ditangani.")}
            </Text>
          )}
        </View>
      ) : null}

      <BottomSheet
        visible={action !== null}
        onRequestClose={closeAction}
        title={translate(action === "dismiss" ? "Tolak laporan?" : "Selesaikan laporan?")}
        description={translate(
          action === "dismiss"
            ? "Laporan akan ditandai ditolak dan tidak ditindaklanjuti."
            : "Laporan akan ditandai selesai ditangani.",
        )}
        avoidKeyboard
        footer={
          <View className="flex-row gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              disabled={submitting}
              onPress={closeAction}
            >
              {translate("Batal")}
            </Button>
            <Button
              variant={action === "dismiss" ? "destructive" : "primary"}
              className="flex-1"
              loading={submitting}
              onPress={() => void handleConfirm()}
              accessibilityLabel={translate(
                action === "dismiss"
                  ? "Konfirmasi penolakan laporan"
                  : "Konfirmasi penyelesaian laporan",
              )}
            >
              {translate(action === "dismiss" ? "Ya, tolak" : "Ya, selesaikan")}
            </Button>
          </View>
        }
      >
        <Input
          variant="multiline"
          rows={3}
          label={translate("Catatan (opsional)")}
          placeholder={translate("Tulis catatan penanganan bila perlu…")}
          value={notes}
          onChangeText={setNotes}
          maxLength={2000}
          accessibilityLabel={translate("Catatan penanganan laporan")}
        />
      </BottomSheet>
    </DataScreen>
  )
}
