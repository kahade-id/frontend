/**
 * Kahade — HALAMAN "PESAN BARU" (`/chat/new`, permintaan produk 2026-10-08).
 *
 * Satu halaman untuk MEMULAI percakapan, ala WhatsApp "New chat", dengan
 * kontak yang disimpan lewat USERNAME (tanpa nomor HP):
 *
 *   1. Kotak cari username → hasil `GET /v1/users/search` (q ≥ 2 — kontrak
 *      lama). Ketuk hasil = langsung buka/buat DM (`POST /v1/chat/dm`).
 *   2. "Kontak tersimpan" → `GET /v1/users/saved` (API simpan-profil yang
 *      SUDAH ada, terpisah dari favorit: tersinkron ke akun). Ketuk = langsung
 *      DM; ikon bookmark = simpan/hapus dari kontak.
 *   3. Baris "Pesan untuk diri sendiri" (`POST /v1/chat/self`) — self-chat
 *      PINDAH ke sini dari puncak daftar chat (2026-10-08): layar inilah
 *      tempat "mulai percakapan dengan…", dan self-chat salah satu tujuannya.
 *
 * Keputusan non-obvious:
 *   - Menyimpan kontak memakai API "saved profile" yang sudah ada
 *     (`POST/DELETE /v1/users/{username}/saved`) — TIDAK ada endpoint baru
 *     yang diasumsikan, tidak ada daftar kontak lokal yang bisa hilang saat
 *     ganti perangkat. Bila backend kelak menyediakan daftar kontak khusus
 *     chat (mis. dengan alias), itu rekomendasi terpisah —
 *     lihat docs/rekomendasi-backend-chat.md.
 *   - DM dibuka dengan `router.replace` (bukan push): setelah masuk ruang,
 *     tombol kembali membawa ke daftar chat — halaman ini tidak menumpuk di
 *     tumpukan riwayat.
 *   - Backend membatasi pencarian username (q ≥ 2 huruf, throttle 10 rpm),
 *     jadi query di-debounce dan kunci cache memuat query — hasil lama tidak
 *     dipakai untuk query baru.
 *   - Penolakan DM karena kebijakan privasi lawan bicara (403
 *     CHAT_DM_NOT_ALLOWED) dipetakan ke kalimat yang menjelaskan jalan
 *     keluarnya, bukan error generik.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { ScrollView, View } from "react-native"
import { router } from "expo-router"
import { BookmarkSimple, NotePencil, UserCircle, Users } from "phosphor-react-native"

import { api, isApiError, userMessage } from "@/lib/api"
import { getOrCreateDm, getOrCreateSelfRoom, isDmNotAllowedError } from "@/lib/api/chat"
import { getMeCached, type SavedProfileEntry, type UserSearchResult } from "@/lib/api/users"
import { useHasSession } from "@/lib/guest-gate"
import { haptic } from "@/lib/haptics"
import { translate, useLanguage } from "@/lib/i18n"
import { showMutationError } from "@/lib/mutation-toast"
import { ROUTES } from "@/lib/routes"
import { useApiQuery } from "@/lib/use-api-query"
import { useDebouncedValue } from "@/lib/use-debounced-value"

import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { ListLoading } from "@/components/ui/paginated-list"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Screen } from "@/components/ui/screen"
import { SearchField } from "@/components/ui/search-field"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { UserListItem } from "@/components/ui/user-list-item"
import { useToast } from "@/components/ui/toast"

/** Pencarian dikirim hanya bila ≥ 2 huruf (batas backend). */
const SEARCH_MIN_CHARS = 2
/** Debounce pencarian — backend membatasi 10 permintaan/menit. */
const SEARCH_DEBOUNCE_MS = 350

