import { memo, useCallback, useEffect, useMemo, useState } from "react"
import { View } from "react-native"
import { useLocalSearchParams, router } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { ShareNetwork, Users } from "phosphor-react-native"
import type { UserConnection } from "@/lib/api/users"
import { api } from "@/lib/api"
import { ROUTES } from "@/lib/routes"
import { tokens } from "@/lib/tokens"
import { translate, useLanguage } from "@/lib/i18n"
import { usePaginatedQuery } from "@/lib/use-paginated-query"
import { useCopy } from "@/lib/clipboard"
import { profileUrl } from "@/lib/deeplinks"
import { shareContent } from "@/lib/share"
import { useHasSession } from "@/lib/guest-gate"
import { showMutationError } from "@/lib/mutation-toast"
import { useToast } from "@/components/ui/toast"
import { Button } from "@/components/ui/button"
import { DebouncedSearchField } from "@/components/ui/debounced-search-field"
import { EmptyState } from "@/components/ui/empty-state"
import { FollowButton } from "@/components/ui/follow-button"
import { Header } from "@/components/ui/header"
import { PaginatedList } from "@/components/ui/paginated-list"
import { Screen } from "@/components/ui/screen"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { Text } from "@/components/ui/text"
import { UserListItem } from "@/components/ui/user-list-item"

type Tab = "followers" | "following"

// FE-010 (audit 2026-09-29): keyExtractor stabil di level modul —
// `UserConnection` memakai username (unik) sebagai kunci (R1 audit 2026-09-26).
const connectionKeyExtractor = (item: UserConnection): string => item.username

type FollowerRowProps = {
  item: UserConnection
  /** true = tampilkan FollowButton (daftar "Mengikuti" milik sendiri). */
  showAction: boolean
  busy: boolean
  busyAny: boolean
  onOpenProfile: (username: string) => void
  onUnfollow: (target: UserConnection) => void
}

// FE-010 (audit 2026-09-29): baris di-memo — keystroke kolom "cari di daftar"
// tidak lagi me-render ulang seluruh baris. Handler diterima stabil per-id;
// closure per baris (`onPress`, `onToggle`) dibuat di dalam render baris
// sendiri sehingga tidak menjebol bail-out UserListItem antar render.
const FollowerRow = memo(function FollowerRow({
  item,
  showAction,
  busy,
  busyAny,
  onOpenProfile,
  onUnfollow,
}: FollowerRowProps) {
  return (
    <UserListItem
      padded={false}
      name={item.fullName ?? item.username}
      username={item.username}
      avatar={{ source: item.avatarUrl ?? undefined }}
      sealTier={item.sealTier ?? null}
      chevron={!showAction}
      divider
      onPress={() => onOpenProfile(item.username)}
      // Item 64: tombol Ikuti/Mengikuti per baris — hanya di daftar
      // "Mengikuti" milik sendiri. Aksi di LUAR Pressable baris
      // (sibling) agar tap tombol tidak membuka profil (pola komponen).
      action={
        showAction ? (
          <FollowButton
            size="sm"
            following
            loading={busy}
            disabled={busyAny}
            onToggle={() => onUnfollow(item)}
          />
        ) : undefined
      }
    />
  )
})

