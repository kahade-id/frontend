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
 *  - B-10: cap waktu relatif (`formatRelativeTime`) khas feed sosial.
 *  - A-12: badge kategori bisa ditekan → feed terfilter kategori itu
 *    (param `category` pada rute tab /showcase).
 *  - H-04: tap penulis untuk tamu → loginRequired(next=profil).
 *  - M-03: istilah "showcase" untuk user diganti "karya".
 *
 * Memo: komponen ini `memo` — kartu di feed tab membaca state sosialnya
 * sendiri (FeedCard/EtalaseCard) dan meneruskan HANYA prop yang stabil,
 * sehingga satu tap ♥ tidak me-render ulang seluruh sel (audit A-08).
 */

import { memo, useCallback } from "react"
import { BookmarkSimple, ChatCircle, DotsThreeCircle, Export, Flag } from "phosphor-react-native"
import { router, useLocalSearchParams } from "expo-router"
import { View } from "react-native"
import { translate } from "@/lib/i18n/translate"
import { useLanguage } from "@/lib/i18n"

import { formatCountCompact, formatRelativeTime } from "@/lib/format"
import type { ShowcaseSocialItem } from "@/lib/api/showcase"
import type { VerificationBadge } from "@/lib/api/users"
import { useHasSession } from "@/lib/guest-gate"
import { showcaseImages } from "@/lib/showcase-social"
import { ShowcaseMediaGallery } from "@/components/ui/showcase-media-gallery"
import { ROUTES } from "@/lib/routes"
import { showcasePriceLabelOrFallback } from "@/lib/showcase-labels"

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

