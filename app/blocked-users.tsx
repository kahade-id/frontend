import { LoadingScreen } from "@/components/ui/loading-screen"
/**
 * Screen — Pengguna Diblokir (GET /v1/settings/blocked-users, DELETE unblock).
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Prohibit } from "phosphor-react-native"

import { api } from "@/lib/api"
import type { BlockedUser } from "@/lib/api/settings"
import { tokens } from "@/lib/tokens"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { UserListItem } from "@/components/ui/user-list-item"
import { useToast } from "@/components/ui/toast"

export default function BlockedUsersScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [items, setItems] = useState<BlockedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [unblockingId, setUnblockingId] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.settings.getBlockedUsers()
      setItems(res ?? [])
    } catch {
      setError("Gagal memuat daftar blokir.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchAll()
    setRefreshing(false)
  }, [fetchAll])

  const handleUnblock = useCallback(
    async (user: BlockedUser) => {
      setUnblockingId(user.id)
      try {
        await api.settings.unblockUser(user.id)
        setItems((prev) => prev.filter((u) => u.id !== user.id))
        toast.show({ title: `${user.username} dibuka blokirnya`, tone: "success", duration: 3000 })
      } catch {
        toast.show({ title: "Gagal membuka blokir", tone: "danger" })
      } finally {
        setUnblockingId(null)
      }
    },
    [toast.show],
  )

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Pengguna Diblokir" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        {loading ? (
          <LoadingScreen message="Memuat daftar…" />
        ) : error ? (
          <ErrorState title="Gagal memuat" description={error} onRetry={() => void fetchAll()} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={Prohibit}
            title="Tidak ada yang diblokir"
            description="Pengguna yang Anda blokir akan muncul di sini."
          />
        ) : (
          <View className="gap-1" style={{ paddingTop: tokens.space[3] }}>
            {items.map((u, i) => (
              <UserListItem
                key={u.id}
                name={u.fullName ?? u.username}
                username={u.username}
                avatar={{ source: u.avatarUrl ?? undefined }}
                blocked
                action={
                  <Button
                    variant="ghost"
                    size="sm"
                    fullWidth={false}
                    loading={unblockingId === u.id}
                    onPress={() => void handleUnblock(u)}
                  >
                    Buka Blokir
                  </Button>
                }
                divider={i < items.length - 1}
              />
            ))}
          </View>
        )}
      </PullToRefresh>
    </Screen>
  )
}
