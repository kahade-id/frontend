/**
 * Screen — Tiket Dukungan (GET /v1/support/tickets).
 * List + navigasi detail (support/[ticketId]).
 *
 * Audit: state async → `useApiQuery`; kerangka → <DataScreen>.
 *
 * Item mega-batch:
 * - 124: pencarian + filter status (filter lokal — API belum punya query filter).
 * - 126: dot unread dari jejak "terakhir dibuka" lokal (lib/support-unread).
 */
import { ChatCircleText } from "phosphor-react-native"
import { router } from "expo-router"
import { useEffect, useMemo, useState } from "react"
import { View } from "react-native"

import { api } from "@/lib/api"
import type { SupportTicket } from "@/lib/api/support"
import { formatDateTime } from "@/lib/format"
import { ROUTES } from "@/lib/routes"
import { getSupportOpenedAt, isSupportTicketUnread } from "@/lib/support-unread"
import { useApiQuery } from "@/lib/use-api-query"

import { Button } from "@/components/ui/button"
import { Chip } from "@/components/ui/chip"
import { DataScreen } from "@/components/ui/data-screen"
import { DebouncedSearchField } from "@/components/ui/debounced-search-field"
import { SectionHeader } from "@/components/ui/section"
import { SupportTicketCard } from "@/components/ui/support-ticket-card"

type StatusFilter = "all" | "active" | "done"

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "Semua" },
  { value: "active", label: "Aktif" },
  { value: "done", label: "Selesai" },
]

/**
 * SYS-A-002 (audit sistemik ronde 3, 2026-10-03): filter "Menunggu saya"
 * DIHAPUS — membandingkan `t.status === "WAITING_USER"`, state yang tidak
 * pernah ada (backend `SupportTicketStatus` hanya OPEN|IN_PROGRESS|
 * RESOLVED|CLOSED, tidak ada kode klien yang mengisinya), sehingga filter
 * itu selalu menampilkan daftar kosong. Menghapusnya lebih jujur daripada
 * membiarkan tab mati.
 */
function matchesFilter(t: SupportTicket, filter: StatusFilter): boolean {
  switch (filter) {
    case "active":
      return t.status === "OPEN" || t.status === "IN_PROGRESS"
    case "done":
      return t.status === "RESOLVED" || t.status === "CLOSED"
    default:
      return true
  }
}

export default function SupportScreen() {
  const query = useApiQuery("support-tickets", (signal) => api.support.listSupportTickets(signal))
  const tickets = query.data ?? []

  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<StatusFilter>("all")
  const [openedAt, setOpenedAt] = useState<Record<string, number>>({})

  useEffect(() => {
    void getSupportOpenedAt().then(setOpenedAt)
  }, [])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return tickets.filter((t) => {
      if (!matchesFilter(t, filter)) return false
      if (!q) return true
      return (
        t.subject.toLowerCase().includes(q) ||
        t.ticketNumber.toLowerCase().includes(q) ||
        (t.lastMessage?.text ?? "").toLowerCase().includes(q)
      )
    })
  }, [tickets, search, filter])

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
      <SectionHeader title="Semua tiket" />
      {/* Item 124: pencarian + filter status. */}
      <View className="gap-2">
        {/* Item 124: pencarian + filter status. TIM 8 (perf): state mentah
            dikurung di <DebouncedSearchField> — filter client-side 3 field
            hanya jalan atas nilai yang sudah tenang (pola app/faq.tsx). */}
        <DebouncedSearchField
          initialQuery={search}
          onQueryChange={setSearch}
          placeholder="Cari subjek atau nomor tiket"
          returnKeyType="search"
          accessibilityLabel="Cari tiket"
        />
        <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
          {STATUS_FILTERS.map((f) => (
            <Chip
              key={f.value}
              selected={filter === f.value}
              onPress={() => setFilter(f.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: filter === f.value }}
            >
              {f.label}
            </Chip>
          ))}
        </View>
      </View>
      {visible.map((t) => (
        <SupportTicketCard
          key={t.id}
          ticketNumber={t.ticketNumber}
          subject={t.subject}
          status={t.status}
          category={t.category}
          attachmentCount={t.attachmentKeys?.length}
          lastMessage={
            t.lastMessage
              ? { text: t.lastMessage.text, fromUser: t.lastMessage.fromUser }
              : undefined
          }
          updatedAt={t.updatedAt ? formatDateTime(t.updatedAt) : undefined}
          unread={isSupportTicketUnread(t, openedAt)}
          href={ROUTES.supportTicket(t.id)}
        />
      ))}
      {tickets.length > 0 && visible.length === 0 ? (
        <View className="items-center py-6">
          <Button variant="ghost" fullWidth={false} onPress={() => { setSearch(""); setFilter("all") }}>
            Bersihkan pencarian
          </Button>
        </View>
      ) : null}
    </DataScreen>
  )
}