export type ShowcaseFeedItemProps = {
  item: ShowcaseSocialItem
  onPress?: () => void
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
   * Opsi untuk karya MILIK SENDIRI (edit/hapus) — ditampilkan sebagai
   * DotsThreeCircle di profile. Jika tidak disediakan, tombol disembunyikan
   * untuk karya sendiri (lapor tidak masuk akal untuk karya sendiri).
   */
  onManage?: () => void
  divider?: boolean
  className?: string
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
  divider = false,
  className,
}: ShowcaseFeedItemProps) {
  // i18n: label aksesibilitas mengikuti bahasa aktif.
  useLanguage()
  // L-01: tab feed aktif dari param rute (hook harus di body render).
  const { kind } = useLocalSearchParams<{ kind?: string }>()
  // H-04: gate tap penulis untuk tamu (profil = layar terproteksi).
  const hasSession = useHasSession()
  const gallery = showcaseImages(item)
  const priceLabel = showcasePriceLabelOrFallback(item)

  const liked = item.isLiked === true
  // B-05 (audit 2026-09-23): hint dirakit lewat `translate` + token —
  // template literal mentah tidak bisa diterjemahkan ("12 Komentar" di EN).
  const commentCountLabel = translate("{x} Komentar", { x: formatCountCompact(item.commentCount) })
  // M-03 (audit 2026-09-23): istilah "showcase" diganti "karya" untuk user.
  const summary = translate("Karya {x}, {y}, oleh {z}", {
    x: item.title,
    y: priceLabel,
    z: item.author.fullName ?? item.author.username,
  })

  const handleReport = useCallback(() => {
    if (onReport) onReport()
    else router.push(ROUTES.showcaseDetail(item.id))
  }, [onReport, item.id])

  /** A-12: kategori sebagai filter feed — tab /showcase menerima param kategori. */
  const handleCategoryPress = useCallback(() => {
    // L-01 (audit 2026-09-23): teruskan tab feed aktif — dulu selalu forYou.
    if (item.category) router.push(ROUTES.showcaseWithCategory(item.category, kind))
  }, [item.category, kind])

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
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={translate("Lihat profil {x}", { x: item.author.fullName?.trim() || item.author.username })}
          accessibilityHint={`@${item.author.username}`}
          onPress={() =>
            router.push(
              hasSession
                ? ROUTES.userProfile(item.author.username)
                : ROUTES.loginRequired(`/user/${encodeURIComponent(item.author.username)}`),
            )
          }
          containerClassName={cn("min-w-0 flex-1 rounded-md", focusRing)}
          className="flex-row items-center gap-3"
        >
          <Avatar
            source={item.author.avatarUrl ? { uri: item.author.avatarUrl } : undefined}
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
              {`@${item.author.username} · ${formatRelativeTime(item.createdAt)}`}
            </Text>
          </View>
        </PressableScale>
        {/* B-05: lapor tidak masuk akal untuk karya sendiri (selaras detail).
            Untuk karya sendiri tampilkan DotsThreeCircle (kelola: edit/hapus)
            bila onManage disediakan. */}
        {!item.isOwner ? (
          <IconButton
            icon={onOptions ? DotsThreeCircle : Flag}
            variant="ghost"
            size="md"
            accessibilityLabel={onOptions ? translate("Pilihan karya") : translate("Laporkan karya")}
            // A-03 (audit 2026-09-24): hint tidak lagi menyebut dua aksi yang
            // bisa berubah — isi sheet tidak dijanjikan di muka.
            accessibilityHint={onOptions ? translate("Buka opsi karya") : translate("Laporkan karya ini")}
            onPress={onOptions ?? handleReport}
          />
        ) : onManage ? (
          <IconButton
            icon={DotsThreeCircle}
            variant="ghost"
            size="md"
            accessibilityLabel={translate("Kelola karya")}
            accessibilityHint={translate("Buka opsi kelola karya")}
            onPress={onManage}
          />
        ) : null}
      </View>

      {/* ── Media CARD (mx-5) swipe ── */}
      <View className="mx-5 pt-3">
        <ShowcaseMediaGallery images={gallery} title={item.title} onOpen={() => onPress?.()} />
      </View>

      {/* ── Harga · judul · deskripsi (tap ke detail) ──
          B-03 (audit 2026-09-23): badge kategori kini SAUDARA (bukan anak)
          pressable ringkasan — button di dalam role=button = HTML tidak valid
          & iOS `accessible` induk menyembunyikan tombol kategori dari
          VoiceOver. Susunan visual (baris harga+badge, lalu judul & deskripsi)
          tetap sama. */}
      <View className="gap-1 px-5 pt-3">
        <View className="flex-row flex-wrap items-center gap-2">
          <PressableScale
            accessibilityRole={onPress ? "button" : undefined}
            accessibilityLabel={onPress ? summary : undefined}
            accessibilityHint={onPress ? translate("Buka detail karya") : undefined}
            onPress={onPress}
            containerClassName={cn("rounded-sm", focusRing)}
          >
            <Text variant="h2" weight={700} className="tabular-nums">
              {priceLabel}
            </Text>
          </PressableScale>
          {item.category ? (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={translate("Filter kategori {x}", { x: item.category })}
              accessibilityHint={translate("Tampilkan feed kategori ini")}
              onPress={handleCategoryPress}
              containerClassName={cn("rounded-sm", focusRing)}
            >
              <Text variant="caption" tone="secondary" numberOfLines={1}>
                {item.category}
              </Text>
            </PressableScale>
          ) : null}
        </View>
        <PressableScale
          accessibilityRole={onPress ? "button" : undefined}
          accessibilityLabel={onPress ? item.title : undefined}
          accessibilityHint={onPress ? translate("Buka detail karya") : undefined}
          onPress={onPress}
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
      </View>

      {/* ── Separator atas aksi (inset, bukan full) ── */}
      <Divider inset className="mt-3" />

      {/* ── Aksi: suka · komentar (kiri) · share · simpan (kanan) — count di samping ikon ── */}
      <View className="flex-row items-center px-2 pt-1">
        {likeRow}
        {commentRow}
        <View className="flex-1" />
        {onShare ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={translate("Bagikan")}
            accessibilityHint={translate("Bagikan karya ini")}
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
