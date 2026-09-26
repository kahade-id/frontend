/**
 * Admin — Daftar laporan pengguna (GET /v1/admin/reports).
 *
 * Filter status, pull-to-refresh, paginasi "muat lagi", ketuk kartu →
 * detail laporan.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { View } from "react-native"
import type { Href } from "expo-router"
import { useIsFocused } from "@react-navigation/native"
import { Flag } from "phosphor-react-native"

import {
  listReports,
  type ReportStatus,
  type UserReport,
} from "@/lib/api/admin/reports"
import { userMessage } from "@/lib/api"
import { handleAdminApiError } from "@/lib/admin-session"
import { formatDateTimeWIB } from "@/lib/format"
import { translate } from "@/lib/i18n/translate"

import { Badge, type BadgeTone } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"
import { DataScreen } from "@/components/ui/data-screen"
import { Text } from "@/components/ui/text"

const PAGE_SIZE = 20

type StatusFilter = "ALL" | ReportStatus

const FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "ALL", label: "Semua" },
  { value: "PENDING", label: "Menunggu" },
  { value: "UNDER_REVIEW", label: "Ditinjau" },
  { value: "RESOLVED_ACTION_TAKEN", label: "Selesai · ditindak" },
  { value: "RESOLVED_NO_ACTION", label: "Selesai · tanpa tindakan" },
  { value: "DISMISSED", label: "Ditolak" },
]

/** Label ditulis sebagai pemanggilan translate() literal agar masuk katalog i18n. */
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

function reportDetailHref(id: string): Href {
  return {
    pathname: "/admin/(panel)/reports/[id]",
    params: { id },
  } as unknown as Href
}

function ReportCard({ report }: { report: UserReport }) {
  return (
    <Card
      href={reportDetailHref(report.id)}
      accessibilityLabel={translate("Buka detail laporan {x}", {
        x: report.reason,
      })}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text variant="bodyLarge" weight={600} numberOfLines={2}>
            {report.reason}
          </Text>
          <Text variant="caption" tone="secondary" className="mt-1" numberOfLines={1}>
            {translate("Pelapor {x} · {y}", {
              x: report.reporterId,
              y: formatDateTimeWIB(report.createdAt),
            })}
          </Text>
        </View>
        <Badge tone={statusTone(report.status)}>{statusLabel(report.status)}</Badge>
      </View>
    </Card>
  )
}

export default function AdminReportsScreen() {
  const isFocused = useIsFocused()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reports, setReports] = useState<UserReport[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)
  const [filter, setFilter] = useState<StatusFilter>("ALL")

  const load = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (mode === "initial") setLoading(true)
      else setRefreshing(true)
      setError(null)
      try {
        const res = await listReports({
          page: 1,
          limit: PAGE_SIZE,
          status: filter === "ALL" ? undefined : filter,
        })
        setReports(res.data)
        setTotal(res.total ?? res.data.length)
        setPage(1)
      } catch (e) {
        if (!handleAdminApiError(e)) setError(userMessage(e))
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [filter],
  )

  useEffect(() => {
    if (isFocused) void load("initial")
  }, [isFocused, load])

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || reports.length >= total) return
    setLoadingMore(true)
    try {
      const res = await listReports({
        page: page + 1,
        limit: PAGE_SIZE,
        status: filter === "ALL" ? undefined : filter,
      })
      setReports((prev) => [...prev, ...res.data])
      setTotal(res.total ?? total)
      setPage((p) => p + 1)
    } catch (e) {
      if (!handleAdminApiError(e)) setError(userMessage(e))
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, reports.length, total, page, filter])

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

  return (
    <DataScreen
      title={translate("Laporan Pengguna")}
      state={state}
      loadingMessage={translate("Memuat laporan pengguna…")}
      errorTitle={translate("Gagal memuat laporan pengguna")}
      empty={
        reports.length === 0 && {
          icon: Flag,
          title: translate("Belum ada laporan"),
          description: translate("Tidak ada laporan pengguna pada filter ini."),
        }
      }
      above={
        <View className="flex-row flex-wrap gap-2 px-5 pt-2">
          {FILTERS.map((f) => (
            <Chip
              key={f.value}
              selected={filter === f.value}
              onPress={() => setFilter(f.value)}
              accessibilityLabel={translate("Filter status {x}", {
                x: translate(f.label),
              })}
            >
              {translate(f.label)}
            </Chip>
          ))}
        </View>
      }
    >
      <View className="gap-3">
        {reports.map((r) => (
          <ReportCard key={r.id} report={r} />
        ))}
        {reports.length < total ? (
          <Button
            variant="secondary"
            loading={loadingMore}
            onPress={() => void handleLoadMore()}
            accessibilityLabel={translate("Muat lebih banyak laporan")}
          >
            {translate("Muat lebih banyak")}
          </Button>
        ) : null}
      </View>
    </DataScreen>
  )
}
