/**
 * Kahade — <ShowcaseSavedCollection> daftar karya tersimpan (perangkat ini).
 *
 * Revisi audit Etalase 2026-09-23 (J-area):
 *  - J-02/N+1: detail TIDAK lagi ditembak `ids.map(getShowcaseDetail)` setiap
 *    render/query-key berubah (25 simpanan = 25 GET tiap buka tab). Kini
 *    per-id, SINGLE-FLIGHT, dan di-cache per sesi — re-render & pindah tab
 *    tidak menghasilkan request sama sekali. (Inflasi viewCount per PERTAMA
 *    ambil tetap ada — sifat kontrak GET detail; lihat issues-etalase.md.)
 *  - J-03: menghapus satu item tidak memuat ulang item lain — cache per id
 *    (dulu kunci query memuat `ids.join` sehingga SEMUA id ditembak ulang).
 *  - J-04: kegagalan dibedakan — 404/403 (dihapus/privat) = auto-prune dari
 *    bookmark + hilang diam-diam; jaringan dsb. = "Gagal memuat — coba lagi"
 *    dengan tombol retry per baris.
 *  - J-05: baris kini memuat thumbnail, judul, penulis, dan harga — bukan
 *    dua tombol ghost tanpa identitas karya.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { Image, View } from "react-native"
import { Trash } from "phosphor-react-native"
import { router } from "expo-router"
import { api, isApiError, userMessage } from "@/lib/api"
import { getShowcaseDetail, type ShowcaseSocialItem } from "@/lib/api/showcase"
import { getSessionRevision } from "@/lib/api/session"
import { useHasSession, useSessionRevision } from "@/lib/guest-gate"
import { showcasePriceLabelOrFallback } from "@/lib/showcase-labels"
import {
  loadShowcaseBookmarks,
  toggleShowcaseSaved,
  useShowcaseSavedIds,
} from "@/lib/showcase-social-prefs"
import { translate } from "@/lib/i18n/translate"
import { ROUTES } from "@/lib/routes"
import { Button } from "@/components/ui/button"
import { Text } from "@/components/ui/text"
import { IconButton } from "@/components/ui/icon-button"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/toast"

type SavedDetailState =
  | { status: "loading" }
  | { status: "ready"; item: ShowcaseSocialItem }
  /** 403/404 — privat atau sudah dihapus (J-04: auto-prune). */
  | { status: "gone" }
  | { status: "error"; message: string }

/**
 * Cache per id per sesi + penerbangan tunggal (single-flight).
 * Modul-level supaya pindah tab/mount ulang tidak mengulang GET detail
 * (J-02/J-03) — entri sesi lain selalu dianggap miss (stempel revisi).
 */
const savedDetails = new Map<string, { revision: number; state: SavedDetailState }>()
const savedFlights = new Map<string, Promise<void>>()

/** Test helper: kosongkan cache antar-test (pengujian N+1 butuh keadaan awal). */
export function __resetSavedCollectionCache(): void {
  savedDetails.clear()
  savedFlights.clear()
}

function loadSavedDetail(id: string, revision: number): Promise<void> {
  // J-02/J-03: cache hidup per id per sesi — remount/tab-switch tanpa GET.
  const cached = savedDetails.get(id)
  if (cached && cached.revision === revision) return Promise.resolve()
  const flight = savedFlights.get(id)
  if (flight) return flight
  const task = (async () => {
    try {
      const item = await getShowcaseDetail(id)
      savedDetails.set(id, { revision: getSessionRevision(), state: { status: "ready", item } })
    } catch (err) {
      const gone = isApiError(err) && (err.status === 404 || err.status === 403)
      savedDetails.set(id, {
        revision: getSessionRevision(),
        state: gone
          ? { status: "gone" }
          : { status: "error", message: userMessage(err) },
      })
    } finally {
      savedFlights.delete(id)
    }
  })()
  savedFlights.set(id, task)
  return task
}

