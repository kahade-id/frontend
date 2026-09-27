/**
 * Kahade — Seksi "Tahapan Pembayaran" di detail order.
 *
 * Hanya tampil bila order memang memiliki milestone (GET
 * /v1/orders/:orderId/milestones mengembalikan daftar tidak kosong). Escrow
 * satu tahap existing TIDAK disentuh — seksi ini murni tambahan.
 *
 * Tombol aksi kontekstual per role:
 * - seller : "Kirim hasil" (buka detail tahap → submit + lampirkan bukti)
 * - buyer  : "Terima & cairkan" (konfirmasi → dana RpX cair ke penjual),
 *            "Minta revisi" (buka detail tahap, sisa putaran ditampilkan)
 * - keduanya: "Usulkan perubahan" / "Setujui perubahan" (buka detail tahap)
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { router } from "expo-router"

import { api, userMessage, type OrderMilestone } from "@/lib/api"
import { remainingRevisions } from "@/lib/api/milestones"
import { formatRupiah, formatDateTime } from "@/lib/format"
import { ROUTES } from "@/lib/routes"
import { translate } from "@/lib/i18n"
import { logWarn } from "@/lib/telemetry"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/modal"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"

export const MILESTONE_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draf",
  AWAITING_ACTIVATION: "Menunggu aktivasi",
  SUBMITTED: "Hasil terkirim",
  REVISION_REQUESTED: "Revisi diminta",
  ACCEPTED: "Diterima",
  RELEASED: "Dicairkan",
  CANCELLED: "Dibatalkan",
  DISPUTED: "Disengketa",
}

export const MILESTONE_STATUS_TONE: Record<string, "neutral" | "info" | "success" | "warning" | "danger"> = {
  DRAFT: "neutral",
  AWAITING_ACTIVATION: "info",
  SUBMITTED: "warning",
  REVISION_REQUESTED: "warning",
  ACCEPTED: "info",
  RELEASED: "success",
  CANCELLED: "neutral",
  DISPUTED: "danger",
}

export type OrderMilestoneRole = "BUYER" | "SELLER"

function MilestoneRow({
  milestone,
  role,
  onChanged,
}: {
  milestone: OrderMilestone
  role?: OrderMilestoneRole
  onChanged: () => void
}) {
  const toast = useToast()
  const [confirmAccept, setConfirmAccept] = useState(false)
  const [accepting, setAccepting] = useState(false)

  const isSeller = role === "SELLER"
  const isBuyer = role === "BUYER"
  const canSubmit = milestone.status === "AWAITING_ACTIVATION" || milestone.status === "REVISION_REQUESTED"
  const submitted = milestone.status === "SUBMITTED"
  const revisionsLeft = remainingRevisions(milestone)
  const changePending =
    milestone.changeRequest != null &&
    !(isBuyer ? milestone.buyerApprovedChange : milestone.sellerApprovedChange) &&
    ["AWAITING_ACTIVATION", "SUBMITTED", "REVISION_REQUESTED"].includes(milestone.status)

  const handleAccept = useCallback(async () => {
    if (accepting) return
    setAccepting(true)
    try {
      await api.milestones.acceptMilestone(milestone.id)
      setConfirmAccept(false)
      toast.show({ title: "Tahap diterima — dana dicairkan ke penjual", tone: "success" })
      onChanged()
    } catch (e) {
      toast.show({ title: "Gagal menerima tahap", description: userMessage(e), tone: "danger" })
    } finally {
      setAccepting(false)
    }
  }, [accepting, milestone.id, onChanged, toast])

  return (
    <View className="gap-2 rounded-lg border border-border bg-surface p-4">
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1 gap-1">
          <Text variant="body" weight={600} numberOfLines={2}>
            Tahap {milestone.seq}: {milestone.title}
          </Text>
          <Text variant="monoBody" tone="secondary">
            {formatRupiah(milestone.amount)}
          </Text>
        </View>
        <Badge tone={MILESTONE_STATUS_TONE[milestone.status] ?? "neutral"}>
          {MILESTONE_STATUS_LABEL[milestone.status] ?? milestone.status}
        </Badge>
      </View>
      {milestone.deadline ? (
        <Text variant="caption" tone="secondary">
          Tenggat: {formatDateTime(milestone.deadline)}
        </Text>
      ) : null}
      {changePending ? (
        <Text variant="caption" tone="primary" weight={600}>
          Ada usulan perubahan menunggu persetujuan Anda.
        </Text>
      ) : null}

      <View className="flex-row flex-wrap gap-2">
        <Button
          size="sm"
          variant="ghost"
          onPress={() => router.push(ROUTES.milestoneDetail(milestone.id))}
        >
          Detail tahap
        </Button>
        {isSeller && canSubmit ? (
          <Button size="sm" onPress={() => router.push(ROUTES.milestoneDetail(milestone.id))}>
            Kirim hasil
          </Button>
        ) : null}
        {isBuyer && submitted ? (
          <>
            <Button size="sm" onPress={() => setConfirmAccept(true)}>
              Terima &amp; cairkan
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onPress={() => router.push(ROUTES.milestoneDetail(milestone.id))}
            >
              Minta revisi{revisionsLeft > 0 ? ` (${revisionsLeft} putaran)` : ""}
            </Button>
          </>
        ) : null}
        {role && (canSubmit || submitted) ? (
          <Button
            size="sm"
            variant="ghost"
            onPress={() => router.push(ROUTES.milestoneDetail(milestone.id))}
          >
            {changePending ? "Setujui perubahan" : "Usulkan perubahan"}
          </Button>
        ) : null}
      </View>

      <Dialog
        title="Terima tahap ini?"
        description={translate("Dana {x} akan dicairkan ke penjual. Lanjutkan?", {
          x: formatRupiah(milestone.sellerAmount),
        })}
        visible={confirmAccept}
        loading={accepting}
        confirmLabel="Ya, terima & cairkan"
        cancelLabel="Batal"
        onConfirm={() => void handleAccept()}
        onRequestClose={() => setConfirmAccept(false)}
      />
    </View>
  )
}

export function MilestoneSection({
  orderId,
  role,
}: {
  orderId: string
  role?: OrderMilestoneRole
}) {
  const [milestones, setMilestones] = useState<OrderMilestone[] | null>(null)

  const load = useCallback(async () => {
    try {
      const items = await api.milestones.listOrderMilestones(orderId)
      setMilestones(items)
    } catch (e) {
      // Pelengkap: kegagalan memuat tahap tidak boleh mematikan detail order.
      logWarn("order:milestones", e)
      setMilestones([])
    }
  }, [orderId])

  useEffect(() => {
    void load()
  }, [load])

  if (!milestones || milestones.length === 0) return null

  return (
    <View className="gap-3">
      <SectionHeader
        title="Tahapan Pembayaran"
        subtitle="Dana escrow dilepas per tahap setelah hasil diterima."
      />
      {milestones.map((m) => (
        <MilestoneRow key={m.id} milestone={m} role={role} onChanged={() => void load()} />
      ))}
    </View>
  )
}
