import { ListLoading } from "@/components/ui/paginated-list"
/**
 * Screen — Laporan Saya (GET /v1/settings/reports).
 * Bila dibuka dengan `targetId`/`targetName` (dari Profil Publik), tampilkan
 * <ReportForm> di atas untuk membuat laporan (POST /v1/settings/report).
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useLocalSearchParams } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Flag } from "phosphor-react-native"

import { api } from "@/lib/api"
import type { ReportsSettings } from "@/lib/api/settings"
import type { ReportUserSettingsDto } from "@/lib/api/types"
import { formatDateTime } from "@/lib/format"
import { tokens } from "@/lib/tokens"

import { Badge, type BadgeTone } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { ListGroup, ListItem } from "@/components/ui/list-item"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { ReportForm, type ReportFormValue } from "@/components/ui/report-form"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { useToast } from "@/components/ui/toast"

/** Peta alasan UI → enum API POST /v1/settings/report. */
const REASON_TO_CATEGORY: Record<string, string> = {
  SCAM: "FRAUD",
  HARASSMENT: "TNC_VIOLATION",
  FAKE_ACCOUNT: "FAKE_IDENTITY",
  INAPPROPRIATE_CONTENT: "INAPPROPRIATE_CONTENT",
  SPAM: "SPAM",
  OTHER: "OTHER",
}

export type ReportStatus = "PENDING" | "REVIEWING" | "RESOLVED" | "REJECTED" | (string & {})
const STATUS_TONE: Record<ReportStatus, BadgeTone> = {
  PENDING: "warning",
  REVIEWING: "warning",
  RESOLVED: "success",
  REJECTED: "neutral",
}

const STATUS_LABELS: Record<ReportStatus, string> = {
  PENDING: "Menunggu tinjauan",
  REVIEWING: "Ditinjau",
  RESOLVED: "Selesai",
  REJECTED: "Ditolak",
}

const CATEGORY_LABELS: Record<string, string> = {
  FRAUD: "Penipuan",
  FAKE_IDENTITY: "Identitas palsu",
  INAPPROPRIATE_CONTENT: "Konten tidak pantas",
  TNC_VIOLATION: "Pelanggaran ketentuan",
  MONEY_LAUNDERING: "Pencucian uang",
  SPAM: "Spam",
  OTHER: "Lainnya",
}

export default function ReportsScreen() {
  const { targetId, targetName } = useLocalSearchParams<{
    targetId?: string
    targetName?: string
  }>()
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [items, setItems] = useState<ReportsSettings[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [value, setValue] = useState<ReportFormValue>({ reason: "", detail: "" })
  const [submitting, setSubmitting] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.settings.getReports()
      setItems(res ?? [])
    } catch {
      setError("Gagal memuat laporan.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchAll()
    setRefreshing(false)
  }, [fetchAll])

  const handleSubmit = useCallback(
    async (v: ReportFormValue) => {
      if (!targetId) return
      setSubmitting(true)
      try {
        await api.settings.reportUser({
          targetId,
          category: (REASON_TO_CATEGORY[v.reason] ?? "OTHER") as ReportUserSettingsDto["category"],
          description: v.detail.trim(),
        })
        toast.show({ title: "Laporan terkirim", tone: "success", duration: 3000 })
        setValue({ reason: "", detail: "" })
        await fetchAll()
      } catch {
        toast.show({ title: "Gagal mengirim laporan", tone: "danger" })
      } finally {
        setSubmitting(false)
      }
    },
    [targetId, toast.show, fetchAll],
  )

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Laporan" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        {targetId ? (
          <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
            <SectionHeader title={`Laporkan ${targetName ? `@${targetName}` : "pengguna"}`} />
            <ReportForm
              targetName={targetName ? `@${targetName}` : undefined}
              value={value}
              onChange={setValue}
              onSubmit={(v) => void handleSubmit(v)}
              submitting={submitting}
            />
          </View>
        ) : null}

        <View className="gap-3" style={{ paddingTop: tokens.space[3] }}>
          <SectionHeader title="Laporan saya" />
          {loading ? (
            <ListLoading />
          ) : error ? (
            <ErrorState title="Gagal memuat" description={error} onRetry={() => void fetchAll()} />
          ) : items.length === 0 ? (
            <EmptyState
              icon={Flag}
              title="Belum ada laporan"
              description="Laporan yang Anda kirim akan muncul di sini."
            />
          ) : (
            <ListGroup>
              {items.map((r, i) => {
                const status = r.status as ReportStatus
                const known = status in STATUS_TONE
                return (
                  <ListItem
                    key={r.id}
                    title={CATEGORY_LABELS[r.category] ?? r.category}
                    subtitle={formatDateTime(r.createdAt)}
                    leading={Flag}
                    trailing={
                      <Badge tone={known ? STATUS_TONE[status] : "neutral"}>
                        {known ? STATUS_LABELS[status] : r.status}
                      </Badge>
                    }
                    divider={i < items.length - 1}
                  />
                )
              })}
            </ListGroup>
          )}
        </View>
      </PullToRefresh>
    </Screen>
  )
}
