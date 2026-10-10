/**
 * Bottom sheet daftar penyuka & penyimpan karya Etalase.
 *
 * Kontrak final Tim A #5 (2026-09-28):
 * - Tab "Disukai" — GET /v1/showcase/:id/likers (publik).
 * - Tab "Disimpan" — GET /v1/showcase/:id/savers (HANYA pemilik).
 *   403 `SHOWCASE_FORBIDDEN` = viewer bukan pemilik → tab disembunyikan
 *   dengan elegan (fail closed, tanpa error mencolok).
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { View } from "react-native"
import { router } from "expo-router"

import { Heart, BookmarkSimple } from "phosphor-react-native"
import { Avatar } from "@/components/ui/avatar"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, type TabItem } from "@/components/ui/tabs"
import { Text } from "@/components/ui/text"
import {
  getShowcaseLikers,
  getShowcaseSavers,
  type ShowcaseLiker,
} from "@/lib/api/showcase"
import { isApiError, userMessage } from "@/lib/api"
import { cn } from "@/lib/cn"
import { focusRing } from "@/lib/focus-ring"
import { formatRelativeTime } from "@/lib/format"
import { translate } from "@/lib/i18n/translate"
import { useLanguage } from "@/lib/i18n"
import { ROUTES } from "@/lib/routes"
import { useHasSession } from "@/lib/guest-gate"
import { logWarn } from "@/lib/telemetry"

export type LikersTab = "likers" | "savers"

type Props = {
  visible: boolean
  onClose: () => void
  itemId: string
  likeCount: number
  saveCount: number
  /** Pemilik karya — satu-satunya yang boleh melihat tab penyimpan. */
  canViewSavers: boolean
  initialTab?: LikersTab
}

type Person = {
  key: string
  username: string | null
  fullName: string | null
  avatarUrl: string | null
  at: string | null
}

type TabState = {
  data: Person[]
  /** NP-008: cursor halaman berikutnya (null = habis). Menggantikan nomor halaman. */
  nextCursor: string | null
  hasNext: boolean
  status: "idle" | "loading" | "error" | "end"
  /** UX-15: pesan error sebenarnya (offline/timeout/5xx) — bukan tebakan "periksa koneksi". */
  message?: string
}

const EMPTY_TAB: TabState = { data: [], nextCursor: null, hasNext: false, status: "idle" }
const PAGE_LIMIT = 20

function toPerson(liker: ShowcaseLiker): Person {
  return {
    key: liker.userId,
    username: liker.username ?? null,
    fullName: liker.fullName ?? null,
    avatarUrl: liker.avatarUrl ?? null,
    at: liker.at || null,
  }
}

