/**
 * Admin — Rating: moderasi penilaian antar pengguna.
 *
 * - Filter: Semua / Disembunyikan (param `flagged` backend).
 * - Tombol sembunyikan/tampilkan kembali per rating: konfirmasi GANDA —
 *   BottomSheet wajib isi alasan (min 5 karakter) lalu dialog Alert.
 *   Backend mewajibkan body `{ reason }` untuk kedua aksi.
 */
import { useCallback, useEffect, useState } from "react"
import { Alert, View } from "react-native"
import { useIsFocused } from "@react-navigation/native"
import { Eye, EyeClosed, Star } from "phosphor-react-native"

import { translate } from "@/lib/i18n/translate"
import { formatDateTimeWIB } from "@/lib/format"
import { userMessage } from "@/lib/api/errors"
import { handleAdminApiError } from "@/lib/admin-session"
import {
  hideRating,
  listRatings,
  unhideRating,
  type AdminRating,
} from "@/lib/api/admin/ratings"

import { Badge } from "@/components/ui/badge"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Chip } from "@/components/ui/chip"
import { DataScreen } from "@/components/ui/data-screen"
import { Input } from "@/components/ui/input"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"

const PAGE_SIZE = 20

function starsLabel(stars?: number | null): string {
  if (typeof stars !== "number" || !Number.isFinite(stars)) return "—"
  return `${stars}/5`
}

function personName(r: AdminRating["giver"]): string {
  return r?.fullName ?? r?.username ?? "—"
}

