/**
 * Screen — Etalase saya (manajemen).
 *
 * Kontrak API (docs/api/kahade-api-mobile.json):
 *   GET    /v1/users/me/showcase             → semua item (termasuk nonaktif)
 *   POST   /v1/users/me/showcase             CreateShowcaseItemDto { title, description?,
 *                                            imageFileKeys?, priceMin?, priceMax?,
 *                                            category?, visibility?, sortOrder? }
 *   PUT    /v1/users/me/showcase/{id}        UpdateShowcaseItemDto (+ isActive)
 *   DELETE /v1/users/me/showcase/{id}
 * Unggah foto: presigned → PUT objek → POST /upload/confirm → fileKey
 * (satu pintu di lib/showcase-upload.ts, audit D-04; multipart lama = fallback).
 *
 * Alur tambah: pilih BEBERAPA foto (D-11) → unggah → buka form (judul wajib,
 * deskripsi, rentang harga, KATEGORI, VISIBILITAS — D-02) → createShowcase
 * dengan imageFileKeys. Bila fallback multipart mengembalikan item utuh
 * (res.id), item ditandai NONAKTIF (draft — D-01) dan form edit dibuka
 * supaya publikasi tidak pernah terjadi tanpa konfirmasi judul.
 *
 * Perbaikan audit Etalase (2026-09-23):
 *   D-01 Tidak ada lagi item terbit-tanpa-judul dari unggah foto: item yang
 *        dibuat otomatis backend disembunyikan (isActive false) & form edit
 *        dibuka; pengguna yang menyadarinya dari grid (badge, D-06).
 *   D-02 Field kategori & visibilitas bisa diisi (form create & edit).
 *   D-03 sortOrder item baru = max(sortOrder)+1 (bukan items.length) —
 *        tidak menabrak urutan setelah hapus item di tengah.
 *   D-05 Label harga via `showcasePriceLabel` bersama (feed/detail/manajemen
 *        identik; rentang sama → harga tunggal).
 *   D-06 Item nonaktif ditandai VISUAL di grid (scrim + badge EyeSlash).
 *   D-07 Skeleton = grid persegi (bukan ListLoading kartu h-24).
 *   D-08 Batas form & MAX_IMAGES dari API_CONSTRAINTS (constraints.ts).
 *   D-09 Key yang terunggah tapi gagal dipakai dibersihkan best-effort.
 *   D-10 Reorder foto = edit LOKAL di sheet, SATU PUT saat sheet ditutup.
 *   D-11 Multi-pick (pilih beberapa foto sekaligus, tanpa crop paksa 1:1).
 *   J-01 Nama fitur "Etalase" (judul layar, copy), bukan "Portofolio".
 *   Tiap mutasi sukses memanggil markShowcaseFeedDirty() → tab feed
 *        menyegarkan dirinya saat fokus kembali (A-08).
 */

