import type { OpeningMediaTap } from "@/lib/use-opening-media-tap"
/**
 * Kahade — <ShowcaseFeedItem> (§9.17, §9.23; revisi 2026-09-17 #3).
 *
 * Revisi 2026-09-23 (audit Etalase):
 *  - B-01: label harga dari SATU util `showcasePriceLabelOrFallback`
 *    (lib/showcase-labels) — item dengan hanya `priceMax` tidak lagi
 *    ditampilkan "Harga lewat diskusi".
 *  - B-02: pager multi-slide hanya me-render <Picture> untuk slide aktif ±1
 *    (slide lain jadi placeholder seukuran) — tidak ada lagi 8 gambar
 *    ter-mount per kartu (implementasi di <ShowcaseMediaGallery>).
 *  - B-03: prop `href` mati DIHAPUS (dulu diterima lalu dibuang); badge
 *    kategori kini SAUDARA pressable ringkaran (bukan button-in-button).
 *  - B-04: `onLayout` diketik `LayoutChangeEvent`, bukan `any`.
 *  - B-05: bendera lapor disembunyikan untuk item milik sendiri (feed
 *    sejajar dengan halaman detail).
 *  - B-10: cap waktu relatif khas feed sosial (revisi 2026-09-28: memakai
 *    `formatTimeAgo` — "5 menit lalu"/"Kemarin" — agar konsisten dengan
 *    daftar chat/notifikasi/transaksi; `formatRelativeTime` gaya "2 jam"
 *    tetap dipakai komentar & QA card).
 *  - A-12: badge kategori bisa ditekan → feed terfilter kategori itu
 *    (param `category` pada rute tab /showcase).
 *  - H-04: tap penulis untuk tamu → loginRequired(next=profil).
 *  - C1 (batch 3): follow tidak boleh dirender di feed/list; hanya menu detail.
 *  - M-03: istilah "showcase" untuk user diganti "karya".
 *
 * Memo: komponen ini `memo` — kartu di feed tab membaca state sosialnya
 * sendiri (FeedCard/EtalaseCard) dan meneruskan HANYA prop yang stabil,
 * sehingga satu tap ♥ tidak me-render ulang seluruh sel (audit A-08).
 */

import { memo, useCallback, useMemo, useState } from "react"
import { BookmarkSimple, ChatCircle, DotsThreeCircle, Export, Flag, Funnel, Heart } from "phosphor-react-native"
import { router } from "expo-router"
import { View } from "react-native"
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated"
import { translate } from "@/lib/i18n/translate"
import { useLanguage } from "@/lib/i18n"

import { formatCountCompact, formatTimeAgo } from "@/lib/format"
import type { ShowcaseSocialItem } from "@/lib/api/showcase"
import type { VerificationBadge } from "@/lib/api/users"
import { useHasSession } from "@/lib/guest-gate"
import { showcaseMedia } from "@/lib/showcase-social"
import { useReducedMotion } from "@/lib/use-reduced-motion"
import { ShowcaseMediaGallery } from "@/components/ui/showcase-media-gallery"
import { CommerceBadgesCompact } from "@/components/showcase/product-commerce-section"
import { ROUTES } from "@/lib/routes"

import { Avatar } from "@/components/ui/avatar"
import { VerifiedName } from "@/components/ui/verified-name"
import { Divider } from "@/components/ui/divider"
import { Icon, type IconComponent } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { LikeAction } from "@/components/ui/like-button"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { focusRing } from "@/lib/focus-ring"
import { shouldFireDoubleTapLike } from "@/lib/showcase-like-guard"
import { isShowcaseSoldOut } from "@/lib/showcase-stock"
import { prefetchUserProfile } from "@/lib/entity-detail-prefetch"

