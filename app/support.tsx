/**
 * Screen — Tiket Dukungan (GET /v1/support/tickets).
 * List + navigasi detail (support/[ticketId]).
 *
 * Audit: state async → `useApiQuery`; kerangka → <DataScreen>.
 */
import { ChatCircleText } from "phosphor-react-native"
import { router } from "expo-router"

import { api } from "@/lib/api"
import { formatDateTime } from "@/lib/format"
import { ROUTES } from "@/lib/routes"
import { useApiQuery } from "@/lib/use-api-query"

import { Button } from "@/components/ui/button"
import { DataScreen } from "@/components/ui/data-screen"
import { SectionHeader } from "@/components/ui/section"
import { SupportTicketCard } from "@/components/ui/support-ticket-card"

export default function SupportScreen() {
  const query = useApiQuery("support-tickets", (signal) => api.support.listSupportTickets(signal))
  const tickets = query.data ?? []

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
      {tickets.map((t) => (
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
          href={ROUTES.supportTicket(t.id)}
        />
      ))}
    </DataScreen>
  )
}