import { Crossfade } from "@/components/ui/fade-in"
import { useCallback, useMemo, useRef, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { CaretLeft, CaretRight, Eye, EyeSlash, Images, PencilSimple, Plus, Trash } from "phosphor-react-native"
import { router } from "expo-router"
import { translate } from "@/lib/i18n/translate"

import { api, userMessage } from "@/lib/api"
import { API_CONSTRAINTS } from "@/lib/api/constraints"
import type { ShowcaseImage, ShowcaseItem } from "@/lib/api/users"
import { pickImages } from "@/lib/image-picker"
import { useApiQuery } from "@/lib/use-api-query"
import { ROUTES } from "@/lib/routes"
import { showcasePriceLabel } from "@/lib/showcase-labels"
import { showcaseCoverOf, untitledShowcaseTitle } from "@/lib/showcase-social"
import { markShowcaseFeedDirty } from "@/lib/showcase-social-prefs"
import { cleanupPendingShowcaseKeys, uploadShowcasePhoto } from "@/lib/showcase-upload"
import { tokens } from "@/lib/tokens"

import { ActionSheet, type ActionSheetItem } from "@/components/ui/action-sheet"
import { AmountInput } from "@/components/ui/amount-input"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/modal"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { IconButton } from "@/components/ui/icon-button"
import { Input } from "@/components/ui/input"
import { Picture } from "@/components/ui/picture"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { ShowcaseGalleryGrid } from "@/components/ui/showcase-gallery-grid"
import { Switch } from "@/components/ui/switch"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"
import { useToast } from "@/components/ui/toast"

/** Batas form — D-08: TURUNAN dari kontrak backend, bukan angka lokal. */
const TITLE_MAX = API_CONSTRAINTS.CreateShowcaseItemDto.title.maxLength
const DESC_MAX = API_CONSTRAINTS.CreateShowcaseItemDto.description.maxLength
const CATEGORY_MAX = API_CONSTRAINTS.CreateShowcaseItemDto.category.maxLength
/** Batas foto per item (DTO imageFileKeys: "Maksimum 8 gambar"). */
const SHOWCASE_MAX_IMAGES = 8

type FormState = {
  title: string
  description: string
  priceMin: number
  priceMax: number
  /** D-02: kategori & visibilitas ikut diisi dari aplikasi. */
  category: string
  isPublic: boolean
}
const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  priceMin: 0,
  priceMax: 0,
  category: "",
  isPublic: true,
}

type Editor =
  | { mode: "create"; fileKeys: string[] }
  | { mode: "edit"; item: ShowcaseItem }
  | null

/** Judul tampil item mentah — fallback netral bersama (J-04). */
function labelOf(it: ShowcaseItem): string {
  return it.title ?? it.caption ?? untitledShowcaseTitle()
}

/** Nilai opsional (buat & ubah) — harga 0 = tidak diisi (undefined). */
function formToPayload(form: FormState) {
  return {
    description: form.description.trim() || undefined,
    priceMin: form.priceMin || undefined,
    priceMax: form.priceMax || undefined,
    category: form.category.trim() || undefined,
    visibility: form.isPublic ? ("PUBLIC" as const) : ("PRIVATE" as const),
  }
}

/** Baca `sortOrder` maksimum +1 (D-03) — tahan item tanpa sortOrder. */
function nextSortOrder(items: ShowcaseItem[]): number {
  return items.reduce((max, it) => Math.max(max, typeof it.sortOrder === "number" ? it.sortOrder : 0), 0) + 1
}

/** Kategori/visibilitas dari respons mentah (ShowcaseItem belum mengetiknya). */
function rawMeta(it: ShowcaseItem): { category: string; isPublic: boolean } {
  const raw = it as ShowcaseItem & { category?: string | null; visibility?: string | null }
  return {
    category: typeof raw.category === "string" ? raw.category : "",
    isPublic: raw.visibility !== "PRIVATE",
  }
}