export default function AdminRatingsScreen() {
  const toast = useToast()
  const isFocused = useIsFocused()

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ratings, setRatings] = useState<AdminRating[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hiddenOnly, setHiddenOnly] = useState(false)

  const [target, setTarget] = useState<AdminRating | null>(null)
  const [action, setAction] = useState<"hide" | "unhide" | null>(null)
  const [reason, setReason] = useState("")
  const [reasonError, setReasonError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (mode === "initial") setLoading(true)
      else setRefreshing(true)
      setError(null)
      try {
        const res = await listRatings({
          page: 1,
          limit: PAGE_SIZE,
          hidden: hiddenOnly || undefined,
        })
        setRatings(res.data)
        setTotal(res.total ?? res.meta?.total ?? res.data.length)
        setPage(1)
      } catch (err) {
        if (!handleAdminApiError(err)) setError(userMessage(err))
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [hiddenOnly],
  )

  useEffect(() => {
    if (isFocused) void load("initial")
  }, [isFocused, load])

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || ratings.length >= total) return
    setLoadingMore(true)
    try {
      const res = await listRatings({
        page: page + 1,
        limit: PAGE_SIZE,
        hidden: hiddenOnly || undefined,
      })
      setRatings((prev) => [...prev, ...res.data])
      setTotal(res.total ?? res.meta?.total ?? total)
      setPage((p) => p + 1)
    } catch (err) {
      toast.show({
        title: translate("Gagal memuat rating"),
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, ratings.length, total, page, hiddenOnly, toast])

  const openAction = useCallback((rating: AdminRating, a: "hide" | "unhide") => {
    setTarget(rating)
    setAction(a)
    setReason("")
    setReasonError(null)
  }, [])

  const closeAction = useCallback(() => {
    if (submitting) return
    setTarget(null)
    setAction(null)
    setReason("")
    setReasonError(null)
  }, [submitting])

  /** Konfirmasi ganda: BottomSheet (alasan) → Alert native. */
  const confirmAction = useCallback(() => {
    if (!target || !action || submitting) return
    const trimmed = reason.trim()
    if (trimmed.length < 5) {
      setReasonError(translate("Alasan minimal 5 karakter."))
      return
    }
    const isHide = action === "hide"
    Alert.alert(
      translate(isHide ? "Sembunyikan rating?" : "Tampilkan kembali rating?"),
      translate(
        isHide
          ? "Rating tidak akan terlihat lagi oleh pengguna, tetapi tercatat di audit log."
          : "Rating akan terlihat kembali oleh pengguna.",
      ),
      [
        { text: translate("Batal"), style: "cancel" },
        {
          text: translate(isHide ? "Ya, sembunyikan" : "Ya, tampilkan"),
          style: isHide ? "destructive" : "default",
          onPress: () =>
            void (async () => {
              setSubmitting(true)
              try {
                if (isHide) await hideRating(target.id, trimmed)
                else await unhideRating(target.id, trimmed)
                toast.show({
                  title: translate(
                    isHide ? "Rating disembunyikan" : "Rating ditampilkan kembali",
                  ),
                  tone: "success",
                })
                closeAction()
                await load("refresh")
              } catch (err) {
                if (!handleAdminApiError(err))
                  toast.show({
                    title: translate("Gagal memproses rating"),
                    description: userMessage(err),
                    tone: "danger",
                  })
              } finally {
                setSubmitting(false)
              }
            })(),
        },
      ],
    )
  }, [target, action, submitting, reason, toast, load, closeAction])

  return (
    <>
      <DataScreen
        title={translate("Rating")}
        state={{
          loading,
          refreshing,
          error,
          refresh: () => load("refresh"),
          reload: () => load("initial"),
        }}
        loadingMessage={translate("Memuat rating…")}
        errorTitle={translate("Gagal memuat rating")}
        empty={
          ratings.length === 0
            ? {
                icon: Star,
                title: translate("Belum ada rating"),
                description: translate(
                  hiddenOnly
                    ? "Tidak ada rating yang disembunyikan."
                    : "Tidak ada rating pada filter ini.",
                ),
                compact: true,
              }
            : undefined
        }
      >
        <View className="gap-4">
          <View className="flex-row gap-2">
            <Chip
              selected={!hiddenOnly}
              onPress={() => setHiddenOnly(false)}
              accessibilityLabel={translate("Filter semua rating")}
            >
              {translate("Semua")}
            </Chip>
            <Chip
              selected={hiddenOnly}
              onPress={() => setHiddenOnly(true)}
              accessibilityLabel={translate("Filter rating disembunyikan")}
            >
              {translate("Disembunyikan")}
            </Chip>
          </View>
          {ratings.length > 0 ? (
            <View className="gap-2">
              {ratings.map((r) => (
                <Card key={r.id} padded={false} className="px-4 py-3">
                  <View className="flex-row items-start justify-between gap-2">
                    <View className="flex-1">
                      <Text variant="body" weight={600}>
                        {personName(r.giver)} → {personName(r.receiver)}
                      </Text>
                      {r.comment ? (
                        <Text variant="body" tone="secondary" className="mt-1" numberOfLines={3}>
                          {r.comment}
                        </Text>
                      ) : null}
                      <Text variant="caption" tone="secondary" className="mt-1">
                        {[r.order?.orderId, formatDateTimeWIB(r.createdAt ?? "")]
                          .filter(Boolean)
                          .join(" • ")}
                      </Text>
                    </View>
                    <View className="items-end gap-1">
                      <Badge tone={r.isHidden ? "danger" : "neutral"}>
                        {starsLabel(r.stars)}
                      </Badge>
                      {r.isHidden ? (
                        <Badge tone="danger">{translate("Disembunyikan")}</Badge>
                      ) : null}
                    </View>
                  </View>
                  <View className="flex-row gap-2 mt-3">
                    {r.isHidden ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1"
                        onPress={() => openAction(r, "unhide")}
                        accessibilityLabel={translate("Tampilkan kembali rating ini")}
                      >
                        <View className="flex-row items-center gap-1.5">
                          <Eye size={16} />
                          <Text variant="body" weight={600}>
                            {translate("Tampilkan")}
                          </Text>
                        </View>
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex-1"
                        onPress={() => openAction(r, "hide")}
                        accessibilityLabel={translate("Sembunyikan rating ini")}
                      >
                        <View className="flex-row items-center gap-1.5">
                          <EyeClosed size={16} />
                          <Text variant="body" weight={600}>
                            {translate("Sembunyikan")}
                          </Text>
                        </View>
                      </Button>
                    )}
                  </View>
                </Card>
              ))}
              {ratings.length < total ? (
                <Button
                  variant="secondary"
                  loading={loadingMore}
                  onPress={() => void handleLoadMore()}
                >
                  {translate("Muat lebih banyak")}
                </Button>
              ) : null}
            </View>
          ) : null}
        </View>
      </DataScreen>

      <BottomSheet
        visible={target != null}
        onRequestClose={closeAction}
        title={translate(action === "hide" ? "Sembunyikan rating" : "Tampilkan rating")}
        description={target ? translate("{x} → {y}", { x: personName(target.giver), y: personName(target.receiver) }) : undefined}
        footer={
          <View className="flex-row gap-2">
            <Button
              variant="secondary"
              className="flex-1"
              disabled={submitting}
              onPress={closeAction}
            >
              {translate("Batal")}
            </Button>
            <Button
              variant={action === "hide" ? "destructive" : "primary"}
              className="flex-1"
              loading={submitting}
              onPress={confirmAction}
            >
              {translate("Lanjut")}
            </Button>
          </View>
        }
      >
        <View className="gap-2">
          <Text variant="body" tone="secondary">
            {translate(
              "Tulis alasan moderasi. Alasan wajib diisi dan tercatat di audit log.",
            )}
          </Text>
          <Input
            label={translate("Alasan")}
            required
            multiline
            numberOfLines={3}
            value={reason}
            onChangeText={(v) => {
              setReason(v)
              if (reasonError) setReasonError(null)
            }}
            errorText={reasonError ?? undefined}
            placeholder={translate("Contoh: komentar mengandung kata kasar…")}
            accessibilityLabel={translate("Alasan moderasi rating")}
          />
          <Text variant="caption" tone="secondary">
            {translate("Setelah lanjut, akan ada dialog konfirmasi kedua.")}
          </Text>
        </View>
      </BottomSheet>
    </>
  )
}
