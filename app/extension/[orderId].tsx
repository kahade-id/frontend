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

import { Crossfade } from "@/components/ui/fade-in"
import { DetailLoading } from "@/components/ui/paginated-list"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { View } from "react-native"
import { useLocalSearchParams } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Clock, Plus } from "phosphor-react-native"

import { api, userMessage, type Order } from "@/lib/api"
import { API_CONSTRAINTS } from "@/lib/api/constraints"
import {
  isExtendable,
  orderPartyName,
  type OrderExtension,
  type PageQuery,
} from "@/lib/api/orders"
import { addDays, OrderExtensionCard } from "@/components/ui/order-extension-card"
import { formatDateTime, formatDateTimeWIB } from "@/lib/format"
import { tokens } from "@/lib/tokens"
import { useApiQuery } from "@/lib/use-api-query"
import { usePolling } from "@/lib/use-polling"
import { showMutationError } from "@/lib/mutation-toast"

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
import { translate } from "@/lib/i18n/translate"

// R2 (audit ronde-2, butir #78): batas diambil dari API_CONSTRAINTS (satu
// sumber kebenaran, tergenerasi dari spec) — konstanta lokal yang ditulis
// ulang berisiko drift diam-diam saat server mengetatkan batas.
const EXT_C = API_CONSTRAINTS.RequestExtensionDto
const DAYS_MIN = EXT_C.extensionDays.minimum ?? 1
const DAYS_MAX = EXT_C.extensionDays.maximum ?? 14
const DAYS_DEFAULT = 3
const REASON_MIN = EXT_C.reason.minLength ?? 10
const REASON_MAX = EXT_C.reason.maxLength ?? 500
/** RespondExtensionDto.note maxLength */
const NOTE_MAX = API_CONSTRAINTS.RespondExtensionDto.note.maxLength ?? 500
const PAGE_SIZE: NonNullable<PageQuery["limit"]> = 20

type Action = { kind: "APPROVE" | "REJECT"; extension: OrderExtension } | null
type Role = "BUYER" | "SELLER" | null

