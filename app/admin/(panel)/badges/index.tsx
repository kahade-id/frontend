/**
 * Admin — Badge & Centang Emas.
 *
 * - Daftar badge (listBadges): nama, deskripsi, jumlah pemegang.
 * - Ketuk badge → BottomSheet detail (getBadgeDetail): daftar pemegang
 *   (BadgeHolder) dengan tombol "Cabut" per pemegang (revokeBadge), tombol
 *   "Beri ke pengguna" (Input ID pengguna → awardBadge), dan tombol hapus
 *   badge (deleteBadge, dengan konfirmasi).
 * - Tombol "Buat badge" → BottomSheet form (nama, deskripsi, iconUrl
 *   opsional) → createBadge.
 *
 * Badge tier gold = centang EMAS eksklusif: pemegang badge tier gold tampil
 * dengan centang emas di aplikasi pengguna. Penjelasan ini ditampilkan di
 * bagian atas layar.
 *
 * Kontrak API dikunci di lib/api/admin/badges.ts — layar ini hanya memakai
 * fungsi yang sudah ada, tanpa mengubahnya.
 */
import { useCallback, useMemo, useState } from "react"
import { Alert, View } from "react-native"
import { Medal, SealCheck } from "phosphor-react-native"

import { translate } from "@/lib/i18n/translate"
import { userMessage } from "@/lib/api/errors"
import { handleAdminApiError } from "@/lib/admin-session"
import { formatDateTimeWIB } from "@/lib/format"
import { usePaginatedQuery } from "@/lib/use-paginated-query"
import {
  awardBadge,
  createBadge,
  deleteBadge,
  getBadgeDetail,
  listBadges,
  revokeBadge,
  type AdminBadge,
  type BadgeHolder,
} from "@/lib/api/admin/badges"

import { Badge, type BadgeTone } from "@/components/ui/badge"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { Input } from "@/components/ui/input"
import { PaginatedList } from "@/components/ui/paginated-list"
import { Screen } from "@/components/ui/screen"
import { Section } from "@/components/ui/section"
import { Spinner } from "@/components/ui/spinner"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"
import { useToast } from "@/components/ui/toast"

const PAGE_LIMIT = 20

const TIER_LABEL: Record<string, string> = {
  gold: "Gold — centang emas",
  blue: "Biru",
  gray: "Abu-abu",
}

const TIER_TONE: Record<string, BadgeTone> = {
  gold: "warning",
  blue: "info",
  gray: "neutral",
}

function tierLabel(tier: unknown): string {
  const raw = String(tier ?? "").toLowerCase()
  return translate(TIER_LABEL[raw] ?? (raw ? raw : "—"))
}

function BadgeCard({
  badge,
  onPress,
}: {
  badge: AdminBadge
  onPress: () => void
}) {
  return (
    <Card
      onPress={onPress}
      accessibilityLabel={translate("Buka detail badge {x}", {
        x: badge.name,
      })}
    >
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text variant="body" weight={600} numberOfLines={1}>
            {badge.name}
          </Text>
          {badge.description ? (
            <Text variant="caption" tone="secondary" numberOfLines={2} className="mt-0.5">
              {badge.description}
            </Text>
          ) : null}
          <Text variant="caption" tone="tertiary" className="mt-1">
            {translate("{x} pemegang", {
              x: String(badge.holderCount ?? 0),
            })}
          </Text>
        </View>
        <Badge tone={TIER_TONE[String(badge.tier ?? "").toLowerCase()] ?? "neutral"}>
          {tierLabel(badge.tier)}
        </Badge>
      </View>
    </Card>
  )
}

function HolderRow({
  holder,
  revoking,
  onRevoke,
}: {
  holder: BadgeHolder
  revoking: boolean
  onRevoke: () => void
}) {
  const displayName =
    holder.fullName?.trim() ||
    (holder.username ? `@${holder.username}` : null) ||
    holder.userId.slice(0, 12)
  return (
    <View className="flex-row items-center justify-between gap-2 rounded-xl border border-border bg-surface p-3">
      <View className="flex-1">
        <Text variant="body" weight={600} numberOfLines={1}>
          {displayName}
        </Text>
        <Text variant="caption" tone="tertiary" numberOfLines={1}>
          {translate("Diberi {x}", { x: formatDateTimeWIB(holder.awardedAt) })}
        </Text>
      </View>
      <Button
        variant="secondary"
        size="sm"
        onPress={onRevoke}
        loading={revoking}
        accessibilityLabel={translate("Cabut badge dari {x}", {
          x: displayName,
        })}
      >
        {translate("Cabut")}
      </Button>
    </View>
  )
}