export type ShowcaseFeedItemProps = {
  item: ShowcaseSocialItem
  onPress?: () => void
  /**
   * C05 (batch 139): niat buka detail terdeteksi (press-in pada judul) —
   * pemanggil memicu `prefetchShowcaseDetail` agar navigasi terasa instan.
   * Tidak memicu unduhan media apa pun (prefetch hanya metadata JSON).
   */
  onPressIn?: () => void
  /**
   * Ketuk media → buka pratinjau gambar (index slide). Bila tidak disediakan,
   * ketuk media jatuh ke `onPress` (perilaku lama: buka detail karya).
   */
  onOpenMedia?: (index: number, openingTap?: OpeningMediaTap) => void
  onToggleLike?: () => void
  onOpenComments?: () => void
  onToggleSave?: () => void
  saved?: boolean
  /**
   * S-01/S-02 (audit 2026-09-24): request suka/simpan sedang berjalan. Kartu
   * menampilkan state "sedang diproses" (a11y `busy`) — dulu tap kedua diam
   * tanpa umpan balik apa pun.
   */
  likePending?: boolean
  savePending?: boolean
  onShare?: () => void
  onReport?: () => void
  onOptions?: () => void
  /**
   * Batch 19 (item 16): true = kartu terlihat di layar → video autoplay.
   * Default true agar pemanggil lama (profil) tidak berubah perilaku.
   */
  autoplayActive?: boolean
  /**
   * Opsi untuk karya MILIK SENDIRI (edit/hapus) — ditampilkan sebagai
   * DotsThreeCircle di profile. Jika tidak disediakan, tombol disembunyikan
   * untuk karya sendiri (lapor tidak masuk akal untuk karya sendiri).
   */
  onManage?: () => void
  /**
   * C11 (batch 139): mode pratinjau — kartu memakai komponen yang sama dengan
   * feed, tetapi semua tombol tidak navigasi/tidak memicu aksi (author,
   * kategori, media, lapor, dan bar aksi dirender non-interaktif).
   * Dipakai sheet pratinjau sebelum terbitkan etalase.
   */
  nonInteractive?: boolean
  divider?: boolean
  className?: string
  /**
   * R1-003 (2026-09-29, audit render-perf): tab feed aktif dari param rute,
   * dioper dari induk — komponen ini TIDAK lagi memanggil
   * `useLocalSearchParams` sendiri (dulu tiap kartu berlangganan).
   */
  feedKind?: string
}

/**
 * Satu aksi hitungan di bar bawah kartu: ikon + angka + label SEJAJAR.
 *
 * NON-OBVIOUS (revisi 2026-09-18): kelas baris HARUS dipasang pada `className`
 * — View ISI di dalam <PressableScale> — bukan hanya pada `containerClassName`.
 * PressableScale merender `<Pressable><Animated.View><View className>`:
 * `containerClassName` hanya membentuk hit area, sedangkan anaknya dibungkus
 * dua View tanpa style. Kalau `flex-row items-center gap-*` diletakkan di hit
 * area, isinya tetap kolom default RN dan angka jatuh ke BAWAH ikon (bug yang
 * dilaporkan di list Showcase). Karena itu kelas baris ada di `className` dan
 * pemisah sumbu (min-h/px/focus ring) tetap di `containerClassName`.
 */
function CountAction({
  icon,
  iconWeight = "regular",
  count,
  label,
  accessibilityLabel,
  accessibilityHint,
  onPress,
}: {
  icon: IconComponent
  iconWeight?: "fill" | "regular"
  count: number
  label: string
  accessibilityLabel: string
  accessibilityHint: string
  onPress?: () => void
}) {
  const content = (
    <>
      <Icon icon={icon} size="md" tone="active" weight={iconWeight} />
      <Text variant="caption" weight={600} className="tabular-nums">
        {formatCountCompact(count)}
      </Text>
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
    </>
  )

  if (!onPress) {
    return <View className="min-h-11 flex-row items-center gap-1.5 px-3">{content}</View>
  }

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      haptic
      onPress={onPress}
      containerClassName={cn("min-h-11 flex-row items-center rounded-md px-3", focusRing)}
      className="flex-row items-center gap-1.5"
    >
      {content}
    </PressableScale>
  )
}


