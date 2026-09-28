/**
 * Kahade — <ShowcaseSavedCollection>: daftar karya tersimpan dari server.
 *
 * Mega-batch FE-IMP-1, item 54: dimigrasikan dari bookmark lokal + N+1 GET
 * detail per id ke endpoint backend `GET /v1/showcase/saved` (?cursor&limit,
 * NP-008 keyset, kartu bentuk feed + `savedAt`). Server adalah source of
 * truth; store lokal hanya cache status simpan untuk kartu feed/detail.
 *
 * Perilaku:
 *  - Paginasi "Muat lagi" (hasNext dari server).
 *  - Hapus per baris: optimistis + rollback (muat ulang) bila gagal; store
 *    lokal ikut disinkronkan agar kartu feed/detail tidak basi.
 *  - Item rusak dilewati per-item oleh parser (DRIFT-04), tidak meruntuhkan
 *    koleksi.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { View } from "react-native"

import { Picture } from "@/components/ui/picture"
import { Trash } from "phosphor-react-native"
import { router } from "expo-router"
import { isApiError, userMessage } from "@/lib/api"
import {
  getSavedShowcases,
  removeSavedShowcase,
  type SavedShowcaseEntry,
} from "@/lib/api/showcase"
import { getSessionRevision } from "@/lib/api/session"
import { useHasSession, useSessionRevision } from "@/lib/guest-gate"
import { setShowcaseSavedState } from "@/lib/showcase-social-prefs"
import { translate } from "@/lib/i18n/translate"
import { formatRelativeTime } from "@/lib/format"
import { ROUTES } from "@/lib/routes"
import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"
import { IconButton } from "@/components/ui/icon-button"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/toast"

const PAGE_LIMIT = 20

type ListState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready" }
  | { status: "error"; message: string }

export function ShowcaseSavedCollection() {
  const session = useHasSession()
  const revision = useSessionRevision()
  const toast = useToast()
  const [entries, setEntries] = useState<SavedShowcaseEntry[]>([])
  const [listState, setListState] = useState<ListState>({ status: "idle" })
  /** NP-008: cursor keyset menggantikan nomor halaman. */
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasNext, setHasNext] = useState(false)
  const [total, setTotal] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)
  /**
   * T2-F04 (audit UI/UX 2026-09-28): gagal load-more TIDAK boleh menghapus
   * daftar yang sudah termuat — error ditampilkan inline dengan tombol
   * "Coba lagi", daftar dipertahankan (pola product-stats-section.tsx).
   */
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null)
  const [removingIds, setRemovingIds] = useState<ReadonlySet<string>>(new Set())
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(async (cursor: string | null, append: boolean) => {
    const rev = getSessionRevision()
    setLoadMoreError(null)
    if (append) setLoadingMore(true)
    else setListState({ status: "loading" })
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const result = await getSavedShowcases(
        { cursor, limit: PAGE_LIMIT },
        controller.signal,
      )
      if (rev !== getSessionRevision()) return
      setEntries((prev) => (append ? [...prev, ...result.data] : result.data))
      setNextCursor(result.nextCursor ?? null)
      setHasNext(result.nextCursor != null)
      setTotal(result.total)
      setListState({ status: "ready" })
    } catch (error) {
      if (rev !== getSessionRevision()) return
      if (isApiError(error) && error.code === "ABORTED") return
      // T2-F04: gagal APPEND (load-more) → pertahankan daftar, error inline.
      if (append) {
        setLoadMoreError(userMessage(error) || translate("Gagal memuat — coba lagi"))
        return
      }
      setListState({
        status: "error",
        message: userMessage(error),
      })
    } finally {
      if (rev === getSessionRevision()) setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    if (!session) {
      setEntries([])
      setListState({ status: "idle" })
      return
    }
    void load(null, false)
    return () => {
      abortRef.current?.abort()
    }
    // Muat ulang saat sesi berubah (login/logout/ganti akun).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, revision])

  const loadMore = useCallback(() => {
    if (loadingMore || !hasNext) return
    void load(nextCursor, true)
  }, [loadingMore, hasNext, nextCursor, load])

  const removeOne = useCallback(
    (id: string) => {
      if (removingIds.has(id)) return
      setRemovingIds((prev) => new Set(prev).add(id))
      // Optimistis: keluarkan dari daftar langsung.
      setEntries((prev) => prev.filter((e) => e.item.id !== id))
      setTotal((t) => Math.max(0, t - 1))
      void (async () => {
        const rev = getSessionRevision()
        try {
          await removeSavedShowcase(id)
          if (rev !== getSessionRevision()) return
          // Sinkronkan cache lokal agar kartu feed/detail tidak basi.
          setShowcaseSavedState(id, false)
        } catch (error) {
          if (rev !== getSessionRevision()) return
          // Rollback: muat ulang dari server (keadaan akhir pasti benar).
          toast.show({
            title: translate("Gagal menghapus simpanan"),
            description: userMessage(error),
            tone: "danger",
          })
          await load(null, false)
        } finally {
          if (rev === getSessionRevision()) {
            setRemovingIds((prev) => {
              const next = new Set(prev)
              next.delete(id)
              return next
            })
          }
        }
      })()
    },
    [removingIds, toast, load],
  )

  if (!session) {
    return (
      <View className="gap-3 pb-5">
        <Text variant="h3">Karya tersimpan</Text>
        <Text tone="secondary">{translate("Masuk untuk melihat karya yang Anda simpan.")}</Text>
      </View>
    )
  }

  return (
    <View className="gap-3 pb-5">
      <Text variant="h3">Karya tersimpan</Text>
      {listState.status === "ready" ? (
        <Text variant="caption" tone="secondary">
          {translate("{x} karya tersimpan di akun Anda.", { x: total })}
        </Text>
      ) : null}

      {listState.status === "loading" ? (
        <View className="gap-3">
          {[0, 1, 2].map((i) => (
            <View key={i} className="flex-row items-center gap-3 rounded-md border border-border p-3">
              <Skeleton className="h-14 w-14" shape="card" />
              <View className="flex-1 gap-2">
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="h-3 w-2/5" />
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {listState.status === "error" ? (
        <View className="gap-2 rounded-md border border-border p-3">
          <Text variant="caption" tone="secondary">
            {listState.message || translate("Gagal memuat — coba lagi")}
          </Text>
          <Button variant="ghost" onPress={() => load(null, false)}>
            {translate("Coba lagi")}
          </Button>
        </View>
      ) : null}

      {listState.status === "ready"
        ? entries.map(({ item, savedAt }) => {
            // Kontrak final Tim A (2026-09-28): entri video memakai thumbnailUrl
            // sebagai cover (imageUrl-nya = berkas video).
            const first = item.images[0]
            const cover = first?.kind === "video" ? (first.thumbnailUrl ?? first.imageUrl) : first?.imageUrl
            const id = item.id
            return (
              <View key={id} className="flex-row items-center gap-3 rounded-md border border-border p-3">
                <Button
                  variant="ghost"
                  fullWidth={false}
                  containerClassName="min-w-0 flex-1"
                  onPress={() => router.push(ROUTES.showcaseDetail(id))}
                  accessibilityLabel={translate("Buka karya {x}", { x: item.title || translate("Tanpa judul") })}
                >
                  <View className="flex-row items-center gap-3 pr-2">
                    {/* P-01 (audit 2026-09-24): <Picture> kanonik — paritas
                        proteksi unggah/unduh (preventDownload) & recyclingKey
                        dengan feed, detail, dan galeri. */}
                    {cover ? (
                      <Picture
                        source={cover}
                        alt={item.title || translate("Foto karya")}
                        width={56}
                        height={56}
                        radius="sm"
                        preventDownload
                        recyclingKey={id}
                        className="bg-surface"
                      />
                    ) : (
                      <View className="h-14 w-14 rounded-sm bg-surface" />
                    )}
                    {/* T2-F10: kolom teks fleksibel (dulu max-w-[180px] tetap) —
                        judul panjang memanfaatkan ruang layar yang ada. */}
                    <View className="min-w-0 flex-1 gap-0.5">
                      <Text variant="body" numberOfLines={1}>
                        {item.title || translate("Tanpa judul")}
                      </Text>
                      <Text variant="caption" tone="secondary" numberOfLines={1}>
                        @{item.author.username}
                      </Text>
                      <Text variant="caption" tone="secondary" numberOfLines={1}>
                        {translate("Disimpan {x}", { x: formatRelativeTime(savedAt) })}
                      </Text>
                    </View>
                  </View>
                </Button>
                <IconButton
                  icon={Trash}
                  variant="ghost"
                  size="sm"
                  accessibilityLabel={translate("Hapus karya tersimpan")}
                  onPress={() => removeOne(id)}
                  disabled={removingIds.has(id)}
                />
              </View>
            )
          })
        : null}

      {listState.status === "ready" && hasNext ? (
        loadMoreError ? (
          // T2-F04: daftar tetap tampil di atas; error + retry inline di sini.
          <View className="gap-2 rounded-md border border-border p-3">
            <Text variant="caption" tone="secondary">
              {loadMoreError}
            </Text>
            <Button variant="ghost" onPress={loadMore} disabled={loadingMore}>
              {translate("Coba lagi")}
            </Button>
          </View>
        ) : (
          <Button variant="secondary" onPress={loadMore} disabled={loadingMore}>
            {loadingMore ? translate("Memuat…") : translate("Muat lagi")}
          </Button>
        )
      ) : null}

      {listState.status === "ready" && entries.length === 0 ? (
        <Text tone="secondary">{translate("Belum ada karya tersimpan")}</Text>
      ) : null}
    </View>
  )
}
