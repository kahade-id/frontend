/**
 * Admin — Daftar tiket bantuan (GET /v1/admin/support/tickets).
 *
 * Filter status, pull-to-refresh, paginasi "muat lagi", ketuk kartu →
 * detail tiket.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { View } from "react-native"
import type { Href } from "expo-router"
import { useIsFocused } from "@react-navigation/native"
import { Lifebuoy } from "phosphor-react-native"

import {
  listTickets,
  type SupportTicket,
  type TicketStatus,
} from "@/lib/api/admin/support"
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

type StatusFilter = "ALL" | TicketStatus

const FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "ALL", label: "Semua" },
  { value: "OPEN", label: "Terbuka" },
  { value: "IN_PROGRESS", label: "Diproses" },
  { value: "RESOLVED", label: "Selesai" },
  { value: "CLOSED", label: "Ditutup" },
]

/** Label ditulis sebagai pemanggilan translate() literal agar masuk katalog i18n. */
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

function ticketDetailHref(id: string): Href {
  return {
    pathname: "/admin/(panel)/tickets/[id]",
    params: { id },
  } as unknown as Href
}

function TicketCard({ ticket }: { ticket: SupportTicket }) {
  const userLabel =
    ticket.user?.fullName?.trim() ||
    ticket.user?.email ||
    ticket.userId
  return (
    <Card
      href={ticketDetailHref(ticket.id)}
      accessibilityLabel={translate("Buka detail tiket {x}", {
        x: ticket.subject,
      })}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text variant="bodyLarge" weight={600} numberOfLines={2}>
            {ticket.subject}
          </Text>
          <Text variant="caption" tone="secondary" className="mt-1" numberOfLines={1}>
            {userLabel} · {formatDateTimeWIB(ticket.createdAt)}
          </Text>
        </View>
        <Badge tone={statusTone(ticket.status)}>{statusLabel(ticket.status)}</Badge>
      </View>
    </Card>
  )
}

export default function AdminTicketsScreen() {
  const isFocused = useIsFocused()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tickets, setTickets] = useState<SupportTicket[]>([])
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
        const res = await listTickets({
          page: 1,
          limit: PAGE_SIZE,
          status: filter === "ALL" ? undefined : filter,
        })
        setTickets(res.data)
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
    if (loadingMore || tickets.length >= total) return
    setLoadingMore(true)
    try {
      const res = await listTickets({
        page: page + 1,
        limit: PAGE_SIZE,
        status: filter === "ALL" ? undefined : filter,
      })
      setTickets((prev) => [...prev, ...res.data])
      setTotal(res.total ?? total)
      setPage((p) => p + 1)
    } catch (e) {
      if (!handleAdminApiError(e)) setError(userMessage(e))
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, tickets.length, total, page, filter])

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
      title={translate("Tiket Bantuan")}
      state={state}
      loadingMessage={translate("Memuat tiket bantuan…")}
      errorTitle={translate("Gagal memuat tiket bantuan")}
      empty={
        tickets.length === 0 && {
          icon: Lifebuoy,
          title: translate("Belum ada tiket"),
          description: translate("Tidak ada tiket bantuan pada filter ini."),
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
        {tickets.map((t) => (
          <TicketCard key={t.id} ticket={t} />
        ))}
        {tickets.length < total ? (
          <Button
            variant="secondary"
            loading={loadingMore}
            onPress={() => void handleLoadMore()}
            accessibilityLabel={translate("Muat lebih banyak tiket")}
          >
            {translate("Muat lebih banyak")}
          </Button>
        ) : null}
      </View>
    </DataScreen>
  )
}
