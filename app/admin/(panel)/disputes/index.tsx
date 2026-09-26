/**
 * Admin — Daftar sengketa (GET /v1/admin/disputes).
 *
 * Filter status, pull-to-refresh, paginasi "muat lagi", ketuk kartu →
 * detail sengketa.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { View } from "react-native"
import type { Href } from "expo-router"
import { useIsFocused } from "@react-navigation/native"
import { Scales } from "phosphor-react-native"

import {
  listDisputes,
  type AdminDisputeItem,
  type DisputeStatus,
} from "@/lib/api/admin/disputes"
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

type StatusFilter = "ALL" | DisputeStatus

const FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "ALL", label: "Semua" },
  { value: "OPEN", label: "Terbuka" },
  { value: "ASSIGNED", label: "Ditugaskan" },
  { value: "UNDER_REVIEW", label: "Ditinjau" },
  { value: "WAITING_RESPONSE", label: "Menunggu respons" },
  { value: "ESCALATED", label: "Dieskalasi" },
  { value: "RESOLVED", label: "Selesai" },
]

/** Label ditulis sebagai pemanggilan translate() literal agar masuk katalog i18n. */
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

function disputeDetailHref(id: string): Href {
  return {
    pathname: "/admin/(panel)/disputes/[id]",
    params: { id },
  } as unknown as Href
}

function DisputeCard({ dispute }: { dispute: AdminDisputeItem }) {
  const title = dispute.reason?.trim() || dispute.orderId
  return (
    <Card
      href={disputeDetailHref(dispute.id)}
      accessibilityLabel={translate("Buka detail sengketa {x}", {
        x: dispute.orderId,
      })}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text variant="bodyLarge" weight={600} numberOfLines={2}>
            {title}
          </Text>
          <Text variant="caption" tone="secondary" className="mt-1" numberOfLines={1}>
            {translate("Order {x} · {y}", {
              x: dispute.orderId,
              y: formatDateTimeWIB(dispute.createdAt),
            })}
          </Text>
        </View>
        <Badge tone={statusTone(dispute.status)}>{statusLabel(dispute.status)}</Badge>
      </View>
    </Card>
  )
}

export default function AdminDisputesScreen() {
  const isFocused = useIsFocused()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [disputes, setDisputes] = useState<AdminDisputeItem[]>([])
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
        const res = await listDisputes({
          page: 1,
          limit: PAGE_SIZE,
          status: filter === "ALL" ? undefined : filter,
        })
        setDisputes(res.data)
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
    if (loadingMore || disputes.length >= total) return
    setLoadingMore(true)
    try {
      const res = await listDisputes({
        page: page + 1,
        limit: PAGE_SIZE,
        status: filter === "ALL" ? undefined : filter,
      })
      setDisputes((prev) => [...prev, ...res.data])
      setTotal(res.total ?? total)
      setPage((p) => p + 1)
    } catch (e) {
      if (!handleAdminApiError(e)) setError(userMessage(e))
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, disputes.length, total, page, filter])

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
      title={translate("Sengketa")}
      state={state}
      loadingMessage={translate("Memuat sengketa…")}
      errorTitle={translate("Gagal memuat sengketa")}
      empty={
        disputes.length === 0 && {
          icon: Scales,
          title: translate("Belum ada sengketa"),
          description: translate("Tidak ada sengketa pada filter ini."),
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
        {disputes.map((d) => (
          <DisputeCard key={d.id} dispute={d} />
        ))}
        {disputes.length < total ? (
          <Button
            variant="secondary"
            loading={loadingMore}
            onPress={() => void handleLoadMore()}
            accessibilityLabel={translate("Muat lebih banyak sengketa")}
          >
            {translate("Muat lebih banyak")}
          </Button>
        ) : null}
      </View>
    </DataScreen>
  )
}