export default function ShowcaseScreen() {
  const insets = useSafeAreaInsets()
  const toast = useToast()

  /**
   * Audit: state async dirakit manual. Cacat terbukti dari kode lama:
   * `handleRefresh` memanggil `fetchAll()` yang sama dengan muat-awal, dan
   * fungsi itu membuka dengan `setLoading(true)` — tarik-untuk-menyegarkan
   * mengganti daftar etalase dengan kerangka. Request juga tidak dibatalkan
   * saat layar ditutup.
   */
  const query = useApiQuery<ShowcaseItem[]>(
    "my-showcase",
    async (signal) => (await api.users.getMyShowcase(signal)) ?? [],
  )
  const items = query.data ?? []
  const { loading, error, refreshing } = query
  const [uploading, setUploading] = useState(false)

  const [menuItem, setMenuItem] = useState<ShowcaseItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ShowcaseItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [toggling, setToggling] = useState(false)

  const [editor, setEditor] = useState<Editor>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | undefined>()
  const [saving, setSaving] = useState(false)
  /**
   * Key yang sudah terunggah dari flow create & belum ter-commit — dibersihkan
   * bila pengguna membatalkan form (D-09; create gagal juga membersihkan).
   */
  const pendingKeys = useRef<string[]>([])

  // ── Kelola foto item (multi-image) ────────────────────────────────
  // ID saja yang disimpan di state — baris item diturunkan dari `items`
  // supaya selalu sinkron setelah refresh (foto baru/terhapus/terurut ulang).
  const [imagesItemId, setImagesItemId] = useState<string | null>(null)
  const imagesItem = imagesItemId ? (items.find((it) => it.id === imagesItemId) ?? null) : null
  const [attaching, setAttaching] = useState(false)
  const [deleteImage, setDeleteImage] = useState<ShowcaseImage | null>(null)
  const [deletingImage, setDeletingImage] = useState(false)

  /**
   * D-10: urutan foto diedit LOKAL (draft) — panah menukar posisi di draft;
   * SATU UpsertImagesOrder dikirim saat sheet DITUTUP (bukan 2 request per
   * klik). `null` = tidak ada perubahan sejak sheet dibuka/terakhir commit.
   */
  const [orderDraft, setOrderDraft] = useState<string[] | null>(null)
  const [committingOrder, setCommittingOrder] = useState(false)

  /** Mutasi sukses → tab feed menyegarkan diri saat fokus kembali (A-08). */
  const touchFeed = useCallback(() => markShowcaseFeedDirty(), [])

  // ── Tambah: multi-pick → unggah → form ────────────────────────────
  const handleUpload = useCallback(async () => {
    const picked = await pickImages({ selectionLimit: SHOWCASE_MAX_IMAGES })
    if (picked.status === "denied") {
      toast.show({ title: "Akses galeri ditolak", tone: "danger" })
      return
    }
    if (picked.status !== "picked") return
    setUploading(true)
    const uploadedKeys: string[] = []
    try {
      /**
       * Unggah berurutan (bukan paralel): progress jujur + batas fileKey
       * backend; bila satu gagal, file yang sudah sukses dibersihkan (D-09)
       * dan pengguna diberi tahu spesifik.
       */
      let autoItem: { itemId: string; title?: string | null } | null = null
      const failed: string[] = []
      for (const asset of picked.assets) {
        try {
          const outcome = await uploadShowcasePhoto(asset)
          if (outcome.kind === "item") {
            // Cabang multipart lama: backend SUDAH membuat item.
            autoItem = { itemId: outcome.itemId, title: outcome.title }
          } else {
            uploadedKeys.push(outcome.fileKey)
          }
        } catch {
          failed.push(asset.name)
        }
      }

      if (autoItem) {
        /**
         * D-01: item buatan-otomatis LANGSUNG disembunyikan — tidak ada
         * lagi item TERBIT tanpa judul; form edit dibuka agar pengguna
         * sadar dan melengkapi. Publikasi = aksi eksplisit (toggle di menu).
         */
        try {
          await api.users.updateShowcase(autoItem.itemId, { isActive: false })
        } catch {
          // best-effort: grid D-06 tetap menunjukkan status sebenarnya.
        }
        await query.refresh()
        touchFeed()
        // NOTE: query.data di closure ini STALE (render lama) — item lengkap
        // belum tentu bisa ditemukan; stub seadanya cukup untuk form edit.
        const item = {
          id: autoItem.itemId,
          title: autoItem.title ?? undefined,
          createdAt: new Date().toISOString(),
        } as ShowcaseItem
        setForm({
          ...EMPTY_FORM,
          title: item.title ?? item.caption ?? "",
          description: item.description ?? "",
          priceMin: item.priceMin ?? 0,
          priceMax: item.priceMax ?? 0,
          ...rawMeta(item),
        })
        setFormError(undefined)
        setEditor({ mode: "edit", item })
        toast.show({
          title: "Foto diunggah — lengkapi detail, lalu tampilkan di profil",
          tone: "info",
          duration: 4000,
        })
        // Key presigned yang tidak terpakai cabang ini → bersih (D-09).
        void cleanupPendingShowcaseKeys(uploadedKeys)
        return
      }

      if (uploadedKeys.length === 0) {
        toast.show({
          title: "Gagal mengunggah foto",
          description: failed.length > 0 ? translate("{x} foto gagal diunggah.", { x: failed.length }) : undefined,
          tone: "danger",
        })
        return
      }
      if (failed.length > 0) {
        toast.show({
          title: translate("{x} dari {y} foto gagal diunggah", { x: failed.length, y: picked.assets.length }),
          description: "Foto yang berhasil disimpan saat Anda menekan Simpan.",
          tone: "danger",
        })
      }
      pendingKeys.current = uploadedKeys
      setForm({ ...EMPTY_FORM })
      setFormError(undefined)
      setEditor({ mode: "create", fileKeys: uploadedKeys })
    } catch (err) {
      void cleanupPendingShowcaseKeys(uploadedKeys)
      toast.show({ title: "Gagal mengunggah foto", description: userMessage(err), tone: "danger" })
    } finally {
      setUploading(false)
    }
  }, [toast, query, touchFeed])

  const openEdit = useCallback((item: ShowcaseItem) => {
    setForm({
      title: item.title ?? item.caption ?? "",
      description: item.description ?? "",
      priceMin: item.priceMin ?? 0,
      priceMax: item.priceMax ?? 0,
      ...rawMeta(item),
    })
    setFormError(undefined)
    setEditor({ mode: "edit", item })
  }, [])

  /** Tutup editor — membatalkan create membersihkan key tertunda (D-09). */
  const closeEditor = useCallback(() => {
    setEditor((current) => {
      if (current?.mode === "create") void cleanupPendingShowcaseKeys(current.fileKeys)
      pendingKeys.current = []
      return null
    })
  }, [])

  const handleSave = useCallback(async () => {
    if (!editor || saving) return
    const title = form.title.trim()
    if (!title) {
      setFormError("Judul wajib diisi.")
      return
    }
    if (form.priceMin && form.priceMax && form.priceMax < form.priceMin) {
      setFormError("Harga maksimum harus ≥ harga minimum.")
      return
    }
    setSaving(true)
    const payload = { title, ...formToPayload(form) }
    try {
      if (editor.mode === "create") {
        await api.users.createShowcase({
          ...payload,
          // fileKey hasil presigned+confirm (purpose SHOWCASE_IMAGE, D-04).
          imageFileKeys: editor.fileKeys.length > 0 ? editor.fileKeys : undefined,
          sortOrder: nextSortOrder(items),
        })
        pendingKeys.current = []
        toast.show({ title: "Karya ditambahkan", tone: "success", duration: 3000 })
      } else {
        await api.users.updateShowcase(editor.item.id, payload)
        toast.show({ title: "Detail diperbarui", tone: "success", duration: 3000 })
      }
      setEditor(null)
      touchFeed()
      await query.refresh()
    } catch (err) {
      if (editor.mode === "create") {
        // Create gagal: form tetap terbuka agar pengguna bisa mencoba lagi;
        // key HANYA dibersihkan bila pengguna membatalkan (closeEditor).
      }
      toast.show({ title: "Gagal menyimpan", description: userMessage(err), tone: "danger" })
    } finally {
      setSaving(false)
    }
  }, [editor, saving, form, items, toast, query, touchFeed])

  const handleToggleActive = useCallback(
    async (item: ShowcaseItem) => {
      if (toggling) return
      setToggling(true)
      const next = !(item.isActive ?? true)
      try {
        await api.users.updateShowcase(item.id, { isActive: next })
        toast.show({
          title: next ? "Karya ditampilkan di profil" : "Karya disembunyikan",
          tone: "success",
          duration: 2500,
        })
        setMenuItem(null)
        touchFeed()
        await query.refresh()
      } catch (err) {
        toast.show({
          title: "Gagal mengubah visibilitas",
          description: userMessage(err),
          tone: "danger",
        })
      } finally {
        setToggling(false)
      }
    },
    [toggling, toast, query, touchFeed],
  )

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.users.deleteShowcase(deleteTarget.id)
      toast.show({ title: "Karya dihapus", tone: "success", duration: 3000 })
      setDeleteTarget(null)
      touchFeed()
      await query.refresh()
    } catch (err) {
      toast.show({ title: "Gagal menghapus", description: userMessage(err), tone: "danger" })
    } finally {
      setDeleting(false)
    }
  }, [deleteTarget, toast, query, touchFeed])

  /**
   * Lampirkan foto tambahan — MULTI-PICK (D-11): pilih beberapa sekaligus,
   * unggah satu-satu, lalu SATU attach untuk semua key yang berhasil.
   * Key yang terunggah tapi gagal dilampirkan dibersihkan (D-09) dan toast
   * menyebut alasannya spesifik (bukan "fileKey boolean" generik).
   */
  const handleAttachImage = useCallback(
    async (item: ShowcaseItem) => {
      if (attaching) return
      const slots = SHOWCASE_MAX_IMAGES - (item.images?.length ?? 0)
      if (slots <= 0) return
      const picked = await pickImages({ selectionLimit: slots })
      if (picked.status === "denied") {
        toast.show({ title: "Akses galeri ditolak", tone: "danger" })
        return
      }
      if (picked.status !== "picked") return
      setAttaching(true)
      try {
        const keys: string[] = []
        let failedUploads = 0
        for (const asset of picked.assets) {
          try {
            const outcome = await uploadShowcasePhoto(asset)
            if (outcome.kind === "fileKey") keys.push(outcome.fileKey)
            else failedUploads += 1 // cabang item-utuh tidak berlaku untuk lampiran
          } catch {
            failedUploads += 1
          }
        }
        if (keys.length > 0) {
          try {
            await api.users.attachShowcaseImages(item.id, keys)
          } catch (err) {
            // D-09: upload sukses tapi attach gagal → bersihkan key orphan.
            void cleanupPendingShowcaseKeys(keys)
            throw err
          }
        }
        if (failedUploads > 0 && keys.length === 0) {
          toast.show({ title: "Gagal mengunggah foto", tone: "danger" })
          return
        }
        toast.show({
          title:
            failedUploads > 0
              ? translate("{x} foto dilampirkan, {y} gagal", { x: keys.length, y: failedUploads })
              : translate("{x} foto dilampirkan", { x: keys.length }),
          tone: failedUploads > 0 ? "info" : "success",
          duration: 3000,
        })
        touchFeed()
        await query.refresh()
      } catch (err) {
        toast.show({
          title: "Foto terunggah tapi gagal dilampirkan",
          description: `${userMessage(err)} — coba lampirkan lagi.`,
          tone: "danger",
        })
      } finally {
        setAttaching(false)
      }
    },
    [attaching, toast, query, touchFeed],
  )

  // ── D-10: reorder foto — draft lokal, SATU commit saat sheet tutup ──
  const openImagesSheet = useCallback((item: ShowcaseItem) => {
    setOrderDraft(null)
    setImagesItemId(item.id)
  }, [])

  /** ID foto efektif: draft bila ada perubahan, kalau tidak urutan server. */
  const effectiveImageIds: string[] = useMemo(() => {
    const server = (imagesItem?.images ?? []).map((img) => img.id)
    if (!orderDraft) return server
    // Draft hanya valid bila himpunan ID-nya masih sama dengan server
    // (attach/delete di tengah sesi sheet menggagalkan draft secara alami).
    return orderDraft.length === server.length && server.every((id) => orderDraft.includes(id))
      ? orderDraft
      : server
  }, [imagesItem, orderDraft])

  const moveImage = useCallback(
    (imageId: string, dir: -1 | 1) => {
      const current = effectiveImageIds
      const i = current.indexOf(imageId)
      const j = i + dir
      if (i < 0 || j < 0 || j >= current.length) return
      const next = [...current]
      ;[next[i], next[j]] = [next[j], next[i]]
      setOrderDraft(next)
    },
    [effectiveImageIds],
  )

  /** Commit draft urutan (dipanggil saat sheet ditutup). */
  const closeImagesSheet = useCallback(async () => {
    const itemId = imagesItemId
    const draft = orderDraft
    const server = (imagesItem?.images ?? []).map((img) => img.id)
    setImagesItemId(null)
    setOrderDraft(null)
    if (!itemId || !draft || draft.join("|") === server.join("|")) return
    if (committingOrder) return
    setCommittingOrder(true)
    try {
      await api.users.reorderShowcaseImages(itemId, draft)
      touchFeed()
      await query.refresh()
      toast.show({ title: "Urutan foto disimpan", tone: "success", duration: 2500 })
    } catch (err) {
      toast.show({
        title: "Gagal mengubah urutan foto",
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setCommittingOrder(false)
    }
  }, [imagesItemId, imagesItem, orderDraft, committingOrder, query, toast, touchFeed])

  const handleDeleteImage = useCallback(async () => {
    if (!imagesItem || !deleteImage || deletingImage) return
    setDeletingImage(true)
    try {
      await api.users.deleteShowcaseImage(deleteImage.id)
      toast.show({ title: "Foto dihapus", tone: "success", duration: 2500 })
      setDeleteImage(null)
      touchFeed()
      await query.refresh()
    } catch (err) {
      toast.show({ title: "Gagal menghapus foto", description: userMessage(err), tone: "danger" })
    } finally {
      setDeletingImage(false)
    }
  }, [imagesItem, deleteImage, deletingImage, toast, query, touchFeed])

  const menuActions: ActionSheetItem[] = menuItem
    ? [
        {
          key: "view",
          label: "Lihat detail",
          description: "Halaman sosial: suka, komentar, bagikan",
          icon: Eye,
          onPress: () => {
            const it = menuItem
            setMenuItem(null)
            router.push(ROUTES.showcaseDetail(it.id))
          },
        },
        {
          key: "edit",
          label: "Ubah detail",
          description: showcasePriceLabel(menuItem) ?? undefined,
          icon: PencilSimple,
          onPress: () => {
            const it = menuItem
            setMenuItem(null)
            openEdit(it)
          },
        },
        {
          key: "images",
          label: "Kelola foto",
          description: translate("{x} foto — tambah, urutkan, hapus", { x: menuItem.images?.length ?? 1 }),
          icon: Images,
          onPress: () => {
            const it = menuItem
            setMenuItem(null)
            openImagesSheet(it)
          },
        },
        {
          key: "toggle",
          label: (menuItem.isActive ?? true) ? "Sembunyikan dari profil" : "Tampilkan di profil",
          icon: (menuItem.isActive ?? true) ? EyeSlash : Eye,
          disabled: toggling,
          onPress: () => void handleToggleActive(menuItem),
        },
        {
          key: "delete",
          label: "Hapus",
          icon: Trash,
          destructive: true,
          onPress: () => {
            const it = menuItem
            setMenuItem(null)
            setDeleteTarget(it)
          },
        },
      ]
    : []

  const hiddenCount = items.filter((it) => it.isActive === false).length

  /** Baris foto mengikuti effectiveImageIds (draft D-10). */
  const imageRows = effectiveImageIds.flatMap((id) => {
    const img = (imagesItem?.images ?? []).find((entry) => entry.id === id)
    return img ? [img] : []
  })

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Etalase" />
      <PullToRefresh
        onRefresh={() => void query.refresh()}
        refreshing={refreshing}
        contentContainerClassName="px-5"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        {error ? (
          <ErrorState title="Gagal memuat" description={error} onRetry={() => void query.reload()} />
        ) : (
          <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
            <SectionHeader
              title="Etalase Anda"
              subtitle={
                items.length
                  ? [
                      translate("{x} item", { x: items.length }),
                      hiddenCount ? translate("{x} disembunyikan", { x: hiddenCount }) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : undefined
              }
            />
            {/* D-07: skeleton = grid persegi (bentuk cocok dengan konten). */}
            <Crossfade loading={loading} skeleton={<ShowcaseGalleryGrid items={[]} loading />}>
              <ShowcaseGalleryGrid
                items={items.map((it) => {
                  const isHidden = it.isActive === false || rawMeta(it).isPublic === false
                  return {
                    id: it.id,
                    // E-01 kelas yang sama: satu resolver cover bersama.
                    source: showcaseCoverOf(it) ?? "",
                    alt: `${labelOf(it)}${isHidden ? " (disembunyikan)" : ""}`,
                    hidden: isHidden,
                  }
                })}
                onPressItem={(_, index) => setMenuItem(items[index] ?? null)}
                loading={false}
                empty={
                  <EmptyState
                    icon={Images}
                    title="Belum ada foto"
                    description="Tambahkan foto produk atau hasil kerja Anda."
                  />
                }
              />
            </Crossfade>
            <Text variant="caption" tone="secondary">
              Ketuk karya untuk mengubah detail, menyembunyikan, atau menghapus.
            </Text>
            <Button
              leftIcon={Plus}
              loading={uploading}
              variant="secondary"
              onPress={() => void handleUpload()}
            >
              Tambah foto
            </Button>
          </View>
        )}
      </PullToRefresh>

      <ActionSheet
        visible={!!menuItem}
        onRequestClose={() => setMenuItem(null)}
        title={menuItem ? labelOf(menuItem) : undefined}
        description={menuItem?.isActive === false ? "Disembunyikan dari profil publik" : undefined}
        actions={menuActions}
      />

      {/* ── Kelola foto item (multi-image; D-10 reorder lokal) ─────── */}
      <BottomSheet
        avoidKeyboard
        visible={imagesItem != null}
        onRequestClose={() => void closeImagesSheet()}
        title={imagesItem ? translate("Foto: {x}", { x: labelOf(imagesItem) }) : "Foto karya"}
        description={translate("{x} dari {y} foto. Foto pertama menjadi cover karya.", {
          x: imagesItem?.images?.length ?? 0,
          y: SHOWCASE_MAX_IMAGES,
        })}
        footer={
          <Button
            leftIcon={Plus}
            fullWidth
            variant="secondary"
            loading={attaching}
            disabled={(imagesItem?.images?.length ?? 0) >= SHOWCASE_MAX_IMAGES}
            onPress={() => imagesItem && void handleAttachImage(imagesItem)}
          >
            Tambah foto
          </Button>
        }
      >
        <View className="gap-2">
          {imageRows.map((img, i) => (
            <View
              key={img.id}
              className="flex-row items-center gap-2 rounded-md border border-border p-2"
            >
              <Picture source={img.imageUrl} alt="" width={56} height={56} radius="sm" />
              <View className="flex-1 gap-0.5">
                <Text variant="body" weight={500} tone="primary">
                  Foto {i + 1}
                </Text>
                {i === 0 ? <Text variant="caption" tone="secondary">Cover karya</Text> : null}
              </View>
              <IconButton
                icon={CaretLeft}
                size="sm"
                variant="ghost"
                accessibilityLabel={translate("Geser foto {x} ke kiri", { x: i + 1 })}
                disabled={i === 0}
                onPress={() => moveImage(img.id, -1)}
              />
              <IconButton
                icon={CaretRight}
                size="sm"
                variant="ghost"
                accessibilityLabel={translate("Geser foto {x} ke kanan", { x: i + 1 })}
                disabled={i === imageRows.length - 1}
                onPress={() => moveImage(img.id, 1)}
              />
              <IconButton
                icon={Trash}
                size="sm"
                variant="ghost"
                accessibilityLabel={translate("Hapus foto {x}", { x: i + 1 })}
                disabled={deletingImage}
                onPress={() => setDeleteImage(img)}
              />
            </View>
          ))}
          {imageRows.length === 0 ? (
            <Text variant="caption" tone="secondary">
              Belum ada foto — lampirkan foto pertama di bawah.
            </Text>
          ) : null}
        </View>
      </BottomSheet>

      <Dialog
        title="Hapus foto ini?"
        description={
          deleteImage && imagesItem?.images?.[0]?.id === deleteImage.id
            ? "Foto cover akan digantikan foto berikutnya."
            : "Foto akan dihapus permanen dari karya ini."
        }
        visible={!!deleteImage}
        destructive
        loading={deletingImage}
        confirmLabel="Hapus"
        cancelLabel="Batal"
        onConfirm={() => void handleDeleteImage()}
        onCancel={() => setDeleteImage(null)}
        onRequestClose={() => setDeleteImage(null)}
      />

      <Dialog
        title="Hapus karya ini?"
        description="Karya akan dihapus permanen dari etalase Anda."
        visible={!!deleteTarget}
        destructive
        loading={deleting}
        confirmLabel="Hapus"
        cancelLabel="Batal"
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
        onRequestClose={() => setDeleteTarget(null)}
      />

      <BottomSheet
        avoidKeyboard
        visible={!!editor}
        onRequestClose={() => (saving ? undefined : closeEditor())}
        title={editor?.mode === "create" ? "Detail karya baru" : "Ubah detail"}
        description="Judul, kategori, dan rentang harga membantu calon pembeli memahami penawaran Anda."
        footer={
          <View className="gap-2">
            <Button variant="primary" loading={saving} onPress={() => void handleSave()} fullWidth>
              Simpan
            </Button>
            <Button variant="ghost" disabled={saving} onPress={closeEditor} fullWidth>
              Batal
            </Button>
          </View>
        }
      >
        <View className="gap-4">
          <Input
            label="Judul"
            value={form.title}
            onChangeText={(t) => {
              setForm((f) => ({ ...f, title: t }))
              setFormError(undefined)
            }}
            autoCapitalize="sentences"
            returnKeyType="next"
            maxLength={TITLE_MAX}
            errorText={formError && !form.title.trim() ? formError : undefined}
            required
            disabled={saving}
          />
          <TextArea
            label="Deskripsi"
            value={form.description}
            onChangeText={(t) => setForm((f) => ({ ...f, description: t }))}
            maxLength={DESC_MAX}
            showCount
            rows={3}
            disabled={saving}
          />
          {/* D-02: kategori (kontrak menganggur sebelum audit) */}
          <Input
            label="Kategori (opsional)"
            value={form.category}
            onChangeText={(t) => setForm((f) => ({ ...f, category: t }))}
            placeholder="Jasa desain, kerajinan, digital…"
            autoCapitalize="sentences"
            maxLength={CATEGORY_MAX}
            disabled={saving}
          />
          <AmountInput
            label="Harga minimum (opsional)"
            value={form.priceMin}
            onChange={(v) => {
              setForm((f) => ({ ...f, priceMin: v }))
              setFormError(undefined)
            }}
            disabled={saving}
          />
          <AmountInput
            label="Harga maksimum (opsional)"
            value={form.priceMax}
            onChange={(v) => {
              setForm((f) => ({ ...f, priceMax: v }))
              setFormError(undefined)
            }}
            errorText={formError && form.title.trim() ? formError : undefined}
            disabled={saving}
          />
          {/* D-02: visibilitas PUBLIC/PRIVATE */}
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-1 gap-1">
              <Text variant="body" weight={500}>
                Tampilkan secara publik
              </Text>
              <Text variant="caption" tone="secondary">
                {form.isPublic
                  ? "Karya terlihat di feed & profil publik Anda."
                  : "Karya disimpan sebagai draf privat (tidak terlihat pengunjung)."}
              </Text>
            </View>
            <Switch
              value={form.isPublic}
              onChange={(v) => setForm((f) => ({ ...f, isPublic: v }))}
              accessibilityLabel="Tampilkan secara publik"
              disabled={saving}
            />
          </View>
        </View>
      </BottomSheet>
    </Screen>
  )
}
