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
import { useEffect, useRef, useState } from "react"
import { View } from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import { Bell, Trash } from "phosphor-react-native"

import { api, userMessage, type AppNotification } from "@/lib/api"
import { formatDateTime } from "@/lib/format"
import { ROUTES } from "@/lib/routes"
import {
  labelForNotificationReference,
  routeForNotificationReference,
} from "@/lib/notification-routing"
import {
  notificationCategoryLabel,
  notificationUiCategory,
} from "@/lib/notification-category"
import { refreshUnreadCount } from "@/lib/unread-count"
import { useApiQuery } from "@/lib/use-api-query"

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
  const markedRead = useRef<string | null>(null)
  useEffect(() => {
    if (!notif || notif.isRead || markedRead.current === notif.id) return
    markedRead.current = notif.id
    api.notifications
      .markNotificationRead(notif.id)
      .then(() => refreshUnreadCount())
      .catch(() => {
        markedRead.current = null
      })
  }, [notif])

  const relatedRoute = notif ? routeForNotificationReference(notif) : null
  const relatedLabel = notif ? labelForNotificationReference(notif) : null

  const handleDelete = async () => {
    if (!notif || deleting) return
    setDeleting(true)
    try {
      await api.notifications.deleteNotification(notif.id)
      void refreshUnreadCount()
      toast.show({ title: "Notifikasi dihapus", tone: "success", duration: 2500 })
      if (router.canGoBack()) router.back()
      else router.replace(ROUTES.notifications)
    } catch (err: unknown) {
      toast.show({
        title: "Notifikasi belum dapat dihapus",
        description: userMessage(err),
        tone: "danger",
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

  const uiCategory = notificationUiCategory(notif?.category)

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
                  accessibilityLabel="Hapus notifikasi"
                  onPress={() => setConfirmDelete(true)}
                />
              ),
            }
          : undefined
      }
      state={query}
      loadingMessage="Memuat notifikasi"
      errorTitle="Gagal memuat notifikasi"
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
              {!notif.isRead ? (
                <Badge tone="info" variant="soft">
                  Baru
                </Badge>
              ) : null}
            </View>
            <Text variant="h2">{notif.title}</Text>
          </View>

          {/* ── Isi penuh (daftar hanya memotong 2 baris) ─────────── */}
          <Text variant="body" tone="primary">
            {notif.body}
          </Text>

          {/* ── CTA ke entitas terkait ───────────────────────────── */}
          {relatedRoute && relatedLabel ? (
            <Button variant="secondary" onPress={() => router.push(relatedRoute)}>
              {relatedLabel}
            </Button>
          ) : (
            <Text variant="caption" tone="tertiary">
              Notifikasi ini tidak menaut ke halaman lain.
            </Text>
          )}
        </View>
      ) : null}

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
