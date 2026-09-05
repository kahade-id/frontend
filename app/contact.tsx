/**
 * Screen — Hubungi Kami: form tiket (POST /v1/support/tickets) + daftar
 * tiket (GET /v1/support/tickets) langsung di layar.
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { ChatCircleText } from "phosphor-react-native"
import { router } from "expo-router"

import { api } from "@/lib/api"
import type { SupportTicket } from "@/lib/api/support"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Field } from "@/components/ui/field"
import { FormSection } from "@/components/ui/form-section"
import { Header } from "@/components/ui/header"
import { Input } from "@/components/ui/input"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { SupportTicketCard } from "@/components/ui/support-ticket-card"
import { TextArea } from "@/components/ui/text-area"
import { useToast } from "@/components/ui/toast"

export default function ContactScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)

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

  const handleSubmit = useCallback(async () => {
    if (!subject.trim() || !message.trim()) return
    setSubmitting(true)
    try {
      const res = await api.support.createSupportTicket({
        subject: subject.trim(),
        message: message.trim(),
        attachments: [],
      })
      toast.show({ title: "Tiket terkirim", description: "Tim kami akan segera merespons.", tone: "success", duration: 4000 })
      setSubject("")
      setMessage("")
      if (res?.id) {
        router.push(ROUTES.supportTicket(res.id))
      }
      await fetchTickets()
    } catch {
      toast.show({ title: "Gagal mengirim tiket", tone: "danger" })
    } finally {
      setSubmitting(false)
    }
  }, [subject, message, toast.show, fetchTickets, router])

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Hubungi Kami" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{ style: { paddingBottom: insets.bottom + tokens.space[8] } }}
      >
        <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
          <FormSection title="Buat tiket baru">
            <Field label="Subjek" required>
              <Input value={subject} onChangeText={setSubject} placeholder="Ringkasan masalah" maxLength={120} />
            </Field>
            <Field label="Pesan" required>
              <TextArea
                value={message}
                onChangeText={setMessage}
                placeholder="Jelaskan kendala Anda"
                maxLength={2000}
                numberOfLines={5}
              />
            </Field>
            <Button loading={submitting} disabled={!subject.trim() || !message.trim()} onPress={() => void handleSubmit()}>
              Kirim Tiket
            </Button>
          </FormSection>

          <SectionHeader title="Tiket saya" inset />
          {loading ? (
            <EmptyState icon={ChatCircleText} title="Memuat tiket…" />
          ) : error ? (
            <ErrorState title="Gagal memuat" description={error} onRetry={() => void fetchTickets()} />
          ) : tickets.length === 0 ? (
            <EmptyState
              icon={ChatCircleText}
              title="Belum ada tiket"
              description="Tiket yang Anda kirim akan muncul di sini."
            />
          ) : (
            tickets.map((t) => (
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
                onPress={() => router.push(ROUTES.supportTicket(t.id))}
              />
            ))
          )}
        </View>
      </PullToRefresh>
    </Screen>
  )
}
