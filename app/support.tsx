/**
 * Screen — Tiket Dukungan (GET /v1/support/tickets).
 * List + navigasi detail (support/[ticketId]).
 *
 * Audit: state async → `useApiQuery`; kerangka → <DataScreen>.
 *
 * Mega-batch FE-IMP-5:
 * - Item 124: pencarian (nomor tiket/subjek) + chip filter status.
 * - Item 125: label kategori Indonesia (di <SupportTicketCard>).
 * - Item 126: dot "balasan baru" — balasan staf lebih baru dari terakhir
 *   tiket dibuka (disimpan lokal per tiket di lib/ui-prefs).
 */
import { useMemo, useState } from "react"
import { ScrollView, View } from "react-native"
import { ChatCircleText } from "phosphor-react-native"
import { router } from "expo-router"

import { api } from "@/lib/api"
import { formatDateTime } from "@/lib/format"
import { ROUTES } from "@/lib/routes"
import { useApiQuery } from "@/lib/use-api-query"
import { hasUnreadTicketReply } from "@/lib/ui-prefs"
import { TICKET_STATUS_LABELS } from "@/lib/labels/status"

import { Button } from "@/components/ui/button"
import { Chip } from "@/components/ui/chip"
import { DataScreen } from "@/components/ui/data-screen"
import { DebouncedSearchField } from "@/components/ui/debounced-search-field"
import { EmptyState } from "@/components/ui/empty-state"
import { SectionHeader } from "@/components/ui/section"
import { SupportTicketCard } from "@/components/ui/support-ticket-card"

type StatusFilter = "ALL" | "OPEN" | "IN_PROGRESS" | "WAITING_USER" | "RESOLVED" | "CLOSED"

const STATUS_FILTERS: StatusFilter[] = [
  "ALL",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_USER",
  "RESOLVED",
  "CLOSED",
]

function statusFilterLabel(filter: StatusFilter): string {
  return filter === "ALL" ? "Semua" : (TICKET_STATUS_LABELS[filter] ?? filter)
}

export default function SupportScreen() {
  const query = useApiQuery("support-tickets", (signal) => api.support.listSupportTickets(signal))
  const tickets = query.data ?? []
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL")
  const [searchText, setSearchText] = useState("")

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase()
    return tickets.filter((t) => {
      if (statusFilter !== "ALL" && t.status !== statusFilter) return false
      if (!q) return true
      return (
        t.ticketNumber.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q)
      )
    })
  }, [tickets, statusFilter, searchText])

  return (
    <DataScreen
      title="Tiket Dukungan"
      state={query}
      loadingMessage="Memuat tiket…"
      empty={
        tickets.length === 0 && {
          icon: ChatCircleText,
          title: "Belum ada tiket",
          description: "Buat tiket melalui menu Hubungi Kami.",
          action: (
            <Button variant="ghost" fullWidth={false} onPress={() => router.push(ROUTES.contact)}>
              Hubungi kami
            </Button>
          ),
        }
      }
    >
      {/* Item 124: pencarian + chip status. */}
      <DebouncedSearchField
        placeholder="Cari nomor tiket atau subjek…"
        onQueryChange={setSearchText}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-2">
          {STATUS_FILTERS.map((filter) => (
            <Chip
              key={filter}
              selected={statusFilter === filter}
              onPress={() => setStatusFilter(filter)}
            >
              {statusFilterLabel(filter)}
            </Chip>
          ))}
        </View>
      </ScrollView>

      <SectionHeader
        title={statusFilter === "ALL" ? "Semua tiket" : statusFilterLabel(statusFilter)}
      />
      {filtered.length === 0 && tickets.length > 0 ? (
        <View className="py-8">
          <EmptyState
            icon={ChatCircleText}
            title="Tidak ada tiket yang cocok"
            description="Coba kata kunci atau filter status lain."
          />
        </View>
      ) : null}
      {filtered.map((t) => {
        const lastAt = t.lastMessage?.createdAt ? Date.parse(t.lastMessage.createdAt) : null
        return (
          <SupportTicketCard
            key={t.id}
            ticketNumber={t.ticketNumber}
            subject={t.subject}
            status={t.status}
            category={t.category}
            attachmentCount={t.attachmentKeys?.length}
            // Item 126: dot balasan baru bila staf membalas setelah tiket
            // terakhir dibuka.
            unread={hasUnreadTicketReply(
              t.id,
              Number.isFinite(lastAt) ? lastAt : null,
              t.lastMessage?.fromUser ?? true,
            )}
            lastMessage={
              t.lastMessage
                ? { text: t.lastMessage.text, fromUser: t.lastMessage.fromUser }
                : undefined
            }
            updatedAt={t.updatedAt ? formatDateTime(t.updatedAt) : undefined}
            href={ROUTES.supportTicket(t.id)}
          />
        )
      })}
    </DataScreen>
  )
}
