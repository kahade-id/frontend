import { LoadingScreen } from "@/components/ui/loading-screen"
/**
 * Screen — Tiket Dukungan (GET /v1/support/tickets).
 * List + navigasi detail (support/[ticketId]).
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { ChatCircleText } from "phosphor-react-native"
import { router } from "expo-router"

import { api } from "@/lib/api"
import type { SupportTicket } from "@/lib/api/support"
import { formatDateTime } from "@/lib/format"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"

import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Button } from "@/components/ui/button"
import { Header } from "@/components/ui/header"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { SupportTicketCard } from "@/components/ui/support-ticket-card"

export default function SupportScreen() {
  const insets = useSafeAreaInsets()

  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchTickets = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.support.listSupportTickets()
      setTickets(res ?? [])
    } catch {
      setError("Gagal memuat daftar tiket.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchTickets()
  }, [fetchTickets])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchTickets()
    setRefreshing(false)
  }, [fetchTickets])

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Tiket Dukungan" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        {loading ? (
          <LoadingScreen message="Memuat tiket…" />
        ) : error ? (
          <ErrorState
            title="Gagal memuat"
            description={error}
            onRetry={() => void fetchTickets()}
          />
        ) : tickets.length === 0 ? (
          <EmptyState
            icon={ChatCircleText}
            title="Belum ada tiket"
            description="Buat tiket melalui menu Hubungi Kami."
            action={
              <Button variant="ghost" fullWidth={false} onPress={() => router.push(ROUTES.contact)}>
                Hubungi Kami
              </Button>
            }
          />
        ) : (
          <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
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
                onPress={() => router.push(ROUTES.supportTicket(t.id))}
              />
            ))}
          </View>
        )}
      </PullToRefresh>
    </Screen>
  )
}
