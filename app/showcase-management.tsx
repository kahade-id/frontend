import { Crossfade } from "@/components/ui/fade-in"
import { ListLoading } from "@/components/ui/paginated-list"
/**
 * Screen — Showcase / portofolio saya.
 *
 * Kontrak API (docs/api/kahade-api-mobile.json):
 *   GET    /v1/users/me/showcase             → semua item (termasuk nonaktif)
 *   POST   /v1/users/me/showcase/upload      multipart gambar (201, tanpa schema)
 *   POST   /v1/users/me/showcase             CreateShowcaseItemDto { title, description?,
 *                                            imageUrl?, priceMin?, priceMax?, sortOrder? }
 *   PUT    /v1/users/me/showcase/{id}        UpdateShowcaseItemDto (+ isActive)
 *   DELETE /v1/users/me/showcase/{id}
 *
 * Alur tambah: pilih gambar → upload → bila respons sudah berupa item
 * (punya `id`) selesai; bila hanya `imageUrl`/`url`/`key` → buka form
 * (judul wajib, deskripsi, rentang harga) → createShowcase. UNVERIFIED mana
 * yang dilakukan backend; keduanya ditangani.
 *
 * Tap item → ActionSheet: Ubah detail (form → updateShowcase), Sembunyikan/
 * Tampilkan (isActive), Hapus (Dialog destructive). Item nonaktif ditandai
 * di judul sheet supaya user tahu kenapa tidak tampil di profil publik.
 *
 * Keputusan non-obvious:
 *   - Harga memakai <AmountInput> (format Rupiah §13) dengan validasi
 *     priceMax ≥ priceMin lokal; 0 = tidak diisi (undefined ke server).
 *   - Tidak ada drag-reorder: `sortOrder` diisi berurutan saat membuat item
 *     baru (di akhir); pengurutan manual dicatat di finding sebagai backlog.
 */