export default function FollowersScreen() {
  const { username, tab: initialTab } = useLocalSearchParams<{ username: string; tab?: Tab }>()
  const [tab, setTab] = useState<Tab>(initialTab === "following" ? "following" : "followers")
  // Item 63 (mega-batch 2026-09-28): kolom pencarian nama/username.
  // Backend mendukung `?search=` di GET followers; GET following TIDAK —
  // jadi tab "Mengikuti" disaring di klien atas halaman yang sudah dimuat
  // (lihat `visibleRows`).
  const [connectionSearch, setConnectionSearch] = useState("")
  // UI-P019: sinkronkan tab bila param rute berubah setelah mount (mis. pindah
  // dari "Pengikut" ke "Mengikuti" tanpa remount).
  useEffect(() => {
    setTab(initialTab === "following" ? "following" : "followers")
  }, [initialTab])
  // i18n: label tab mengikuti bahasa aktif.
  useLanguage()
  const insets = useSafeAreaInsets()
  const toast = useToast()
  const { copy } = useCopy()
  const hasSession = useHasSession()

  // Daftar milik sendiri? — tombol Ikuti/Mengikuti per baris (item 64) dan
  // empty state "Bagikan profil" (item 74) hanya relevan di sini.
  const [meUsername, setMeUsername] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    api.users
      .getMeCached()
      .then((me) => {
        if (alive) setMeUsername(me?.username ?? null)
      })
      .catch(() => {
        /* tamu: bukan daftar sendiri */
      })
    return () => {
      alive = false
    }
  }, [])
  const isOwnList =
    meUsername != null && username != null && username.toLowerCase() === meUsername.toLowerCase()

  // C-08 (audit): sengaja TANPA `compare` — `UserConnection` tidak membawa
  // tanda waktu apa pun (`lib/api/users.ts`), jadi daftar ini tidak punya
  // urutan kronologis untuk ditegakkan; urutannya milik server (alfabetis /
  // "terbaru diikuti" sesuai backend). Menambahkan pembanding rekaan di sini
  // akan mengacak urutan yang sudah benar.
  const query = usePaginatedQuery<UserConnection>(
    `connections:${username}:${tab}:${tab === "followers" ? connectionSearch : ""}`,
    (page, signal) =>
      tab === "followers"
        ? api.users.getFollowers(
            username,
            { page, limit: 20, search: connectionSearch.trim() || undefined },
            signal,
          )
        : api.users.getFollowing(username, { page, limit: 20 }, signal),
    // R1 (audit 2026-09-26): backend tidak mengirim id — dedup pakai username (unik).
    // UI-P020: `enabled` — username datang dari param rute; tanpa ini fetcher
    // menembak /v1/users/undefined/followers sebelum rute selesai di-resolve.
    { getKey: (item) => item.username, enabled: Boolean(username) },
  )
  // FE-010: destruktur agar useCallback di bawah hanya bergantung pada nilai
  // yang benar-benar dipakai (`query` sendiri objek literal baru tiap render).
  const { data: queryData, setData: setQueryData } = query

  // Item 63 (lanjutan): filter klien untuk tab "Mengikuti" (backend tidak
  // punya ?search= di endpoint ini). Bila backend kelak mendukungnya, hapus
  // filter ini dan teruskan search ke fetcher seperti tab Pengikut.
  const searchLower = connectionSearch.trim().toLowerCase()
  const visibleRows = useMemo(
    () =>
      tab === "following" && searchLower
        ? query.data.filter(
            (u) =>
              u.username.toLowerCase().includes(searchLower) ||
              (u.fullName ?? "").toLowerCase().includes(searchLower),
          )
        : query.data,
    [query.data, tab, searchLower],
  )

  // Item 64 (mega-batch 2026-09-28): tombol Ikuti/Mengikuti per baris di
  // daftar "Mengikuti" — hanya daftar MILIK SENDIRI (semua baris pasti
  // diikuti; tap = berhenti mengikuti dengan rollback optimistis).
  // FE-010: dibungkus useCallback agar identitas stabil antar render
  // (diteruskan ke baris yang di-memo).
  const [unfollowBusy, setUnfollowBusy] = useState<string | null>(null)
  const handleUnfollow = useCallback(
    async (target: UserConnection) => {
      if (unfollowBusy) return
      // P3 (audit 2026-09-26): tamu di-gate login sebelum aksi sosial.
      if (!hasSession) {
        router.push(ROUTES.loginRequired(`/followers/${encodeURIComponent(username ?? "")}`))
        return
      }
      setUnfollowBusy(target.username)
      const prev = queryData
      setQueryData(prev.filter((u) => u.username !== target.username))
      try {
        await api.users.unfollowUser(target.username)
        toast.show({
          title: translate("Berhenti mengikuti @{x}", { x: target.username }),
          tone: "neutral",
          duration: 2500,
        })
      } catch (err) {
        // Klasifikasi toast: error mutasi non-blokir via showMutationError.
        if (
          showMutationError(toast.show, {
            failTitle: translate("Gagal berhenti mengikuti"),
            uncertainHint: translate("Aksi mungkin sudah diproses — memuat ulang…"),
            err: err,
            scope: "followers:username:berhenti-mengikuti",
          })
        ) {
          void query.reload()
        } else {
          setQueryData(prev)
        }
      } finally {
        setUnfollowBusy(null)
      }
    },
    [unfollowBusy, hasSession, username, queryData, setQueryData, toast],
  )

  // FE-010: handler navigasi stabil per-id (bukan closure per baris).
  const openProfile = useCallback((targetUsername: string) => {
    router.push(ROUTES.userProfile(targetUsername))
  }, [, query])

  // Item 74 (mega-batch 2026-09-29): empty state pengikut di profil sendiri →
  // tombol "Bagikan profil" (pola share dari app/user/[username].tsx).
  // FE-010: useCallback agar stabil sebagai dep useMemo emptyState.
  const handleShareProfile = useCallback(async () => {
    if (!username) return
    const url = profileUrl(username)
    const outcome = await shareContent({
      title: translate("@{x} di Kahade", { x: username }),
      message: translate("Lihat profil {x} di Kahade", { x: username }),
      url,
    })
    if (outcome === "unavailable") {
      const ok = await copy(url)
      toast.show({
        title: ok ? translate("Tautan profil disalin") : translate("Tidak bisa membagikan"),
        tone: ok ? "success" : "danger",
      })
    }
  }, [username, copy, toast])

  // FE-010: empty state di-memo — elemen inline (dengan onPress inline di
  // tombol "Bagikan profil") sebelumnya menjebol memo internal PaginatedList.
  const emptyState = useMemo(
    () =>
      tab === "followers" && isOwnList ? (
        <EmptyState
          icon={Users}
          title={translate("Belum ada pengikut")}
          description={translate("Bagikan profil Anda agar lebih banyak orang menemukan dan mengikuti Anda.")}
          action={
            <Button variant="secondary" fullWidth={false} leftIcon={ShareNetwork} onPress={() => void handleShareProfile()}>
              {translate("Bagikan profil")}
            </Button>
          }
        />
      ) : (
        <EmptyState
          icon={Users}
          title={
            searchLower
              ? translate("Tidak ada hasil")
              : tab === "followers"
                ? translate("Belum ada pengikut")
                : translate("Belum mengikuti siapa pun")
          }
          description={
            searchLower
              ? translate("Coba nama atau username lain.")
              : tab === "followers"
                ? translate("Pengguna yang mengikuti @{x} akan tampil di sini.", { x: username ?? "" })
                : translate("Akun yang diikuti @{x} akan tampil di sini.", { x: username ?? "" })
          }
        />
      ),
    [tab, isOwnList, searchLower, username, handleShareProfile],
  )

  // FE-010: renderItem stabil — komputasi per baris (busy per-id) dihitung di
  // sini sebagai boolean agar baris memo hanya me-render ulang bila
  // miliknya sendiri yang berubah.
  const renderItem = useCallback(
    ({ item }: { item: UserConnection }) => (
      <FollowerRow
        item={item}
        showAction={tab === "following" && isOwnList}
        busy={unfollowBusy === item.username}
        busyAny={unfollowBusy != null}
        onOpenProfile={openProfile}
        onUnfollow={handleUnfollow}
      />
    ),
    [tab, isOwnList, unfollowBusy, openProfile, handleUnfollow],
  )

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title={tab === "followers" ? translate("Pengikut") : translate("Mengikuti")} />
      <View className="gap-3 px-5 py-4">
        <SegmentedControl<Tab>
          // UI-P018: label aksesibilitas mengikuti tab aktif.
          accessibilityLabel={tab === "followers" ? translate("Daftar pengikut") : translate("Daftar mengikuti")}
          value={tab}
          onChange={setTab}
          items={[
            { value: "followers", label: translate("Pengikut") },
            { value: "following", label: translate("Mengikuti") },
          ]}
        />
        {/* Item 63: kolom pencarian nama/username di daftar koneksi. */}
        <DebouncedSearchField
          onQueryChange={setConnectionSearch}
          placeholder={translate("Cari nama atau username")}
          accessibilityLabel={translate("Cari di daftar {x}", {
            x: tab === "followers" ? translate("pengikut") : translate("mengikuti"),
          })}
          debounceMs={400}
        />
        {tab === "following" && searchLower ? (
          <Text variant="caption" tone="tertiary">
            {translate("Mencari di {n} akun yang sudah dimuat.", { n: String(query.data.length) })}
          </Text>
        ) : null}
      </View>
      <PaginatedList
        {...query}
        data={visibleRows}
        // R1 (audit 2026-09-26): backend tidak mengirim id — pakai username (unik) sebagai kunci.
        // FE-010: keyExtractor + renderItem stabil (hoist/useCallback).
        keyExtractor={connectionKeyExtractor}
        onRefresh={query.refresh}
        onRetry={query.reload}
        onLoadMore={query.loadMore}
        gap={0}
        bottomPadding={insets.bottom + tokens.space[8]}
        empty={emptyState}
        renderItem={renderItem}
      />
    </Screen>
  )
}
