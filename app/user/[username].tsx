/**
 * Screen — Profil Publik (GET /v1/users/{username}).
 *
 * Aksi: Ikuti/Berhenti (POST/DELETE /v1/users/{username}/follow), favorit
 * (GET/POST/DELETE /favorite), bagikan profil (share sheet), Buat Transaksi
 * dengan pengguna ini, Showcase / Tanya Jawab / Ulasan / Pengikut, laporkan
 * (POST /v1/settings/report) dan blokir (POST /v1/settings/block).
 *
 * Keputusan non-obvious:
 *   - Memakai <ProfileHeader> sistem (rata kiri, statistik Mono, badge
 *     Terverifikasi) — konsisten dengan tab Pengaturan; sebelumnya layar ini
 *     menyusun avatar tengah sendiri.
 *   - Status "mengikuti" TIDAK ada di respons profil (spec tanpa schema) →
 *     dibaca dari daftar `GET /users/{username}/followers` yang memuat akun
 *     sendiri (`getMe`). Kalau daftar gagal dimuat, tombol tetap tampil
 *     dengan state "belum mengikuti" (server tetap sumber kebenaran).
 *   - Profil sendiri (username == me): aksi Ikuti/Blokir/Laporkan/Buat
 *     Transaksi disembunyikan, diganti tombol "Edit profil".
 *   - Share: pakai `profileUrl()` (lib/deeplinks) — tanpa literal skema.
 *   - Blokir sukses → kembali (router.back) karena profil pengguna yang
 *     diblokir tidak lagi relevan untuk dilihat.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { View } from "react-native"
import { useLocalSearchParams, router } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import {
  ChatCircleDots,
  Flag,
  Handshake,
  Images,
  PencilSimple,
  Prohibit,
  ShareNetwork,
  Star,
  UserCircle,
  Users,
} from "phosphor-react-native"

import { api, isApiError, userMessage } from "@/lib/api"
import type { PublicUserProfile } from "@/lib/api/users"
import { useCopy } from "@/lib/clipboard"
import { profileUrl } from "@/lib/deeplinks"
import { formatDate, formatDecimal, formatNumber } from "@/lib/format"
import { ROUTES } from "@/lib/routes"
import { shareContent } from "@/lib/share"
import { tokens } from "@/lib/tokens"

import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/modal"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { FavoriteIconButton } from "@/components/ui/favorite-icon-button"
import { FollowButton } from "@/components/ui/follow-button"
import { Header } from "@/components/ui/header"
import { IconButton } from "@/components/ui/icon-button"
import { ProfileHeader, type ProfileStat } from "@/components/ui/profile-header"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { useToast } from "@/components/ui/toast"

export default function UserProfileScreen() {
  const { username: rawUsername } = useLocalSearchParams<{ username: string }>()
  const username = rawUsername ?? ""
  const insets = useSafeAreaInsets()
  const toast = useToast()
  const { copy } = useCopy()

  const [profile, setProfile] = useState<PublicUserProfile | null>(null)
  const [meId, setMeId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const [favorite, setFavorite] = useState(false)
  const [favLoading, setFavLoading] = useState(false)
  const [following, setFollowing] = useState<boolean | null>(null)
  const [followLoading, setFollowLoading] = useState(false)
  const [followerCount, setFollowerCount] = useState<number | null>(null)
  const [followingCount, setFollowingCount] = useState<number | null>(null)

  const [blockOpen, setBlockOpen] = useState(false)
  const [blocking, setBlocking] = useState(false)

  const handle = profile?.username ?? username
  const isSelf = Boolean(meId && profile?.id && meId === profile.id)

  const profileRequest = useRef(0)
  const fetchProfile = useCallback(async () => {
    const started = ++profileRequest.current
    const current = () => profileRequest.current === started
    setFollowing(null)
    setFollowerCount(null)
    setFollowingCount(null)
    if (!username) return
    setLoading(true)
    setError(null)
    try {
      const [res, me] = await Promise.all([
        api.users.getUserByUsername(username),
        api.users.getMe().catch(() => null),
      ])
      if (!current()) return
      setProfile(res)
      setMeId(me?.id ?? null)
      const name = res.username ?? username

      // Data pendamping — kegagalan tidak menggagalkan layar.
      void api.users
        .isFavorite(name)
        .then((r) => {
          if (current()) setFavorite(Boolean(r?.favorited))
        })
        .catch(() => {
          if (current()) setFavorite(false)
        })
      void api.users
        .getFollowers(name, { page: 1, limit: 1 })
        .then((rows) => {
          if (current()) setFollowerCount(rows.meta.total ?? null)
        })
        .catch(() => {
          if (current()) setFollowerCount(null)
        })
      void api.users
        .getFollowing(name, { page: 1, limit: 1 })
        .then((rows) => {
          if (current()) setFollowingCount(rows.meta.total ?? null)
        })
        .catch(() => {
          if (current()) setFollowingCount(null)
        })
      if (me?.username)
        void api.users
          .getFollowers(name, { page: 1, limit: 20, search: me.username })
          .then((result) => {
            const found = result.data.some((user) => user.id === me.id)
            if (current()) setFollowing(found ? true : result.meta.totalPages <= 1 ? false : null)
          })
          .catch(() => {
            if (current()) setFollowing(null)
          })
    } catch (err) {
      if (current())
        setError(
          isApiError(err) && err.status !== 404 ? userMessage(err) : "Profil tidak ditemukan.",
        )
    } finally {
      if (current()) setLoading(false)
    }
  }, [username])

  useEffect(() => {
    void fetchProfile()
    return () => {
      profileRequest.current += 1
    }
  }, [fetchProfile])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchProfile()
    setRefreshing(false)
  }, [fetchProfile])

  const handleFavorite = useCallback(
    async (next: boolean) => {
      if (!handle) return
      setFavLoading(true)
      try {
        if (next) await api.users.addFavorite(handle)
        else await api.users.removeFavorite(handle)
        setFavorite(next)
      } catch {
        toast.show({ title: "Gagal memperbarui favorit", tone: "danger" })
      } finally {
        setFavLoading(false)
      }
    },
    [handle, toast.show],
  )

  const handleFollow = useCallback(
    async (next: boolean) => {
      if (!handle) return
      // Optimistic: tombol & angka pengikut langsung berubah, rollback bila gagal.
      setFollowing(next)
      setFollowerCount((c) => (c == null ? c : Math.max(0, c + (next ? 1 : -1))))
      setFollowLoading(true)
      try {
        if (next) await api.users.followUser(handle)
        else await api.users.unfollowUser(handle)
      } catch (err) {
        setFollowing(!next)
        setFollowerCount((c) => (c == null ? c : Math.max(0, c + (next ? -1 : 1))))
        toast.show({
          title: next ? "Gagal mengikuti" : "Gagal berhenti mengikuti",
          description: isApiError(err) ? userMessage(err) : undefined,
          tone: "danger",
        })
      } finally {
        setFollowLoading(false)
      }
    },
    [handle, toast.show],
  )

  const handleShare = useCallback(async () => {
    if (!handle) return
    const url = profileUrl(handle)
    const outcome = await shareContent({
      title: `@${handle} di Kahade`,
      message: `Lihat profil ${profile?.fullName ?? `@${handle}`} di Kahade`,
      url,
    })
    if (outcome === "unavailable") {
      const ok = await copy(url)
      toast.show({
        title: ok ? "Tautan profil disalin" : "Tidak bisa membagikan",
        tone: ok ? "success" : "danger",
      })
    }
  }, [handle, profile?.fullName, copy, toast.show])

  const handleBlock = useCallback(async () => {
    if (!profile?.id) return
    setBlocking(true)
    try {
      await api.settings.blockUser(profile.id)
      toast.show({ title: "Pengguna diblokir", tone: "success", duration: 3000 })
      setBlockOpen(false)
      router.back()
    } catch {
      toast.show({ title: "Gagal memblokir pengguna", tone: "danger" })
    } finally {
      setBlocking(false)
    }
  }, [profile?.id, toast.show])

  const stats = useMemo<ProfileStat[]>(() => {
    if (!profile) return []
    const items: ProfileStat[] = []
    if (followerCount != null)
      items.push({
        value: formatNumber(followerCount),
        label: "Pengikut",
        onPress: () => router.push(ROUTES.followers(handle)),
      })
    if (followingCount != null)
      items.push({
        value: formatNumber(followingCount),
        label: "Mengikuti",
        onPress: () => router.push(ROUTES.followers(handle, "following")),
      })
    if (profile.rating != null)
      items.push({
        value: formatDecimal(profile.rating),
        label: "Rating",
        onPress: () => router.push(ROUTES.userRatings(handle)),
      })
    if (profile.trustScore != null)
      items.push({ value: formatNumber(profile.trustScore), label: "Skor" })
    return items
  }, [profile, followerCount, followingCount, handle])

  return (
    <Screen edges={["top"]} padded={false}>
      <Header
        title="Profil"
        right={
          profile ? (
            <IconButton
              icon={ShareNetwork}
              variant="ghost"
              accessibilityLabel="Bagikan profil"
              onPress={() => void handleShare()}
            />
          ) : undefined
        }
      />
      <PullToRefresh
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-0"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        {loading && !profile ? (
          <ProfileHeader name="" loading />
        ) : error ? (
          <View className="px-6">
            <ErrorState
              title="Gagal memuat"
              description={error}
              onRetry={() => void fetchProfile()}
            />
          </View>
        ) : profile ? (
          <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
            <ProfileHeader
              name={profile.fullName ?? `@${handle}`}
              handle={`@${handle}`}
              avatar={{ source: profile.avatarUrl ?? undefined }}
              verified={profile.verified}
              bio={profile.bio ?? undefined}
              stats={stats}
              action={
                isSelf ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={PencilSimple}
                    onPress={() => router.push(ROUTES.editProfile)}
                  >
                    Edit profil
                  </Button>
                ) : (
                  <>
                    <FollowButton
                      following={following === true}
                      loading={followLoading || following == null}
                      onToggle={(next) => void handleFollow(next)}
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon={Handshake}
                      onPress={() => router.push(ROUTES.createTransactionWith(handle))}
                    >
                      Buat Transaksi
                    </Button>
                    <FavoriteIconButton
                      active={favorite}
                      disabled={favLoading}
                      onToggle={(next) => void handleFavorite(next)}
                      accessibilityLabel={favorite ? "Hapus dari favorit" : "Simpan ke favorit"}
                      size="md"
                    />
                  </>
                )
              }
            />

            <View className="gap-4 px-6">
              <Text variant="caption" tone="secondary">
                Bergabung {profile.createdAt ? formatDate(profile.createdAt) : "—"}
              </Text>

              <SectionHeader title="Lihat juga" />
              <View className="flex-row flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={Images}
                  onPress={() => router.push(ROUTES.userShowcase(handle))}
                >
                  Portofolio
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={ChatCircleDots}
                  onPress={() => router.push(ROUTES.userQuestions(handle))}
                >
                  Tanya Jawab
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={Star}
                  onPress={() => router.push(ROUTES.userRatings(handle))}
                >
                  Ulasan
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={Users}
                  onPress={() => router.push(ROUTES.followers(handle))}
                >
                  Pengikut
                </Button>
              </View>

              {!isSelf ? (
                <>
                  <SectionHeader title="Keamanan" />
                  <View className="flex-row flex-wrap gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={Flag}
                      onPress={() =>
                        router.push(ROUTES.reports({ targetId: profile.id, targetName: handle }))
                      }
                    >
                      Laporkan
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={Prohibit}
                      onPress={() => setBlockOpen(true)}
                    >
                      Blokir
                    </Button>
                  </View>
                </>
              ) : null}
            </View>
          </View>
        ) : (
          <EmptyState icon={UserCircle} title="Profil tidak ditemukan" />
        )}
      </PullToRefresh>

      <Dialog
        title={`Blokir @${handle}?`}
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