export function ShowcaseLikersSheet({
  visible,
  onClose,
  itemId,
  likeCount,
  saveCount,
  canViewSavers,
  initialTab = "likers",
}: Props) {
  useLanguage()
  // H-04: profil = layar terproteksi — tamu diarahkan ke loginRequired.
  const hasSession = useHasSession()
  const [tab, setTab] = useState<LikersTab>(initialTab)
  /**
   * 403 saat memuat penyimpan = viewer ternyata bukan pemilik (mis. item
   * dibagikan setelah kepemilikan berubah) → sembunyikan tab dengan elegan.
   */
  const [saversForbidden, setSaversForbidden] = useState(false)
  const [likers, setLikers] = useState<TabState>(EMPTY_TAB)
  const [savers, setSavers] = useState<TabState>(EMPTY_TAB)
  /**
   * T2-F01 (audit UI/UX 2026-09-28): satu abortRef untuk dua tab membuat
   * ganti tab cepat MEMBUNUHKAN request tab lama — statusnya macet di
   * "loading" selamanya (effect auto-fetch hanya jalan dari "idle").
   * Controller kini di-scope PER TAB: tab lain tidak pernah dibatalkan,
   * dua tab boleh memuat bersamaan.
   */
  const abortRefs = useRef<Record<LikersTab, AbortController | null>>({
    likers: null,
    savers: null,
  })

  // Reset tiap dibuka.
  useEffect(() => {
    if (!visible) return
    setTab(canViewSavers ? initialTab : "likers")
    setSaversForbidden(false)
    setLikers(EMPTY_TAB)
    setSavers(EMPTY_TAB)
  }, [visible, itemId, canViewSavers, initialTab])

  const fetchTab = useCallback(
    // NP-008: `cursor` null = halaman pertama; string = lanjutkan keyset.
    async (which: LikersTab, cursor: string | null, append: boolean) => {
      // Batalkan hanya request TAB YANG SAMA yang masih berjalan (mis. spam
      // "Muat lebih banyak") — request tab lain dibiarkan selesai.
      abortRefs.current[which]?.abort()
      const controller = new AbortController()
      abortRefs.current[which] = controller
      const setState = which === "likers" ? setLikers : setSavers
      setState((prev) => ({ ...prev, status: "loading" }))
      try {
        const res =
          which === "likers"
            ? await getShowcaseLikers(itemId, { cursor, limit: PAGE_LIMIT }, controller.signal)
            : await getShowcaseSavers(itemId, { cursor, limit: PAGE_LIMIT }, controller.signal)
        if (controller.signal.aborted) return
        setState((prev) => ({
          data: append ? [...prev.data, ...res.data.map(toPerson)] : res.data.map(toPerson),
          // NP-008: habis bila server tak mengembalikan nextCursor.
          nextCursor: res.nextCursor ?? null,
          hasNext: res.nextCursor != null,
          status: res.nextCursor != null ? "idle" : "end",
        }))
      } catch (error) {
        if (controller.signal.aborted) return
        if (which === "savers" && isApiError(error) && error.backendCode === "SHOWCASE_FORBIDDEN") {
          // Fail closed: bukan pemilik → tab penyimpan hilang begitu saja.
          setSaversForbidden(true)
          setTab("likers")
          return
        }
        logWarn("showcase:likers-sheet", error instanceof Error ? error : new Error(String(error)))
        setState((prev) => ({ ...prev, status: "error", message: userMessage(error) }))
      }
    },
    [itemId],
  )

  useEffect(() => {
    if (!visible) return
    if (tab === "savers" && (!canViewSavers || saversForbidden)) return
    const state = tab === "likers" ? likers : savers
    if (state.status === "idle" && state.data.length === 0) void fetchTab(tab, null, false)
  }, [visible, tab, canViewSavers, saversForbidden, likers, savers, fetchTab])

  useEffect(
    () => () => {
      abortRefs.current.likers?.abort()
      abortRefs.current.savers?.abort()
    },
    [],
  )

  const active: TabState = tab === "likers" ? likers : savers
  const showSaversTab = canViewSavers && !saversForbidden

  const tabItems: TabItem<LikersTab>[] = showSaversTab
    ? [
        { value: "likers", label: translate("Disukai"), count: likeCount },
        { value: "savers", label: translate("Disimpan"), count: saveCount },
      ]
    : [{ value: "likers", label: translate("Disukai"), count: likeCount }]

  const displayName = (p: Person) => p.fullName || (p.username ? `@${p.username}` : translate("Pengguna"))

  return (
    <BottomSheet
      visible={visible}
      onRequestClose={onClose}
      title={translate("Suka & simpan")}
      padding="none"
    >
      <View className="px-5 pb-6">
        {/* Tab — komponen <Tabs> underline bawaan design system. */}
        {showSaversTab ? (
          <Tabs items={tabItems} value={tab} onChange={setTab} />
        ) : null}

        {/* Daftar */}
        {active.status === "loading" && active.data.length === 0 ? (
          <View className="gap-3 pt-1">
            {[0, 1, 2].map((i) => (
              <View key={i} className="flex-row items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <View className="flex-1 gap-1.5">
                  <Skeleton className="h-4 w-2/5 rounded" />
                  <Skeleton className="h-3 w-1/4 rounded" />
                </View>
              </View>
            ))}
          </View>
        ) : active.status === "error" ? (
          <View className="items-center gap-3 py-6">
            <Text variant="body" tone="secondary" className="text-center">
              {active.message || translate("Gagal memuat daftar.")}
            </Text>
            <Button variant="secondary" onPress={() => void fetchTab(tab, null, false)}>
              {translate("Coba lagi")}
            </Button>
          </View>
        ) : active.data.length === 0 ? (
          <EmptyState
            icon={tab === "likers" ? Heart : BookmarkSimple}
            title={tab === "likers" ? translate("Belum ada yang menyukai") : translate("Belum ada yang menyimpan")}
            description={
              tab === "likers"
                ? translate("Jadilah yang pertama menyukai etalase ini.")
                : translate("Etalase ini belum disimpan siapa pun.")
            }
          />
        ) : (
          <View>
            {active.data.map((person) => {
              // Item 52: baris tanpa username TIDAK bisa diketuk (bukan tombol)
              // dan TIDAK boleh menutup sheet tanpa navigasi.
              const rowContent = (
                <>
                  <Avatar source={person.avatarUrl ?? undefined} name={displayName(person)} size="md" />
                  <View className="flex-1">
                    <Text variant="label" numberOfLines={1}>
                      {displayName(person)}
                    </Text>
                    {person.username && person.fullName ? (
                      <Text variant="caption" tone="secondary" numberOfLines={1}>
                        @{person.username}
                      </Text>
                    ) : null}
                  </View>
                  {person.at ? (
                    <Text variant="caption" tone="tertiary">
                      {formatRelativeTime(person.at)}
                    </Text>
                  ) : null}
                </>
              )
              if (!person.username) {
                return (
                  <View key={person.key} className="flex-row items-center gap-3 py-2.5">
                    {rowContent}
                  </View>
                )
              }
              return (
                <PressableScale
                  key={person.key}
                  accessibilityRole="button"
                  accessibilityLabel={translate("Lihat profil {x}", {
                    x: person.fullName?.trim() || `@${person.username}`,
                  })}
                  // Item 52 (FE-IMP-1): baris penyuka/penyimpan BISA diketuk → profil.
                  onPress={() => {
                    onClose()
                    router.push(
                      hasSession
                        ? ROUTES.userProfile(person.username as string)
                        : ROUTES.loginRequired(`/user/${encodeURIComponent(person.username as string)}`),
                    )
                  }}
                  containerClassName={cn("-mx-2 rounded-md px-2", focusRing)}
                  className="flex-row items-center gap-3 py-2.5"
                >
                  {rowContent}
                </PressableScale>
              )
            })}
            {active.status === "idle" && active.hasNext ? (
              <Button
                variant="ghost"
                fullWidth
                onPress={() => void fetchTab(tab, active.nextCursor, true)}
              >
                {translate("Muat lebih banyak")}
              </Button>
            ) : null}
            {active.status === "loading" && active.data.length > 0 ? (
              <View className="gap-3 pt-2">
                <Skeleton className="h-12 w-full rounded" />
              </View>
            ) : null}
          </View>
        )}
      </View>
    </BottomSheet>
  )
}