function ShowcaseFeedItemBase({
  item,
  onPress,
  onPressIn,
  onOpenMedia,
  onToggleLike,
  onOpenComments,
  onToggleSave,
  saved = false,
  likePending = false,
  savePending = false,
  onShare,
  onReport,
  onOptions,
  onManage,
  autoplayActive = true,
  nonInteractive = false,
  divider = false,
  className,
  feedKind,
}: ShowcaseFeedItemProps) {
  // i18n: label aksesibilitas mengikuti bahasa aktif.
  useLanguage()
  // H-04: gate tap penulis untuk tamu (profil = layar terproteksi).
  const hasSession = useHasSession()
  // PERF-FIX (TIM1-P1): onPress penulis stabil — tidak jebol memo kartu.
  const handleAuthorPress = useCallback(
    () =>
      router.push(
        hasSession
          ? ROUTES.userProfile(item.author.username)
          : ROUTES.loginRequired(`/user/${encodeURIComponent(item.author.username)}`),
      ),
    [hasSession, item.author.username],
  )
  // PERF-FIX (P1 nav): prefetch profil penulis saat niat buka terdeteksi
  // (press-in) — halaman profil memakai hasil ini bila masih segar.
  const handleAuthorPressIn = useCallback(
    () => {
      if (hasSession) prefetchUserProfile(item.author.username)
    },
    [hasSession, item.author.username],
  )
  // PERF-FIX (TIM1-P1): objek {uri} stabil — prop Avatar tidak "berubah"
  // tiap render.
  const avatarSource = useMemo(
    () => (item.author.avatarUrl ? { uri: item.author.avatarUrl } : undefined),
    [item.author.avatarUrl],
  )
  // PERF-FIX (TIM1-P2): formatTimeAgo sekali per kartu, bukan 2x.
  const timeAgo = useMemo(() => formatTimeAgo(item.createdAt), [item.createdAt])
  // Batch 19: slide galeri (gambar/video) — referensi stabil via cache WeakMap
  // di `showcaseMedia` agar memo galeri tidak re-render sia-sia.
  const gallery = useMemo(() => showcaseMedia(item), [item])

  const liked = item.isLiked === true

  /**
   * Ketuk-ganda pada media → suka (ala Instagram). Guard ganda:
   *  - `likePending`: request suka sedang berjalan — jangan tembak lagi;
   *  - `liked`: ketuk-ganda TIDAK unlike (hanya animasi hati), jadi tidak
   *    ada toggle bolak-balik dari satu gesture. Guard antre/di-dalam
   *    `toggleLike` (useShowcaseSocialActions) tetap menjadi pertahanan
   *    terakhir bila race tetap terjadi.
   */
  const reducedMotion = useReducedMotion()
  const [heartVisible, setHeartVisible] = useState(false)
  const heartScale = useSharedValue(0)
  const heartOpacity = useSharedValue(0)
  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
    opacity: heartOpacity.value,
  }))
  const playHeartBurst = useCallback(() => {
    if (reducedMotion) return
    setHeartVisible(true)
    heartScale.value = 0
    heartOpacity.value = 1
    heartScale.value = withSequence(
      withTiming(1.25, { duration: 160 }),
      withTiming(1, { duration: 120 }),
    )
    // Tahan sekejap lalu memudar; unmount via JS agar state konsisten.
    heartOpacity.value = withDelay(
      450,
      withTiming(0, { duration: 220 }, (finished) => {
        if (finished) runOnJS(setHeartVisible)(false)
      }),
    )
  }, [reducedMotion, heartScale, heartOpacity])
  const handleMediaDoubleTap = useCallback(() => {
    if (shouldFireDoubleTapLike({ liked, likePending, hasHandler: !!onToggleLike })) onToggleLike?.()
    playHeartBurst()
  }, [onToggleLike, likePending, liked, playHeartBurst])
  // B-05 (audit 2026-09-23): hint dirakit lewat `translate` + token —
  // template literal mentah tidak bisa diterjemahkan ("12 Komentar" di EN).
  const commentCountLabel = translate("{x} Komentar", { x: formatCountCompact(item.commentCount) })

  const handleReport = useCallback(() => {
    if (onReport) onReport()
    else router.push(ROUTES.showcaseDetail(item.id))
  }, [onReport, item.id])

  /** A-12: kategori sebagai filter feed — tab /showcase menerima param kategori. */
  const handleCategoryPress = useCallback(() => {
    // L-01 (audit 2026-09-23): teruskan tab feed aktif — dulu selalu forYou.
    // R1-003: dari prop `feedKind` (induk), bukan useLocalSearchParams.
    if (item.category) router.push(ROUTES.showcaseWithCategory(item.category, feedKind))
  }, [item.category, feedKind])

  // C06 (batch 139): badge "Stok habis" di kartu — graceful: status unknown
  // (field backend belum ada) = tidak ada badge.
  const soldOut = isShowcaseSoldOut(item)
  // C11 (batch 139): pratinjau — media tidak membuka apa pun.
  // PERF-FIX (TIM1-P1): useCallback — identitas stabil, tidak jebol memo
  // <ShowcaseMediaGallery>.
  const handleOpenMedia = useCallback(
    nonInteractive
      ? (_index: number) => {}
      : (index: number, openingTap?: OpeningMediaTap) => (onOpenMedia ? onOpenMedia(index, openingTap) : onPress?.()),
    [nonInteractive, onOpenMedia, onPress],
  )

  const likeRow = (
    // Revisi 2026-09-23: suka = MERAH + motion pop/ring (<LikeAction>) —
    // menggantikan CountAction generik yang dulu dipakai di sini.
    <LikeAction
      liked={liked}
      count={item.likeCount}
      label={translate("Suka")}
      busy={likePending}
      onPress={onToggleLike}
    />
  )

  const commentRow = (
    <CountAction
      icon={ChatCircle}
      count={item.commentCount}
      label={translate("Komentar")}
      // A-02 (audit 2026-09-24): label a11y TIDAK lagi mengulang teks visual
      // ("Komentar" di layar + "Komentar" di pembaca layar) — kini angka yang
      // dibacakan, sesuai informasi yang dicari pengguna.
      accessibilityLabel={commentCountLabel}
      accessibilityHint={translate("Buka komentar")}
      onPress={onOpenComments}
    />
  )

  return (
    <View className={cn("w-full", className)}>
      {/* ── Penulis + laporkan ──
          H-04 (audit 2026-09-23): profil induk `user/[username]` terproteksi —
          tamu diarahkan ke loginRequired dengan `next` profil, jadi tidak
          "menabrak dinding" tanpa konteks; setelah login mendarat di profil. */}
      <View className="flex-row items-center gap-2 px-5 pt-3">
        {nonInteractive ? (
          /* C11: pratinjau — author dirender sebagai info biasa. */
          <View className="min-w-0 flex-1 flex-row items-center gap-3">
            <Avatar
              source={item.author.avatarUrl ? { uri: item.author.avatarUrl } : undefined}
              name={item.author.fullName?.trim() || item.author.username}
              size="md"
            />
            <View className="min-w-0 flex-1 justify-center">
              <VerifiedName
                name={item.author.fullName?.trim() || item.author.username}
                variant="body"
                badges={item.author.badges as unknown as VerificationBadge[]}
                verified={item.author.isKycVerified === true}
                tier={item.author.sealTier ?? null}
                textProps={{ weight: 600 }}
              />
              <Text variant="caption" tone="secondary" numberOfLines={1}>
                {`@${item.author.username} · ${timeAgo}`}
              </Text>
            </View>
          </View>
        ) : (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={translate("Lihat profil {x}", { x: item.author.fullName?.trim() || item.author.username })}
          accessibilityHint={`@${item.author.username}`}
          onPress={handleAuthorPress}
          onPressIn={handleAuthorPressIn}
          containerClassName={cn("min-w-0 flex-1 rounded-md", focusRing)}
          className="flex-row items-center gap-3"
        >
          <Avatar
            source={avatarSource}
            name={item.author.fullName?.trim() || item.author.username}
            size="md"
          />
          <View className="min-w-0 flex-1 justify-center">
            {/* S1: seal 3-tier di samping nama (sumber: badge backend, sama
                dengan profil); fallback boolean KYC bila badge belum ada. */}
            <VerifiedName
              name={item.author.fullName?.trim() || item.author.username}
              variant="body"
              badges={item.author.badges as unknown as VerificationBadge[]}
              verified={item.author.isKycVerified === true}
              tier={item.author.sealTier ?? null}
              textProps={{ weight: 600 }}
            />
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {`@${item.author.username} · ${timeAgo}`}
            </Text>
          </View>
        </PressableScale>
        )}
        {/* B-05: lapor tidak masuk akal untuk karya sendiri (selaras detail).
            Untuk karya sendiri tampilkan DotsThreeCircle (kelola: edit/hapus)
            bila onManage disediakan. C11: pratinjau menyembunyikan semuanya. */}
        {!nonInteractive && !item.isOwner ? (
          <IconButton
            icon={onOptions ? DotsThreeCircle : Flag}
            variant="ghost"
            size="md"
            accessibilityLabel={onOptions ? translate("Pilihan etalase") : translate("Laporkan etalase")}
            // A-03 (audit 2026-09-24): hint tidak lagi menyebut dua aksi yang
            // bisa berubah — isi sheet tidak dijanjikan di muka.
            accessibilityHint={onOptions ? translate("Buka opsi etalase") : translate("Laporkan etalase ini")}
            onPress={onOptions ?? handleReport}
          />
        ) : !nonInteractive && onManage ? (
          <IconButton
            icon={DotsThreeCircle}
            variant="ghost"
            size="md"
            accessibilityLabel={translate("Kelola etalase")}
            accessibilityHint={translate("Buka opsi kelola etalase")}
            onPress={onManage}
          />
        ) : null}
      </View>

      {/* ── Media CARD (mx-5) swipe ──
          Ketuk-ganda = suka + semburan hati (Instagram); ketuk-tunggal =
          buka viewer gambar bila `onOpenMedia` ada, kalau tidak ke detail
          (`onPress`, perilaku lama — mis. tab Etalase di profil). */}
      <View className="mx-5 pt-3">
        <View className="relative">
          <ShowcaseMediaGallery
            media={gallery}
            title={item.title}
            onOpen={handleOpenMedia}
            onDoubleTap={!nonInteractive && onToggleLike ? handleMediaDoubleTap : undefined}
            autoplayActive={autoplayActive}
            // C01: rasio slide pertama untuk placeholder di luar jendela render.
            aspectRatio={gallery[0]?.aspectRatio ?? 1}
          />
          {/* C06: badge stok habis — menimpa media, info kartu tetap tampil. */}
          {soldOut ? (
            <View className="absolute left-2 top-2 rounded-full bg-overlay-media px-2.5 py-1">
              <Text variant="caption" weight={700} tone="inverse">
                {translate("Stok habis")}
              </Text>
            </View>
          ) : null}
          {heartVisible ? (
            <View
              pointerEvents="none"
              className="absolute inset-0 items-center justify-center"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Animated.View style={heartStyle}>
                {/* Hati merah = bahasa suka aplikasi (LikeAction); putih
                    butuh pengecualian allowlist — merah cukup terbaca di
                    atas foto tanpa scrim tambahan. */}
                <Icon icon={Heart} weight="fill" tone="danger" size={84} />
              </Animated.View>
            </View>
          ) : null}
        </View>
      </View>

      {/* ── Kategori · judul · deskripsi (tap ke detail) ──
          Revisi 2026-09-27 (permintaan produk): harga DIHAPUS dari list
          feed agar bersih — harga tetap tampil di halaman detail karya.
          `priceLabel` dipertahankan untuk ringkasan aksesibilitas.
          B-03 (audit 2026-09-23): badge kategori kini SAUDARA (bukan anak)
          pressable ringkasan — button di dalam role=button = HTML tidak valid
          & iOS `accessible` induk menyembunyikan tombol kategori dari
          VoiceOver. */}
      <View className="gap-1 px-5 pt-3">
        {item.category || item.orderLink ? (
          <View className="flex-row flex-wrap items-center gap-2">
            {item.category ? (
              nonInteractive ? (
                /* C11: pratinjau — kategori sebagai label biasa. */
                <View className="rounded-sm px-0">
                  <Text variant="caption" tone="secondary" numberOfLines={1}>
                    {item.category}
                  </Text>
                </View>
              ) : (
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={translate("Filter kategori {x}", { x: item.category })}
                accessibilityHint={translate("Tampilkan feed kategori ini")}
                onPress={handleCategoryPress}
                containerClassName={cn("rounded-sm", focusRing)}
              >
                <View className="flex-row items-center gap-1">
                  <Icon icon={Funnel} size="xs" tone="default" />
                  <Text variant="caption" tone="secondary" numberOfLines={1}>
                    {item.category}
                  </Text>
                </View>
              </PressableScale>
              )
            ) : null}
            {/* Batch 43: badge commerce (Terlaris/Diskon) di kartu feed —
                hanya untuk produk commerce. D1-001/D1-011: pemicu eksplisit
                `isCommerce` + badge dari payload (tanpa N+1 fetch). */}
            {item.isCommerce ? <CommerceBadgesCompact showcaseId={item.id} badges={item.badges} /> : null}
          </View>
        ) : null}
        {/* C11: pratinjau — judul/deskripsi sebagai teks biasa. */}
        {nonInteractive ? (
          <View className="gap-1">
            <Text variant="body" weight={600} numberOfLines={2}>
              {item.title}
            </Text>
            {item.description ? (
              <Text variant="caption" tone="secondary" numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}
          </View>
        ) : (
        <PressableScale
          accessibilityRole={onPress ? "button" : undefined}
          accessibilityLabel={onPress ? item.title : undefined}
          accessibilityHint={onPress ? translate("Buka detail etalase") : undefined}
          onPress={onPress}
          // C05: press-in = niat buka detail → prefetch metadata ringan.
          onPressIn={nonInteractive ? undefined : onPressIn}
          containerClassName={cn("rounded-sm", focusRing)}
        >
          <View className="gap-1">
            <Text variant="body" weight={600} numberOfLines={2}>
              {item.title}
            </Text>
            {item.description ? (
              <Text variant="caption" tone="secondary" numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}
          </View>
        </PressableScale>
        )}
      </View>

      {/* ── Separator atas aksi (inset, bukan full) ── */}
      <Divider inset className="mt-3" />

      {/* ── Aksi: suka · komentar · bagikan · simpan ── */}
      {/* (2026-10-05, revisi produk: tombol "Beli" dihapus dari list —
          beli hanya dari halaman detail etalase.) */}
      <View className="flex-row items-center px-2 pt-1">
        {likeRow}
        {commentRow}
        <View className="flex-1" />
        {onShare ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={translate("Bagikan")}
            accessibilityHint={translate("Bagikan etalase ini")}
            onPress={onShare}
            containerClassName={cn("min-h-11 min-w-11 items-center justify-center rounded-md", focusRing)}
          >
            <Icon icon={Export} size="md" tone="active" />
          </PressableScale>
        ) : null}
        {onToggleSave ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={saved ? translate("Hapus dari tersimpan") : translate("Simpan")}
            accessibilityState={{ selected: saved, busy: savePending }}
            onPress={onToggleSave}
            containerClassName={cn("min-h-11 min-w-11 items-center justify-center rounded-md", focusRing)}
          >
            <Icon icon={BookmarkSimple} size="md" tone="active" weight={saved ? "fill" : "regular"} />
          </PressableScale>
        ) : null}
      </View>

      {divider ? <Divider inset className="mt-1" /> : null}
    </View>
  )
}

/**
 * Memo: sel kartu hanya dirender ulang bila prop-nya berubah (audit A-09 —
 * sebelumnya renderItem inline membuat SELURUH sel tampak dirender ulang di
 * setiap ketikan kolom pencarian).
 */
export const ShowcaseFeedItem = memo(ShowcaseFeedItemBase)
