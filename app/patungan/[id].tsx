/**
 * Screen — Detail grup patungan (batch 43, item 16).
 *
 * GET /v1/patungan/groups/:id (publik) — agregat transparan dari server:
 * terkumpul, sisa, slot, overfunding + pengurang per orang, feeNote.
 *
 * Peserta: join (BAGI_RATA: nominal dari server; CUSTOM: input nominal),
 * bayar via escrow (create-transaction prefill), tautkan order
 * (POST /v1/patungan/participants/:id/link-order).
 *
 * Host: inisiasi pencairan (POST /groups/:id/initiate-release) → masa
 * sanggah 24 jam peserta; bagikan inviteCode.
 *
 * Keputusan non-obvious: nominal per orang mode BAGI_RATA tidak dihitung
 * ulang di klien — join tanpa amountIdr, server yang menetapkan (kontrak
 * backend: joinGroup memakai group.perPersonAmount). Tampilan "per orang"
 * diambil dari amountIdr partisipan (semuanya sama di mode ini).
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { CalendarBlank, Copy, ShareNetwork, Users } from "phosphor-react-native"
import { useLocalSearchParams, router } from "expo-router"
import * as Clipboard from "expo-clipboard"

import { api, userMessage } from "@/lib/api"
import {
  PATUNGAN_PARTICIPANT_STATUS_LABELS,
  PATUNGAN_STATUS_LABELS,
  type PatunganGroup,
  type PatunganParticipant,
} from "@/lib/api/commerce"
import { useHasSession } from "@/lib/guest-gate"
import { translate } from "@/lib/i18n/translate"
import { formatDateLong, formatRupiah } from "@/lib/format"
import { ROUTES } from "@/lib/routes"
import { shareContent } from "@/lib/share"
import { useToast } from "@/components/ui/toast"

import { Badge } from "@/components/ui/badge"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog } from "@/components/ui/modal"
import { ErrorState } from "@/components/ui/error-state"
import { GuestLoginPrompt } from "@/components/web-guest-gate"
import { Header } from "@/components/ui/header"
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { Input } from "@/components/ui/input"
import { LoadingScreen } from "@/components/ui/loading-screen"
import { ProgressBar } from "@/components/ui/progress-bar"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"

const STATUS_TONE: Record<string, "success" | "info" | "danger" | "warning" | "neutral"> = {
  OPEN: "success",
  FUNDED: "info",
  RELEASE_INITIATED: "warning",
  RELEASED: "neutral",
  REFUNDED: "neutral",
  FAILED: "danger",
  CANCELLED: "neutral",
}

function ParticipantRow({ p, perPerson }: { p: PatunganParticipant; perPerson: number | null }) {
  return (
    <Card variant="outline" className="gap-1 p-3">
      <View className="flex-row items-center gap-2">
        <Text variant="caption" tone="secondary" className="flex-1 tabular-nums" numberOfLines={1}>
          {p.amountIdr != null ? formatRupiah(p.amountIdr) : perPerson != null ? formatRupiah(perPerson) : "—"}
        </Text>
        <Badge tone="neutral">{PATUNGAN_PARTICIPANT_STATUS_LABELS[p.status] ?? p.status}</Badge>
      </View>
      {p.paidAt ? (
        <Text variant="caption" tone="tertiary">
          {translate("Bayar")}: {formatDateLong(p.paidAt)}
        </Text>
      ) : null}
    </Card>
  )
}

export default function PatunganDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>()
  const toast = useToast()
  const hasSession = useHasSession()
  const [group, setGroup] = useState<PatunganGroup | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [meId, setMeId] = useState<string | null>(null)

  const [joinOpen, setJoinOpen] = useState(false)
  const [customAmount, setCustomAmount] = useState("")
  const [joinError, setJoinError] = useState<string | undefined>()
  const [joining, setJoining] = useState(false)

  const [linkOpen, setLinkOpen] = useState(false)
  const [orderId, setOrderId] = useState("")
  const [linkError, setLinkError] = useState<string | undefined>()
  const [linking, setLinking] = useState(false)

  const [releaseOpen, setReleaseOpen] = useState(false)
  const [releasing, setReleasing] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setLoadError(null)
    try {
      const [g, me] = await Promise.all([
        api.commerce.getPatunganGroup(id),
        hasSession ? api.users.getMeCached().catch(() => null) : Promise.resolve(null),
      ])
      if (!g) throw new Error("empty")
      setGroup(g)
      setMeId(me?.id ?? null)
    } catch (err) {
      setLoadError(userMessage(err))
    } finally {
      setLoading(false)
    }
  }, [id, hasSession])

  useEffect(() => {
    void load()
  }, [load])

  const isHost = group != null && meId != null && group.hostId === meId
  const myParticipation = group?.participants.find((p) => p.userId === meId) ?? null
  // Mode BAGI_RATA: semua amountIdr sama (ditetapkan server) — ambil contoh pertama.
  const perPersonExample =
    group?.mode === "BAGI_RATA"
      ? (group.participants.find((p) => p.amountIdr != null)?.amountIdr ?? null)
      : null

  const pct =
    group?.targetAmountIdr && group.targetAmountIdr > 0
      ? Math.min(100, (group.totalPaidIdr / group.targetAmountIdr) * 100)
      : 0

  const handleJoin = useCallback(async () => {
    if (!id || !group || joining) return
    let amountIdr: number | undefined
    if (group.mode === "CUSTOM") {
      const n = Number.parseInt(customAmount.replace(/\D/g, ""), 10)
      if (!Number.isFinite(n) || n <= 0) {
        setJoinError(translate("Nominal wajib > 0."))
        return
      }
      amountIdr = n
    }
    setJoining(true)
    try {
      await api.commerce.joinPatunganGroup(id, amountIdr !== undefined ? { amountIdr } : {})
      toast.show({ title: translate("Berhasil ikut patungan"), tone: "success" })
      setJoinOpen(false)
      setCustomAmount("")
      await load()
    } catch (err) {
      setJoinError(userMessage(err))
    } finally {
      setJoining(false)
    }
  }, [id, group, joining, customAmount, toast, load])

  const handleLink = useCallback(async () => {
    if (!myParticipation || linking) return
    if (orderId.trim().length < 4) {
      setLinkError(translate("Masukkan ID pesanan escrow yang sudah dibayar."))
      return
    }
    setLinking(true)
    try {
      await api.commerce.linkPatunganOrder(myParticipation.id, orderId.trim())
      toast.show({ title: translate("Pesanan ditautkan"), tone: "success" })
      setLinkOpen(false)
      setOrderId("")
      await load()
    } catch (err) {
      setLinkError(userMessage(err))
    } finally {
      setLinking(false)
    }
  }, [myParticipation, linking, orderId, toast, load])

  const handleRelease = useCallback(async () => {
    if (!id || releasing) return
    setReleasing(true)
    try {
      const g = await api.commerce.initiatePatunganRelease(id)
      if (g) setGroup(g)
      toast.show({ title: translate("Pencairan diinisiasi — masa sanggah 24 jam"), tone: "warning" })
      setReleaseOpen(false)
    } catch (err) {
      toast.show({ title: translate("Gagal inisiasi pencairan"), description: userMessage(err), tone: "danger" })
    } finally {
      setReleasing(false)
    }
  }, [id, releasing, toast])

  const shareInvite = useCallback(async () => {
    if (!group?.inviteCode) return
    try {
      await shareContent({
        message: translate("Ikut patungan “{x}” — kode undangan: {y}", {
          x: group.title,
          y: group.inviteCode,
        }),
        dialogTitle: translate("Bagikan undangan patungan"),
      })
    } catch {
      await Clipboard.setStringAsync(group.inviteCode)
      toast.show({ title: translate("Kode undangan disalin"), tone: "success" })
    }
  }, [group, toast])

  if (loading) {
    return (
      <Screen edges={["top"]}>
        <Header title={translate("Detail patungan")} />
        <LoadingScreen message={translate("Memuat grup")} />
      </Screen>
    )
  }

  if (loadError || !group) {
    return (
      <Screen edges={["top"]}>
        <Header title={translate("Detail patungan")} />
        <ErrorState
          title={translate("Gagal memuat grup")}
          description={loadError ?? undefined}
          onRetry={() => void load()}
        />
      </Screen>
    )
  }

  const canJoin = hasSession && !isHost && !myParticipation && group.status === "OPEN"

  return (
    <Screen edges={["top"]} padded={false}>
      <Header
        title={translate("Detail patungan")}
        right={
          group.inviteCode ? (
            <IconButton
              icon={ShareNetwork}
              accessibilityLabel={translate("Bagikan undangan")}
              onPress={() => void shareInvite()}
            />
          ) : undefined
        }
      />
      <View className="gap-4 px-5 pb-8 pt-3">
        <Card variant="outline" className="gap-2 p-4">
          <View className="flex-row items-center gap-2">
            <Text variant="h3" weight={700} className="flex-1">
              {group.title}
            </Text>
            <Badge tone={STATUS_TONE[group.status] ?? "neutral"}>
              {PATUNGAN_STATUS_LABELS[group.status] ?? group.status}
            </Badge>
          </View>
          {group.description ? (
            <Text variant="body" tone="secondary">
              {group.description}
            </Text>
          ) : null}
          <Badge tone="neutral">
            {group.mode === "BAGI_RATA" ? translate("Bagi rata") : translate("Nominal bebas")}
          </Badge>
          <ProgressBar value={pct} />
          <View className="flex-row justify-between">
            <Text variant="caption" tone="secondary" className="tabular-nums">
              {translate("Terkumpul")}: {formatRupiah(group.totalPaidIdr)}
            </Text>
            <Text variant="caption" tone="secondary" className="tabular-nums">
              {translate("Target")}: {group.targetAmountIdr != null ? formatRupiah(group.targetAmountIdr) : "—"}
            </Text>
          </View>
          <View className="flex-row items-center gap-4">
            {group.deadlineAt ? (
              <View className="flex-row items-center gap-1">
                <Icon icon={CalendarBlank} size="xs" tone="default" />
                <Text variant="caption" tone="secondary">
                  {formatDateLong(group.deadlineAt)}
                </Text>
              </View>
            ) : null}
            <View className="flex-row items-center gap-1">
              <Icon icon={Users} size="xs" tone="default" />
              <Text variant="caption" tone="secondary">
                {group.paidCount}/{group.participantCount} {translate("bayar")}
                {group.slotsLeft != null ? ` • ${translate("sisa")} ${group.slotsLeft} ${translate("slot")}` : ""}
              </Text>
            </View>
          </View>
          {group.remainingIdr > 0 ? (
            <Text variant="caption" tone="secondary" className="tabular-nums">
              {translate("Sisa")}: {formatRupiah(group.remainingIdr)}
            </Text>
          ) : null}
          {group.inviteCode ? (
            <View className="flex-row items-center gap-2">
              <Text variant="caption" tone="secondary" className="flex-1">
                {translate("Kode undangan")}: <Text variant="caption" weight={700}>{group.inviteCode}</Text>
              </Text>
              <IconButton
                icon={Copy}
                size="sm"
                variant="ghost"
                accessibilityLabel={translate("Salin kode undangan")}
                onPress={() => {
                  void Clipboard.setStringAsync(group.inviteCode ?? "").then(() =>
                    toast.show({ title: translate("Kode undangan disalin"), tone: "success" }),
                  )
                }}
              />
            </View>
          ) : null}
        </Card>

        {group.overfundingIdr > 0 ? (
          <Card variant="outline" className="gap-1 p-4">
            <Text variant="body" weight={600}>
              {translate("Kelebihan dana")}
            </Text>
            <Text variant="caption" tone="secondary" className="tabular-nums">
              {translate("Total lebih")}: {formatRupiah(group.overfundingIdr)} →{" "}
              {translate("pengurang")} {formatRupiah(group.overfundingPerPersonIdr)}/{translate("orang")}
            </Text>
          </Card>
        ) : null}

        {group.feeNote ? (
          <Text variant="caption" tone="tertiary">
            {group.feeNote}
          </Text>
        ) : null}

        {group.status === "RELEASE_INITIATED" ? (
          <Card variant="outline" className="gap-1 p-4">
            <Text variant="body" weight={600}>
              {translate("Masa sanggah 24 jam")}
            </Text>
            <Text variant="caption" tone="secondary">
              {translate("Host menginisiasi pencairan. Peserta dapat menyanggah sebelum dana cair.")}
            </Text>
          </Card>
        ) : null}

        {myParticipation ? (
          <Card variant="outline" className="gap-2 p-4">
            <View className="flex-row items-center gap-2">
              <Text variant="body" weight={600} className="flex-1">
                {translate("Partisipasiku")}
              </Text>
              <Badge tone="neutral">
                {PATUNGAN_PARTICIPANT_STATUS_LABELS[myParticipation.status] ?? myParticipation.status}
              </Badge>
            </View>
            <Text variant="caption" tone="secondary" className="tabular-nums">
              {translate("Iuran")}: {myParticipation.amountIdr != null ? formatRupiah(myParticipation.amountIdr) : "—"}
            </Text>
            {(myParticipation.status === "JOINED" || myParticipation.status === "PAID") &&
            !myParticipation.orderId &&
            myParticipation.amountIdr != null ? (
              <View className="gap-2">
                <Button
                  fullWidth
                  onPress={() =>
                    router.push(
                      ROUTES.createTransactionPatungan(
                        `Patungan: ${group.title}`,
                        myParticipation.amountIdr ?? 0,
                      ),
                    )
                  }
                >
                  {translate("Bayar via escrow")}
                </Button>
                <Button
                  variant="secondary"
                  fullWidth
                  onPress={() => {
                    setLinkError(undefined)
                    setLinkOpen(true)
                  }}
                >
                  {translate("Tautkan pesanan yang sudah dibayar")}
                </Button>
              </View>
            ) : null}
          </Card>
        ) : null}

        {canJoin ? (
          <Button
            fullWidth
            onPress={() => {
              setJoinError(undefined)
              setJoinOpen(true)
            }}
          >
            {translate("Ikut patungan")}
          </Button>
        ) : null}

        {!hasSession && group.status === "OPEN" ? (
          <GuestLoginPrompt next={id ? `/patungan/${id}` : "/patungan"} bare />
        ) : null}

        {isHost && group.status === "FUNDED" ? (
          <Button variant="destructive" fullWidth onPress={() => setReleaseOpen(true)}>
            {translate("Inisiasi pencairan")}
          </Button>
        ) : null}

        <View className="gap-2">
          <Text variant="body" weight={600}>
            {translate("Peserta")} ({group.participantCount})
          </Text>
          {group.participants.length === 0 ? (
            <Text variant="caption" tone="tertiary">
              {translate("Belum ada peserta.")}
            </Text>
          ) : (
            group.participants.map((p) => (
              <ParticipantRow key={p.id} p={p} perPerson={perPersonExample} />
            ))
          )}
        </View>
      </View>

      <BottomSheet
        visible={joinOpen}
        onRequestClose={() => setJoinOpen(false)}
        // FRM-017: field bawah tidak tertutup keyboard di layar kecil.
        avoidKeyboard
        title={translate("Ikut patungan")}
        footer={
          <Button fullWidth loading={joining} onPress={() => void handleJoin()}>
            {translate("Ikut")}
          </Button>
        }
      >
        <View className="gap-4">
          {group.mode === "BAGI_RATA" ? (
            <Text variant="caption" tone="secondary">
              {translate("Mode bagi rata — nominal per orang ditetapkan host dan diambil otomatis oleh server.")}
            </Text>
          ) : (
            <Input
              label={translate("Nominal iuran (Rp)")}
              value={customAmount}
              onChangeText={(t) => { setCustomAmount(t); setJoinError(undefined) }}
              keyboardType="number-pad"
              maxLength={15}
            />
          )}
          <Text variant="caption" tone="secondary">
            {translate("Setelah ikut, bayar via escrow lalu tautkan pesanan Anda. Target tercapai → cair ke host; gagal → pengembalian dana otomatis.")}
          </Text>
          {joinError ? (
            <Text variant="caption" tone="danger">
              {joinError}
            </Text>
          ) : null}
        </View>
      </BottomSheet>

      <BottomSheet
        visible={linkOpen}
        onRequestClose={() => setLinkOpen(false)}
        // FRM-017: field bawah tidak tertutup keyboard di layar kecil.
        avoidKeyboard
        title={translate("Tautkan pesanan escrow")}
        footer={
          <Button fullWidth loading={linking} onPress={() => void handleLink()}>
            {translate("Tautkan")}
          </Button>
        }
      >
        <View className="gap-4">
          <Input
            label={translate("ID pesanan")}
            value={orderId}
            onChangeText={(t) => { setOrderId(t); setLinkError(undefined) }}
            placeholder={translate("ID pesanan yang sudah dibayar")}
            autoCapitalize="none"
            // FRM-024: autocorrect/spellcheck mati — jangan sampai ID order diubah jadi kata kamus.
            autoCorrect={false}
            spellCheck={false}
            maxLength={40}
          />
          {linkError ? (
            <Text variant="caption" tone="danger">
              {linkError}
            </Text>
          ) : null}
        </View>
      </BottomSheet>

      <Dialog
        title={translate("Inisiasi pencairan?")}
        description={translate("Target tercapai. Dana cair ke host setelah masa sanggah 24 jam peserta.")}
        visible={releaseOpen}
        loading={releasing}
        confirmLabel={translate("Ya, inisiasi")}
        cancelLabel={translate("Batal")}
        onConfirm={() => void handleRelease()}
        onCancel={() => setReleaseOpen(false)}
        onRequestClose={() => setReleaseOpen(false)}
      />
    </Screen>
  )
}
