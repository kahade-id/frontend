import { ListLoading } from "@/components/ui/paginated-list"
/**
 * Screen — Perpanjangan tenggat pengiriman.
 *
 * Kontrak API (docs/api/kahade-api-mobile.json):
 *   GET  /v1/orders/{id}                         → Order (role, tenggat, lawan)
 *   GET  /v1/orders/{id}/extensions?page&limit   → Paginated<OrderExtension>
 *   POST /v1/orders/{id}/extensions              body RequestExtensionDto
 *        { extensionDays 1–14, reason 10–500 }   ← PENJUAL mengajukan
 *   POST /v1/orders/{id}/extensions/{extId}/respond body RespondExtensionDto
 *        { action APPROVE|REJECT, note? }        ← PEMBELI menanggapi
 *
 * Peran:
 *   - myRole === "SELLER" → tombol "Ajukan perpanjangan" (BottomSheet:
 *     NumberStepper hari + TextArea alasan). Disembunyikan bila masih ada
 *     permintaan PENDING (server juga menolak; kita cegah klik sia-sia) atau
 *     order tidak lagi di fase pengerjaan (PAID/PROCESSING/SHIPPED).
 *   - myRole === "BUYER"  → Setujui/Tolak pada kartu PENDING via Dialog
 *     (catatan opsional ≤ 500).
 *   Bila `myRole` tidak dikirim server, peran diturunkan dari
 *   `order.seller.id`/`buyer.id` vs `me` (GET /v1/users/me) — UNVERIFIED
 *   apakah backend selalu mengisi myRole.
 *
 * Keputusan non-obvious:
 *   - Daftar dipaginasi (PAGE_SIZE 20 + <LoadMore>), bukan `limit: 50` hardcode:
 *     order panjang bisa punya banyak permintaan, dan meta paginasi tersedia.
 *   - Tenggat baru pratinjau = tenggat saat ini + hari — dihitung oleh
 *     <OrderExtensionCard>/`addDays` yang sama dengan kartu riwayat, supaya
 *     angka yang dilihat penjual saat mengajukan = yang dilihat pembeli.
 *   - Batas 1–14 hari & alasan 10–500 karakter diambil dari DTO; pesan
 *     validasi lokal hanya mencegah request yang pasti ditolak.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { View } from "react-native"
import { useLocalSearchParams } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Clock, Plus } from "phosphor-react-native"

import { api, userMessage, type Order } from "@/lib/api"
import type { OrderExtension, PageQuery } from "@/lib/api/orders"
import { addDays, OrderExtensionCard } from "@/components/ui/order-extension-card"
import { formatDateTime } from "@/lib/format"
import { tokens } from "@/lib/tokens"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/modal"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { KeyValue, KeyValueList } from "@/components/ui/key-value"
import { LoadMore } from "@/components/ui/load-more"
import { NumberStepper } from "@/components/ui/number-stepper"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"
import { useToast } from "@/components/ui/toast"

/** Batas RequestExtensionDto (spec): extensionDays 1–14, reason 10–500 */
const DAYS_MIN = 1
const DAYS_MAX = 14
const DAYS_DEFAULT = 3
const REASON_MIN = 10
const REASON_MAX = 500
/** RespondExtensionDto.note maxLength */
const NOTE_MAX = 500
const PAGE_SIZE: NonNullable<PageQuery["limit"]> = 20

/** Status order yang masih memungkinkan penjual meminta tambahan waktu */
const EXTENDABLE_STATUSES: ReadonlySet<string> = new Set(["PAID", "PROCESSING", "SHIPPED"])

type Action = { kind: "APPROVE" | "REJECT"; extension: OrderExtension } | null
type Role = "BUYER" | "SELLER" | null

