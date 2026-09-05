/**
 * Screen — Profil Publik (GET /v1/users/{username}; favorite via /deeplinks
 * tidak dipakai di layar ini).
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useLocalSearchParams } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { UserCircle } from "phosphor-react-native"

import { api } from "@/lib/api"
import { formatDateTime } from "@/lib/format"
import { tokens } from "@/lib/tokens"

import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"

export default function UserProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>()
  const insets = useSafeAreaInsets()
  const toast = useToast()

  const [profile, setProfile] = useState<{
    username?: string | null
    fullName?: string
    bio?: string | null
    avatarUrl?: string | null
    createdAt?: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchProfile = useCallback(async () => {
    if (!username) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.users.getUserByUsername(username)
      setProfile({
        username: res.username ?? username,
        fullName: res.fullName,
        bio: res.bio,
        avatarUrl: res.avatarUrl,
        createdAt: res.createdAt,
      })
    } catch {
      setError("Profil tidak ditemukan.")
    } finally {
      setLoading(false)
    }
  }, [username])

  useEffect(() => {
    void fetchProfile()
  }, [fetchProfile])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchProfile()
    setRefreshing(false)
  }, [fetchProfile])

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Profil" />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{ style: { paddingBottom: insets.bottom + tokens.space[8] } }}
      >
        {loading ? (
          <EmptyState icon={UserCircle} title="Memuat profil…" />
        ) : error ? (
          <ErrorState title="Gagal memuat" description={error} onRetry={() => void fetchProfile()} />
        ) : profile ? (
          <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
            <View className="items-center gap-3">
              <Avatar source={profile.avatarUrl ?? undefined} name={profile.fullName ?? profile.username ?? undefined} size="xl" />
              <SectionHeader title={profile.fullName ?? `@${profile.username}`} />
              <Text variant="caption" tone="secondary">
                Bergabung {profile.createdAt ? formatDateTime(profile.createdAt) : "sekarang"}
              </Text>
            </View>
            {profile.bio ? <Text variant="body" tone="secondary">{profile.bio}</Text> : null}
            <Button variant="secondary" onPress={() => toast.show({ title: "Fitur profil publik", description: "Detail lengkap segera hadir.", tone: "info" })}>
              Lihat Rating
            </Button>
          </View>
        ) : null}
      </PullToRefresh>
    </Screen>
  )
}
