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
import { useCallback, useEffect, useRef, useState } from "react"
import { View } from "react-native"
import { router } from "expo-router"

import { api, userMessage, type OrderMilestone } from "@/lib/api"
import { remainingRevisions } from "@/lib/api/milestones"
import { formatRupiah, formatDateTimeWIB } from "@/lib/format"
import { ROUTES } from "@/lib/routes"
import { translate } from "@/lib/i18n"
import { logWarn } from "@/lib/telemetry"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/modal"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"
import { useWalletEnabled } from "@/lib/use-wallet-enabled"

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
  // Mode Tanpa Wallet Internal: pencairan tahap ke rekening bank penjual.
  const walletEnabled = useWalletEnabled()

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
      toast.show({
        title: walletEnabled
          ? "Tahap diterima — dana dicairkan ke penjual"
          : "Tahap diterima — dana dicairkan ke rekening bank penjual",
        tone: "success",
      })
      onChanged()
    } catch (e) {
      toast.show({ title: "Gagal menerima tahap", description: userMessage(e), tone: "danger" })
    } finally {
      setAccepting(false)
    }
  }, [accepting, milestone.id, onChanged, toast])

  return (
    <View className="gap-2 rounded-lg border border-border bg-surface p-4">
      {/* UX-A11Y-015: blok info tahap sebagai SATU elemen aksesibilitas
          dengan label ringkas (pola timeline.tsx: tiap item `accessible`
          + label gabungan). Tanpa ini SR membaca judul, nominal, badge
          status, dan tenggat sebagai fragmen terpisah yang sulit
          diasosiasikan dengan tahap yang benar. Baris tombol aksi
          DIBIARKAN di luar grup agar tetap bisa dioperasikan. */}
      <View
        accessible
        accessibilityLabel={[
          translate("Tahap {seq}: {title}, {amount}, {status}", {
            seq: milestone.seq,
            title: milestone.title,
            amount: formatRupiah(milestone.amount),
            status: MILESTONE_STATUS_LABEL[milestone.status] ?? milestone.status,
          }),
          milestone.deadline
            ? translate("tenggat {x}", { x: formatDateTimeWIB(milestone.deadline) })
            : null,
          changePending ? translate("ada usulan perubahan menunggu persetujuan") : null,
        ]
          .filter(Boolean)
          .join(", ")}
      >
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
          {/* TRX-017: tenggat milestone mengikat (keterlambatan →
              dispute/refund) — wajib berlabel WIB, bukan waktu lokal
              perangkat yang ambigu. */}
          Tenggat: {formatDateTimeWIB(milestone.deadline)}
        </Text>
      ) : null}
      {changePending ? (
        <Text variant="caption" tone="primary" weight={600}>
          Ada usulan perubahan menunggu persetujuan Anda.
        </Text>
      ) : null}
      </View>

      <View className="flex-row flex-wrap gap-2">
        <Button
          fullWidth={false}
          size="sm"
          variant="ghost"
          onPress={() => router.push(ROUTES.milestoneDetail(milestone.id))}
        >
          Detail tahap
        </Button>
        {isSeller && canSubmit ? (
          <Button fullWidth={false} size="sm" onPress={() => router.push(ROUTES.milestoneDetail(milestone.id))}>
            Kirim hasil
          </Button>
        ) : null}
        {isBuyer && submitted ? (
          <>
            <Button fullWidth={false} size="sm" onPress={() => setConfirmAccept(true)}>
              Terima &amp; cairkan
            </Button>
            <Button
              fullWidth={false}
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
            fullWidth={false}
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
        description={translate(
          walletEnabled
            ? "Dana {x} akan dicairkan ke penjual. Lanjutkan?"
            : "Dana {x} akan dicairkan ke rekening bank penjual. Lanjutkan?",
          {
            x: formatRupiah(milestone.sellerAmount),
          },
        )}
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
  initialMilestones,
  refreshKey,
}: {
  orderId: string
  role?: OrderMilestoneRole
  /**
   * TR-001 (audit performa): hasil GET /v1/orders/:orderId/milestones yang
   * sudah diambil PARALEL di bundle utama order-detail. Bila disediakan,
   * section TIDAK menembak request serial sendiri saat mount — mayoritas
   * order = escrow satu tahap (hasil kosong), jadi request itu murni
   * terbuang bila serial.
   */
  initialMilestones?: OrderMilestone[]
  /**
   * TR-001: naikkan untuk memaksa fetch ulang (pengganti remount-buta via
   * prop `key` — mis. setelah skema cicilan dibuat).
   */
  refreshKey?: number
}) {
  const [milestones, setMilestones] = useState<OrderMilestone[] | null>(initialMilestones ?? null)
  // Mode Tanpa Wallet Internal: copy pencairan ke rekening bank penjual.
  const walletEnabled = useWalletEnabled()

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

  const hasInitial = initialMilestones !== undefined
  // TR-001: bundle utama sudah membawa data → lewati request serial saat mount.
  useEffect(() => {
    if (hasInitial) return
    void load()
  }, [load, hasInitial])

  // TR-001: fetch ulang saat refreshKey berubah (dulu via remount `key`).
  const refreshKeyRef = useRef(refreshKey)
  useEffect(() => {
    if (refreshKeyRef.current === refreshKey) return
    refreshKeyRef.current = refreshKey
    void load()
  }, [refreshKey, load])

  if (!milestones || milestones.length === 0) return null

  return (
    <View className="gap-3">
      <SectionHeader
        title="Tahapan Pembayaran"
        subtitle={
          walletEnabled
            ? "Dana diteruskan ke penjual per tahap setelah hasil diterima."
            : "Dana dicairkan ke rekening bank penjual per tahap setelah hasil diterima."
        }
      />
      {/* UX-A11Y-015: daftar tahap sebagai list (pola timeline.tsx);
          tiap kartu info-nya sudah satu elemen berlabel ringkas. */}
      <View className="gap-3" accessibilityRole="list">
        {milestones.map((m) => (
          <MilestoneRow key={m.id} milestone={m} role={role} onChanged={() => void load()} />
        ))}
      </View>
    </View>
  )
}
