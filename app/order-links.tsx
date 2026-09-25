/**
 * Screen — Order Link Saya (GET /v1/orders/links/my, paginated).
 *
 * Tiap tautan: <OrderLinkShareCard> (salin, bagikan via share sheet native,
 * batalkan bila masih ACTIVE, buka pesanan bila sudah ACCEPTED).
 *
 * Keputusan non-obvious:
 *   - Bagikan memakai `shareContent()` (lib/share) → share sheet OS; bila
 *     "unavailable" (web desktop) jatuh ke salin tautan + toast. Sebelumnya
 *     tombol Bagikan hanya menampilkan toast berisi URL.
 *   - URL fallback dibentuk `orderLinkUrl(token)` (lib/deeplinks) — tidak ada
 *     literal skema `kahade://` di layar.
 *   - Tone badge status: ACTIVE=success, ACCEPTED=info, EXPIRED=warning,
 *     CANCELLED=neutral — mengikuti §2.3 (semantic hanya untuk status).
 */

import { useCallback, useState } from "react"
import { LinkSimple } from "phosphor-react-native"
import { router } from "expo-router"

import { api, type OrderLink } from "@/lib/api"
import { showMutationError } from "@/lib/mutation-toast"
import { useCopy } from "@/lib/clipboard"
import { orderLinkUrl } from "@/lib/deeplinks"
import { formatDateTimeWIB } from "@/lib/format"
import { ROUTES } from "@/lib/routes"
import { shareContent } from "@/lib/share"
import { byTimestampDesc, usePaginatedQuery } from "@/lib/use-paginated-query"

import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/modal"
import { EmptyState } from "@/components/ui/empty-state"
import { Header } from "@/components/ui/header"
import { PaginatedList } from "@/components/ui/paginated-list"
import { OrderLinkShareCard } from "@/components/ui/order-link-share-card"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { orderLinkStatusMeta } from "@/lib/order-link-labels"
import { useToast } from "@/components/ui/toast"

const PAGE_SIZE = 20

