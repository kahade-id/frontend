/**
 * Kahade — <ProfileEtalaseTab>: isi tab "Etalase" di profil publik user.
 *
 * Diekstrak dari app/user/[username].tsx (G-11: god component hanya boleh
 * menyusut). Seluruh logika sosial tab ini (normalisasi item, suka, simpan,
 * bagikan, sheet komentar) hidup di sini supaya layar induk tinggal memegang
 * data mentah + navigasi tab.
 *
 * PRINSIP UTAMA (permintaan produk A.5): list tab ini SAMA PERSIS dengan
 * list halaman Showcase — komponen <ShowcaseFeedItem> yang sama (penulis,
 * media card swipe, harga, judul, bar aksi Suka/Komentar/Bagikan/Simpan,
 * divider inset) dan parameter jarak yang sama dengan <PaginatedList> di
 * ShowcaseFeedTab (container tanpa px-5 — item membawa gutter sendiri;
 * jarak antar item tokens.space[5]). Handler suka/simpan/bagikan/komentar
 * disalin paruh-per-paruh dari ShowcaseFeedTab agar perilaku optimistis
 * (ubah angka dulu, sinkron nilai final server) identik.
 */
import { useCallback, useMemo, useRef, useState } from "react"
import { View } from "react-native"
import { router } from "expo-router"
import { Images, Plus } from "phosphor-react-native"

import { isApiError, userMessage } from "@/lib/api"
import {
  getShowcaseSharePayload,
  likeShowcase,
  unlikeShowcase,
  type ShowcaseSocialItem,
} from "@/lib/api/showcase"
import type { ShowcaseItem } from "@/lib/api/users"
import { resolveMediaUrl } from "@/lib/media"
import { ROUTES } from "@/lib/routes"
import { shareContent } from "@/lib/share"
import { tokens } from "@/lib/tokens"

import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { ListLoading } from "@/components/ui/paginated-list"
import { ShowcaseCommentsSheet } from "@/components/ui/showcase-comments-sheet"
import { ShowcaseFeedItem } from "@/components/ui/showcase-feed-item"
import { useToast } from "@/components/ui/toast"

/** Pemilik profil — penulis semua item etalase (endpoint sudah per-username). */
export type EtalaseOwner = {
  id: string
  username: string
  fullName?: string
  avatarUrl?: string | null
  verified?: boolean
}

export type ProfileEtalaseTabProps = {
  /** Item mentah dari GET /v1/users/{username}/showcase. */
  items: ShowcaseItem[]
  loading: boolean
  /** Username profil (tanpa @) — untuk copy empty state. */
  handle: string
  owner: EtalaseOwner
  /** Apakah ini profil milik pengguna sendiri */
  isSelf?: boolean
}

/**
 * Normalisasi GET /v1/users/{username}/showcase (ShowcaseItem) ke bentuk
 * <ShowcaseFeedItem> (ShowcaseSocialItem). Respons backend BISA sudah
 * membawa field sosial (likeCount/isLiked/images[]) — semuanya dibaca
 * defensif; yang tidak ada diisi nilai netral.
 */
function toSocialShowcaseItem(item: ShowcaseItem, owner: EtalaseOwner): ShowcaseSocialItem {
  const raw = item as ShowcaseItem & Partial<ShowcaseSocialItem>
  const images = Array.isArray(raw.images)
    ? raw.images
        .map((image, index) => {
          const url = resolveMediaUrl(image?.imageUrl)
          return url
            ? {
                id: image.id ?? `${item.id}-${index}`,
                imageUrl: url,
                sortOrder: image.sortOrder ?? index,
              }
            : null
        })
        .filter((image): image is { id: string; imageUrl: string; sortOrder: number } => image != null)
    : []
  if (images.length === 0) {
    // Item lama mungkin hanya punya cover tunggal (imageUrl) atau key storage.
    const cover = resolveMediaUrl(item.coverImageUrl ?? item.imageUrl ?? item.fileKey)
    if (cover) images.push({ id: item.id, imageUrl: cover, sortOrder: 0 })
  }
  return {
    id: item.id,
    title: item.title ?? item.caption ?? "Showcase",
    description: item.description ?? item.caption ?? null,
    category: raw.category ?? null,
    images,
    coverImageUrl: item.coverImageUrl ?? item.imageUrl ?? null,
    imageUrl: item.imageUrl ?? null,
    priceMin: item.priceMin ?? null,
    priceMax: item.priceMax ?? null,
    likeCount: typeof raw.likeCount === "number" ? raw.likeCount : 0,
    commentCount: typeof raw.commentCount === "number" ? raw.commentCount : 0,
    viewCount: typeof raw.viewCount === "number" ? raw.viewCount : 0,
    isLiked: raw.isLiked === true,
    createdAt: item.createdAt,
    updatedAt: (raw as { updatedAt?: string }).updatedAt ?? item.createdAt,
    author: {
      userId: owner.id,
      username: owner.username,
      fullName: owner.fullName ?? null,
      avatarUrl: owner.avatarUrl ?? null,
      isKycVerified: owner.verified === true,
    },
  }
}