export default function ExtensionScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>()
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [order, setOrder] = useState<Order | null>(null)
  const [role, setRole] = useState<Role>(null)
  const [items, setItems] = useState<OrderExtension[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // Respon (pembeli)
  const [action, setAction] = useState<Action>(null)
  const [actionNote, setActionNote] = useState("")
  const [busy, setBusy] = useState(false)

  // Pengajuan (penjual)
  const [requestOpen, setRequestOpen] = useState(false)
  const [days, setDays] = useState(DAYS_DEFAULT)
  const [reason, setReason] = useState("")
  const [reasonError, setReasonError] = useState<string | undefined>()
  const [requesting, setRequesting] = useState(false)

  const resolveRole = useCallback(async (o: Order): Promise<Role> => {
    if (o.myRole === "SELLER" || o.myRole === "BUYER") return o.myRole
    try {
      const me = await api.users.getMe()
      if (me?.id && me.id === o.seller?.id) return "SELLER"
      if (me?.id && me.id === o.buyer?.id) return "BUYER"
    } catch {
      /* fallback: tanpa peran → hanya baca */
    }
    return null
  }, [])

  const fetchPage = useCallback(
    async (p: number) => {
      if (!orderId) return
      const res = await api.orders.listExtensions(orderId, { page: p, limit: PAGE_SIZE })
      const data = res?.data ?? []
      setItems((prev) => (p === 1 ? data : [...prev, ...data]))
      setPage(p)
      const totalPages = res?.meta?.totalPages
      setHasMore(typeof totalPages === "number" ? p < totalPages : data.length >= PAGE_SIZE)
    },
    [orderId],
  )

  const fetchAll = useCallback(async () => {
    if (!orderId) return
    setLoading(true)
    setError(null)
    try {
      const [o] = await Promise.all([api.orders.getOrder(orderId), fetchPage(1)])
      setOrder(o ?? null)
      if (o) setRole(await resolveRole(o))
    } catch {
      setError("Gagal memuat permintaan perpanjangan.")
    } finally {
      setLoading(false)
    }
  }, [orderId, fetchPage, resolveRole])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchAll()
    setRefreshing(false)
  }, [fetchAll])

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      await fetchPage(page + 1)
    } catch {
      toast.show({ title: "Gagal memuat halaman berikutnya", tone: "danger" })
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, hasMore, fetchPage, page, toast])

  // ── Respon pembeli ─────────────────────────────────────────────────
  const openAction = useCallback((kind: "APPROVE" | "REJECT", ext: OrderExtension) => {
    setAction({ kind, extension: ext })
    setActionNote("")
  }, [])

  const submitAction = useCallback(async () => {
    if (!action || !orderId) return
    setBusy(true)
    try {
      await api.orders.respondExtension(orderId, action.extension.id, {
        action: action.kind,
        note: actionNote.trim() || undefined,
      })
      toast.show({
        title: action.kind === "APPROVE" ? "Perpanjangan disetujui" : "Perpanjangan ditolak",
        tone: action.kind === "APPROVE" ? "success" : "neutral",
        duration: 3000,
      })
      setAction(null)
      await fetchAll()
    } catch {
      toast.show({ title: "Gagal memproses permintaan", tone: "danger" })
    } finally {
      setBusy(false)
    }
  }, [action, orderId, actionNote, toast, fetchAll])

  // ── Pengajuan penjual ──────────────────────────────────────────────
  const openRequest = useCallback(() => {
    setDays(DAYS_DEFAULT)
    setReason("")
    setReasonError(undefined)
    setRequestOpen(true)
  }, [])

  const submitRequest = useCallback(async () => {
    if (!orderId || requesting) return
    const trimmed = reason.trim()
    if (trimmed.length < REASON_MIN) {
      setReasonError(`Alasan minimal ${REASON_MIN} karakter.`)
      return
    }
    setRequesting(true)
    try {
      await api.orders.requestExtension(orderId, { extensionDays: days, reason: trimmed })
      toast.show({
        title: "Permintaan terkirim",
        description: "Pembeli akan diberi tahu untuk menyetujui atau menolak.",
        tone: "success",
      })
      setRequestOpen(false)
      await fetchAll()
    } catch (err) {
      toast.show({
        title: "Gagal mengajukan perpanjangan",
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setRequesting(false)
    }
  }, [orderId, requesting, reason, days, toast, fetchAll])

  // Tenggat saat ini — dari order (deadline eksplisit atau createdAt + hari)
  const deadline = useMemo(() => {
    if (!order) return new Date()
    return order.deliveryDeadlineAt ?? addDays(order.createdAt, order.deliveryDeadlineDays)
  }, [order])
  const previewDeadline = useMemo(() => addDays(deadline, days), [deadline, days])

  const isSeller = role === "SELLER"
  const isBuyer = role === "BUYER"
  const requesterName = order ? (order.seller.fullName ?? order.seller.username) : undefined
  const hasPending = items.some((e) => e.status === "PENDING")
  const canRequest = isSeller && !!order && EXTENDABLE_STATUSES.has(order.status) && !hasPending

  return (
    <Screen
      edges={["top"]}
      padded={false}
      footer={
        canRequest ? (
          <Button variant="primary" leftIcon={Plus} onPress={openRequest} fullWidth>
            Ajukan perpanjangan
          </Button>
        ) : undefined
      }
    >
      <Header title="Perpanjangan Tenggat" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        {loading ? (
          <ListLoading />
        ) : error ? (
          <ErrorState title="Gagal memuat" description={error} onRetry={() => void fetchAll()} />
        ) : (
          <View className="gap-3" style={{ paddingTop: tokens.space[3] }}>
            {order ? (
              <KeyValueList>
                <KeyValue label="Order" value={order.title} />
                <KeyValue label="Tenggat saat ini" value={formatDateTime(deadline)} emphasis />
              </KeyValueList>
            ) : null}

            {isSeller && hasPending ? (
              <Text variant="caption" tone="secondary">
                Masih ada permintaan yang menunggu tanggapan pembeli. Ajukan lagi setelah dijawab.
              </Text>
            ) : null}

            {items.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="Belum ada permintaan"
                description={
                  isSeller
                    ? "Butuh waktu tambahan? Ajukan perpanjangan dan pembeli akan diminta menyetujui."
                    : "Permintaan perpanjangan tenggat dari penjual akan tercatat di sini."
                }
              />
            ) : (
              <>
                <SectionHeader title={`${items.length} permintaan`} />
                {items.map((ext) => {
                  const pending = ext.status === "PENDING"
                  const canRespond = pending && isBuyer
                  return (
                    <OrderExtensionCard
                      key={ext.id}
                      extensionDays={ext.extensionDays}
                      currentDeadline={deadline}
                      reason={ext.reason}
                      status={ext.status}
                      requestedByMe={isSeller}
                      requesterName={requesterName}
                      requesterAvatar={order?.seller.avatarUrl ?? undefined}
                      responseNote={ext.note ?? undefined}
                      requestedAt={formatDateTime(ext.createdAt)}
                      onApprove={canRespond ? () => openAction("APPROVE", ext) : undefined}
                      onReject={canRespond ? () => openAction("REJECT", ext) : undefined}
                    />
                  )
                })}
                <LoadMore
                  status={loadingMore ? "loading" : hasMore ? "idle" : "end"}
                  onLoadMore={() => void handleLoadMore()}
                  endLabel="Semua permintaan sudah ditampilkan"
                />
              </>
            )}
          </View>
        )}
      </PullToRefresh>

      {/* Respon pembeli */}
      <Dialog
        title={action?.kind === "APPROVE" ? "Setujui perpanjangan?" : "Tolak perpanjangan?"}
        description={
          action?.kind === "APPROVE"
            ? `Tenggat pengiriman menjadi ${formatDateTime(addDays(deadline, action.extension.extensionDays))}. Dana tetap di escrow.`
            : "Tenggat pengiriman tidak berubah. Beri tahu penjual alasannya."
        }
        visible={!!action}
        loading={busy}
        destructive={action?.kind === "REJECT"}
        confirmLabel={action?.kind === "APPROVE" ? "Setujui" : "Tolak"}
        cancelLabel="Batal"
        onConfirm={() => void submitAction()}
        onCancel={() => setAction(null)}
        onRequestClose={() => setAction(null)}
      >
        <TextArea
          value={actionNote}
          onChangeText={setActionNote}
          placeholder="Catatan untuk penjual (opsional)…"
          maxLength={NOTE_MAX}
          showCount
        />
      </Dialog>

      {/* Pengajuan penjual */}
      <BottomSheet
        visible={requestOpen}
        onRequestClose={() => (requesting ? undefined : setRequestOpen(false))}
        title="Ajukan perpanjangan"
        description="Pembeli harus menyetujui sebelum tenggat berubah."
        footer={
          <View className="gap-2">
            <Button
              variant="primary"
              loading={requesting}
              onPress={() => void submitRequest()}
              fullWidth
            >
              Kirim permintaan
            </Button>
            <Button
              variant="ghost"
              disabled={requesting}
              onPress={() => setRequestOpen(false)}
              fullWidth
            >
              Batal
            </Button>
          </View>
        }
      >
        <View className="gap-4">
          <NumberStepper
            label="Tambahan waktu"
            value={days}
            onChange={setDays}
            min={DAYS_MIN}
            max={DAYS_MAX}
            suffix="hari"
            helperText={`${DAYS_MIN}–${DAYS_MAX} hari · tenggat baru ${formatDateTime(previewDeadline)}`}
            disabled={requesting}
            fullWidth
          />
          <TextArea
            label="Alasan"
            value={reason}
            onChangeText={(t) => {
              setReason(t)
              setReasonError(undefined)
            }}
            placeholder="Jelaskan kenapa butuh waktu tambahan…"
            maxLength={REASON_MAX}
            showCount
            errorText={reasonError}
            helperText={reasonError ? undefined : `Minimal ${REASON_MIN} karakter`}
            disabled={requesting}
            required
          />
        </View>
      </BottomSheet>
    </Screen>
  )
}