export default function ChatNewMessageScreen() {
  useLanguage()
  const toast = useToast()
  /**
   * Tamu web: route /chat/new terdaftar ber-auth (lib/protected-routes) —
   * root layout sudah menampilkan ajakan login, dan `useApiQuery` berhenti
   * menembak lewat `useGuestPathBlocked`. Pembacaan imperatif `getMeCached`
   * di bawah TIDAK lewat jalur itu, jadi ikut digate di sini supaya tidak
   * ada 401 yang tidak perlu.
   */
  const hasSession = useHasSession()
  const [text, setText] = useState("")
  const query = useDebouncedValue(text.trim(), SEARCH_DEBOUNCE_MS)
  const searchActive = query.length >= SEARCH_MIN_CHARS

  /** Baris yang sedang membuka DM/menyimpan kontak — cegah ketukan ganda. */
  const [busyKey, setBusyKey] = useState<string | null>(null)
  /** Username sendiri: tidak ditawarkan sebagai tujuan DM. */
  const [meUsername, setMeUsername] = useState<string | null>(null)

  useEffect(() => {
    if (!hasSession) return
    let alive = true
    void getMeCached()
      .then((me) => {
        const handle = (me?.username ?? "").replace(/^@/, "").trim().toLowerCase()
        if (alive) setMeUsername(handle || null)
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [hasSession])

  const savedQuery = useApiQuery(
    "users-saved",
    (signal) => api.users.getSavedProfiles({ limit: 50 }, signal),
    // Tidak dimuat selagi mencari: satu permintaan yang tidak terlihat hanya
    // menambah beban jaringan.
    !searchActive,
    { refreshOnFocus: true },
  )

  const searchQuery = useApiQuery(
    // Kunci memuat query: hasil pencarian lama tidak pernah dipakai untuk
    // query baru (dan cache query yang sama tetap terpakai saat bolak-balik).
    `users-search:${searchActive ? query : ""}`,
    (signal) => api.users.searchUsers(query, { limit: 20 }, signal),
    searchActive,
    { refreshOnFocus: false },
  )

  const savedEntries = savedQuery.data?.data ?? []
  const savedUsernames = useMemo(
    () => new Set(savedEntries.map((e) => e.user.username.toLowerCase())),
    [savedEntries],
  )
  const searchResults = searchQuery.data?.users ?? []
  const visibleResults = useMemo(
    () =>
      searchResults.filter(
        (u) => u.username && u.username.toLowerCase() !== meUsername,
      ),
    [searchResults, meUsername],
  )

  /**
   * Buka/buat DM lalu masuk ruang. `key` mencegah dua ketukan pada baris yang
   * sama (dan memberi tahu baris mana yang sedang sibuk).
   */
  const openDm = useCallback(
    async (target: { username: string; name?: string | null; key: string }) => {
      if (busyKey) return
      setBusyKey(target.key)
      try {
        const room = await getOrCreateDm(target.username)
        haptic("select")
        router.replace(ROUTES.chatRoom(room.id, target.name ?? `@${target.username}`))
      } catch (err) {
        const blocked = isDmNotAllowedError(err)
        toast.show({
          title: blocked
            ? translate("Belum bisa mengirim pesan")
            : translate("Gagal membuka percakapan"),
          description: blocked
            ? translate(
                "Pengguna ini membatasi pesan dari orang yang belum ia kenal.",
              )
            : isApiError(err)
              ? userMessage(err)
              : undefined,
          tone: "danger",
        })
      } finally {
        setBusyKey(null)
      }
    },
    [busyKey, toast.show],
  )

  const openSelfChat = useCallback(async () => {
    if (busyKey) return
    setBusyKey("self")
    try {
      const room = await getOrCreateSelfRoom()
      router.replace(
        ROUTES.chatRoom(room.id, translate("Pesan untuk diri sendiri"), true),
      )
    } catch (err) {
      toast.show({
        title: translate("Gagal membuka pesan untuk diri sendiri"),
        description: isApiError(err) ? userMessage(err) : undefined,
        tone: "danger",
      })
    } finally {
      setBusyKey(null)
    }
  }, [busyKey, toast.show])

  const toggleSaved = useCallback(
    async (username: string, isSaved: boolean) => {
      try {
        if (isSaved) await api.users.unsaveProfile(username)
        else await api.users.saveProfile(username)
        haptic("success")
        savedQuery.refresh()
        toast.show({
          title: isSaved
            ? translate("Kontak dihapus dari daftar")
            : translate("Kontak disimpan"),
          tone: "neutral",
          duration: 2000,
        })
      } catch (err) {
        if (
          showMutationError(toast.show, {
            failTitle: isSaved
              ? translate("Gagal menghapus kontak")
              : translate("Gagal menyimpan kontak"),
            uncertainHint: translate("Muat ulang daftar untuk keadaan terbaru."),
            err,
            scope: "chat:new-message:simpan-kontak",
          })
        ) {
          savedQuery.refresh()
        }
      }
    },
    [savedQuery, toast.show],
  )

  const renderSavedRow = useCallback(
    (entry: SavedProfileEntry, divider: boolean) => {
      const { user } = entry
      const name = user.fullName ?? user.username
      return (
        <UserListItem
          key={entry.id}
          name={name}
          username={user.username}
          avatar={user.avatarUrl ? { source: user.avatarUrl } : undefined}
          verified={user.kycStatus === "APPROVED"}
          divider={divider}
          onPress={() =>
            void openDm({ username: user.username, name, key: `saved-${entry.id}` })
          }
          action={
            <IconButton
              icon={BookmarkSimple}
              weight="fill"
              variant="ghost"
              size="sm"
              accessibilityLabel={translate("Hapus {x} dari kontak", { x: name })}
              onPress={() => void toggleSaved(user.username, true)}
            />
          }
        />
      )
    },
    [openDm, toggleSaved],
  )

  const renderSearchRow = useCallback(
    (user: UserSearchResult, divider: boolean) => {
      const username = user.username ?? ""
      const name = user.fullName || `@${username}`
      const isSaved = savedUsernames.has(username.toLowerCase())
      return (
        <UserListItem
          key={user.userId || username}
          name={name}
          username={username}
          avatar={user.avatarUrl ? { source: user.avatarUrl } : undefined}
          sealTier={user.sealTier ?? null}
          highlight={query}
          divider={divider}
          onPress={() =>
            void openDm({ username, name, key: `search-${user.userId || username}` })
          }
          action={
            <IconButton
              icon={BookmarkSimple}
              weight={isSaved ? "fill" : "regular"}
              variant="ghost"
              size="sm"
              accessibilityLabel={
                isSaved
                  ? translate("Hapus {x} dari kontak", { x: name })
                  : translate("Simpan {x} sebagai kontak", { x: name })
              }
              onPress={() => void toggleSaved(username, isSaved)}
            />
          }
        />
      )
    },
    [openDm, query, savedUsernames, toggleSaved],
  )

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title={translate("Pesan baru")} />
      <View className="px-5 pb-3 pt-1">
        <SearchField
          value={text}
          onChangeText={setText}
          placeholder={translate("Cari username")}
          accessibilityLabel={translate("Cari username")}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>

      <ScrollView
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="grow gap-5 px-5 pb-10 pt-1"
      >
        {searchActive ? (
          /* ── Mode cari: hasil username ─────────────────────────────── */
          <View className="gap-2">
            <SectionHeader
              title={translate("Hasil pencarian")}
              subtitle={translate("Ketuk nama untuk mulai mengirim pesan.")}
            />
            {searchQuery.loading && visibleResults.length === 0 ? (
              <View className="py-6">
                <ListLoading />
              </View>
            ) : searchQuery.error ? (
              <ErrorState
                compact
                title={translate("Pencarian gagal")}
                description={searchQuery.error}
                onRetry={() => void searchQuery.reload()}
              />
            ) : visibleResults.length === 0 ? (
              <EmptyState
                compact
                icon={UserCircle}
                title={translate("Username tidak ditemukan")}
                description={translate(
                  "Periksa ejaan username-nya — ditulis tanpa spasi.",
                )}
              />
            ) : (
              visibleResults.map((user, i) =>
                renderSearchRow(user, i < visibleResults.length - 1),
              )
            )}
          </View>
        ) : (
          /* ── Mode daftar: self-chat + kontak tersimpan ──────────────── */
          <>
            <PressableScale
              onPress={() => void openSelfChat()}
              accessibilityRole="button"
              accessibilityLabel={translate("Pesan untuk diri sendiri")}
              accessibilityHint={translate("Membuka catatan pribadi Anda")}
              className="flex-row items-center gap-3 rounded-md border border-border bg-surface px-4 py-3"
            >
              <View className="h-11 w-11 items-center justify-center rounded-full bg-primary/10">
                <Icon icon={NotePencil} size={22} tone="active" />
              </View>
              <View className="min-w-0 flex-1 gap-0.5">
                <Text variant="body" weight={600} tone="primary" numberOfLines={1}>
                  {translate("Pesan untuk diri sendiri")}
                </Text>
                <Text variant="caption" tone="secondary" numberOfLines={1}>
                  {translate("Catatan pribadi, hanya Anda yang melihat")}
                </Text>
              </View>
            </PressableScale>

            <View className="gap-2">
              {/*
                2026-10-08 (permintaan produk): deskripsi "Simpan lewat
                username agar bisa langsung dipesan kapan saja" DIHAPUS —
                judul "Kontak tersimpan" sudah cukup menjelaskan, dan baris
                hasil pencarian memang punya ikon simpan sendiri.
              */}
              <SectionHeader title={translate("Kontak tersimpan")} />
              {savedQuery.loading && savedEntries.length === 0 ? (
                <View className="py-6">
                  <ListLoading />
                </View>
              ) : savedQuery.error ? (
                <ErrorState
                  compact
                  title={translate("Gagal memuat kontak")}
                  description={savedQuery.error}
                  onRetry={() => void savedQuery.reload()}
                />
              ) : savedEntries.length === 0 ? (
                <EmptyState
                  compact
                  icon={Users}
                  title={translate("Belum ada kontak tersimpan")}
                  description={translate(
                    "Cari username di kolom atas, lalu tekan ikon simpan di baris hasil.",
                  )}
                />
              ) : (
                savedEntries.map((entry, i) =>
                  renderSavedRow(entry, i < savedEntries.length - 1),
                )
              )}
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  )
}