export default function ExtensionScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>()
  const insets = useSafeAreaInsets()
  const toast = useToast()

  /**
   * Audit: state async dirakit manual. Cacat terbukti dari kode lama:
   * `handleRefresh` memanggil `fetchAll()` yang sama dengan muat-awal, dan
   * fungsi itu membuka dengan `setLoading(true)` — tarik-untuk-menyegarkan
   * mengganti pesanan + daftar pengajuan perpanjangan dengan kerangka.
   * Request juga tidak dibatalkan saat layar ditutup.
   *
   * `resolveRole` tetap DI DALAM fetcher karena hasilnya data server yang
   * diturunkan dari order, bukan state UI.
   *
   * Halaman-1 daftar perpanjangan ikut dalam fetcher (#75/#76); halaman
   * BERIKUTNYA tetap lewat paginator manual `fetchPage` (load-more) —
   * menggantinya dengan usePaginatedQuery akan mengubah semantik (dedupe by
   * id, hasMore, loadMore) dan itu perubahan lain.
   */
  const query = useApiQuery<{
    order: Order | null
    role: Role
    /** R2 (butir #75): halaman-1 daftar pengajuan ikut dalam SATU fetcher. */
    list: { items: OrderExtension[]; hasMore: boolean }
  }>(
    `order-extension:${orderId}`,
    async (signal) => {
      // R2 (audit ronde-2, butir #75/#76): getOrder & halaman-1 daftar
      // pengajuan DIPARARELkan dalam satu fetcher — dulu rantai serial
      // getOrder → (bundle effect) → fetchPage(1): dua roundtrip berturut-
      // turut untuk dua resource tak-berkait, dan halaman-1 ikut ditembak
      // ulang setiap refresh ringan (identitas bundle baru tiap refetch).
      const [o, listRes] = await Promise.all([
        api.orders.getOrder(orderId as string, signal),
        api.orders
          .listExtensions(orderId as string, { page: 1, limit: PAGE_SIZE }, signal)
          .catch(() => null),
      ])
      const rows = listRes?.data ?? []
      const totalPages = listRes?.meta?.totalPages
      return {
        order: o ?? null,
        role: o ? await resolveRole(o, signal) : null,
        list: {
          items: rows,
          hasMore:
            typeof totalPages === "number" ? totalPages > 1 : rows.length >= PAGE_SIZE,
        },
      }
    },
    Boolean(orderId),
  )
  const bundle = query.data
  const order = bundle?.order ?? null
  const role = bundle?.role ?? null

  // R2 (audit ronde-2, butir #24): persetujuan/penolakan perpanjangan dari
  // pihak lawan menyegar tiap 20 detik saat layar terbuka.
  usePolling(
    async () => {
      await query.refresh().catch(() => {})
    },
    20_000,
    Boolean(orderId),
  )
  const [items, setItems] = useState<OrderExtension[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const { loading, error, refreshing } = query
  const [loadingMore, setLoadingMore] = useState(false)

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

  const resolveRole = useCallback(async (o: Order, signal?: AbortSignal): Promise<Role> => {
    if (o.myRole === "SELLER" || o.myRole === "BUYER") return o.myRole
    try {
      // C-02 (audit): cache bersama `queryKeys.me()` — peran pesanan
      // diselesaikan dari identitas yang sama dengan layar lain.
      const me = await api.users.getMeCached(signal)
      if (me?.id && me.id === o.seller?.id) return "SELLER"
      if (me?.id && me.id === o.buyer?.id) return "BUYER"
    } catch {
      /* fallback: tanpa peran → hanya baca */
    }
    return null
  }, [])

  /**
   * F-02 (audit escrow 2026-09-24): `fetchPage` kini membawa AbortSignal yang
   * dibatalkan saat unmount — dulu request halaman memperbarui state setelah
   * layar ditutup dan bisa balapan dengan penyegaran (halaman lama mendarat
   * belakangan menimpa data segar).
   */
  const pageAbortRef = useRef<AbortController | null>(null)
  useEffect(() => () => pageAbortRef.current?.abort(), [])

  const fetchPage = useCallback(
    async (p: number) => {
      if (!orderId) return
      pageAbortRef.current?.abort()
      const controller = new AbortController()
      pageAbortRef.current = controller
      let res
      try {
        res = await api.orders.listExtensions(
          orderId,
          { page: p, limit: PAGE_SIZE },
          controller.signal,
        )
      } catch (err) {
        if (controller.signal.aborted) return
        throw err
      }
      if (controller.signal.aborted) return
      const data = res?.data ?? []
      setItems((prev) => (p === 1 ? data : [...prev, ...data]))
      setPage(p)
      const totalPages = res?.meta?.totalPages
      setHasMore(typeof totalPages === "number" ? p < totalPages : data.length >= PAGE_SIZE)
    },
    [orderId],
  )

  // R2 (butir #75/#76): halaman-1 kini tiba BERSAMA fetcher — effect hanya
  // menyinkronkan state paginator manual (load-more), tanpa request jaringan.
  useEffect(() => {
    if (!bundle) return
    setItems(bundle.list.items)
    setPage(1)
    setHasMore(bundle.list.hasMore)
  }, [bundle])

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      await fetchPage(page + 1)
    } catch (err: unknown) {
      toast.show({
        title: "Gagal memuat halaman berikutnya",
        description: userMessage(err),
        tone: "danger",
      })
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
      await query.refresh()
    } catch (err: unknown) {
      // R2 (audit ronde-2, butir #10): APPROVE mengubah tenggat escrow — muat
      // ulang dari server saat hasil tidak diketahui.
      if (
        showMutationError(toast.show, {
          failTitle: "Gagal memproses permintaan",
          uncertainHint: "Respons mungkin sudah dicatat — memuat ulang…",
          uncertainDetail: "Tenggat bisa sudah berubah — periksa daftar permintaan.",
          err,
        })
      ) {
        await query.refresh().catch(() => {})
      }
    } finally {
      setBusy(false)
    }
  }, [action, orderId, actionNote, toast, query])

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
      await query.refresh()
    } catch (err) {
      // R2 (audit ronde-2, butir #11): permintaan bisa sudah terbuat saat
      // respons hilang — muat ulang sebelum pengguna mengajukan duplikat.
      if (
        showMutationError(toast.show, {
          failTitle: "Gagal mengajukan perpanjangan",
          uncertainHint: "Permintaan mungkin sudah terkirim — memuat ulang…",
          err,
        })
      ) {
        await query.refresh().catch(() => {})
      }
    } finally {
      setRequesting(false)
    }
  }, [orderId, requesting, reason, days, toast, query])

  // Tenggat saat ini — dari order (deadline eksplisit atau createdAt + hari)
  const deadline = useMemo(() => {
    if (!order) return new Date()
    const base = order.deliveryDeadlineAt ?? addDays(order.createdAt, order.deliveryDeadlineDays)
    // F-08 (audit escrow 2026-09-24): fallback `createdAt + hari` dulu
    // mengabaikan perpanjangan yang SUDAH DISETUJUI sehingga pratinjau
    // "Tenggat baru" menghitung dari basis yang salah. Deadline eksplisit dari
    // server sudah memuat perpanjangan; hanya fallback yang perlu ditambah.
    if (order.deliveryDeadlineAt) return base
    const extraDays = items
      .filter((e) => e.status === "APPROVED")
      .reduce((sum, e) => sum + (Number.isFinite(e.extensionDays) ? e.extensionDays : 0), 0)
    return extraDays > 0 ? addDays(base, extraDays) : base
  }, [order, items])
  const previewDeadline = useMemo(() => addDays(deadline, days), [deadline, days])

  const isSeller = role === "SELLER"
  const isBuyer = role === "BUYER"
  const hasPending = items.some((e) => e.status === "PENDING")
  const canRequest = isSeller && !!order && isExtendable(order.status) && !hasPending

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
        onRefresh={() => void query.refresh()}
        refreshing={refreshing}
        contentContainerClassName="px-5"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        <Crossfade loading={loading} skeleton={<DetailLoading />}>
          {error ? (
          <ErrorState title="Gagal memuat" description={error} onRetry={() => void query.reload()} />
        ) : (
          <View className="gap-3" style={{ paddingTop: tokens.space[3] }}>
            {order ? (
              <KeyValueList>
                <KeyValue label="Order" value={order.title} />
                <KeyValue
                  label="Tenggat saat ini"
                  // M-58 (audit end-to-end, issue #41/#95): `addDays(createdAt
                  // kosong)` = Invalid Date → tampil "—" murni, bukan "— WIB"
                  // (label zona untuk data yang tidak ada).
                  value={(() => {
                    const ms =
                      deadline instanceof Date ? deadline.getTime() : new Date(deadline).getTime()
                    return Number.isFinite(ms) ? formatDateTimeWIB(deadline) : "—"
                  })()}
                  emphasis
                />
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
                <SectionHeader title={translate("{x} permintaan", { x: items.length })} />
                {items.map((ext) => {
                  const pending = ext.status === "PENDING"
                  const canRespond = pending && isBuyer
                  // F-06 (audit escrow 2026-09-24): pihak pengaju dibaca dari
                  // data ekstensi bila ada (`requesterId`) — dulu selalu
                  // `isSeller`/nama penjual sehingga kartu tertukar pihak begitu
                  // pembeli diizinkan mengajukan. Fallback ke penjual hanya
                  // untuk payload lama (kini memang hanya penjual yang mengajukan).
                  const requesterId = (ext as { requesterId?: string }).requesterId
                  const requestedByMe = requesterId
                    ? requesterId === (isSeller ? order?.seller?.id : order?.buyer?.id)
                    : isSeller
                  const requesterIsBuyer = requesterId != null && requesterId === order?.buyer?.id
                  const perRequesterName = order
                    ? (ext as { requesterName?: string }).requesterName ??
                      orderPartyName(requesterIsBuyer ? order.buyer : order.seller)
                    : undefined
                  return (
                    <OrderExtensionCard
                      key={ext.id}
                      extensionDays={ext.extensionDays}
                      currentDeadline={deadline}
                      reason={ext.reason}
                      status={ext.status}
                      requestedByMe={requestedByMe}
                      requesterName={perRequesterName}
                      // M-44 (audit end-to-end, issue #40): avatar MEMILIH
                      // pihak pemohon (pembeli bila `requesterIsBuyer`) — dulu
                      // selalu wajah penjual apa pun pemohonnya (F-06 hanya
                      // memperbaiki nama).
                      requesterAvatar={
                        (requesterIsBuyer ? order?.buyer?.avatarUrl : order?.seller?.avatarUrl) ??
                        undefined
                      }
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
        </Crossfade>
      </PullToRefresh>

      {/* Respon pembeli */}
      <Dialog
        title={action?.kind === "APPROVE" ? "Setujui perpanjangan?" : "Tolak perpanjangan?"}
        description={
          action?.kind === "APPROVE"
            ? translate("Tenggat pengiriman menjadi {x}. Dana tetap di escrow.", {
                x: formatDateTimeWIB(addDays(deadline, action.extension.extensionDays)),
              })
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
        avoidKeyboard
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
            helperText={translate("{x}–{y} hari · tenggat baru {z}", {
              x: DAYS_MIN,
              y: DAYS_MAX,
              z: formatDateTimeWIB(previewDeadline),
            })}
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
            helperText={reasonError ? undefined : translate("Minimal {x} karakter", { x: REASON_MIN })}
            disabled={requesting}
            required
          />
        </View>
      </BottomSheet>
    </Screen>
  )
}