export function ShowcaseSavedCollection() {
  const ids = useShowcaseSavedIds()
  const session = useHasSession()
  const revision = useSessionRevision()
  const toast = useToast()
  const [states, setStates] = useState<Record<string, SavedDetailState>>({})
  /** Pemicu ulang manual untuk tombol retry per baris (J-04). */
  const [retryNonce, setRetryNonce] = useState(0)

  useEffect(() => {
    if (!session) return
    void api.users
      .getMeCached()
      .then(async (me) => {
        if (revision === getSessionRevision()) await loadShowcaseBookmarks(me.id)
      })
      .catch((error) =>
        toast.show({
          title: "Gagal memuat karya tersimpan",
          description: userMessage(error),
          tone: "danger",
        }),
      )
  }, [session, revision, toast])

  // ids dari store lokal — kunci efek pakai bentuk nilainya (bukan identitas
  // array) agar render lain tidak memicu mutasi baca.
  const idsKey = ids.join(",")
  useEffect(() => {
    if (!session || ids.length === 0) {
      setStates({})
      return
    }
    let alive = true
    void (async () => {
      await Promise.all(ids.map((id) => loadSavedDetail(id, revision)))
      if (!alive) return
      const next: Record<string, SavedDetailState> = {}
      for (const id of ids) {
        const entry = savedDetails.get(id)
        next[id] =
          entry && entry.revision === revision
            ? entry.state
            : { status: "error", message: translate("Gagal memuat — coba lagi") }
      }
      setStates(next)
      // J-04: auto-prune bookmark yang sudah hilang/privat — diam-diam.
      for (const id of ids) {
        if (next[id]?.status === "gone") toggleShowcaseSaved(id)
      }
    })()
    return () => {
      alive = false
    }
    // ids dibaca lewat idsKey (nilai, bukan identitas array) — lihat komentar di atas.
  }, [session, revision, idsKey, retryNonce])

  const retryOne = useCallback((id: string) => {
    savedDetails.delete(id)
    setRetryNonce((n) => n + 1)
  }, [])

  const rows = useMemo(
    () => ids.map((id) => ({ id, state: states[id] ?? { status: "loading" as const } })),
    [ids, states],
  )

  return (
    <View className="gap-3 pb-5">
      <Text variant="h3">Karya tersimpan</Text>
      <Text variant="caption" tone="secondary">
        Maksimal 25 karya di perangkat ini. Simpanan dihapus saat keluar akun.
      </Text>
      {rows.map(({ id, state }) => {
        if (state.status === "gone") return null
        if (state.status === "loading") {
          return (
            <View key={id} className="flex-row items-center gap-3 rounded-md border border-border p-3">
              <Skeleton className="h-14 w-14" shape="card" />
              <View className="flex-1 gap-2">
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="h-3 w-2/5" />
              </View>
            </View>
          )
        }
        if (state.status === "error") {
          return (
            <View key={id} className="gap-2 rounded-md border border-border p-3">
              {/* J-04: gagal jaringan ≠ karya hilang — pesan & aksi berbeda. */}
              <Text variant="caption" tone="secondary">
                {state.message || translate("Gagal memuat — coba lagi")}
              </Text>
              <Button variant="ghost" onPress={() => retryOne(id)}>
                Coba lagi
              </Button>
            </View>
          )
        }
        const item = state.item
        const cover = item.images[0]?.imageUrl
        return (
          <View key={id} className="flex-row items-center gap-3 rounded-md border border-border p-3">
            <Button
              variant="ghost"
              fullWidth={false}
              onPress={() => router.push(ROUTES.showcaseDetail(id))}
              accessibilityLabel={translate("Buka karya {x}", { x: item.title || translate("Tanpa judul") })}
            >
              {/* J-05: thumbnail + identitas karya, bukan dua tombol telanjang. */}
              <View className="flex-row items-center gap-3 pr-2">
                {cover ? (
                  <Image
                    source={{ uri: cover }}
                    className="h-14 w-14 rounded-sm bg-surface"
                    accessibilityLabel={item.title || translate("Foto karya")}
                  />
                ) : (
                  <View className="h-14 w-14 rounded-sm bg-surface" />
                )}
                <View className="max-w-[180px] gap-0.5">
                  <Text variant="body" numberOfLines={1}>
                    {item.title || translate("Tanpa judul")}
                  </Text>
                  <Text variant="caption" tone="secondary" numberOfLines={1}>
                    @{item.author.username} · {showcasePriceLabelOrFallback(item)}
                  </Text>
                </View>
              </View>
            </Button>
            <View className="flex-1" />
            <IconButton
              icon={Trash}
              variant="ghost"
              size="sm"
              accessibilityLabel={translate("Hapus karya tersimpan")}
              onPress={() => toggleShowcaseSaved(id)}
            />
          </View>
        )
      })}
      {rows.length === 0 ? <Text tone="secondary">Belum ada karya tersimpan</Text> : null}
    </View>
  )
}
