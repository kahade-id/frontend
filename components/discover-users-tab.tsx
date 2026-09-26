/**
 * Kahade — <UsersTab> tab "Pengguna" layar Jelajahi (ekstrak G-11 dari
 * app/(tabs)/discover.tsx, revisi 2026-09-23).
 *
 * Daftar rekomendasi pengguna (GET /v1/users/discover, offset-based) dengan
 * tombol ikuti optimistis. Dipisah dari ShowcaseFeedTab (cursor-based) agar
 * tiap tab memiliki satu tujuan dan satu file — feed showcase untuk
 * karya/percakapan, tab ini untuk menemukan akun.
 *
 * Keputusan non-obvious (disalin dari discover.tsx):
 *   - B-02 (audit): tab ini terbuka bagi tamu web, sedangkan endpoint-nya
 *     auth-required — tanpa gate token tamu memanen 401 → refresh →
 *     potensi expireSession. Empty state tamu menjelaskan keadaannya.
 *   - C-08 (audit): sengaja TANPA `compare` — daftar ini PERINGKAT
 *     rekomendasi server, bukan kronologi; mengurutkan ulang di klien
 *     merusak urutan yang dimaksudkan backend.
 *   - Ikuti optimistis: state lokal dibalik dulu, dipulihkan bila server
 *     menolak (toast galat), `pendingId` mencegah double-tap.
 */
import { useCallback, useState } from "react"
import { View } from "react-native"
import { router } from "expo-router"
import { Compass, LockKey } from "phosphor-react-native"

import { api, userMessage } from "@/lib/api"
import type { DiscoveredUser } from "@/lib/api/users"
import { useHasSession } from "@/lib/guest-gate"
import { translate } from "@/lib/i18n/translate"
import { ROUTES } from "@/lib/routes"
import { usePaginatedQuery } from "@/lib/use-paginated-query"

import { Button } from "@/components/ui/button"
import { Chip } from "@/components/ui/chip"
import { EmptyState } from "@/components/ui/empty-state"
import { PaginatedList } from "@/components/ui/paginated-list"
import { UserDiscoverResultItem } from "@/components/ui/user-discover-result-item"
import { useToast } from "@/components/ui/toast"

const PAGE_LIMIT = 20

export function UsersTab({ bottomPadding }: { bottomPadding: number }) {
  const toast = useToast()
  const hasSession = useHasSession()
  // DC-013: filter rating minimum (backend minRating). Satu chip agar tidak
  // berlebihan; mengubah key → usePaginatedQuery refetch dari halaman 1.
  const [minRating, setMinRating] = useState<number | undefined>(undefined)
  const query = usePaginatedQuery<DiscoveredUser>(
    `discover:${minRating ?? "all"}`,
    (page, signal) =>
      api.users.discoverUsers({ page, limit: PAGE_LIMIT, minRating }, signal),
    { enabled: hasSession },
  )
  const { setData } = query
  const [pendingId, setPendingId] = useState<string | null>(null)

  const handleFollowToggle = useCallback(
    async (user: DiscoveredUser, following: boolean) => {
      setPendingId(user.id)
      const apply = (value: boolean) =>
        setData((prev) => prev.map((u) => (u.id === user.id ? { ...u, following: value } : u)))
      apply(following)
      try {
        if (following) await api.users.followUser(user.username)
        else await api.users.unfollowUser(user.username)
      } catch (err) {
        apply(!following)
        toast.show({
          title: "Gagal memperbarui status ikuti",
          description: userMessage(err),
          tone: "danger",
        })
      } finally {
        setPendingId(null)
      }
    },
    [setData, toast.show],
  )

  return (
    <View className="flex-1">
      {/* DC-013: filter rating minimum — chip toggle. */}
      <View className="flex-row gap-2 px-5 pb-2">
        <Chip
          selected={minRating === 4}
          accessibilityState={{ selected: minRating === 4 }}
          accessibilityLabel="Hanya tampilkan pengguna rating 4 ke atas"
          onPress={() => setMinRating((v) => (v === 4 ? undefined : 4))}
        >
          {translate("Rating 4+")}
        </Chip>
      </View>
    <PaginatedList
      {...query}
      onRefresh={query.refresh}
      onRetry={query.reload}
      onLoadMore={query.loadMore}
      gap={0}
      bottomPadding={bottomPadding}
      empty={
        hasSession ? (
          <EmptyState
            icon={Compass}
            title="Belum ada rekomendasi"
            description="Pengguna yang disarankan untuk Anda akan muncul di sini."
          />
        ) : (
          <EmptyState
            icon={LockKey}
            title="Masuk untuk menemukan pengguna"
            description="Rekomendasi pengguna disusun dari riwayat transaksi dan lingkaran sosial akun Anda."
            action={<Button onPress={() => router.push(ROUTES.login)}>Masuk</Button>}
          />
        )
      }
      renderItem={({ item, index }) => (
        <UserDiscoverResultItem
          name={item.fullName ?? item.username}
          handle={`@${item.username}`}
          avatar={item.avatarUrl ?? undefined}
          verified={item.verified}
          transactionCount={item.transactionCount}
          rating={item.rating}
          onPress={() => router.push(ROUTES.userProfile(item.username))}
          follow={{
            following: !!item.following,
            loading: pendingId === item.id,
            onToggle: (next) => void handleFollowToggle(item, next),
          }}
          divider={index < query.data.length - 1}
        />
      )}
    />
    </View>
  )
}
