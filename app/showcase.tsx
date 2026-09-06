import { ListLoading } from "@/components/ui/paginated-list"
/**
 * Screen — Showcase / portofolio saya.
 *
 * Kontrak API (docs/api/kahade-api-mobile.json):
 *   GET    /v1/users/me/showcase             → semua item (termasuk nonaktif)
 *   POST   /v1/users/me/showcase/upload      multipart gambar (201, tanpa schema)
 *   POST   /v1/users/me/showcase             CreateShowcaseDto { title, description?,
 *                                            imageUrl?, priceMin?, priceMax?, sortOrder? }
 *   PUT    /v1/users/me/showcase/{id}        UpdateShowcaseDto (+ isActive)
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
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Eye, EyeSlash, Images, PencilSimple, Plus, Trash } from "phosphor-react-native"

import { api, userMessage } from "@/lib/api"
import type { ShowcaseItem } from "@/lib/api/users"
import { pickImage, pickedImageToFormData } from "@/lib/image-picker"
import { formatRupiah } from "@/lib/format"
import { tokens } from "@/lib/tokens"

import { ActionSheet, type ActionSheetItem } from "@/components/ui/action-sheet"
import { AmountInput } from "@/components/ui/amount-input"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/modal"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { Input } from "@/components/ui/input"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { ShowcaseGalleryGrid } from "@/components/ui/showcase-gallery-grid"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"
import { useToast } from "@/components/ui/toast"
// UX: haptic feedback ensured for onPress (light) — improves confirmation

/** Batas lokal (spec tidak menyebut maxLength untuk showcase) */
const TITLE_MAX = 100
const DESC_MAX = 500

type FormState = {
  title: string
  description: string
  priceMin: number
  priceMax: number
}
const EMPTY_FORM: FormState = { title: "", description: "", priceMin: 0, priceMax: 0 }

type Editor = { mode: "create"; imageUrl?: string } | { mode: "edit"; item: ShowcaseItem } | null

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

  const [items, setItems] = useState<ShowcaseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [uploading, setUploading] = useState(false)

  const [menuItem, setMenuItem] = useState<ShowcaseItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ShowcaseItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [toggling, setToggling] = useState(false)

  const [editor, setEditor] = useState<Editor>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | undefined>()
  const [saving, setSaving] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.users.getMyShowcase()
      setItems(res ?? [])
    } catch (err) {
      setError(userMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await fetchAll()
    setRefreshing(false)
  }, [fetchAll])

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
        await fetchAll()
        // Tawarkan lengkapi detail (judul/harga) bila belum ada judul
        if (!res.title) {
          setForm({ ...EMPTY_FORM })
          setEditor({ mode: "edit", item: { ...(res as ShowcaseItem), id: res.id } })
        }
      } else {
        const imageUrl = res?.imageUrl ?? res?.url ?? res?.key ?? res?.fileKey
        setForm({ ...EMPTY_FORM })
        setFormError(undefined)
        setEditor({ mode: "create", imageUrl })
      }
    } catch (err) {
      toast.show({ title: "Gagal mengunggah foto", description: userMessage(err), tone: "danger" })
    } finally {
      setUploading(false)
    }
  }, [toast, fetchAll])

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
          imageUrl: editor.imageUrl,
          sortOrder: items.length,
        })
        toast.show({ title: "Item showcase dibuat", tone: "success", duration: 3000 })
      } else {
        await api.users.updateShowcase(editor.item.id, payload)
        toast.show({ title: "Detail diperbarui", tone: "success", duration: 3000 })
      }
      setEditor(null)
      await fetchAll()
    } catch (err) {
      toast.show({ title: "Gagal menyimpan", description: userMessage(err), tone: "danger" })
    } finally {
      setSaving(false)
    }
  }, [editor, saving, form, items.length, toast, fetchAll])

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
        await fetchAll()
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
    [toggling, toast, fetchAll],
  )

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.users.deleteShowcase(deleteTarget.id)
      toast.show({ title: "Item dihapus", tone: "success", duration: 3000 })
      setDeleteTarget(null)
      await fetchAll()
    } catch (err) {
      toast.show({ title: "Gagal menghapus", description: userMessage(err), tone: "danger" })
    } finally {
      setDeleting(false)
    }
  }, [deleteTarget, toast, fetchAll])

  const menuActions: ActionSheetItem[] = menuItem
    ? [
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
        onRefresh={handleRefresh}
        refreshing={refreshing}
        contentContainerClassName="px-6"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        {error ? (
          <ErrorState title="Gagal memuat" description={error} onRetry={() => void fetchAll()} />
        ) : (
          <View accessible={false} className="gap-4" style={{ paddingTop: tokens.space[3] }}>
            <SectionHeader
              title="Portofolio Anda"
              subtitle={
                items.length
                  ? `${items.length} item${hiddenCount ? ` · ${hiddenCount} disembunyikan` : ""}`
                  : undefined
              }
            />
            {loading ? (
              <ListLoading />
            ) : (
              <ShowcaseGalleryGrid
                items={items.map((it) => ({
                  id: it.id,
                  source: it.imageUrl ?? it.fileKey ?? "",
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
            )}
            <Text numberOfLines={1} variant="caption" tone="secondary">
              Ketuk item untuk mengubah detail, menyembunyikan, atau menghapus.
            </Text>
            <Button accessibilityHint="Ketuk untuk berinteraksi"
              leftIcon={Plus}
              loading={uploading}
              variant="secondary"
              onPress={() => void handleUpload()}
            >
              Tambah Foto
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