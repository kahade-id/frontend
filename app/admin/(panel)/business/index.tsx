/**
 * Admin — Antrean verifikasi bisnis: daftar pengajuan badan usaha.
 *
 * - Filter status (Semua/Menunggu/Disetujui/Ditolak/Dicabut) via chip.
 * - Tap baris → detail di business/[id].
 * - Pull-to-refresh + tombol "Muat lebih banyak" (paginasi).
 */
import { Briefcase } from "phosphor-react-native"
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { Stack, router } from "expo-router"
import { useIsFocused } from "@react-navigation/native"

import { translate } from "@/lib/i18n/translate"
import { formatDateTimeWIB } from "@/lib/format"
import { userMessage } from "@/lib/api/errors"
import { handleAdminApiError } from "@/lib/admin-session"
import {
  getBusinessQueue,
  type BusinessVerificationItem,
  type BusinessVerificationStatus,
} from "@/lib/api/admin/business"

import { Badge, type BadgeTone } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"
import { DataScreen } from "@/components/ui/data-screen"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"

const PAGE_SIZE = 20

const FILTERS: Array<{ value?: BusinessVerificationStatus; label: string }> = [
  { label: "Semua" },
  { value: "PENDING", label: "Menunggu" },
  { value: "APPROVED", label: "Disetujui" },
  { value: "REJECTED", label: "Ditolak" },
  { value: "REVOKED", label: "Dicabut" },
]

const STATUS_TONE: Record<BusinessVerificationStatus, BadgeTone> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  REVOKED: "neutral",
}

const STATUS_LABEL: Record<BusinessVerificationStatus, string> = {
  PENDING: "Menunggu",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  REVOKED: "Dicabut",
}

function verificationIdOf(item: BusinessVerificationItem): string {
  return item.verificationId ?? item.id
}

export default function AdminBusinessQueueScreen() {
  const toast = useToast()
  const isFocused = useIsFocused()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<BusinessVerificationItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)
  const [status, setStatus] = useState<BusinessVerificationStatus | undefined>(
    undefined,
  )

  const load = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (mode === "initial") setLoading(true)
      else setRefreshing(true)
      setError(null)
      try {
        const res = await getBusinessQueue({
          page: 1,
          limit: PAGE_SIZE,
          status,
        })
        setItems(res.data)
        setTotal(res.total ?? res.meta?.total ?? res.data.length)
        setPage(1)
      } catch (e) {
        if (!handleAdminApiError(e)) setError(userMessage(e))
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [status],
  )

  useEffect(() => {
    if (isFocused) void load("initial")
  }, [isFocused, load])

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || items.length >= total) return
    setLoadingMore(true)
    try {
      const res = await getBusinessQueue({
        page: page + 1,
        limit: PAGE_SIZE,
        status,
      })
      setItems((prev) => [...prev, ...res.data])
      setTotal(res.total ?? res.meta?.total ?? total)
      setPage((p) => p + 1)
    } catch (e) {
      if (!handleAdminApiError(e)) {
        toast.show({
          title: translate("Gagal memuat data"),
          description: userMessage(e),
          tone: "danger",
        })
      }
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, items.length, total, page, status, toast])

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <DataScreen
        title={translate("Verifikasi Bisnis")}
        state={{
          loading,
          refreshing,
          error,
          refresh: () => load("refresh"),
          reload: () => load("initial"),
        }}
        loadingMessage={translate("Memuat antrean verifikasi bisnis…")}
        errorTitle={translate("Gagal memuat antrean verifikasi bisnis")}
        empty={
          items.length === 0 && {
            icon: Briefcase,
            title: translate("Belum ada data"),
            description: translate(
              "Tidak ada pengajuan verifikasi bisnis pada filter ini.",
            ),
          }
        }
        above={
          <View className="flex-row flex-wrap gap-2">
            {FILTERS.map((f) => (
              <Chip
                key={f.label}
                selected={status === f.value}
                onPress={() => setStatus(f.value)}
                accessibilityLabel={translate("Filter {x}", {
                  x: f.label,
                })}
              >
                {translate(f.label)}
              </Chip>
            ))}
          </View>
        }
      >
        <View className="gap-2 pb-8">
          {items.map((item) => {
            const title =
              item.businessName ??
              item.user?.fullName ??
              item.user?.email ??
              "—"
            return (
              <Card
                key={verificationIdOf(item)}
                padded={false}
                className="px-4 py-3"
                onPress={() =>
                  router.push(`/admin/business/${verificationIdOf(item)}`)
                }
                accessibilityLabel={translate("Buka detail verifikasi {x}", {
                  x: title,
                })}
              >
                <View className="flex-row items-start justify-between gap-2">
                  <View className="flex-1">
                    <Text variant="body" weight={600} numberOfLines={1}>
                      {title}
                    </Text>
                    {item.user?.email ? (
                      <Text
                        variant="caption"
                        tone="secondary"
                        className="mt-0.5"
                        numberOfLines={1}
                      >
                        {item.user.email}
                      </Text>
                    ) : null}
                    <Text variant="caption" tone="secondary" className="mt-0.5">
                      {formatDateTimeWIB(item.createdAt)}
                    </Text>
                  </View>
                  <Badge tone={STATUS_TONE[item.status]}>
                    {translate(STATUS_LABEL[item.status])}
                  </Badge>
                </View>
              </Card>
            )
          })}
          {items.length < total ? (
            <Button
              variant="secondary"
              loading={loadingMore}
              onPress={() => void handleLoadMore()}
              accessibilityLabel={translate(
                "Muat lebih banyak pengajuan verifikasi bisnis",
              )}
              className="mt-1"
            >
              {translate("Muat lebih banyak")}
            </Button>
          ) : null}
        </View>
      </DataScreen>
    </>
  )
}
