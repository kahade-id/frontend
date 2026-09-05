/**
 * Screen — Detail Sengketa (GET /v1/disputes/{id}, evidence, messages,
 * claim, mutual-resolution). Komponen: DisputeClaimForm, EvidenceGrid,
 * ChatMessageBubble, MutualResolutionCard.
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useLocalSearchParams } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { ShieldWarning } from "phosphor-react-native"
import * as ImagePicker from "expo-image-picker"

import { api } from "@/lib/api"
import type { DisputeDetail, DisputeEvidence, DisputeMessage, MutualResolutionProposal } from "@/lib/api/disputes"
import { formatDateTime, formatRupiah } from "@/lib/format"
import { tokens } from "@/lib/tokens"

import { ChatMessageBubble } from "@/components/ui/chat-message-bubble"
import { DisputeClaimForm } from "@/components/ui/dispute-claim-form"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { EvidenceGrid } from "@/components/ui/evidence-grid"
import { Header } from "@/components/ui/header"
import { MutualResolutionCard } from "@/components/ui/mutual-resolution-card"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"

export default function DisputeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [dispute, setDispute] = useState<DisputeDetail | null>(null)
  const [evidence, setEvidence] = useState<DisputeEvidence[]>([])
  const [messages, setMessages] = useState<DisputeMessage[]>([])
  const [proposal, setProposal] = useState<MutualResolutionProposal | null>(null)
  const [claim, setClaim] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const fetchAll = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const [d, ev, msgs, proposals] = await Promise.all([
        api.disputes.getDispute(id),
        api.disputes.getDisputeEvidence(id),
        api.disputes.getDisputeMessages(id),
        api.disputes.getMutualResolution(id).catch(() => []),
      ])
      setDispute(d)
      setEvidence(ev ?? [])
      setMessages(msgs ?? [])
      setProposal(proposals?.[0] ?? null)
      setClaim(d.claim ?? "")
    } catch {
      setError("Gagal memuat sengketa.")
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchAll()
    setRefreshing(false)
  }, [fetchAll])

  const handleSubmitClaim = useCallback(
    async (text: string) => {
      if (!id) return
      setSubmitting(true)
      try {
        await api.disputes.submitDisputeClaim(id, { claim: text.trim() })
        toast.show({ title: "Klaim diperbarui", tone: "success", duration: 3000 })
        await fetchAll()
      } catch {
        toast.show({ title: "Gagal menyimpan klaim", tone: "danger" })
      } finally {
        setSubmitting(false)
      }
    },
    [id, toast.show, fetchAll],
  )

  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!id || !text.trim()) return
      try {
        await api.disputes.sendDisputeMessage(id, text.trim())
        setMessages(await api.disputes.getDisputeMessages(id))
      } catch {
        toast.show({ title: "Gagal mengirim pesan", tone: "danger" })
      }
    },
    [id, toast.show],
  )

  const handleAddEvidence = useCallback(async () => {
    if (!id) return
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      toast.show({ title: "Akses galeri ditolak", tone: "danger" })
      return
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.7,
    })
    if (res.canceled || !res.assets[0]) return
    setSubmitting(true)
    try {
      const asset = res.assets[0]
      const blob = await (await fetch(asset.uri)).blob()
      const { fileKey } = await api.upload.uploadPresigned(
        "DISPUTE_EVIDENCE",
        asset.fileName ?? "bukti.jpg",
        blob.type || "image/jpeg",
        blob,
      )
      await api.disputes.submitDisputeEvidence(id, {
        description: "Bukti tambahan",
        fileUrls: [fileKey],
        fileTypes: ["image/jpeg"],
      })
      setEvidence(await api.disputes.getDisputeEvidence(id))
      toast.show({ title: "Bukti terkirim", tone: "success", duration: 3000 })
    } catch {
      toast.show({ title: "Gagal mengunggah bukti", tone: "danger" })
    } finally {
      setSubmitting(false)
    }
  }, [id, toast.show])

  const handleRespondProposal = useCallback(
    async (action: "ACCEPT" | "REJECT") => {
      if (!id || !proposal) return
      setSubmitting(true)
      try {
        await api.disputes.respondMutualResolution(id, proposal.id, {})
        await fetchAll()
        toast.show({ title: action === "ACCEPT" ? "Kesepakatan diterima" : "Usulan ditolak", tone: "success", duration: 3000 })
      } catch {
        toast.show({ title: "Gagal menanggapi usulan", tone: "danger" })
      } finally {
        setSubmitting(false)
      }
    },
    [id, proposal, toast.show, fetchAll],
  )

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Detail Sengketa" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{ style: { paddingBottom: insets.bottom + tokens.space[8] } }}
      >
        {loading ? (
          <EmptyState icon={ShieldWarning} title="Memuat sengketa…" />
        ) : error ? (
          <ErrorState title="Gagal memuat" description={error} onRetry={() => void fetchAll()} />
        ) : dispute ? (
          <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
            <SectionHeader title={`Order ${dispute.orderId}`} />
            <Text variant="monoBody" tone="secondary">{dispute.id}</Text>

            <DisputeClaimForm
              value={claim}
              onChange={setClaim}
              onSubmit={(t) => void handleSubmitClaim(t)}
              submitting={submitting}
              existingClaim={dispute.claim || undefined}
              updatedAt={dispute.updatedAt ? formatDateTime(dispute.updatedAt) : undefined}
            />

            <SectionHeader title="Bukti" />
            <EvidenceGrid
              items={evidence.map((e) => ({
                id: e.id,
                url: e.url ?? e.fileKey ?? "",
                mimeType: e.fileType ?? "image/jpeg",
                mine: e.mine ?? e.uploadedByMe ?? false,
                description: e.description,
                uploadedAt: formatDateTime(e.createdAt),
              }))}
              onOpen={(item) => toast.show({ title: "Bukti", description: item.url, tone: "info" })}
              onAdd={() => void handleAddEvidence()}
              addDisabled={submitting}
            />

            <SectionHeader title="Pesan" />
            {messages.length === 0 ? (
              <EmptyState icon={ShieldWarning} title="Belum ada pesan" />
            ) : (
              messages.map((m, i) => (
                <ChatMessageBubble
                  key={m.id}
                  direction={m.fromUser ? "outgoing" : "incoming"}
                  text={m.text}
                  time={formatDateTime(m.createdAt)}
                  grouped={messages[i - 1]?.fromUser === m.fromUser}
                />
              ))
            )}

            {proposal ? (
              <>
                <SectionHeader title="Penyelesaian bersama" />
                <MutualResolutionCard
                  totalAmount={proposal.amount ?? 0}
                  buyerAmount={(proposal.amount ?? 0) / 2}
                  status={proposal.status}
                  proposedByMe
                  role="buyer"
                  note={proposal.note}
                  createdAt={formatDateTime(proposal.createdAt)}
                  onAccept={proposal.status === "PENDING" ? () => void handleRespondProposal("ACCEPT") : undefined}
                  onReject={proposal.status === "PENDING" ? () => void handleRespondProposal("REJECT") : undefined}
                  accepting={submitting}
                  rejecting={submitting}
                />
              </>
            ) : null}
          </View>
        ) : null}
      </PullToRefresh>
    </Screen>
  )
}
