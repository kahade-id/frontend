/**
 * Screen — Profil Publik (GET /v1/users/{username}) + navigasi Showcase,
 * Tanya Jawab, Ulasan, Followers; favorite toggle (GET/POST/DELETE
 * /v1/users/{username}/favorite) dan laporan (POST /v1/settings/report).
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useLocalSearchParams, router } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { ChatCircleDots, Flag, Images, Star, UserCircle, Users } from "phosphor-react-native"

import { api } from "@/lib/api"
import { formatDateTime } from "@/lib/format"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"

import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/modal"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { FavoriteIconButton } from "@/components/ui/favorite-icon-button"
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
    id: string
    username?: string | null
    fullName?: string
    bio?: string | null
    avatarUrl?: string | null
    createdAt?: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [favorite, setFavorite] = useState(false)
  const [favLoading, setFavLoading] = useState(false)
  const [blockOpen, setBlockOpen] = useState(false)
  const [blocking, setBlocking] = useState(false)

  const fetchProfile = useCallback(async () => {
    if (!username) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.users.getUserByUsername(username)
      setProfile({
        id: res.id,
        username: res.username ?? username,
        fullName: res.fullName,
        bio: res.bio,
        avatarUrl: res.avatarUrl,
        createdAt: res.createdAt,
      })
      api.users
        .isFavorite(res.username ?? username)
        .then((r) => setFavorite(!!r?.favorited))
        .catch(() => setFavorite(false))
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

  const handleFavorite = useCallback(
    async (next: boolean) => {
      if (!profile?.username) return
      setFavLoading(true)
      try {
        if (next) await api.users.addFavorite(profile.username)
        else await api.users.removeFavorite(profile.username)
        setFavorite(next)
      } catch {
        toast.show({ title: "Gagal memperbarui favorit", tone: "danger" })
      } finally {
        setFavLoading(false)
      }
    },
    [profile?.username, toast.show],
  )

  const handleBlock = useCallback(async () => {
    if (!profile?.id) return
    setBlocking(true)
    try {
      await api.settings.blockUser(profile.id)
      toast.show({ title: "Pengguna diblokir", tone: "success", duration: 3000 })
      setBlockOpen(false)
    } catch {
      toast.show({ title: "Gagal memblokir pengguna", tone: "danger" })
    } finally {
      setBlocking(false)
    }
  }, [profile?.id, toast.show])

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
              <FavoriteIconButton
                active={favorite}
                disabled={favLoading}
                onToggle={(next) => void handleFavorite(next)}
                accessibilityLabel={favorite ? "Hapus dari favorit" : "Simpan ke favorit"}
                size="md"
              />
            </View>
            {profile.bio ? <Text variant="body" tone="secondary">{profile.bio}</Text> : null}

            <View className="flex-row flex-wrap gap-2">
              <Button variant="secondary" size="sm" leftIcon={Images} onPress={() => router.push(ROUTES.userShowcase(profile.username ?? username))}>
                Showcase
              </Button>
              <Button variant="secondary" size="sm" leftIcon={ChatCircleDots} onPress={() => router.push(ROUTES.userQuestions(profile.username ?? username))}>
                Tanya Jawab
              </Button>
              <Button variant="secondary" size="sm" leftIcon={Star} onPress={() => router.push(ROUTES.userRatings(profile.username ?? username))}>
                Ulasan
              </Button>
              <Button variant="secondary" size="sm" leftIcon={Users} onPress={() => router.push(ROUTES.followers(profile.username ?? username))}>
                Followers
              </Button>
              <Button
                variant="ghost"
                size="sm"
                leftIcon={Flag}
                onPress={() => router.push(ROUTES.reports({ targetId: profile.id, targetName: profile.username ?? username }))}
              >
                Laporkan
              </Button>
              <Button variant="ghost" size="sm" onPress={() => setBlockOpen(true)}>
                Blokir
              </Button>
            </View>
          </View>
        ) : null}
      </PullToRefresh>

      <Dialog
        title={`Blokir @${profile?.username ?? username}?`}
        description="Anda tidak akan lagi melihat aktivitas pengguna ini, dan sebaliknya."
        visible={blockOpen}
        destructive
        loading={blocking}
        confirmLabel="Blokir"
        cancelLabel="Batal"
        onConfirm={() => void handleBlock()}
        onCancel={() => setBlockOpen(false)}
        onRequestClose={() => setBlockOpen(false)}
      />
    </Screen>
  )
}