export default function OrderLinksScreen() {
  const toast = useToast()
  const { copy } = useCopy()

  const [cancelTarget, setCancelTarget] = useState<OrderLink | null>(null)
  const [cancelling, setCancelling] = useState(false)

  /**
   * `usePaginatedQuery`, bukan rakitan manual page/more/loading. Yang
   * sebelumnya hilang dan sekarang ditangani hook: request halaman lama
   * dibatalkan saat layar di-unmount, "muat lagi" single-flight (tap ganda
   * tidak lagi menembak dua halaman), baris yang sudah ada TETAP tampil saat
   * halaman berikutnya gagal, dan `refreshing` terpisah dari `loading`
   * sehingga tarik-untuk-menyegarkan tidak lagi mengosongkan daftar.
   *
   * `OrderLink` tidak punya `id` — identitasnya `token`. Hook mendeduplikasi
   * baris lewat `id`, jadi token dipetakan ke sana.
   */
  const query = usePaginatedQuery<OrderLink & { id: string }>(
    "order-links",
    async (page, signal) => {
      const res = await api.orders.listMyOrderLinks({ page, limit: PAGE_SIZE }, signal)
      const data = res.data ?? []
      return {
        data: data.map((link) => ({ ...link, id: link.token })),
        meta: {
          page,
          limit: PAGE_SIZE,
          // Fallback meniru logika lama: tanpa totalPages dari server, halaman
          // yang tidak penuh dianggap akhir.
          totalPages: res.meta?.totalPages ?? (data.length < PAGE_SIZE ? page : page + 1),
        },
      }
    },
    // C-08 (audit): tautan terbaru di atas.
    {
      compare: byTimestampDesc<OrderLink & { id: string }>((link) => link.createdAt),
      // R2 (audit ronde-2, butir #27): status tautan (DITERIMA/KEDALUWARSA)
      // yang berubah saat pengguna berpindah layar terpantul saat kembali.
      refreshOnFocus: true,
    },
  )
  const items = query.data

  const handleShare = useCallback(
    async (payload: { url: string; message: string }, title: string) => {
      // M-36 (audit end-to-end, issue #99): url kosong = share sheet tanpa isi
      // berguna — jatuh ke SALIN Teks pesan, jangan panggil jalur bagikan.
      if (!payload.url.trim()) {
        const ok = await copy(payload.message)
        toast.show({
          title: ok ? "Teks tautan disalin" : "Tidak bisa membagikan",
          description: ok
            ? "Tautan belum punya URL; kalimat siap kirim disalin ke papan klip."
            : undefined,
          tone: ok ? "success" : "danger",
        })
        return
      }
      const outcome = await shareContent({ message: payload.message, url: payload.url, title })
      if (outcome === "unavailable") {
        const ok = await copy(payload.url)
        toast.show({
          title: ok ? "Tautan disalin" : "Tidak bisa membagikan",
          description: ok
            ? "Berbagi tidak tersedia di perangkat ini; tempel tautan secara manual."
            : undefined,
          tone: ok ? "success" : "danger",
        })
      }
    },
    [copy, toast.show],
  )

  const handleCancel = useCallback(async () => {
    if (!cancelTarget) return
    setCancelling(true)
    try {
      // M-37 (audit end-to-end, issue #29): HASIL `cancelOrderLink` (D-12)
      // dipakai — dulu dibuang lalu status lokal dipaksa "CANCELLED" + toast
      // "Tautan dibatalkan" apa pun keputusan server (mis. tautan sudah
      // diterima → status sebenarnya ACCEPTED, kartu berbohong).
      const res = await api.orders.cancelOrderLink(cancelTarget.token)
      const confirmed = (res.status ?? "CANCELLED") as OrderLink["status"]
      query.setData((prev) =>
        prev.map((l) =>
          l.token === cancelTarget.token
            ? { ...l, status: confirmed, ...(res.status ? {} : {}) }
            : l,
        ),
      )
      toast.show({
        title:
          confirmed === "CANCELLED"
            ? "Tautan dibatalkan"
            : res.status
              ? `Status tautan: ${orderLinkStatusMeta(res.status).label}`
              : "Pembatalan dikirim",
        tone: confirmed === "CANCELLED" ? "success" : "info",
      })
      setCancelTarget(null)
    } catch (err: unknown) {
      // R2 (audit ronde-2, butir #16): respons hilang ≠ pembatalan batal; muat
      // ulang daftar supaya tuju-status final dari server terlihat. `query`
      // ikut masuk deps handler — sebelumnya dipakai tanpa tercantum (laten).
      if (
        showMutationError(toast.show, {
          failTitle: "Gagal membatalkan tautan",
          uncertainHint: "Pembatalan mungkin sudah diproses — memuat ulang daftar…",
          err,
        })
      ) {
        void query.refresh().catch(() => {})
      }
    } finally {
      setCancelling(false)
    }
  }, [cancelTarget, toast.show, query])

  // R2 (audit ronde-2, butir #74): daftar DIVIRTUALISASI (FlatList via
  // PaginatedList) — dulu ScrollView + items.map me-render SELURUH kartu
  // share (QR + handler per baris) setelah beberapa halaman dimuat.
  const renderLinkItem = useCallback(
    ({ item: link }: { item: OrderLink & { id: string } }) => {
              const url = link.url ?? orderLinkUrl(link.token)
              const status = orderLinkStatusMeta(link.status)
              return (
                <OrderLinkShareCard
                  key={link.token}
                  url={url}
                  title={link.title}
                  amount={link.orderValue}
                  // R2 (audit ronde-2, butir #70): token PENUH = kredensial
                  // penerimaan order; yang tampil permanen di daftar disensor
                  // (4 terakhir). Menyalin/berbagi tetap memakai URL utuh.
                  orderCode={`…${link.token.slice(-4)}`}
                  status={status}
                  expiresLabel={
                    link.expiresAt ? `Berlaku hingga ${formatDateTimeWIB(link.expiresAt)}` : undefined
                  }
                  onCopy={(u) => {
                    void copy(u).then(
                      (ok) => ok && toast.show({ title: "Tautan disalin", tone: "success" }),
                    )
                  }}
                  onShare={
                    link.status === "ACTIVE"
                      ? (payload) => void handleShare(payload, link.title)
                      : undefined
                  }
                  onCancel={link.status === "ACTIVE" ? () => setCancelTarget(link) : undefined}
                  cancelling={cancelling && cancelTarget?.token === link.token}
                  onOpen={
                    link.status === "ACCEPTED" && link.orderId
                      ? () => router.push(ROUTES.orderDetail(link.orderId as string))
                      : // F-09 (audit escrow 2026-09-24): ACCEPTED tanpa `orderId`
                        // (payload lama) membuka halaman tautan yang memuat ulang
                        // data via token — begitu `orderId` muncul di sana, kartu
                        // pratinjau menawarkan "Lihat pesanan". Dibanding membentuk
                        // `/order/` telanjang, ini jalur aman yang tetap sampai tujuan.
                        () => router.push(ROUTES.orderLink(link.token))
                  }
                />
              )
    },
    [cancelTarget?.token, cancelling, copy, handleShare, toast.show],
  )

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Order Link" />
      <PaginatedList
        {...query}
        data={items}
        renderItem={renderLinkItem}
        onRefresh={query.refresh}
        onRetry={query.reload}
        onLoadMore={query.loadMore}
        header={<SectionHeader title="Tautan saya" />}
        empty={
          <EmptyState
            icon={LinkSimple}
            title="Belum ada tautan"
            description="Buat order link dari layar buat transaksi, lalu bagikan ke lawan transaksi."
            action={
              <Button
                variant="secondary"
                fullWidth={false}
                onPress={() => router.push(ROUTES.createTransaction)}
              >
                Buat tautan baru
              </Button>
            }
          />
        }
        footer={
          <Button variant="secondary" onPress={() => router.push(ROUTES.createTransaction)}>
            Buat tautan baru
          </Button>
        }
      />

      <Dialog
        title="Batalkan tautan ini?"
        description="Tautan tidak bisa lagi diterima oleh siapa pun. Tindakan ini tidak dapat dibatalkan."
        visible={!!cancelTarget}
        destructive
        loading={cancelling}
        confirmLabel="Batalkan Tautan"
        cancelLabel="Kembali"
        onConfirm={() => void handleCancel()}
        onCancel={() => setCancelTarget(null)}
        onRequestClose={() => setCancelTarget(null)}
      />
    </Screen>
  )
}