import { useCallback, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { CaretLeft, CaretRight, Eye, EyeSlash, Images, PencilSimple, Plus, Trash } from "phosphor-react-native"
import { router } from "expo-router"

import { api, userMessage } from "@/lib/api"
import type { ShowcaseImage, ShowcaseItem } from "@/lib/api/users"
import { pickImage, pickedImageToFormData } from "@/lib/image-picker"
import { formatRupiah } from "@/lib/format"
import { useApiQuery } from "@/lib/use-api-query"
import { ROUTES } from "@/lib/routes"
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
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"
import { useToast } from "@/components/ui/toast"

/** Batas lokal (spec tidak menyebut maxLength untuk showcase) */
const TITLE_MAX = 100
const DESC_MAX = 500
/** Batas foto per item — sama dengan SHOWCASE_MAX_IMAGES backend (8). */
const SHOWCASE_MAX_IMAGES = 8

type FormState = {
  title: string
  description: string
  priceMin: number
  priceMax: number
}
const EMPTY_FORM: FormState = { title: "", description: "", priceMin: 0, priceMax: 0 }

type Editor = { mode: "create"; imageUrl?: string; fileKey?: string } | { mode: "edit"; item: ShowcaseItem } | null

function labelOf(it: ShowcaseItem): string {
  return it.title ?? it.caption ?? "Portofolio"
}

function priceLabel(it: ShowcaseItem): string | undefined {
  if (it.priceMin && it.priceMax)
    return `${formatRupiah(it.priceMin)} – ${formatRupiah(it.priceMax)}`
  if (it.priceMin) return `Mulai ${formatRupiah(it.priceMin)}`
  if (it.priceMax) return `Hingga ${formatRupiah(it.priceMax)}`
  return undefined
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

  // ── Kelola foto item (multi-image) ────────────────────────────────
  // ID saja yang disimpan di state — baris item diturunkan dari `items`
  // supaya selalu sinkron setelah refresh (foto baru/terhapus/terurut ulang).
  const [imagesItemId, setImagesItemId] = useState<string | null>(null)
  const imagesItem = imagesItemId ? (items.find((it) => it.id === imagesItemId) ?? null) : null
  const [attaching, setAttaching] = useState(false)
  const [reorderingId, setReorderingId] = useState<string | null>(null)
  const [deleteImage, setDeleteImage] = useState<ShowcaseImage | null>(null)
  const [deletingImage, setDeletingImage] = useState(false)



  // ── Tambah: pilih → upload → (form bila perlu) ────────────────────
  const handleUpload = useCallback(async () => {
    const picked = await pickImage({ allowsEditing: true })
    if (picked.status === "denied") {
      toast.show({ title: "Akses galeri ditolak", tone: "danger" })
      return
    }
    if (picked.status !== "picked") return
    setUploading(true)
    try {
      const res = await api.users.uploadShowcase(await pickedImageToFormData(picked.asset))
      if (res?.id) {
        // Backend langsung membuat item
        toast.show({ title: "Foto showcase ditambahkan", tone: "success", duration: 3000 })
        await query.refresh()
        // Tawarkan lengkapi detail (judul/harga) bila belum ada judul
        if (!res.title) {
          setForm({ ...EMPTY_FORM })
          setEditor({ mode: "edit", item: { ...(res as ShowcaseItem), id: res.id } })
        }
      } else {
        const imageUrl = res?.imageUrl ?? res?.url ?? res?.key ?? res?.fileKey
        const fileKey = res?.fileKey ?? res?.key
        setForm({ ...EMPTY_FORM })
        setFormError(undefined)
        setEditor({ mode: "create", imageUrl, fileKey })
      }
    } catch (err) {
      toast.show({ title: "Gagal mengunggah foto", description: userMessage(err), tone: "danger" })
    } finally {
      setUploading(false)
    }
  }, [toast, query])

  const openEdit = useCallback((item: ShowcaseItem) => {
    setForm({
      title: item.title ?? item.caption ?? "",
      description: item.description ?? "",
      priceMin: item.priceMin ?? 0,
      priceMax: item.priceMax ?? 0,
    })
    setFormError(undefined)
    setEditor({ mode: "edit", item })
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
    const payload = {
      title,
      description: form.description.trim() || undefined,
      priceMin: form.priceMin || undefined,
      priceMax: form.priceMax || undefined,
    }
    try {
      if (editor.mode === "create") {
        await api.users.createShowcase({
          ...payload,
          // fileKey dari /showcase/upload (purpose SHOWCASE_IMAGE) — field baru
          // CreateShowcaseItemDto; `imageUrl` (DTO lama) tidak lagi diterima backend.
          imageFileKeys: editor.fileKey ? [editor.fileKey] : undefined,
          sortOrder: items.length,
        })
        toast.show({ title: "Item showcase dibuat", tone: "success", duration: 3000 })
      } else {
        await api.users.updateShowcase(editor.item.id, payload)
        toast.show({ title: "Detail diperbarui", tone: "success", duration: 3000 })
      }
      setEditor(null)
      await query.refresh()
    } catch (err) {
      toast.show({ title: "Gagal menyimpan", description: userMessage(err), tone: "danger" })
    } finally {
      setSaving(false)
    }
  }, [editor, saving, form, items.length, toast, query])

  const handleToggleActive = useCallback(
    async (item: ShowcaseItem) => {
      if (toggling) return
      setToggling(true)
      const next = !(item.isActive ?? true)
      try {
        await api.users.updateShowcase(item.id, { isActive: next })
        toast.show({
          title: next ? "Item ditampilkan" : "Item disembunyikan",
          tone: "success",
          duration: 2500,
        })
        setMenuItem(null)
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
    [toggling, toast, query],
  )

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.users.deleteShowcase(deleteTarget.id)
      toast.show({ title: "Item dihapus", tone: "success", duration: 3000 })
      setDeleteTarget(null)
      await query.refresh()
    } catch (err) {
      toast.show({ title: "Gagal menghapus", description: userMessage(err), tone: "danger" })
    } finally {
      setDeleting(false)
    }
  }, [deleteTarget, toast, query])

  /**
   * Lampirkan foto tambahan: pick → upload langsung (kembalikan fileKey) →
   * POST /me/showcase/{id}/images. Foto baru masuk di AKHIR galeri
   * (sortOrder berikutnya diisi backend).
   */
  const handleAttachImage = useCallback(
    async (item: ShowcaseItem) => {
      if (attaching) return
      const picked = await pickImage({ allowsEditing: true })
      if (picked.status === "denied") {
        toast.show({ title: "Akses galeri ditolak", tone: "danger" })
        return
      }
      if (picked.status !== "picked") return
      setAttaching(true)
      try {
        const res = await api.users.uploadShowcase(await pickedImageToFormData(picked.asset))
        const fileKey = res?.fileKey ?? res?.key
        if (!fileKey) {
          toast.show({ title: "Upload tidak menghasilkan kunci file", tone: "danger" })
          return
        }
        await api.users.attachShowcaseImages(item.id, [fileKey])
        toast.show({ title: "Foto dilampirkan", tone: "success", duration: 2500 })
        await query.refresh()
      } catch (err) {
        toast.show({ title: "Gagal melampirkan foto", description: userMessage(err), tone: "danger" })
      } finally {
        setAttaching(false)
      }
    },
    [attaching, toast, query],
  )

  /**
   * Geser satu posisi ke kiri/kanan: swap di array lokal, lalu kirim
   * SELURUH daftar imageIds (PUT /me/showcase/{id}/images/order menyimpan
   * ulang sortOrder 0..n-1 sesuai urutan yang dikirim).
   */
  const handleMoveImage = useCallback(
    async (item: ShowcaseItem, image: ShowcaseImage, dir: -1 | 1) => {
      if (reorderingId) return
      const imgs = item.images ?? []
      const i = imgs.findIndex((x) => x.id === image.id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= imgs.length) return
      setReorderingId(image.id)
      try {
        const next = [...imgs]
        ;[next[i], next[j]] = [next[j], next[i]]
        await api.users.reorderShowcaseImages(item.id, next.map((x) => x.id))
        await query.refresh()
      } catch (err) {
        toast.show({ title: "Gagal mengubah urutan foto", description: userMessage(err), tone: "danger" })
      } finally {
        setReorderingId(null)
      }
    },
    [reorderingId, toast, query],
  )

  const handleDeleteImage = useCallback(async () => {
    if (!imagesItem || !deleteImage || deletingImage) return
    setDeletingImage(true)
    try {
      await api.users.deleteShowcaseImage(deleteImage.id)
      toast.show({ title: "Foto dihapus", tone: "success", duration: 2500 })
      setDeleteImage(null)
      await query.refresh()
    } catch (err) {
      toast.show({ title: "Gagal menghapus foto", description: userMessage(err), tone: "danger" })
    } finally {
      setDeletingImage(false)
    }
  }, [imagesItem, deleteImage, deletingImage, toast, query])

  const menuActions: ActionSheetItem[] = menuItem
    ? [
        {
          key: "view",
          label: "Lihat detail",
          description: "Halaman sosial: like, komentar, share",
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
          description: priceLabel(menuItem),
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
          description: `${menuItem.images?.length ?? 1} foto — tambah, urutkan, hapus`,
          icon: Images,
          onPress: () => {
            setImagesItemId(menuItem.id)
            setMenuItem(null)
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

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Portofolio" />
      <PullToRefresh
        onRefresh={() => void query.refresh()}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        {error ? (
          <ErrorState title="Gagal memuat" description={error} onRetry={() => void query.reload()} />
        ) : (
          <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
            <SectionHeader
              title="Portofolio Anda"
              subtitle={
                items.length
                  ? `${items.length} item${hiddenCount ? ` · ${hiddenCount} disembunyikan` : ""}`
                  : undefined
              }
            />
            {/* v2: skeleton → galeri crossfade (signature moment). */}
            <Crossfade loading={loading} skeleton={<ListLoading />}>
              <ShowcaseGalleryGrid
                items={items.map((it) => ({
                  id: it.id,
                  source: it.coverImageUrl ?? it.imageUrl ?? it.fileKey ?? "",
                  alt: `${labelOf(it)}${it.isActive === false ? " (disembunyikan)" : ""}`,
                }))}
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
              Ketuk item untuk mengubah detail, menyembunyikan, atau menghapus.
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

      {/* ── Kelola foto item (multi-image) ───────────────────────── */}
      <BottomSheet
        avoidKeyboard
        visible={imagesItem != null}
        onRequestClose={() => setImagesItemId(null)}
        title={imagesItem ? `Foto: ${labelOf(imagesItem)}` : "Foto item"}
        description={`${imagesItem?.images?.length ?? 0} dari ${SHOWCASE_MAX_IMAGES} foto. Foto pertama menjadi cover item.`}
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
          {(imagesItem?.images ?? []).map((img, i) => (
            <View
              key={img.id}
              className="flex-row items-center gap-2 rounded-md border border-border p-2"
            >
              <Picture source={img.imageUrl} alt="" width={56} height={56} radius="sm" />
              <View className="flex-1 gap-0.5">
                <Text variant="body" weight={500} tone="primary">
                  Foto {i + 1}
                </Text>
                {i === 0 ? <Text variant="caption" tone="secondary">Cover item</Text> : null}
              </View>
              <IconButton
                icon={CaretLeft}
                size="sm"
                variant="ghost"
                accessibilityLabel={`Geser foto ${i + 1} ke kiri`}
                disabled={i === 0 || reorderingId != null}
                onPress={() => imagesItem && void handleMoveImage(imagesItem, img, -1)}
              />
              <IconButton
                icon={CaretRight}
                size="sm"
                variant="ghost"
                accessibilityLabel={`Geser foto ${i + 1} ke kanan`}
                disabled={i === (imagesItem?.images?.length ?? 0) - 1 || reorderingId != null}
                onPress={() => imagesItem && void handleMoveImage(imagesItem, img, 1)}
              />
              <IconButton
                icon={Trash}
                size="sm"
                variant="ghost"
                accessibilityLabel={`Hapus foto ${i + 1}`}
                disabled={deletingImage}
                onPress={() => setDeleteImage(img)}
              />
            </View>
          ))}
          {(imagesItem?.images ?? []).length === 0 ? (
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
            : "Foto akan dihapus permanen dari item ini."
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
        title="Hapus item ini?"
        description="Item akan dihapus permanen dari showcase Anda."
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
        onRequestClose={() => (saving ? undefined : setEditor(null))}
        title={editor?.mode === "create" ? "Detail item baru" : "Ubah detail"}
        description="Judul dan rentang harga membantu calon pembeli memahami penawaran Anda."
        footer={
          <View className="gap-2">
            <Button variant="primary" loading={saving} onPress={() => void handleSave()} fullWidth>
              Simpan
            </Button>
            <Button variant="ghost" disabled={saving} onPress={() => setEditor(null)} fullWidth>
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
        </View>
      </BottomSheet>
    </Screen>
  )
}