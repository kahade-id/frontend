/**
 * Kahade — <ProfileEtalaseTab>: isi tab "Etalase" di profil publik user.
 *
 * Diekstrak dari app/user/[username].tsx (G-11: god component hanya boleh
 * menyusut). Seluruh logika sosial tab ini hidup di sini supaya layar induk
 * tinggal memegang data mentah + navigasi tab.
 *
 * PRINSIP UTAMA (permintaan produk A.5): list tab ini SAMA PERSIS dengan
 * list halaman Etalase — komponen <ShowcaseFeedItem> yang sama dan
 * parameter jarak yang sama.
 *
 * Revisi audit Etalase (2026-09-23):
 *  - C-01: induk meneruskan `error` + `onRetry` — gagal memuat tidak lagi
 *    tampil sebagai "belum ada konten"; ErrorState compact + Coba lagi.
 *  - C-03: "Laporkan" memakai <ShowcaseReportSheet> (POST /showcase/{id}/
 *    report) — BUKAN lagi endpoint lapor-pengguna dengan ID showcase.
 *  - C-05: patch komentar di-reset saat identitas `items` berubah karena
 *    refresh jaringan — angka optimistis tidak menimpa nilai server baru.
 *  - C-06/A-05/A-06: suka & simpan lewat `useShowcaseSocialActions` (store
 *    bersama + gate tamu ke login-required); identik dengan feed & detail.
 *  - C-07/J-04: normalisasi via `toSocialShowcaseItem` bersama — judul
 *    fallback netral "Tanpa judul", cover ikut urutan resolver kanonik.
 *  - B-05 parity: item dari profil sendiri ditandai isOwner (via
 *    toSocialShowcaseItem isSelf) — bendera lapor tidak muncul di karya
 *    sendiri.
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { View } from "react-native"
import { router } from "expo-router"
import { Images, Plus } from "phosphor-react-native"

import type { ShowcaseSocialItem } from "@/lib/api/showcase"
import type { ShowcaseItem } from "@/lib/api/users"
import { ROUTES } from "@/lib/routes"
import { toSocialShowcaseItem, type ShowcaseOwner } from "@/lib/showcase-social"
import { tokens } from "@/lib/tokens"
import { useShowcaseSocialActions } from "@/lib/use-showcase-social-actions"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { ListLoading } from "@/components/ui/paginated-list"
import { ShowcaseCommentsSheet } from "@/components/ui/showcase-comments-sheet"
import { ShowcaseFeedItem } from "@/components/ui/showcase-feed-item"
import { ShowcaseReportSheet } from "@/components/ui/showcase-report-sheet"
import {
  showcaseCommentCountSeq,
  showcaseCommentCountsSince,
  useShowcaseCommentCountSeq,
} from "@/lib/showcase-social-prefs"
import { translate } from "@/lib/i18n/translate"

/** Pemilik profil — penulis semua item etalase (endpoint sudah per-username). */
export type EtalaseOwner = ShowcaseOwner

export type ProfileEtalaseTabProps = {
  /** Item mentah dari GET /v1/users/{username}/showcase. */
  items: ShowcaseItem[]
  loading: boolean
  /** C-01: gagal memuat tab — string pesan, bukan empty-state. */
  error?: string | null
  onRetry?: () => void
  /** Username profil (tanpa @) — untuk copy empty state. */
  handle: string
  owner: EtalaseOwner
  /** Apakah ini profil milik pengguna sendiri */
  isSelf?: boolean
}

/**
 * Kartu memo: membaca state sosialnya sendiri (store bersama) — menekan ♥
 * di sini langsung terlihat di feed/detail dan sebaliknya (A-07/C-06).
 */
const EtalaseCard = memo(function EtalaseCard({
  item,
  divider,
  onOpenComments,
  onReport,
}: {
  item: ShowcaseSocialItem
  divider: boolean
  onOpenComments: (item: ShowcaseSocialItem) => void
  onReport: (item: ShowcaseSocialItem) => void
}) {
  const { liked, likeCount, saved, likePending, savedPending, toggleLike, toggleSave, share } =
    useShowcaseSocialActions(item)
  const display =
    liked === (item.isLiked === true) && likeCount === item.likeCount
      ? item
      : { ...item, isLiked: liked, likeCount }
  return (
    <ShowcaseFeedItem
      item={display}
      onPress={() => router.push(ROUTES.showcaseDetail(item.id))}
      onToggleLike={toggleLike}
      onOpenComments={() => onOpenComments(item)}
      onToggleSave={toggleSave}
      saved={saved}
      likePending={likePending}
      savePending={savedPending}
      onShare={share}
      onReport={() => onReport(item)}
      divider={divider}
    />
  )
})