export default function AdminBadgesScreen() {
  const toast = useToast()

  const badges = usePaginatedQuery<AdminBadge>(
    "admin-badges",
    (page) =>
      listBadges({ page, limit: PAGE_LIMIT }).then((res) => ({
        data: res.data,
        meta: {
          page,
          limit: PAGE_LIMIT,
          total: res.total ?? res.data.length,
          totalPages: res.meta?.totalPages ?? 1,
        },
      })),
    { refreshOnFocus: true },
  )

  const [detail, setDetail] = useState<
    (AdminBadge & { holders?: BadgeHolder[] }) | null
  >(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [selectedBadgeId, setSelectedBadgeId] = useState<string | null>(null)

  const [awardUserId, setAwardUserId] = useState("")
  const [awardUserError, setAwardUserError] = useState<string | null>(null)
  const [awarding, setAwarding] = useState(false)

  const [revokingUserId, setRevokingUserId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState("")
  const [createNameError, setCreateNameError] = useState<string | null>(null)
  const [createDescription, setCreateDescription] = useState("")
  const [createIconUrl, setCreateIconUrl] = useState("")
  const [creating, setCreating] = useState(false)

  const loadDetail = useCallback(async (badgeId: string) => {
    setDetailLoading(true)
    setDetailError(null)
    try {
      setDetail(await getBadgeDetail(badgeId))
    } catch (err) {
      if (!handleAdminApiError(err)) setDetailError(userMessage(err))
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const openDetail = useCallback(
    (badge: AdminBadge) => {
      setDetail(null)
      setDetailOpen(true)
      setSelectedBadgeId(badge.id)
      setAwardUserId("")
      setAwardUserError(null)
      void loadDetail(badge.id)
    },
    [loadDetail],
  )

  const closeDetail = useCallback(() => {
    if (awarding || revokingUserId !== null || deleting) return
    setDetailOpen(false)
  }, [awarding, revokingUserId, deleting])

  const handleAward = useCallback(async () => {
    if (!detail || awarding) return
    const userId = awardUserId.trim()
    if (!userId) {
      setAwardUserError(translate("ID pengguna wajib diisi."))
      return
    }
    setAwardUserError(null)
    setAwarding(true)
    try {
      await awardBadge(detail.id, userId)
      toast.show({ title: translate("Badge diberikan"), tone: "success" })
      setAwardUserId("")
      await loadDetail(detail.id)
      await badges.refresh()
    } catch (err) {
      if (!handleAdminApiError(err)) {
        toast.show({
          title: translate("Gagal memberi badge"),
          description: userMessage(err),
          tone: "danger",
        })
      }
    } finally {
      setAwarding(false)
    }
  }, [detail, awarding, awardUserId, toast, loadDetail, badges])

  const handleRevoke = useCallback(
    (holder: BadgeHolder) => {
      if (!detail || revokingUserId !== null) return
      const displayName =
        holder.fullName?.trim() ||
        (holder.username ? `@${holder.username}` : null) ||
        holder.userId
      Alert.alert(
        translate("Cabut badge?"),
        translate("Badge akan dicabut dari {x}.", { x: displayName }),
        [
          { text: translate("Batal"), style: "cancel" },
          {
            text: translate("Cabut"),
            style: "destructive",
            onPress: () => {
              setRevokingUserId(holder.userId)
              revokeBadge(detail.id, holder.userId)
                .then(async () => {
                  toast.show({
                    title: translate("Badge dicabut"),
                    tone: "success",
                  })
                  await loadDetail(detail.id)
                  await badges.refresh()
                })
                .catch((err: unknown) => {
                  if (!handleAdminApiError(err)) {
                    toast.show({
                      title: translate("Gagal mencabut badge"),
                      description: userMessage(err),
                      tone: "danger",
                    })
                  }
                })
                .finally(() => setRevokingUserId(null))
            },
          },
        ],
      )
    },
    [detail, revokingUserId, toast, loadDetail, badges],
  )

  const handleDelete = useCallback(() => {
    if (!detail || deleting) return
    Alert.alert(
      translate("Hapus badge?"),
      translate(
        "Badge “{x}” akan dihapus permanen dan tidak bisa dikembalikan.",
        { x: detail.name },
      ),
      [
        { text: translate("Batal"), style: "cancel" },
        {
          text: translate("Hapus"),
          style: "destructive",
          onPress: () => {
            setDeleting(true)
            deleteBadge(detail.id)
              .then(async () => {
                toast.show({
                  title: translate("Badge dihapus"),
                  tone: "success",
                })
                setDetailOpen(false)
                await badges.reload()
              })
              .catch((err: unknown) => {
                if (!handleAdminApiError(err)) {
                  toast.show({
                    title: translate("Gagal menghapus badge"),
                    description: userMessage(err),
                    tone: "danger",
                  })
                }
              })
              .finally(() => setDeleting(false))
          },
        },
      ],
    )
  }, [detail, deleting, toast, badges])

  const handleCreate = useCallback(async () => {
    if (creating) return
    const name = createName.trim()
    if (!name) {
      setCreateNameError(translate("Nama badge wajib diisi."))
      return
    }
    setCreateNameError(null)
    setCreating(true)
    try {
      await createBadge({
        name,
        description: createDescription.trim() || undefined,
        iconUrl: createIconUrl.trim() || undefined,
      })
      toast.show({ title: translate("Badge dibuat"), tone: "success" })
      setCreateOpen(false)
      setCreateName("")
      setCreateDescription("")
      setCreateIconUrl("")
      await badges.reload()
    } catch (err) {
      if (!handleAdminApiError(err)) {
        toast.show({
          title: translate("Gagal membuat badge"),
          description: userMessage(err),
          tone: "danger",
        })
      }
    } finally {
      setCreating(false)
    }
  }, [creating, createName, createDescription, createIconUrl, toast, badges])

  const listHeader = useMemo(
    () => (
      <View className="gap-4">
        <Card>
          <View className="flex-row gap-3">
            <SealCheck size={28} weight="fill" color="#B8860B" />
            <View className="flex-1">
              <Text variant="body" weight={600}>
                {translate("Centang emas eksklusif")}
              </Text>
              <Text variant="caption" tone="secondary" className="mt-1">
                {translate(
                  "Memberi badge tier gold ke pengguna akan menampilkan centang emas di profil aplikasi mereka. Berikan hanya untuk akun terverifikasi atau mitra resmi.",
                )}
              </Text>
            </View>
          </View>
        </Card>
        <Button
          onPress={() => setCreateOpen(true)}
          accessibilityLabel={translate("Buat badge baru")}
        >
          {translate("Buat badge")}
        </Button>
      </View>
    ),
    [],
  )

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title={translate("Badge & Centang Emas")} />
      <View className="flex-1 px-5 pt-3">
        <PaginatedList
          data={badges.data}
          renderItem={({ item }) => (
            <BadgeCard badge={item} onPress={() => openDetail(item)} />
          )}
          loading={badges.loading}
          error={badges.error}
          loadMoreError={badges.loadMoreError}
          refreshing={badges.refreshing}
          loadingMore={badges.loadingMore}
          hasMore={badges.hasMore}
          onRefresh={badges.refresh}
          onRetry={badges.reload}
          onLoadMore={badges.loadMore}
          header={listHeader}
          gap={12}
          empty={
            <EmptyState
              icon={Medal}
              title={translate("Belum ada badge")}
              description={translate(
                "Buat badge pertama untuk mulai memberi penghargaan ke pengguna.",
              )}
            />
          }
        />
      </View>

      {/* BottomSheet detail badge: pemegang + award + hapus */}
      <BottomSheet
        visible={detailOpen}
        onRequestClose={closeDetail}
        title={translate("Detail badge")}
        avoidKeyboard
      >
        {detailLoading ? (
          <View className="items-center py-8">
            <Spinner accessibilityLabel={translate("Memuat detail badge")} />
          </View>
        ) : detail ? (
          <View className="gap-4">
            <View className="flex-row items-start justify-between gap-2">
              <View className="flex-1">
                <Text variant="bodyLarge" weight={600}>
                  {detail.name}
                </Text>
                {detail.description ? (
                  <Text variant="caption" tone="secondary" className="mt-0.5">
                    {detail.description}
                  </Text>
                ) : null}
              </View>
              <Badge tone={TIER_TONE[String(detail.tier ?? "").toLowerCase()] ?? "neutral"}>
                {tierLabel(detail.tier)}
              </Badge>
            </View>

            <Section title={translate("Beri ke pengguna")}>
              <Input
                label={translate("ID pengguna")}
                placeholder={translate("cth. 550e8400-…")}
                helperText={translate("ID pengguna (bukan username).")}
                value={awardUserId}
                onChangeText={(text) => {
                  setAwardUserId(text)
                  if (awardUserError) setAwardUserError(null)
                }}
                errorText={awardUserError ?? undefined}
                autoCapitalize="none"
                accessibilityLabel={translate("ID pengguna penerima badge")}
              />
              <Button
                className="mt-3"
                onPress={handleAward}
                loading={awarding}
                accessibilityLabel={translate("Beri badge ke pengguna")}
              >
                {translate("Beri badge")}
              </Button>
            </Section>

            <Section
              title={translate("Pemegang")}
              subtitle={
                detail.holders && detail.holders.length > 0
                  ? translate("{x} pemegang", {
                      x: String(detail.holders.length),
                    })
                  : undefined
              }
            >
              {detail.holders && detail.holders.length > 0 ? (
                <View className="gap-2">
                  {detail.holders.map((holder) => (
                    <HolderRow
                      key={holder.userId}
                      holder={holder}
                      revoking={revokingUserId === holder.userId}
                      onRevoke={() => handleRevoke(holder)}
                    />
                  ))}
                </View>
              ) : (
                <Text variant="caption" tone="secondary">
                  {translate("Belum ada pemegang badge ini.")}
                </Text>
              )}
            </Section>

            <Button
              variant="destructive"
              onPress={handleDelete}
              loading={deleting}
              accessibilityLabel={translate("Hapus badge {x}", {
                x: detail.name,
              })}
            >
              {translate("Hapus badge")}
            </Button>
          </View>
        ) : detailError ? (
          <ErrorState
            title={translate("Gagal memuat detail badge")}
            description={detailError}
            onRetry={() => selectedBadgeId && void loadDetail(selectedBadgeId)}
            compact
          />
        ) : null}
      </BottomSheet>

      {/* BottomSheet buat badge */}
      <BottomSheet
        visible={createOpen}
        onRequestClose={() => {
          if (!creating) setCreateOpen(false)
        }}
        title={translate("Buat badge baru")}
        avoidKeyboard
      >
        <View className="gap-4">
          <Input
            label={translate("Nama badge")}
            placeholder={translate("cth. Mitra Terverifikasi")}
            value={createName}
            onChangeText={(text) => {
              setCreateName(text)
              if (createNameError) setCreateNameError(null)
            }}
            errorText={createNameError ?? undefined}
            required
            accessibilityLabel={translate("Nama badge")}
          />
          <TextArea
            label={translate("Deskripsi")}
            placeholder={translate("Deskripsi badge (opsional)…")}
            value={createDescription}
            onChangeText={setCreateDescription}
            accessibilityLabel={translate("Deskripsi badge")}
          />
          <Input
            label={translate("URL ikon")}
            placeholder={translate("https://… (opsional)")}
            value={createIconUrl}
            onChangeText={setCreateIconUrl}
            autoCapitalize="none"
            keyboardType="url"
            accessibilityLabel={translate("URL ikon badge")}
          />
          <Button
            onPress={handleCreate}
            loading={creating}
            accessibilityLabel={translate("Simpan badge baru")}
          >
            {translate("Simpan")}
          </Button>
        </View>
      </BottomSheet>
    </Screen>
  )
}
