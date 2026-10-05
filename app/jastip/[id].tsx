/**
 * Screen — Detail trip jastip (batch 43, item 15).
 *
 * GET /v1/jastip/trips/:id — host & peserta.
 *
 * Host: buka trip (DRAFT → OPEN), tambah item katalog, kunci harga per
 * peserta (barang + fee jastip + ongkir — transparan terpisah), tandai gagal
 * (refund otomatis via POST /trips/:id/fail).
 *
 * Peserta: ikut trip (ringkasan item bebas), lihat rincian harga yang
 * dikunci host, bayar via escrow (create-transaction prefill nominal total +
 * jastipParticipantId — order otomatis didaftarkan ke partisipasi via
 * POST /participants/:id/create-order, Poin 2 2026-10-04).
 *
 * Keputusan non-obvious: tidak ada discovery publik (kontrak backend hanya
 * menyediakan /trips/mine + /trips/:id) — trip bersifat tertutup, dibuka via
 * ID/tautan dari host. Uang tidak pernah dihitung ulang di klien: total yang
 * ditampilkan = totalLockedIdr dari server.
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { CalendarBlank, Lock, Plus, Users } from "phosphor-react-native"
import { router, useLocalSearchParams } from "expo-router"

import { api, userMessage } from "@/lib/api"
import {
  JASTIP_PARTICIPANT_STATUS_LABELS,
  JASTIP_TRIP_STATUS_LABELS,
  type JastipParticipant,
  type JastipTrip,
} from "@/lib/api/commerce"
import { useHasSession } from "@/lib/guest-gate"
import { translate } from "@/lib/i18n/translate"
import { formatDateLong, formatRupiah } from "@/lib/format"
import { formatRupiahTypingText, parseRupiahTypingText } from "@/lib/rupiah-input"
import { ROUTES } from "@/lib/routes"
import { showMutationError } from "@/lib/mutation-toast"
import { useToast } from "@/components/ui/toast"

import { Amount } from "@/components/ui/amount"
import { Badge } from "@/components/ui/badge"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog } from "@/components/ui/modal"
import { ErrorState } from "@/components/ui/error-state"
import { GuestLoginPrompt } from "@/components/web-guest-gate"
import { Header } from "@/components/ui/header"
import { Icon } from "@/components/ui/icon"
import { LoadingScreen } from "@/components/ui/loading-screen"
import { IconButton } from "@/components/ui/icon-button"
import { Input } from "@/components/ui/input"
import { OrderHelpActions } from "@/components/order-help-actions"
import { Screen } from "@/components/ui/screen"
import { Text } from "@/components/ui/text"

function PriceBreakdown({ p }: { p: JastipParticipant }) {
  const rows: [string, number | null][] = [
    [translate("Barang"), p.goodsAmountIdr],
    [translate("Fee jastip"), p.jastipFeeIdr],
    [translate("Ongkir"), p.shippingCostIdr],
  ]
  return (
    <View className="gap-1">
      {rows.map(([label, value]) =>
        value != null ? (
          <View key={label} className="flex-row justify-between">
            <Text variant="caption" tone="secondary">
              {label}
            </Text>
            <Amount value={value} size="body" animated={false} />
          </View>
        ) : null,
      )}
      {p.totalLockedIdr != null ? (
        <View className="flex-row justify-between">
          <Text variant="caption" weight={700}>
            {translate("Total")}
          </Text>
          <Amount value={p.totalLockedIdr} size="body" animated={false} />
        </View>
      ) : null}
    </View>
  )
}

export default function JastipDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>()
  const toast = useToast()
  const hasSession = useHasSession()
  const [trip, setTrip] = useState<JastipTrip | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [meId, setMeId] = useState<string | null>(null)

  const [joinOpen, setJoinOpen] = useState(false)
  const [itemSummary, setItemSummary] = useState("")
  const [joinError, setJoinError] = useState<string | undefined>()
  const [joining, setJoining] = useState(false)

  const [itemOpen, setItemOpen] = useState(false)
  const [itemName, setItemName] = useState("")
  const [itemPrice, setItemPrice] = useState("")
  const [itemNote, setItemNote] = useState("")
  const [itemError, setItemError] = useState<string | undefined>()
  // FRM-004: error validasi klien ditempel ke field penyebabnya, bukan slot bersama.
  const [itemNameError, setItemNameError] = useState<string | undefined>()
  const [itemPriceError, setItemPriceError] = useState<string | undefined>()
  const [addingItem, setAddingItem] = useState(false)

  const [lockTarget, setLockTarget] = useState<JastipParticipant | null>(null)
  const [goods, setGoods] = useState("")
  const [fee, setFee] = useState("")
  const [shipping, setShipping] = useState("")
  const [lockError, setLockError] = useState<string | undefined>()
  const [locking, setLocking] = useState(false)

  const [failOpen, setFailOpen] = useState(false)
  const [failReason, setFailReason] = useState("")
  const [failing, setFailing] = useState(false)
  const [acting, setActing] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setLoadError(null)
    try {
      const [t, me] = await Promise.all([
        api.commerce.getJastipTrip(id),
        api.users.getMeCached().catch(() => null),
      ])
      if (!t) throw new Error("empty")
      setTrip(t)
      setMeId(me?.id ?? null)
    } catch (err) {
      setLoadError(userMessage(err))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    if (hasSession) void load()
  }, [hasSession, load])

  const isHost = trip != null && meId != null && trip.hostId === meId
  const myParticipation = trip?.participants.find((p) => p.buyerId === meId) ?? null

  const handleOpen = useCallback(async () => {
    if (!id || acting) return
    setActing(true)
    try {
      const t = await api.commerce.openJastipTrip(id)
      if (t) setTrip(t)
      toast.show({ title: translate("Trip dibuka"), tone: "success" })
    } catch (err) {
      // Klasifikasi toast: error mutasi non-blokir via showMutationError.
      if (
        showMutationError(toast.show, {
          failTitle: translate("Gagal membuka trip"),
          uncertainHint: translate("Aksi mungkin sudah diproses — memuat ulang…"),
          err: err,
          scope: "jastip:id:membuka-trip",
        })
      ) {
        void load()
      }
    } finally {
      setActing(false)
    }
  }, [id, acting, toast, load])

  const handleJoin = useCallback(async () => {
    if (!id || joining) return
    if (itemSummary.trim().length < 3) {
      setJoinError(translate("Ceritakan barang yang diinginkan (min. 3 karakter)."))
      return
    }
    setJoining(true)
    try {
      await api.commerce.joinJastipTrip(id, itemSummary.trim())
      toast.show({ title: translate("Berhasil ikut trip"), tone: "success" })
      setJoinOpen(false)
      setItemSummary("")
      await load()
    } catch (err) {
      setJoinError(userMessage(err))
    } finally {
      setJoining(false)
    }
  }, [id, joining, itemSummary, toast, load])

  const handleAddItem = useCallback(async () => {
    if (!id || addingItem) return
    if (itemName.trim().length < 2) {
      setItemNameError(translate("Nama item minimal 2 karakter."))
      return
    }
    const price = itemPrice.trim() === "" ? undefined : Number.parseInt(itemPrice.replace(/\D/g, ""), 10)
    if (price !== undefined && (!Number.isFinite(price) || price < 0)) {
      setItemPriceError(translate("Estimasi harga tidak valid — isi dengan angka saja."))
      return
    }
    setAddingItem(true)
    try {
      await api.commerce.addJastipItem(id, {
        name: itemName.trim(),
        estimatedPriceIdr: price,
        note: itemNote.trim() || undefined,
      })
      toast.show({ title: translate("Item ditambahkan"), tone: "success" })
      setItemOpen(false)
      setItemName("")
      setItemPrice("")
      setItemNote("")
      await load()
    } catch (err) {
      setItemError(userMessage(err))
    } finally {
      setAddingItem(false)
    }
  }, [id, addingItem, itemName, itemPrice, itemNote, toast, load])

  const handleLock = useCallback(async () => {
    if (!lockTarget || locking) return
    const g = Number.parseInt(goods.replace(/\D/g, ""), 10)
    const f = Number.parseInt(fee.replace(/\D/g, ""), 10)
    const s = Number.parseInt(shipping.replace(/\D/g, ""), 10)
    if (![g, f, s].every((n) => Number.isFinite(n) && n >= 0) || g <= 0) {
      setLockError(translate("Nominal barang wajib > 0; fee dan ongkir ≥ 0."))
      return
    }
    setLocking(true)
    try {
      await api.commerce.lockJastipPrice(lockTarget.id, {
        goodsAmountIdr: g,
        jastipFeeIdr: f,
        shippingCostIdr: s,
      })
      toast.show({ title: translate("Harga dikunci"), tone: "success" })
      setLockTarget(null)
      await load()
    } catch (err) {
      setLockError(userMessage(err))
    } finally {
      setLocking(false)
    }
  }, [lockTarget, locking, goods, fee, shipping, toast, load])

  const handleFail = useCallback(async () => {
    if (!id || failing) return
    setFailing(true)
    try {
      const t = await api.commerce.failJastipTrip(id, failReason.trim() || undefined)
      if (t) setTrip(t)
      toast.show({ title: translate("Trip ditandai gagal — pengembalian dana otomatis diproses"), tone: "warning" })
      setFailOpen(false)
    } catch (err) {
      // Klasifikasi toast: error mutasi non-blokir via showMutationError.
      if (
        showMutationError(toast.show, {
          failTitle: translate("Gagal menandai trip"),
          uncertainHint: translate("Trip mungkin sudah ditandai gagal — memuat ulang…"),
          uncertainDetail: translate("Pengembalian dana bisa sudah diproses otomatis — periksa status trip."),
          err: err,
          scope: "jastip:id:menandai-trip",
        })
      ) {
        void load()
      }
    } finally {
      setFailing(false)
    }
  }, [id, failing, failReason, toast, load])

  if (!hasSession) {
    return <GuestLoginPrompt next={id ? `/jastip/${id}` : "/jastip"} />
  }

  if (loading) {
    return (
      <Screen edges={["top"]}>
        <Header title={translate("Detail trip")} />
        <LoadingScreen message={translate("Memuat trip")} />
      </Screen>
    )
  }

  if (loadError || !trip) {
    return (
      <Screen edges={["top"]}>
        <Header title={translate("Detail trip")} />
        <ErrorState
          title={translate("Gagal memuat trip")}
          description={loadError ?? undefined}
          onRetry={() => void load()}
        />
      </Screen>
    )
  }

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title={translate("Detail trip")} />
      <View className="gap-4 px-5 pb-8 pt-3">
        <View className="gap-4">
          <Card variant="outline" className="gap-2 p-4">
            <View className="flex-row items-center gap-2">
              <Text variant="h3" accessibilityRole="header" className="flex-1">
                {trip.title}
              </Text>
              <Badge tone={trip.status === "OPEN" ? "success" : trip.status === "CANCELLED" ? "danger" : "neutral"}>
                {JASTIP_TRIP_STATUS_LABELS[trip.status] ?? trip.status}
              </Badge>
            </View>
            {trip.description ? (
              <Text variant="body" tone="secondary">
                {trip.description}
              </Text>
            ) : null}
            <View className="flex-row items-center gap-4">
              {trip.orderDeadline ? (
                <View className="flex-row items-center gap-1">
                  <Icon icon={CalendarBlank} size="xs" tone="default" />
                  <Text variant="caption" tone="secondary">
                    {translate("Deadline")}: {formatDateLong(trip.orderDeadline)}
                  </Text>
                </View>
              ) : null}
              <View className="flex-row items-center gap-1">
                <Icon icon={Users} size="xs" tone="default" />
                <Text variant="caption" tone="secondary">
                  {trip.participants.length}
                  {trip.slotTotal != null ? `/${trip.slotTotal}` : ""} {translate("peserta")}
                </Text>
              </View>
            </View>
            {isHost && trip.status === "DRAFT" ? (
              <Button fullWidth loading={acting} onPress={() => void handleOpen()}>
                {translate("Buka trip")}
              </Button>
            ) : null}
          </Card>

          <View className="gap-2">
            <View className="flex-row items-center gap-2">
              <Text variant="body" weight={600} className="flex-1">
                {translate("Katalog")}
              </Text>
              {isHost && (trip.status === "DRAFT" || trip.status === "OPEN") ? (
                <IconButton
                  icon={Plus}
                  size="sm"
                  variant="ghost"
                  accessibilityLabel={translate("Tambah item")}
                  onPress={() => {
                    setItemError(undefined)
                    setItemNameError(undefined)
                    setItemPriceError(undefined)
                    setItemOpen(true)
                  }}
                />
              ) : null}
            </View>
            {trip.items.length === 0 ? (
              <Text variant="caption" tone="tertiary">
                {translate("Belum ada item katalog.")}
              </Text>
            ) : (
              trip.items.map((item) => (
                <Card key={item.id} variant="outline" className="gap-1 p-3">
                  <Text variant="body" weight={600}>
                    {item.name}
                  </Text>
                  {item.estimatedPriceIdr != null ? (
                    <Text variant="caption" tone="secondary" className="tabular-nums">
                      {translate("Estimasi")}: {formatRupiah(item.estimatedPriceIdr)}
                    </Text>
                  ) : null}
                  {item.note ? (
                    <Text variant="caption" tone="tertiary">
                      {item.note}
                    </Text>
                  ) : null}
                </Card>
              ))
            )}
          </View>

          {!isHost && myParticipation ? (
            <Card variant="outline" className="gap-2 p-4">
              <View className="flex-row items-center gap-2">
                <Icon icon={Lock} size="sm" tone="default" />
                <Text variant="body" weight={600} className="flex-1">
                  {translate("Partisipasiku")}
                </Text>
                <Badge tone="neutral">
                  {JASTIP_PARTICIPANT_STATUS_LABELS[myParticipation.status] ?? myParticipation.status}
                </Badge>
              </View>
              <Text variant="caption" tone="secondary">
                {myParticipation.itemSummary}
              </Text>
              {myParticipation.status === "PRICE_LOCKED" || myParticipation.status === "PAID" ? (
                <PriceBreakdown p={myParticipation} />
              ) : (
                <Text variant="caption" tone="tertiary">
                  {translate("Menunggu host mengunci harga (barang + fee + ongkir terpisah).")}
                </Text>
              )}
              {myParticipation.status === "PRICE_LOCKED" && myParticipation.totalLockedIdr != null ? (
                <View className="gap-2">
                  {/* Poin 2 (2026-10-04): id partisipasi diteruskan — order
                      otomatis terdaftar ke partisipasi ini setelah terbentuk;
                      tidak ada lagi tempel ID manual. */}
                  <Button
                    fullWidth
                    onPress={() =>
                      router.push(
                        ROUTES.createTransactionJastip(
                          `Jastip: ${trip.title}`,
                          myParticipation.totalLockedIdr ?? 0,
                          myParticipation.id,
                        ),
                      )
                    }
                  >
                    {translate("Bayar via Kahade")}
                  </Button>
                </View>
              ) : null}
              {/* Poin 2: pintu masuk sengketa/retur — hanya bila order terkait ada. */}
              {myParticipation.orderId ? <OrderHelpActions orderId={myParticipation.orderId} /> : null}
            </Card>
          ) : null}

          {!isHost && !myParticipation && trip.status === "OPEN" ? (
            <Button
              fullWidth
              onPress={() => {
                setJoinError(undefined)
                setJoinOpen(true)
              }}
            >
              {translate("Ikut trip ini")}
            </Button>
          ) : null}

          <View className="gap-2">
            <Text variant="body" weight={600}>
              {translate("Peserta")} ({trip.participants.length})
            </Text>
            {trip.participants.length === 0 ? (
              <Text variant="caption" tone="tertiary">
                {translate("Belum ada peserta.")}
              </Text>
            ) : (
              trip.participants.map((p) => (
                <Card key={p.id} variant="outline" className="gap-2 p-3">
                  <View className="flex-row items-center gap-2">
                    <Text variant="caption" tone="secondary" className="flex-1" numberOfLines={2}>
                      {p.itemSummary}
                    </Text>
                    <Badge tone="neutral">
                      {JASTIP_PARTICIPANT_STATUS_LABELS[p.status] ?? p.status}
                    </Badge>
                  </View>
                  {(p.status === "PRICE_LOCKED" || p.status === "PAID") && isHost ? (
                    <PriceBreakdown p={p} />
                  ) : null}
                  {isHost && p.status === "JOINED" && trip.status === "OPEN" ? (
                    <Button
                      variant="secondary"
                      fullWidth={false}
                      onPress={() => {
                        setGoods("")
                        setFee("")
                        setShipping("")
                        setLockError(undefined)
                        setLockTarget(p)
                      }}
                    >
                      {translate("Kunci harga")}
                    </Button>
                  ) : null}
                </Card>
              ))
            )}
          </View>

          {/* FE-119: label tombol ringkas; penjelasan refund otomatis ada di dialog konfirmasi. */}
          {isHost && (trip.status === "OPEN" || trip.status === "CLOSED") ? (
            <Button variant="destructive" fullWidth loading={failing} onPress={() => setFailOpen(true)}>
              {translate("Tandai gagal dapat barang")}
            </Button>
          ) : null}
        </View>

      <BottomSheet
        visible={joinOpen}
        onRequestClose={() => setJoinOpen(false)}
        // FRM-017: field bawah tidak tertutup keyboard di layar kecil.
        avoidKeyboard
        title={translate("Ikut trip")}
        footer={
          // FE-121: tombol mati sampai syarat minimum terpenuhi (hint ada di field).
          <Button fullWidth loading={joining} onPress={() => void handleJoin()} disabled={itemSummary.trim().length < 3}>
            {translate("Ikut")}
          </Button>
        }
      >
        <View className="gap-4">
          <Input
            label={translate("Barang yang diinginkan")}
            value={itemSummary}
            onChangeText={(t) => { setItemSummary(t); setJoinError(undefined) }}
            placeholder={translate("cth: Sepatu sneakers ukuran 42, warna hitam")}
            helperText={translate("Minimal 3 karakter.")}
            multiline
            maxLength={300}
          />
          <Text variant="caption" tone="secondary">
            {translate("Harga dikunci host sebelum Anda membayar.")}
          </Text>
          {joinError ? (
            <Text variant="caption" tone="danger">
              {joinError}
            </Text>
          ) : null}
        </View>
      </BottomSheet>

      <BottomSheet
        visible={itemOpen}
        onRequestClose={() => setItemOpen(false)}
        // FRM-017: field bawah tidak tertutup keyboard di layar kecil.
        avoidKeyboard
        title={translate("Tambah item katalog")}
        footer={
          // FE-121: tombol mati sampai nama item minimal 2 karakter.
          <Button fullWidth loading={addingItem} onPress={() => void handleAddItem()} disabled={itemName.trim().length < 2}>
            {translate("Tambah item")}
          </Button>
        }
      >
        <View className="gap-4">
          <Input
            label={translate("Nama item")}
            value={itemName}
            onChangeText={(t) => { setItemName(t); setItemError(undefined); setItemNameError(undefined) }}
            helperText={translate("Minimal 2 karakter.")}
            errorText={itemNameError}
            maxLength={120}
          />
          <Input
            label={translate("Estimasi harga (Rp, opsional)")}
            value={itemPrice}
            onChangeText={(t) => { setItemPrice(t); setItemError(undefined); setItemPriceError(undefined) }}
            keyboardType="number-pad"
            errorText={itemPriceError}
            maxLength={15}
          />
          <Input
            label={translate("Catatan (opsional)")}
            value={itemNote}
            onChangeText={(t) => { setItemNote(t); setItemError(undefined) }}
            maxLength={200}
          />
          {/* FRM-004: slot bersama kini khusus error server; error validasi
              klien ditempel via errorText masing-masing field. */}
          {itemError ? (
            <Text variant="caption" tone="danger">
              {itemError}
            </Text>
          ) : null}
        </View>
      </BottomSheet>

      <BottomSheet
        visible={lockTarget != null}
        onRequestClose={() => setLockTarget(null)}
        // FRM-017: field bawah tidak tertutup keyboard di layar kecil.
        avoidKeyboard
        title={translate("Kunci harga peserta")}
        footer={
          <Button fullWidth loading={locking} onPress={() => void handleLock()}>
            {translate("Kunci harga")}
          </Button>
        }
      >
        <View className="gap-4">
          <Text variant="caption" tone="secondary">
            {translate("Harga dikunci transparan — peserta baru membayar via Kahade setelah ini.")}
          </Text>
          <Input
            label={translate("Harga barang (Rp)")}
            // FE-052: pemisah ribuan saat mengetik; state digit mentah —
            // nilai escrow yang dikunci tidak berubah.
            value={formatRupiahTypingText(goods)}
            onChangeText={(t) => {
              const parsed = parseRupiahTypingText(t)
              if (parsed === null) return
              setGoods(parsed)
              setLockError(undefined)
            }}
            keyboardType="number-pad"
          />
          <Input
            label={translate("Fee jastip (Rp)")}
            value={formatRupiahTypingText(fee)}
            onChangeText={(t) => {
              const parsed = parseRupiahTypingText(t)
              if (parsed === null) return
              setFee(parsed)
              setLockError(undefined)
            }}
            keyboardType="number-pad"
          />
          <Input
            label={translate("Ongkir (Rp)")}
            value={formatRupiahTypingText(shipping)}
            onChangeText={(t) => {
              const parsed = parseRupiahTypingText(t)
              if (parsed === null) return
              setShipping(parsed)
              setLockError(undefined)
            }}
            keyboardType="number-pad"
          />
          {/* FE-052: pratinjau total yang akan dikunci — layar paling berisiko. */}
          <Text variant="caption" tone="secondary">
            {translate("Total dikunci: {x}", {
              x: formatRupiah((Number(goods) || 0) + (Number(fee) || 0) + (Number(shipping) || 0)),
            })}
          </Text>
          {lockError ? (
            <Text variant="caption" tone="danger">
              {lockError}
            </Text>
          ) : null}
        </View>
      </BottomSheet>

      <Dialog
        title={translate("Tandai trip gagal?")}
        description={translate("Semua peserta yang sudah bayar akan mendapat pengembalian dana otomatis.")}
        visible={failOpen}
        destructive
        loading={failing}
        confirmLabel={translate("Ya, pengembalian dana otomatis")}
        cancelLabel={translate("Batal")}
        onConfirm={() => void handleFail()}
        onCancel={() => setFailOpen(false)}
        onRequestClose={() => setFailOpen(false)}
      >
        <Input
          label={translate("Alasan (opsional)")}
          value={failReason}
          onChangeText={setFailReason}
          maxLength={300}
        />
      </Dialog>
      </View>
    </Screen>
  )
}
