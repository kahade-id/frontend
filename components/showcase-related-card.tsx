/**
 * Kahade — kartu "Etalase terkait" di detail Etalase.
 *
 * Keputusan produk 2026-10-05: terkait tampil VERTIKAL memakai kartu feed
 * beranda (<ShowcaseFeedItem>), maks 5. Komponen ini membungkus kartu itu
 * dengan state sosial per item (`useShowcaseSocialActions` — hook tidak boleh
 * dipanggil di dalam `.map`, jadi tiap kartu adalah komponennya sendiri).
 *
 * Tanpa pembungkus ini kartu terkait tidak bisa ditekan dan tombol sosialnya
 * mati (prop handler tidak pernah diisi) — audit 2026-10-08.
 */
import { memo, useCallback, useMemo } from "react"
import { router } from "expo-router"

import type { ShowcaseSocialItem } from "@/lib/api/showcase"
import { ROUTES } from "@/lib/routes"
import { prefetchShowcaseDetail } from "@/lib/showcase-detail-prefetch"
import { useShowcaseSocialActions } from "@/lib/use-showcase-social-actions"

import { ShowcaseFeedItem } from "@/components/ui/showcase-feed-item"
import { ShowcaseShareSheet } from "@/components/ui/showcase-share-sheet"

export const ShowcaseRelatedCard = memo(function ShowcaseRelatedCard({
  rel,
  divider = true,
  onReport,
}: {
  rel: ShowcaseSocialItem
  divider?: boolean
  onReport?: (item: ShowcaseSocialItem) => void
}) {
  const { liked, likeCount, saved, likePending, savedPending, toggleLike, toggleSave, share, shareSheetVisible, setShareSheetVisible } =
    useShowcaseSocialActions(rel)
  const display = useMemo(
    () =>
      liked === (rel.isLiked === true) && likeCount === rel.likeCount
        ? rel
        : { ...rel, isLiked: liked, likeCount },
    [liked, likeCount, rel],
  )
  const handlePressIn = useCallback(() => prefetchShowcaseDetail(rel.id), [rel.id])
  const handleOpenDetail = useCallback(() => router.push(ROUTES.showcaseDetail(rel.id)), [rel.id])
  const handleReport = useCallback(() => onReport?.(rel), [onReport, rel])
  const handleCloseShare = useCallback(() => setShareSheetVisible(false), [setShareSheetVisible])
  return (
    <>
      <ShowcaseFeedItem
        item={display}
        onPress={handleOpenDetail}
        onPressIn={handlePressIn}
        onOpenMedia={handleOpenDetail}
        onToggleLike={toggleLike}
        // Komentar item terkait dibaca di detailnya sendiri — sheet komentar
        // layar ini milik item utama.
        onOpenComments={handleOpenDetail}
        onToggleSave={toggleSave}
        saved={saved}
        likePending={likePending}
        savePending={savedPending}
        onShare={share}
        onReport={onReport ? handleReport : undefined}
        divider={divider}
        // FD-02: tanpa autoplay (tak ada wiring viewability), tapi tombol
        // putar tetap bekerja — `autoplayActive={false}` dulu mematikannya.
        autoplay={false}
      />
      <ShowcaseShareSheet visible={shareSheetVisible} item={display} onClose={handleCloseShare} />
    </>
  )
})
