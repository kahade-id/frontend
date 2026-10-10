/**
 * Kahade — Detail Notifikasi (`/notification/[id]`).
 *
 * Dibuka dari ketukan baris di tab Notifikasi maupun deep link
 * `kahade.id/notification/<id>` (email/push lama). Isi:
 *   - Ikon kategori + judul + SELURUH isi pesan (daftar hanya memotong 2 baris)
 *   - Kategori, waktu terima, dan status dibaca
 *   - CTA "Lihat …" ke entitas terkait bila referensinya dikenali
 *     (`routeForNotificationReference` — ORDER, DISPUTE, CHAT, …)
 *   - Aksi hapus (dialog konfirmasi) di header
 *
 * Keputusan non-obvious:
 *   - Dibuka = dibaca: `POST /v1/notifications/:id/read` dipicu sekali saat
 *     data tiba dalam keadaan unread, lalu badge tab disegarkan. Daftar juga
 *     menandai dibaca saat ketuk (optimistic) — pemanggilan ganda aman karena
 *     endpoint-nya idempoten.
 *   - Tanpa `signal` yang dibuang: fetcher meneruskan `signal` ke
 *     `getNotification` (aturan S6) dan memakai `useApiQuery` (aturan S1).
 *   - `id` kosong (deep link rusak) dirender sebagai EmptyState eksplisit,
 *     bukan spinner tanpa akhir — `enabled: Boolean(id)` mematikan fetch.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { View } from "react-native"
import { Image } from "expo-image"
import { router, useLocalSearchParams } from "expo-router"
import { Bell, Trash } from "phosphor-react-native"

import { api, type AppNotification } from "@/lib/api"
import { formatDateTime } from "@/lib/format"
import { ROUTES } from "@/lib/routes"
import {
  checkConfirmReceiptEligible,
  confirmReceipt,
  orderIdFromNotification,
} from "@/lib/order-confirm"
import {
  isNotificationInboxRoute,
  isNotificationSelfRoute,
  labelForNotificationReference,
  routeForNotificationReference,
} from "@/lib/notification-routing"
import { checkNotificationTarget } from "@/lib/notification-target"
import {
  notificationCategoryLabel,
  notificationTypeUiCategory,
  notificationUiCategory,
} from "@/lib/notification-category"
import { refreshUnreadCount } from "@/lib/unread-count"
import { invalidateQueryPrefix, useApiQuery } from "@/lib/use-api-query"
import { translate, useLanguage } from "@/lib/i18n"
import { showMutationError } from "@/lib/mutation-toast"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DataScreen } from "@/components/ui/data-screen"
import { IconButton } from "@/components/ui/icon-button"
import { IconBox } from "@/components/ui/icon-box"
import { Dialog } from "@/components/ui/modal"
import {
  NOTIFICATION_CATEGORY_ICON,
  type NotificationCategory as UiCategory,
} from "@/components/ui/notification-list-item"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"

const CATEGORY_ICON_BOX: Record<UiCategory, "surface" | "danger"> = {
  order: "surface",
  wallet: "surface",
  chat: "surface",
  dispute: "danger",
  security: "danger",
  promo: "surface",
  referral: "surface",
  system: "surface",
}

export default function NotificationDetailScreen() {
  // Langganan bahasa untuk a11y label tombol hapus (prop string, UI-M020).
  useLanguage()
  const { id } = useLocalSearchParams<{ id?: string }>()
  const toast = useToast()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const query = useApiQuery<AppNotification>(
    `notification:${id}`,
    (signal) => api.notifications.getNotification(id ?? "", signal),
    Boolean(id),
  )
  const notif = query.data

  // Dibuka = dibaca — sekali per notifikasi (ref guard, bukan state, agar
  // tidak memicu render ulang dan tidak mengulang saat refresh).
  // CN-009: setelah mark sukses, override lokal agar badge "Baru" hilang
  // seketika tanpa menunggu refetch.
  const markedRead = useRef<string | null>(null)
  const [readLocally, setReadLocally] = useState(false)
  useEffect(() => {
    if (!notif || notif.isRead || markedRead.current === notif.id) return
    markedRead.current = notif.id
    api.notifications
      .markNotificationRead(notif.id)
      .then(() => {
        setReadLocally(true)
        void refreshUnreadCount()
        // Audit 2026-10-10 (FE-14): daftar inbox ter-cache masih menandai item
        // ini belum dibaca (refresh fokus dilewati bila data <30 dtk).
        invalidateQueryPrefix("notifications:")
      })
      .catch(() => {
        markedRead.current = null
      })
  }, [notif])

  // Audit 2026-10-10 (FE-45): rute yang menunjuk layar ini sendiri (broadcast
  // `actionUrl: /notifications?notificationId=<id ini>`) atau tab inbox =
  // bukan tautan — dulu tampil CTA "Lihat notifikasi" yang menumpuk layar
  // detail yang sama di atas dirinya.
  const resolvedRoute = notif ? routeForNotificationReference(notif) : null
  const relatedRoute =
    notif && resolvedRoute && !isNotificationInboxRoute(resolvedRoute) && !isNotificationSelfRoute(resolvedRoute, notif.id)
      ? resolvedRoute
      : null
  const relatedLabel = notif && relatedRoute ? labelForNotificationReference(notif) : null

  /**
   * B15: validasi target CTA sebelum navigasi — target yang sudah dihapus
   * (404 dari probe) tidak dibuka; pengguna tetap di detail notifikasi dengan
   * penjelasan, bukan mendarat di layar yang mati.
   */
  const handleOpenRelated = useCallback(async () => {
    if (!notif) return
    const check = await checkNotificationTarget(notif)
    if (check.status === "unavailable") {
      toast.show({
        title: "Konten tidak tersedia",
        // Audit 2026-10-10 (FE-40): label entitas ("Order"/"Sengketa"/"Karya")
        // diterjemahkan terpisah — template literal lama menyisipkan label
        // Indonesia mentah ke kalimat EN.
        description: translate("{x} sudah tidak tersedia — kemungkinan sudah dihapus.", {
          x: translate(check.entityLabel),
        }),
        tone: "warning",
      })
      return
    }
    // "unknown-route" tak mungkin di sini: CTA hanya tampil bila
    // routeForNotificationReference mengembalikan route.
    if (check.status === "ok") router.push(check.route)
  }, [notif, toast.show])

  // Item #24 — "Konfirmasi terima" langsung dari notifikasi in-app.
  // orderId diambil dari referenceType/referenceId (fail-closed: null bila
  // bukan referensi order). Kelayakan dicek via API saat detail dimuat;
  // tombol HANYA tampil bila order memang bisa dikonfirmasi.
  const confirmOrderId = notif
    ? orderIdFromNotification({
        referenceType: notif.referenceType,
        referenceId: notif.referenceId,
        actionUrl: notif.actionUrl,
      })
    : null
  const [confirmEligible, setConfirmEligible] = useState(false)
  const [confirming, setConfirming] = useState(false)
  // Item 32 (mega-batch FE-IMP-5): konfirmasi eksplisit sebelum dana escrow
  // dilepas dari jalur notifikasi — copy sama seperti detail order.
  const [confirmReleaseOpen, setConfirmReleaseOpen] = useState(false)
  useEffect(() => {
    if (!confirmOrderId) {
      setConfirmEligible(false)
      return
    }
    let cancelled = false
    setConfirmEligible(false)
    void checkConfirmReceiptEligible(confirmOrderId)
      .then((result) => {
        if (!cancelled) setConfirmEligible(result.eligible)
      })
      .catch(() => {
        // Fail-closed: ragu = sembunyikan tombol.
        if (!cancelled) setConfirmEligible(false)
      })
    return () => {
      cancelled = true
    }
  }, [confirmOrderId])

  const handleConfirmReceipt = async () => {
    if (!confirmOrderId || confirming) return
    setConfirming(true)
    try {
      await confirmReceipt(confirmOrderId)
      setConfirmEligible(false)
      toast.show({
        title: "Pesanan dikonfirmasi diterima",
        description: "Dana diteruskan ke penjual.",
        tone: "success",
        duration: 4000,
      })
      // Refresh status: data layar ini + seluruh cache query.
      await query.reload()
    } catch (err: unknown) {
      // Klasifikasi toast: error mutasi non-blokir via showMutationError.
      if (
        showMutationError(toast.show, {
          failTitle: "Konfirmasi gagal",
          uncertainHint: "Konfirmasi mungkin sudah diproses — memuat ulang…",
          uncertainDetail: "Dana bisa sudah diteruskan ke penjual — jangan konfirmasi ulang.",
          err: err,
          scope: "notification:id:konfirmasi",
        })
      ) {
        void query.reload()
      }
    } finally {
      setConfirming(false)
    }
  }

  const handleDelete = async () => {
    if (!notif || deleting) return
    setDeleting(true)
    try {
      await api.notifications.deleteNotification(notif.id)
      void refreshUnreadCount()
      // FE-14: item yang dihapus jangan muncul lagi saat kembali ke daftar.
      invalidateQueryPrefix("notifications:")
      toast.show({ title: "Notifikasi dihapus", tone: "success", duration: 2500 })
      if (router.canGoBack()) router.back()
      else router.replace(ROUTES.notifications)
    } catch (err: unknown) {
      // Klasifikasi toast: error mutasi non-blokir via showMutationError.
      showMutationError(toast.show, {
        failTitle: "Notifikasi belum dapat dihapus",
        uncertainHint: "Aksi mungkin sudah diproses — periksa kembali sebelum mencoba lagi.",
        err: err,
        scope: "notification:id:notifikasi-belum-dapat",
      })
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  if (!id) {
    return (
      <DataScreen
        title="Detail Notifikasi"
        state={{ loading: false, error: null, refresh: () => {}, reload: () => {} }}
        refreshable={false}
        empty={{
          icon: Bell,
          title: "Notifikasi tidak ditemukan",
          description: "Tautan yang Anda buka tidak memuat identitas notifikasi.",
        }}
      />
    )
  }

  const uiCategory =
    notificationTypeUiCategory(notif?.type) ?? notificationUiCategory(notif?.category)

  // Audit 2026-10-10 (FE-11): 404 = notifikasi sudah dihapus/kedaluwarsa
  // (deep link lama, push basi) — bukan kegagalan jaringan. Dulu tampil
  // "Gagal memuat notifikasi" + "Coba lagi" yang tidak akan pernah berhasil.
  const notFound = query.errorStatus === 404

  return (
    <DataScreen
      title="Detail Notifikasi"
      header={
        notif
          ? {
              right: (
                <IconButton
                  icon={Trash}
                  variant="ghost"
                  accessibilityLabel={translate("Hapus notifikasi")}
                  onPress={() => setConfirmDelete(true)}
                />
              ),
            }
          : undefined
      }
      state={notFound ? { ...query, error: null } : query}
      loadingMessage="Memuat notifikasi"
      errorTitle="Gagal memuat notifikasi"
      empty={
        notFound
          ? {
              icon: Bell,
              title: "Notifikasi tidak tersedia",
              description: "Notifikasi ini sudah dihapus atau kedaluwarsa.",
            }
          : null
      }
    >
      {notif ? (
        <View className="gap-5">
          {/* ── Kepala: ikon kategori + judul + meta ─────────────── */}
          <View className="gap-3">
            <View className="flex-row items-center gap-3">
              <IconBox
                icon={NOTIFICATION_CATEGORY_ICON[uiCategory]}
                size="lg"
                variant={CATEGORY_ICON_BOX[uiCategory]}
              />
              <View className="flex-1 gap-1">
                <Badge tone="neutral" variant="outline">
                  {notificationCategoryLabel(notif.category)}
                </Badge>
                <Text variant="caption" tone="secondary" className="tabular-nums">
                  {formatDateTime(notif.createdAt)}
                </Text>
              </View>
              {!notif.isRead && !readLocally ? (
                <Badge tone="info" variant="soft">
                  Baru
                </Badge>
              ) : null}
            </View>
            <Text variant="h2" accessibilityRole="header">{notif.title}</Text>
          </View>

          {/* ── FE-12: gambar notifikasi kaya (opsional, kontrak item 114) ── */}
          {notif.imageUrl ? (
            <Image
              source={{ uri: notif.imageUrl }}
              style={{ width: "100%", aspectRatio: 16 / 9, borderRadius: 12 }}
              contentFit="cover"
              transition={150}
              accessibilityIgnoresInvertColors
              accessible={false}
            />
          ) : null}

          {/* ── Isi penuh (daftar hanya memotong 2 baris) ─────────── */}
          <Text variant="body" tone="primary">
            {notif.body}
          </Text>

          {/* ── CTA ke entitas terkait ───────────────────────────── */}
          {relatedRoute && relatedLabel ? (
            <Button variant="secondary" onPress={() => void handleOpenRelated()}>
              {relatedLabel}
            </Button>
          ) : (
            <Text variant="caption" tone="tertiary">
              Notifikasi ini tidak menaut ke halaman lain.
            </Text>
          )}

          {/* ── Item #24: Konfirmasi terima langsung dari notifikasi.
              Hanya tampil bila API mengonfirmasi order bisa dikonfirmasi
              (fail-closed: disembunyikan saat ragu). */}
          {confirmEligible && confirmOrderId ? (
            <View className="gap-2 rounded-lg bg-success-soft p-4">
              <Text variant="body" weight={600} tone="primary">
                Pesanan sudah sampai?
              </Text>
              <Text variant="caption" tone="secondary">
                Konfirmasi penerimaan untuk meneruskan dana ke penjual.
              </Text>
              <Button variant="accent" onPress={() => setConfirmReleaseOpen(true)}>
                Konfirmasi terima
              </Button>
            </View>
          ) : null}
        </View>
      ) : null}

      <Dialog
        title="Konfirmasi terima barang?"
        description="Dana akan diteruskan ke penjual dan tidak bisa dibatalkan. Pastikan barang/jasa sudah Anda terima dan sesuai dengan kesepakatan."
        visible={confirmReleaseOpen}
        loading={confirming}
        confirmLabel="Ya, konfirmasi"
        cancelLabel="Periksa dulu"
        onConfirm={() => {
          setConfirmReleaseOpen(false)
          void handleConfirmReceipt()
        }}
        onCancel={() => setConfirmReleaseOpen(false)}
        onRequestClose={() => setConfirmReleaseOpen(false)}
      />

      <Dialog
        title="Hapus notifikasi?"
        description="Notifikasi ini akan dihapus dari daftar dan tidak bisa dikembalikan."
        visible={confirmDelete}
        destructive
        loading={deleting}
        confirmLabel="Hapus"
        cancelLabel="Batal"
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmDelete(false)}
        onRequestClose={() => setConfirmDelete(false)}
      />
    </DataScreen>
  )
}
