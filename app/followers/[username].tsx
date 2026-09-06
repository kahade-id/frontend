import { useState } from "react"
import { View } from "react-native"
import { useLocalSearchParams, router } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Users } from "phosphor-react-native"
import type { UserConnection } from "@/lib/api/users"
import { api } from "@/lib/api"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { usePaginatedQuery } from "@/lib/use-paginated-query"
import { EmptyState } from "@/components/ui/empty-state"
import { Header } from "@/components/ui/header"
import { PaginatedList } from "@/components/ui/paginated-list"
import { Screen } from "@/components/ui/screen"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { UserListItem } from "@/components/ui/user-list-item"

type Tab = "followers" | "following"
export default function FollowersScreen() {
  const { username, tab: initialTab } = useLocalSearchParams<{ username: string; tab?: Tab }>()
  const [tab, setTab] = useState<Tab>(initialTab === "following" ? "following" : "followers")
  const insets = useSafeAreaInsets()
  const query = usePaginatedQuery<UserConnection>(
    `connections:${username}:${tab}`,
    (page, signal) =>
      tab === "followers"
        ? api.users.getFollowers(username, { page, limit: 20 }, signal)
        : api.users.getFollowing(username, { page, limit: 20 }, signal),
  )
  return (
    <Screen edges={["top"]} padded={false}>
      <Header title={tab === "followers" ? "Pengikut" : "Mengikuti"} />
      <View accessible={false} className="px-6 py-4">
        <SegmentedControl<Tab>
          value={tab}
          onChange={setTab}
          items={[
            { value: "followers", label: "Pengikut" },
            { value: "following", label: "Mengikuti" },
          ]}
        />
      </View>
      <PaginatedList
        {...query}
        onRefresh={query.refresh}
        onRetry={query.reload}
        onLoadMore={query.loadMore}
        gap={0}
        bottomPadding={insets.bottom + tokens.space[8]}
        empty={
          <EmptyState
            icon={Users}
            title={tab === "followers" ? "Belum ada pengikut" : "Belum mengikuti siapa pun"}
          />
        }
        renderItem={({ item }) => (
          <UserListItem
            padded={false}
            name={item.fullName ?? item.username}
            username={item.username}
            avatar={{ source: item.avatarUrl ?? undefined }}
            chevron
            divider
            onPress={() => router.push(ROUTES.userProfile(item.username))}
          />
        )}
      />
    </Screen>
  )
}