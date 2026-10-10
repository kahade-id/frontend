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
import { ShowcaseFeedSkeleton } from "@/components/ui/showcase-feed-skeleton"
import { ShowcaseCommentsSheet } from "@/components/ui/showcase-comments-sheet"
import { ShowcaseFeedItem } from "@/components/ui/showcase-feed-item"
import { prefetchShowcaseDetail } from "@/lib/showcase-detail-prefetch"
import { ShowcaseReportSheet } from "@/components/ui/showcase-report-sheet"
import { ShowcaseShareSheet } from "@/components/ui/showcase-share-sheet"
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
 *
 * FS-001 (audit performa): `autoplay={false}` SELALU — kartu ini dirender
 * di dalam ScrollView profil tanpa viewability wiring seperti feed utama,
 * jadi autoplay membuat 2 video pertama memegang slot player (cap LR-008)
 * dan terus memutar walau off-screen. Video profil hanya diputar via ketuk
 * eksplisit (konsisten dengan gerbang WiFi-only NP-002). FD-02 (audit
 * etalase 2026-10-10): dulu memakai `autoplayActive={false}` yang ikut
 * mematikan ketuk eksplisit — tombol putar tidak melakukan apa-apa.
 *
 * FS-002 (audit performa): memo yang TIDAK jebol — `display` di-memo dan
 * semua callback ke <ShowcaseFeedItem> stabil (useCallback), sehingga
 * buka/tutup sheet komentar tidak me-render ulang semua kartu.
 */
const EtalaseCard = memo(function EtalaseCard({
  item,
  divider,
  onOpenComments,
  onReport,
  onManage,
}: {
  item: ShowcaseSocialItem
  divider: boolean
  onOpenComments: (item: ShowcaseSocialItem) => void
  onReport: (item: ShowcaseSocialItem) => void
  onManage: (item: ShowcaseSocialItem) => void
}) {
  const { liked, likeCount, saved, likePending, savedPending, toggleLike, toggleSave, share, shareSheetVisible, setShareSheetVisible } =
    useShowcaseSocialActions(item)
  const display = useMemo(
    () =>
      liked === (item.isLiked === true) && likeCount === item.likeCount
        ? item
        : { ...item, isLiked: liked, likeCount },
    [liked, likeCount, item],
  )
  // C05 (batch 139): prefetch metadata ringan saat niat buka terdeteksi.
  const handlePressIn = useCallback(() => prefetchShowcaseDetail(item.id), [item.id])
  const handleOpenDetail = useCallback(() => router.push(ROUTES.showcaseDetail(item.id)), [item.id])
  const handleOpenComments = useCallback(() => onOpenComments(item), [onOpenComments, item])
  const handleReport = useCallback(() => onReport(item), [onReport, item])
  const handleManage = useCallback(() => onManage(item), [onManage, item])
  const handleCloseShare = useCallback(() => setShareSheetVisible(false), [setShareSheetVisible])
  return (
    <>
      <ShowcaseFeedItem
        item={display}
        onPress={handleOpenDetail}
        onPressIn={handlePressIn}
        onToggleLike={toggleLike}
        onOpenComments={handleOpenComments}
        onToggleSave={toggleSave}
        saved={saved}
        likePending={likePending}
        savePending={savedPending}
        onShare={share}
        onReport={handleReport}
        onManage={handleManage}
        divider={divider}
        autoplay={false}
      />
      <ShowcaseShareSheet visible={shareSheetVisible} item={display} onClose={handleCloseShare} />
    </>
  )
})

/**
 * FS-002 (audit performa): windowing inkremental.
 *
 * Tab ini hidup di dalam ScrollView profil (user-profile-screen), BUKAN
 * FlatList ber-viewability seperti feed utama. FlatList yang bersarang di
 * ScrollView searah tidak mem-virtualisasi (viewport-nya terukur selebar
 * seluruh konten → semua item ter-render) dan di iOS menjebak gesture
 * scroll halaman — jadi `.map()` + batas render TETAP menjadi mekanisme
 * windowing di sini, dengan dua perbaikan:
 *   1. Jendela awal 10 kartu (dulu 20): mount awal ≈ ½ biaya sebelumnya.
 *      Tombol "Tampilkan karya lainnya" (+20 per ketuk) DIPERTAHANKAN.
 *   2. memo(EtalaseCard) tidak lagi jebol (callback stabil, display di-memo)
 *      — buka/tutup sheet tidak me-render ulang semua kartu.
 */
const INITIAL_RENDER_LIMIT = 10
const RENDER_LIMIT_STEP = 20

export function ProfileEtalaseTab({
  items,
  loading,
  error,
  onRetry,
  handle,
  owner,
  isSelf = false,
}: ProfileEtalaseTabProps) {
  const [renderLimit, setRenderLimit] = useState(INITIAL_RENDER_LIMIT)
  useEffect(() => { setRenderLimit(INITIAL_RENDER_LIMIT) }, [handle])
  /** Item yang komentarnya sedang dibuka (null = tertutup). */
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
  // FS-002: stabil — inline arrow di sini menjebol memo(EtalaseCard).
  const handleManage = useCallback((item: ShowcaseSocialItem) => {
    router.push(ROUTES.showcaseDetail(item.id))
  }, [])

  return (
    <>
      <View className="pt-4" style={{ gap: tokens.space[5] }}>
        {loading ? (
          // Prinsip A.5: list ini SAMA PERSIS dengan feed Etalase — skeleton
          // pun sebentuk <ShowcaseFeedItem>, bukan kartu generik <ListLoading/>.
          <ShowcaseFeedSkeleton count={2} />
        ) : error ? (
          // C-01: gagal memuat ≠ kosong — selalu ada jalan mencoba ulang.
          <View className="px-5">
            <ErrorState
              compact
              title={translate("Gagal memuat etalase")}
              description={error}
              onRetry={onRetry}
            />
          </View>
        ) : patchedItems.length === 0 ? (
          <View className="px-5">
            {isSelf ? (
              <EmptyState
                icon={Images}
                title={translate("Belum ada etalase")}
                description={translate("Anda belum menambahkan produk atau karya ke etalase.")}
                action={
                  <Button
                    variant="secondary"
                    fullWidth={false}
                    leftIcon={Plus}
                    onPress={() => router.push(ROUTES.showcaseManagement)}
                  >
                    {translate("Tambah etalase")}
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={Images}
                title={translate("Belum ada konten")}
                description={translate("@{x} belum membagikan foto atau etalase produk.", {
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
                onManage={handleManage}
              />
            ))}
            {patchedItems.length > renderLimit ? <Button variant="ghost" onPress={() => setRenderLimit((limit) => limit + RENDER_LIMIT_STEP)}>{translate("Tampilkan etalase lainnya")}</Button> : null}
            {/* E-03: taut ke layar galeri grid publik (jangan biarkan kode mati). */}
            <View className="px-5">
              <Button
                variant="ghost"
                onPress={() => router.push(ROUTES.userShowcase(handle))}
              >
                {translate("Lihat sebagai galeri")}
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