export function ProfileEtalaseTab({ items, loading, handle, owner, isSelf = false }: ProfileEtalaseTabProps) {
  const toast = useToast()
  /** Guard per item: dua request suka berbarengan pada kartu yang sama. */
  const likeBusy = useRef<Set<string>>(new Set())
  /** Bookmark item — lokal (backend belum punya endpoint koleksi tersaved). */
  const [savedIds, setSavedIds] = useState<ReadonlySet<string>>(() => new Set())
  /** Item yang komentarnya sedang dibuka di BottomSheet (null = tertutup). */
  const [commentItem, setCommentItem] = useState<ShowcaseSocialItem | null>(null)

  /**
   * Normalisasi raw → sosial adalah TURUNAN MURNI (useMemo tanpa state
   * cermin — setState saat render dilarang). Interaksi pengguna (suka,
   * komentar) disimpan sebagai patch per-id di atas turunan itu, persis
   * pola optimistis `items` di feed: angka berubah dulu, sinkron server
   * menimpa patch, fetch ulang mengganti basis.
   */
  const {
    id: ownerId,
    username: ownerUsername,
    fullName: ownerFullName,
    avatarUrl: ownerAvatarUrl,
    verified: ownerVerified,
  } = owner
  const base = useMemo(
    () =>
      items.map((item) =>
        toSocialShowcaseItem(item, {
          id: ownerId,
          username: ownerUsername,
          fullName: ownerFullName,
          avatarUrl: ownerAvatarUrl,
          verified: ownerVerified,
        }),
      ),
    [items, ownerId, ownerUsername, ownerFullName, ownerAvatarUrl, ownerVerified],
  )
  const [patches, setPatches] = useState<Record<string, Partial<ShowcaseSocialItem>>>({})
  const socialItems = useMemo(
    () => base.map((entry) => (patches[entry.id] ? { ...entry, ...patches[entry.id] } : entry)),
    [base, patches],
  )

  /** Ganti sebagian field satu item — satu sumber angka untuk kartu di list. */
  const patchItem = useCallback((id: string, patch: Partial<ShowcaseSocialItem>) => {
    setPatches((previous) => ({ ...previous, [id]: { ...previous[id], ...patch } }))
  }, [])

  /**
   * Suka/batal suka langsung dari kartu. Optimistis: angka berubah saat jari
   * menyentuh, lalu disinkronkan dengan nilai FINAL dari server
   * (`{liked, likeCount}`) supaya tidak berbeda dengan halaman detail.
   */
  const handleToggleLike = useCallback(
    async (item: ShowcaseSocialItem) => {
      if (likeBusy.current.has(item.id)) return
      const previous = { isLiked: item.isLiked === true, likeCount: item.likeCount }
      const next = !previous.isLiked
      likeBusy.current.add(item.id)
      patchItem(item.id, {
        isLiked: next,
        likeCount: Math.max(0, previous.likeCount + (next ? 1 : -1)),
      })
      try {
        const res = next ? await likeShowcase(item.id) : await unlikeShowcase(item.id)
        patchItem(item.id, { isLiked: res.liked, likeCount: res.likeCount })
      } catch (err) {
        patchItem(item.id, previous)
        // SHOWCASE_ALREADY_LIKED (race) bukan error pengguna — cukup sinkronkan.
        const isRace = isApiError(err) && err.backendCode === "SHOWCASE_ALREADY_LIKED"
        if (!isRace) {
          toast.show({
            title: "Gagal memperbarui suka",
            description: userMessage(err),
            tone: "danger",
          })
        }
      } finally {
        likeBusy.current.delete(item.id)
      }
    },
    [patchItem, toast],
  )

  const handleToggleSave = useCallback((item: ShowcaseSocialItem) => {
    setSavedIds((previous) => {
      const next = new Set(previous)
      if (next.has(item.id)) next.delete(item.id)
      else next.add(item.id)
      return next
    })
  }, [])

  const handleShare = useCallback(
    async (item: ShowcaseSocialItem) => {
      try {
        const payload = await getShowcaseSharePayload(item.id)
        const outcome = await shareContent({
          message: `${payload.title} — ${payload.authorFullName ?? "@" + payload.authorUsername}`,
          url: payload.shareUrl,
          title: payload.title,
        })
        if (outcome === "unavailable") {
          toast.show({ title: "Share tidak tersedia di perangkat ini", tone: "info" })
        }
      } catch (err) {
        toast.show({
          title: "Gagal menyiapkan share",
          description: isApiError(err) ? userMessage(err) : undefined,
          tone: "danger",
        })
      }
    },
    [toast],
  )

  /** Komentar baru dari komposer sheet — hitungan kartu ikut bertambah. */
  const handleCommentAdded = useCallback(
    (id: string) => {
      const current = socialItems.find((entry) => entry.id === id)?.commentCount ?? 0
      patchItem(id, { commentCount: current + 1 })
    },
    [patchItem, socialItems],
  )

  return (
    <>
      <View className="pt-4" style={{ gap: tokens.space[5] }}>
        {loading ? (
          <View className="px-5">
            <ListLoading />
          </View>
        ) : socialItems.length === 0 ? (
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
                    Tambah etalase
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={Images}
                title="Belum ada konten"
                description={`@${handle} belum membagikan foto atau showcase produk.`}
              />
            )}
          </View>
        ) : (
          socialItems.map((item, index) => (
            <ShowcaseFeedItem
              key={item.id}
              item={item}
              onPress={() => router.push(ROUTES.showcaseDetail(item.id))}
              onToggleLike={() => void handleToggleLike(item)}
              onOpenComments={() => setCommentItem(item)}
              onToggleSave={() => handleToggleSave(item)}
              saved={savedIds.has(item.id)}
              onShare={() => void handleShare(item)}
              // Tanpa onReport: default komponen membuka halaman laporan —
              // persis perilaku feed halaman Showcase.
              divider={index < socialItems.length - 1}
            />
          ))
        )}
      </View>

      {/* Komentar dibaca & ditulis di sheet — paritas dengan halaman
          Showcase (pengguna tidak kehilangan posisi list). */}
      <ShowcaseCommentsSheet
        item={commentItem}
        onRequestClose={() => setCommentItem(null)}
        onCommentAdded={handleCommentAdded}
      />
    </>
  )
}