export function ProfileEtalaseTab({
  items,
  loading,
  error,
  onRetry,
  handle,
  owner,
  isSelf = false,
}: ProfileEtalaseTabProps) {
  /** Item yang komentarnya sedang dibuka (null = tertutup). */
  const [renderLimit, setRenderLimit] = useState(20)
  useEffect(() => { setRenderLimit(20) }, [handle])
  const [commentItem, setCommentItem] = useState<ShowcaseSocialItem | null>(null)
  /** C-03: item yang sedang dilaporkan (null = tertutup). */
  const [reportItem, setReportItem] = useState<ShowcaseSocialItem | null>(null)

  /**
   * Normalisasi raw → sosial adalah TURUNAN MURNI. `isSelf` menandai
   * kepemilikan (moderasi + sembunyikan bendera, paritas B-05).
   */
  const {
    id: ownerId,
    username: ownerUsername,
    fullName: ownerFullName,
    avatarUrl: ownerAvatarUrl,
    verified: ownerVerified,
  } = owner
  const socialItems = useMemo(
    () =>
      items.map((item) =>
        toSocialShowcaseItem(
          item,
          {
            id: ownerId,
            username: ownerUsername,
            fullName: ownerFullName,
            avatarUrl: ownerAvatarUrl,
            verified: ownerVerified,
          },
          isSelf,
        ),
      ),
    [items, isSelf, ownerId, ownerUsername, ownerFullName, ownerAvatarUrl, ownerVerified],
  )

  /**
   * Patch lokal kini HANYA hitungan komentar (suka/simpan hidup di store
   * bersama). C-05: patch dibuang saat `items` berubah identitas karena
   * refresh jaringan — angka server terbaru yang menang lagi.
   *
   * F-01/F-03 (audit 2026-09-24): sumber patch = LEDGER hitungan komentar
   * (`queueShowcaseCommentCount`) yang sama dengan feed, sehingga komentar
   * dari sheet/detail ikut terlihat di sini tanpa refetch. Watermark menjaga
   * event yang sudah diterapkan tidak dihitung dua kali.
   */
  const [patches, setPatches] = useState<Record<string, Partial<ShowcaseSocialItem>>>({})
  const commentSeq = useShowcaseCommentCountSeq()
  const appliedCommentSeq = useRef(showcaseCommentCountSeq())
  const prevItems = useRef(items)
  useEffect(() => {
    if (prevItems.current !== items) {
      prevItems.current = items
      // Data jaringan baru = patch lama usang; watermark ikut maju karena
      // respons ini sudah memuat semua event sampai titik sekarang.
      appliedCommentSeq.current = showcaseCommentCountSeq()
      setPatches({})
    }
  }, [items])

  useEffect(() => {
    const { events, seq } = showcaseCommentCountsSince(appliedCommentSeq.current)
    if (events.length === 0) return
    appliedCommentSeq.current = seq
    setPatches((previous) => {
      const next = { ...previous }
      for (const event of events) {
        const base =
          next[event.id]?.commentCount ??
          socialItems.find((entry) => entry.id === event.id)?.commentCount ??
          0
        next[event.id] = { ...next[event.id], commentCount: Math.max(0, base + event.delta) }
      }
      return next
    })
  }, [commentSeq, socialItems])
  const patchedItems = useMemo(
    () =>
      socialItems.map((entry) => (patches[entry.id] ? { ...entry, ...patches[entry.id] } : entry)),
    [socialItems, patches],
  )

  const handleOpenComments = useCallback((item: ShowcaseSocialItem) => {
    setCommentItem(item)
  }, [])
  const handleOpenReport = useCallback((item: ShowcaseSocialItem) => {
    setReportItem(item)
  }, [])

  return (
    <>
      <View className="pt-4" style={{ gap: tokens.space[5] }}>
        {loading ? (
          <View className="px-5">
            <ListLoading />
          </View>
        ) : error ? (
          // C-01: gagal memuat ≠ kosong — selalu ada jalan mencoba ulang.
          <View className="px-5">
            <ErrorState
              compact
              title="Gagal memuat etalase"
              description={error}
              onRetry={onRetry}
            />
          </View>
        ) : patchedItems.length === 0 ? (
          <View className="px-5">
            {isSelf ? (
              <EmptyState
                icon={Images}
                title="Belum ada etalase"
                description="Anda belum menambahkan karya atau produk ke etalase."
                action={
                  <Button
                    variant="secondary"
                    fullWidth={false}
                    leftIcon={Plus}
                    onPress={() => router.push(ROUTES.showcaseManagement)}
                  >
                    Tambah karya
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={Images}
                title="Belum ada konten"
                description={translate("@{x} belum membagikan foto atau karya produk.", {
                  x: handle,
                })}
              />
            )}
          </View>
        ) : (
          <>
            {patchedItems.slice(0, renderLimit).map((item, index) => (
              <EtalaseCard
                key={item.id}
                item={item}
                // H-05 (audit 2026-09-23): divider dihitung dari SLICE yang
                // dirender — kartu terakhir sebelum "Tampilkan lainnya" tidak
                // lagi diberi garis seolah masih ada kartu sesudahnya.
                divider={index < Math.min(renderLimit, patchedItems.length) - 1}
                onOpenComments={handleOpenComments}
                onReport={handleOpenReport}
              />
            ))}
            {patchedItems.length > renderLimit ? <Button variant="ghost" onPress={() => setRenderLimit((limit) => limit + 20)}>Tampilkan karya lainnya</Button> : null}
            {/* E-03: taut ke layar galeri grid publik (jangan biarkan kode mati). */}
            <View className="px-5">
              <Button
                variant="ghost"
                onPress={() => router.push(ROUTES.userShowcase(handle))}
              >
                Lihat sebagai galeri
              </Button>
            </View>
          </>
        )}
      </View>

      {/* Komentar dibaca & ditulis di sheet — paritas dengan halaman
          Etalase (pengguna tidak kehilangan posisi list). */}
      <ShowcaseCommentsSheet item={commentItem} onRequestClose={() => setCommentItem(null)} />

      {/* C-03: lapor ITEM ke endpoint showcase, sheet bersama (A-11). */}
      <ShowcaseReportSheet item={reportItem} onRequestClose={() => setReportItem(null)} />
    </>
  )
}
