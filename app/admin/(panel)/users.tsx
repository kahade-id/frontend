/**
 * Layar admin — Daftar Pengguna (GET /v1/admin/users).
 *
 * Pencarian (debounce), filter status, pull-to-refresh, paginasi "muat lagi",
 * ketuk kartu → detail pengguna.
 */
import { useMemo, useState } from "react"
import { View } from "react-native"
import type { Href } from "expo-router"
import { Users } from "phosphor-react-native"

import { listAdminUsers, type AdminUserSummary } from "@/lib/api/admin/users"
import { formatDate } from "@/lib/format"
import { translate } from "@/lib/i18n/translate"
import { tokens } from "@/lib/tokens"
import { useDebouncedValue } from "@/lib/use-debounced-value"
import { usePaginatedQuery } from "@/lib/use-paginated-query"

import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { Input } from "@/components/ui/input"
import { PaginatedList } from "@/components/ui/paginated-list"
import { Screen } from "@/components/ui/screen"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { Skeleton } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"
import { useSafeAreaInsets } from "react-native-safe-area-context"

const PAGE_LIMIT = 20

type StatusFilter = "all" | "active" | "banned"

const FILTER_ITEMS = [
  { value: "all", label: "Semua" },
  { value: "active", label: "Aktif" },
  { value: "banned", label: "Diblokir" },
] as const

function adminUserDetailHref(userId: string): Href {
  // typedRoutes aktif: pola yang sama dipakai ROUTES.disputeDetail.
  return { pathname: "/admin/(panel)/users/[id]", params: { id: userId } } as unknown as Href
}

function StatusBadge({ user }: { user: AdminUserSummary }) {
  if (user.isBanned) {
    return <Badge tone="danger">{translate("Diblokir")}</Badge>
  }
  return (
    <View className="flex-row items-center gap-1.5">
      <Badge tone="success">{translate("Aktif")}</Badge>
      {user.flaggedForReview ? (
        <Badge tone="warning">{translate("Flag review")}</Badge>
      ) : null}
    </View>
  )
}

function UserCard({ user }: { user: AdminUserSummary }) {
  const displayName = user.fullName?.trim() || translate("Tanpa nama")
  const href = useMemo(() => adminUserDetailHref(user.id), [user.id])
  return (
    <Card
      href={href}
      className="mb-3"
      accessibilityLabel={translate("Buka detail {x}", { x: displayName })}
    >
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text variant="bodyLarge" weight={600} numberOfLines={1}>
            {displayName}
          </Text>
          {user.username ? (
            <Text variant="body" tone="secondary" numberOfLines={1}>
              @{user.username}
            </Text>
          ) : null}
          <Text variant="caption" tone="tertiary" numberOfLines={1}>
            {translate("Terdaftar {x}", { x: formatDate(user.createdAt) })}
          </Text>
        </View>
        <StatusBadge user={user} />
      </View>
    </Card>
  )
}

function UserCardSkeleton() {
  return (
    <View className="mb-3 rounded-2xl border border-border bg-surface p-5">
      <Skeleton className="h-5 w-2/3 rounded" />
      <View className="h-2" />
      <Skeleton className="h-4 w-1/3 rounded" />
    </View>
  )
}

export default function AdminUsersScreen() {
  const insets = useSafeAreaInsets()
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<StatusFilter>("all")
  const debouncedQuery = useDebouncedValue(query, 400)

  const list = usePaginatedQuery<AdminUserSummary>(
    `admin-users|${debouncedQuery}|${filter}`,
    (page, _signal) =>
      listAdminUsers({
        q: debouncedQuery || undefined,
        status: filter === "all" ? undefined : filter,
        page,
        limit: PAGE_LIMIT,
      }).then((res) => ({
        data: res.data,
        meta: {
          page: res.page ?? page,
          limit: res.limit ?? PAGE_LIMIT,
          total: res.total,
          totalPages: res.totalPages ?? 1,
        },
      })),
    { refreshOnFocus: true },
  )

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title={translate("Pengguna")} />
      <View className="px-5 pt-2" style={{ gap: tokens.space[3] }}>
        <Input
          variant="search"
          placeholder={translate("Cari nama, email, username, HP…")}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          accessibilityLabel={translate("Cari pengguna")}
        />
        <SegmentedControl<StatusFilter>
          items={FILTER_ITEMS.map((item) => ({
            value: item.value,
            label: translate(item.label),
          }))}
          value={filter}
          onChange={setFilter}
          accessibilityLabel={translate("Filter status pengguna")}
        />
      </View>
      <View className="flex-1 pt-3">
        {list.loading && list.data.length === 0 ? (
          <View className="px-5 pt-1" accessibilityRole="progressbar">
            {[0, 1, 2, 3].map((i) => (
              <UserCardSkeleton key={i} />
            ))}
          </View>
        ) : list.error && list.data.length === 0 ? (
          <View className="flex-1 px-5">
            <ErrorState
              title={translate("Gagal memuat pengguna")}
              description={list.error}
              onRetry={list.reload}
              retrying={list.loading}
            />
          </View>
        ) : (
          <PaginatedList
            data={list.data}
            loading={list.loading}
            refreshing={list.refreshing}
            loadingMore={list.loadingMore}
            error={null}
            loadMoreError={list.loadMoreError}
            hasMore={list.hasMore}
            onRefresh={list.refresh}
            onRetry={list.reload}
            onLoadMore={list.loadMore}
            bottomPadding={insets.bottom + tokens.space[8]}
            renderItem={({ item }) => <UserCard user={item} />}
            empty={
              <EmptyState
                icon={Users}
                title={translate("Tidak ada pengguna")}
                description={
                  debouncedQuery
                    ? translate("Tidak ditemukan untuk “{x}”.", { x: debouncedQuery })
                    : translate("Belum ada pengguna pada filter ini.")
                }
              />
            }
          />
        )}
      </View>
    </Screen>
  )
}
