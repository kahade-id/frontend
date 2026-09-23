/** Etalase management: upload-only drafts, explicit publication, recoverable photo ordering.
 * Legacy auto-create upload is intentionally disabled; see the deep-audit remediation log. */

import { Crossfade } from "@/components/ui/fade-in"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Linking, Platform, View } from "react-native"
import { useNavigation, usePreventRemove, type NavigationAction } from "@react-navigation/native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { CaretLeft, CaretRight, Eye, EyeSlash, Images, PencilSimple, Plus, Trash } from "phosphor-react-native"
import { router } from "expo-router"
import { translate } from "@/lib/i18n/translate"

import { createIdempotencyKey } from "@/lib/api/client"
import type { CreateShowcaseItemDto } from "@/lib/api/types"
import { api, isApiError, userMessage } from "@/lib/api"
import { API_CONSTRAINTS } from "@/lib/api/constraints"
import type { ShowcaseImage, ShowcaseItem } from "@/lib/api/users"
import { validImageOrder, showcaseIsHidden } from "@/lib/showcase-state"
import { useShowcaseOperation } from "@/lib/use-showcase-operation"
import { useSessionRevision } from "@/lib/guest-gate"
import { getSessionRevision } from "@/lib/api/session"
import { pickImages, type PickedImage } from "@/lib/image-picker"
import { useApiQuery } from "@/lib/use-api-query"
import { ROUTES } from "@/lib/routes"
import { showcasePriceLabel } from "@/lib/showcase-labels"
import { showcaseCoverOf, untitledShowcaseTitle } from "@/lib/showcase-social"
import { markShowcaseFeedDirty } from "@/lib/showcase-social-prefs"
import { cleanupPendingShowcaseKeys, uploadShowcasePhoto } from "@/lib/showcase-upload"
import { tokens } from "@/lib/tokens"

import { ActionSheet, type ActionSheetItem } from "@/components/ui/action-sheet"
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
  priceMin: number | null
  priceMax: number | null
  /** D-02: kategori & visibilitas ikut diisi dari aplikasi. */
  category: string
  isPublic: boolean
}
const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  priceMin: null,
  priceMax: null,
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

/** Explicit zero is a valid price; null means no draft price. */
function formToPayload(form: FormState) {
  return {
    description: form.description.trim(),
    priceMin: form.priceMin ?? undefined,
    priceMax: form.priceMax ?? undefined,
    category: form.category.trim().replace(/\s+/g, " "),
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
  const revision = useSessionRevision()
  return <ShowcaseManagement key={revision} />
}

function ShowcaseManagement() {
  const insets = useSafeAreaInsets()
  const toast = useToast()
  const revision = useSessionRevision()
  const mutations = useShowcaseOperation("management")
  const navigation = useNavigation()
  const pendingNavigation = useRef<NavigationAction | null>(null)

  /**
   * Audit: state async dirakit manual. Cacat terbukti dari kode lama:
   * `handleRefresh` memanggil `fetchAll()` yang sama dengan muat-awal, dan
   * fungsi itu membuka dengan `setLoading(true)` — tarik-untuk-menyegarkan
   * mengganti daftar etalase dengan kerangka. Request juga tidak dibatalkan
   * saat layar ditutup.
   */
  const query = useApiQuery<ShowcaseItem[]>(
    `my-showcase:${revision}`,
    async (signal) => (await api.users.getMyShowcase(signal)) ?? [],
    true,
    { refreshOnFocus: true, useCache: false },
  )
  const items = query.data ?? []
  const [renderLimit, setRenderLimit] = useState(60)
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
  const createAttempt = useRef<{ key: string; dto: CreateShowcaseItemDto } | null>(null)
  const [uncertainCreate, setUncertainCreate] = useState(false)
  const uploadAbort = useRef<AbortController | null>(null)
  const uploadBusy = useRef(false)
  const saveBusy = useRef(false)
  const mounted = useRef(true)
  const [progress, setProgress] = useState("")
  const [previews, setPreviews] = useState<{ fileKey: string; asset: PickedImage }[]>([])
  const [failedAssets, setFailedAssets] = useState<PickedImage[]>([])
  const [discardOpen, setDiscardOpen] = useState(false)
  const initialForm = useRef(EMPTY_FORM)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      uploadAbort.current?.abort()
      // Never delete keys while a create may have committed server-side.
      if (!saveBusy.current && !createAttempt.current) void cleanupPendingShowcaseKeys(pendingKeys.current)
    }
  }, [revision])

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
    if (uploadBusy.current) return
    uploadBusy.current = true
    const controller = new AbortController()
    uploadAbort.current = controller
    const uploaded: { fileKey: string; asset: PickedImage }[] = []
    const failures: PickedImage[] = []
    try {
      const picked = await pickImages({ selectionLimit: SHOWCASE_MAX_IMAGES })
      if (picked.status === "denied") {
        toast.show({
          title: "Akses galeri ditolak",
          description: "Izinkan akses foto di pengaturan perangkat untuk memilih karya.",
          tone: "danger",
          // G-22 (audit 2026-09-23): tanpa jalan pintas, pengguna harus
          // mencari sendiri halaman izin di OS.
          action: { label: "Buka pengaturan", onPress: () => void Linking.openSettings() },
        })
        return
      }
      if (picked.status !== "picked" || controller.signal.aborted) return
      setUploading(true)
      for (const [index, asset] of picked.assets.entries()) {
        setProgress(translate("Mengunggah foto {x} dari {y}", { x: index + 1, y: picked.assets.length }))
        try {
          const outcome = await uploadShowcasePhoto(asset, controller.signal)
          uploaded.push({ fileKey: outcome.fileKey, asset })
        } catch (error) {
          if (controller.signal.aborted) throw error
          failures.push(asset)
        }
      }
      if (controller.signal.aborted || revision !== getSessionRevision()) {
        void cleanupPendingShowcaseKeys(uploaded.map((entry) => entry.fileKey))
        return
      }
      const keys = uploaded.map((entry) => entry.fileKey)
      pendingKeys.current = keys
      createAttempt.current = null
      setUncertainCreate(false)
      setPreviews(uploaded)
      setFailedAssets(failures)
      setForm({ ...EMPTY_FORM })
      initialForm.current = EMPTY_FORM
      setFormError(undefined)
      setEditor({ mode: "create", fileKeys: keys })
    } catch (error) {
      void cleanupPendingShowcaseKeys(uploaded.map((entry) => entry.fileKey))
      if (!controller.signal.aborted && mounted.current) toast.show({
        title: "Gagal mengunggah foto", description: userMessage(error), tone: "danger",
      })
    } finally {
      uploadBusy.current = false
      if (uploadAbort.current === controller) uploadAbort.current = null
      if (mounted.current) { setUploading(false); setProgress("") }
    }
  }, [toast, revision])

  const retryFailedPhotos = useCallback(async () => {
    if (uploadBusy.current || saveBusy.current || !failedAssets.length) return
    uploadBusy.current = true
    setUploading(true)
    const controller = new AbortController()
    uploadAbort.current = controller
    const next = [...previews]
    const failures: PickedImage[] = []
    try {
      for (const [index, asset] of failedAssets.entries()) {
        setProgress(translate("Mengunggah foto {x} dari {y}", { x: index + 1, y: failedAssets.length }))
        try {
          const result = await uploadShowcasePhoto(asset, controller.signal)
          next.push({ fileKey: result.fileKey, asset })
        } catch { failures.push(asset) }
      }
      if (!mounted.current || revision !== getSessionRevision()) {
        void cleanupPendingShowcaseKeys(next.slice(previews.length).map((entry) => entry.fileKey))
        return
      }
      pendingKeys.current = next.map((entry) => entry.fileKey)
      setPreviews(next)
      setFailedAssets(failures)
      setEditor({ mode: "create", fileKeys: pendingKeys.current })
    } finally {
      uploadBusy.current = false
      uploadAbort.current = null
      if (mounted.current) { setUploading(false); setProgress("") }
    }
  }, [failedAssets, previews, revision])

  const changePreview = (index: number, direction: -1 | 0 | 1) => {
    if (saveBusy.current || uploadBusy.current || uncertainCreate) return
    const next = [...previews]
    if (direction === 0) {
      const [removed] = next.splice(index, 1)
      if (removed) void cleanupPendingShowcaseKeys([removed.fileKey])
    } else {
      const destination = index + direction
      if (destination < 0 || destination >= next.length) return
      ;[next[index], next[destination]] = [next[destination], next[index]]
    }
    pendingKeys.current = next.map((entry) => entry.fileKey)
    setPreviews(next)
    setEditor({ mode: "create", fileKeys: pendingKeys.current })
  }

  const openEdit = useCallback((item: ShowcaseItem) => {
    const nextForm = {
      title: item.title ?? item.caption ?? "",
      description: item.description ?? "",
      priceMin: item.priceMin ?? null,
      priceMax: item.priceMax ?? null,
      ...rawMeta(item),
    }
    initialForm.current = nextForm
    setForm(nextForm)
    setPreviews([])
    setFailedAssets([])
    setFormError(undefined)
    setEditor({ mode: "edit", item })
  }, [])

  /** Tutup editor — membatalkan create membersihkan key tertunda (D-09). */
  const closeEditor = useCallback(() => {
    if (saveBusy.current || uploadBusy.current) return
    if (editor?.mode === "create" && !createAttempt.current) void cleanupPendingShowcaseKeys(pendingKeys.current)
    pendingKeys.current = []
    setEditor(null)
    createAttempt.current = null
    setUncertainCreate(false)
    setPreviews([])
    setFailedAssets([])
    setDiscardOpen(false)
    const action = pendingNavigation.current
    pendingNavigation.current = null
    if (action) navigation.dispatch(action)
  }, [editor, navigation])
  const requestCloseEditor = useCallback(() => {
    if (saveBusy.current || uploadBusy.current) return
    if (editor?.mode === "create" || JSON.stringify(form) !== JSON.stringify(initialForm.current)) setDiscardOpen(true)
    else closeEditor()
  }, [editor, form, closeEditor])

  const dirtyEditor = editor != null && (editor.mode === "create" || JSON.stringify(form) !== JSON.stringify(initialForm.current))
  usePreventRemove(dirtyEditor, ({ data }) => {
    if (saveBusy.current || uploadBusy.current) return
    pendingNavigation.current = data.action
    setDiscardOpen(true)
  })
  useEffect(() => {
    if (Platform.OS !== "web" || !dirtyEditor) return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = "" }
    globalThis.addEventListener?.("beforeunload", warn)
    return () => globalThis.removeEventListener?.("beforeunload", warn)
  }, [dirtyEditor])
  const cancelDiscard = () => { pendingNavigation.current = null; setDiscardOpen(false) }

  const handleSave = useCallback(async () => {
    if (!editor || saveBusy.current || uploadBusy.current || failedAssets.length > 0 || (editor.mode === "create" && editor.fileKeys.length === 0)) return
    const title = form.title.trim()
    if (!title) {
      setFormError("Judul wajib diisi.")
      return
    }
    if (form.priceMin != null && form.priceMax != null && form.priceMax < form.priceMin) {
      setFormError("Harga maksimum harus ≥ harga minimum.")
      return
    }
    if (editor.mode === "edit" && ((editor.item.priceMin != null && form.priceMin == null) || (editor.item.priceMax != null && form.priceMax == null))) {
      setFormError(translate("Harga yang sudah terisi belum dapat dikosongkan. Masukkan nominal baru, termasuk 0 untuk gratis."))
      return
    }
    saveBusy.current = true
    setSaving(true)
    const payload = { title, ...formToPayload(form) }
    try {
      if (editor.mode === "create") {
        createAttempt.current ??= { key: createIdempotencyKey(), dto: {
          ...payload, imageFileKeys: [...editor.fileKeys], sortOrder: nextSortOrder(items),
        } }
        await api.users.createShowcase(createAttempt.current.dto, createAttempt.current.key)
        createAttempt.current = null
        pendingKeys.current = []
        if (!mounted.current || revision !== getSessionRevision()) return
        setUncertainCreate(false)
        toast.show({ title: "Karya ditambahkan", tone: "success", duration: 3000 })
      } else {
        await api.users.updateShowcase(editor.item.id, payload)
        if (!mounted.current || revision !== getSessionRevision()) return
        toast.show({ title: "Detail diperbarui", tone: "success", duration: 3000 })
      }
      setEditor(null)
      touchFeed()
      await query.refresh()
    } catch (err) {
      if (!mounted.current || revision !== getSessionRevision()) return
      if (editor.mode === "create") {
        // Only a definite rejected request is safe to edit/clean up. Transport timeouts may have committed.
        const rejected = isApiError(err) && [400, 403, 404, 413, 422].includes(err.status ?? 0)
        if (rejected) createAttempt.current = null
        setUncertainCreate(!rejected)
      }
      toast.show({ title: "Gagal menyimpan", description: userMessage(err), tone: "danger" })
    } finally {
      saveBusy.current = false
      if (mounted.current) setSaving(false)
    }
  }, [editor, form, items, toast, query, touchFeed, failedAssets.length, revision])

  const handleToggleActive = useCallback(
    async (item: ShowcaseItem) => {
      if (toggling) return
      const task = mutations.begin()
      if (!task) return
      setToggling(true)
      const next = !(item.isActive ?? true)
      try {
        await api.users.updateShowcase(item.id, { isActive: next })
        if (!task.valid()) return
        toast.show({
          title: next ? translate("Karya diaktifkan; pengaturan publik atau privat tetap berlaku") : translate("Karya dinonaktifkan"),
          tone: "success",
          duration: 2500,
        })
        setMenuItem(null)
        touchFeed()
        await query.refresh()
      } catch (err) {
      if (!task.valid()) return
        toast.show({
          title: "Gagal mengubah visibilitas",
          description: userMessage(err),
          tone: "danger",
        })
      } finally {
        task.finish()
        if (task.valid()) setToggling(false)
      }
    },
    [toggling, toast, query, touchFeed, mutations],
  )

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return
    const task = mutations.begin()
    if (!task) return
    setDeleting(true)
    try {
      await api.users.deleteShowcase(deleteTarget.id)
      if (!task.valid()) return
      toast.show({ title: "Karya dihapus", tone: "success", duration: 3000 })
      setDeleteTarget(null)
      touchFeed()
      await query.refresh()
    } catch (err) {
      if (!task.valid()) return
      toast.show({ title: "Gagal menghapus", description: userMessage(err), tone: "danger" })
    } finally {
      task.finish()
      if (task.valid()) setDeleting(false)
    }
  }, [deleteTarget, toast, query, touchFeed, mutations])

  /**
   * Lampirkan foto tambahan — MULTI-PICK (D-11): pilih beberapa sekaligus,
   * unggah satu-satu, lalu SATU attach untuk semua key yang berhasil.
   * Key yang terunggah tapi gagal dilampirkan dibersihkan (D-09) dan toast
   * menyebut alasannya spesifik (bukan "fileKey boolean" generik).
   */
  const handleAttachImage = useCallback(async (item: ShowcaseItem) => {
    if (uploadBusy.current || committingOrder || deletingImage) return
    const slots = SHOWCASE_MAX_IMAGES - (item.images?.length ?? 0)
    if (slots <= 0) return
    const task = mutations.begin()
    if (!task) return
    uploadBusy.current = true
    const controller = new AbortController()
    uploadAbort.current = controller
    const keys: string[] = []
    let submitted = false
    try {
      const picked = await pickImages({ selectionLimit: slots })
      if (picked.status === "denied") {
        toast.show({
          title: "Akses galeri ditolak",
          description: "Izinkan akses foto di pengaturan perangkat untuk memilih karya.",
          tone: "danger",
          // G-22 (audit 2026-09-23): tanpa jalan pintas, pengguna harus
          // mencari sendiri halaman izin di OS.
          action: { label: "Buka pengaturan", onPress: () => void Linking.openSettings() },
        })
        return
      }
      if (picked.status !== "picked" || controller.signal.aborted) return
      setAttaching(true)
      for (const asset of picked.assets) {
        const result = await uploadShowcasePhoto(asset, controller.signal)
        keys.push(result.fileKey)
      }
      if (controller.signal.aborted || !task.valid()) return
      submitted = true
      await api.users.attachShowcaseImages(item.id, keys)
      if (!task.valid()) return
      touchFeed()
      setOrderDraft(null)
      await query.refresh()
      toast.show({ title: "Foto dilampirkan", tone: "success" })
    } catch (error) {
      if (!controller.signal.aborted && task.valid()) toast.show({
        title: submitted ? "Status lampiran belum dapat dipastikan. Segarkan sebelum mencoba lagi." : "Gagal mengunggah foto",
        description: userMessage(error), tone: "danger",
      })
    } finally {
      // An ambiguous attach timeout may already have committed: never delete those objects.
      if (!submitted) void cleanupPendingShowcaseKeys(keys)
      task.finish()
      uploadBusy.current = false
      if (uploadAbort.current === controller) uploadAbort.current = null
      if (task.valid()) setAttaching(false)
    }
  }, [committingOrder, deletingImage, toast, query, touchFeed, mutations])

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
    return validImageOrder(orderDraft, server)
      ? orderDraft
      : server
  }, [imagesItem, orderDraft])

  const moveImage = useCallback(
    (imageId: string, dir: -1 | 1) => {
      if (committingOrder || attaching || deletingImage) return
      const current = effectiveImageIds
      const i = current.indexOf(imageId)
      const j = i + dir
      if (i < 0 || j < 0 || j >= current.length) return
      const next = [...current]
      ;[next[i], next[j]] = [next[j], next[i]]
      setOrderDraft(next)
    },
    [effectiveImageIds, committingOrder, attaching, deletingImage],
  )

  /** Commit draft urutan (dipanggil saat sheet ditutup). */
  const closeImagesSheet = useCallback(async () => {
    if (committingOrder || attaching || deletingImage || uploadBusy.current) return
    const itemId = imagesItemId
    const server = (imagesItem?.images ?? []).map((image) => image.id)
    if (!itemId) return
    if (!validImageOrder(orderDraft, server) || orderDraft?.join("|") === server.join("|")) {
      setOrderDraft(null)
      setImagesItemId(null)
      return
    }
    const task = mutations.begin()
    if (!task) return
    setCommittingOrder(true)
    try {
      await api.users.reorderShowcaseImages(itemId, orderDraft as string[])
      if (!task.valid()) return
      setOrderDraft(null)
      setImagesItemId(null)
      touchFeed()
      await query.refresh()
      toast.show({ title: "Urutan foto disimpan", tone: "success" })
    } catch (error) {
      if (!task.valid()) return
      toast.show({ title: "Gagal mengubah urutan foto", description: userMessage(error), tone: "danger" })
      // Keep the sheet and draft open; closing again retries the same order.
    } finally {
      task.finish()
      if (task.valid()) setCommittingOrder(false)
    }
  }, [imagesItemId, imagesItem, orderDraft, committingOrder, attaching, deletingImage, query, toast, touchFeed, mutations])

  const handleDeleteImage = useCallback(async () => {
    if (!imagesItem || !deleteImage || deletingImage || committingOrder || attaching) return
    const task = mutations.begin()
    if (!task) return
    setDeletingImage(true)
    try {
      await api.users.deleteShowcaseImage(deleteImage.id)
      if (!task.valid()) return
      toast.show({ title: "Foto dihapus", tone: "success", duration: 2500 })
      setDeleteImage(null)
      setOrderDraft(null)
      touchFeed()
      await query.refresh()
    } catch (err) {
      if (!task.valid()) return
      toast.show({ title: "Gagal menghapus foto", description: userMessage(err), tone: "danger" })
    } finally {
      task.finish()
      if (task.valid()) setDeletingImage(false)
    }
  }, [imagesItem, deleteImage, deletingImage, committingOrder, attaching, toast, query, touchFeed, mutations])

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
          label: (menuItem.isActive ?? true) ? "Nonaktifkan karya" : "Aktifkan karya",
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

  const hiddenCount = items.filter(showcaseIsHidden).length

  /** Baris foto mengikuti effectiveImageIds (draft D-10). */
  const imageRows = effectiveImageIds.flatMap((id) => {
    const img = (imagesItem?.images ?? []).find((entry) => entry.id === id)
    return img ? [img] : []
  })

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title="Kelola Etalase" />
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
                      translate("{x} karya", { x: items.length }),
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
                items={items.slice(0, renderLimit).map((it) => {
                  const isHidden = showcaseIsHidden(it)
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
            {items.length > renderLimit ? <Button variant="ghost" onPress={() => setRenderLimit((limit) => limit + 60)}>Tampilkan karya lainnya</Button> : null}
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
            {uploading ? <View className="gap-2"><Text accessibilityLiveRegion="polite">{progress}</Text><Button variant="ghost" onPress={() => uploadAbort.current?.abort()}>Batalkan unggahan</Button></View> : null}
          </View>
        )}
      </PullToRefresh>

      <Dialog visible={discardOpen} title="Buang perubahan?" description="Perubahan dan foto yang belum disimpan akan dibuang." confirmLabel="Buang" cancelLabel="Lanjut mengedit" destructive onConfirm={closeEditor} onCancel={cancelDiscard} onRequestClose={cancelDiscard} />
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
            disabled={committingOrder || deletingImage || (imagesItem?.images?.length ?? 0) >= SHOWCASE_MAX_IMAGES}
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
        onRequestClose={requestCloseEditor}
        title={editor?.mode === "create" ? "Detail karya baru" : "Ubah detail"}
        description="Judul, kategori, dan rentang harga membantu calon pembeli memahami penawaran Anda."
        footer={
          <View className="gap-2">
            <Button variant="primary" loading={saving} disabled={uploading || failedAssets.length > 0 || (editor?.mode === "create" && previews.length === 0)} onPress={() => void handleSave()} fullWidth>
              Simpan
            </Button>
            <Button variant="ghost" disabled={saving || uploading} onPress={requestCloseEditor} fullWidth>
              Batal
            </Button>
          </View>
        }
      >
        <View className="gap-4">
          {uncertainCreate ? (
            // G-15 (audit 2026-09-23): banner punya tombol segarkan — dulu
            // pengguna disuruh "segarkan daftar" tanpa tombolnya.
            <View className="gap-2 rounded-md border border-border p-3">
              <Text tone="danger">
                Status simpan belum pasti. Coba Simpan lagi untuk melanjutkan permintaan yang sama,
                atau segarkan daftar sebelum membuat karya baru.
              </Text>
              <Button variant="secondary" onPress={() => void query.reload()}>
                Segarkan daftar
              </Button>
            </View>
          ) : null}
          {previews.length > 0 ? <View className="gap-2">
            <Text>Pratinjau foto — foto pertama menjadi cover</Text>
            <View className="flex-row flex-wrap gap-2">
              {previews.map((entry, index) => <View key={entry.fileKey} className="gap-1">
                <Picture source={entry.asset.uri} alt={translate("Foto {x}", { x: index + 1 })} width={80} height={80} />
                <View className="flex-row">
                  <IconButton icon={CaretLeft} accessibilityLabel={translate("Geser foto {x} ke kiri", { x: index + 1 })} disabled={saving || uploading || uncertainCreate || index === 0} onPress={() => changePreview(index, -1)} />
                  <IconButton icon={CaretRight} accessibilityLabel={translate("Geser foto {x} ke kanan", { x: index + 1 })} disabled={saving || uploading || uncertainCreate || index === previews.length - 1} onPress={() => changePreview(index, 1)} />
                  <IconButton icon={Trash} accessibilityLabel={translate("Hapus foto {x}", { x: index + 1 })} disabled={saving || uploading || uncertainCreate} onPress={() => changePreview(index, 0)} />
                </View>
              </View>)}
            </View>
          </View> : null}
          {failedAssets.length > 0 ? <View className="gap-2">
            <Text tone="danger">Foto berikut gagal diunggah. Coba lagi atau keluarkan dari pilihan sebelum menyimpan.</Text>
            {failedAssets.map((asset, index) => <View key={`${asset.uri}-${index}`} className="gap-1">
              <Text>{asset.name}</Text>
              <Button variant="ghost" disabled={uploading} onPress={() => setFailedAssets((entries) => entries.filter((_, i) => i !== index))}>Keluarkan foto gagal</Button>
            </View>)}
            <Button loading={uploading} onPress={() => void retryFailedPhotos()}>Coba lagi foto gagal</Button>
            {uploading ? <Text accessibilityLiveRegion="polite">{progress}</Text> : null}
          </View> : null}
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
            disabled={saving || uploading || uncertainCreate}
          />
          <TextArea
            label="Deskripsi"
            value={form.description}
            onChangeText={(t) => setForm((f) => ({ ...f, description: t }))}
            maxLength={DESC_MAX}
            showCount
            rows={3}
            disabled={saving || uploading || uncertainCreate}
          />
          {/* D-02: kategori (kontrak menganggur sebelum audit) */}
          <Input
            label="Kategori (opsional)"
            value={form.category}
            onChangeText={(t) => setForm((f) => ({ ...f, category: t }))}
            placeholder="Jasa desain, kerajinan, digital…"
            autoCapitalize="sentences"
            maxLength={CATEGORY_MAX}
            disabled={saving || uploading || uncertainCreate}
          />
          <Input
            label="Harga minimum (opsional)"
            keyboardType="number-pad"
            value={form.priceMin == null ? "" : String(form.priceMin)}
            maxLength={15}
            onChangeText={(raw) => {
              if (!/^\d*$/.test(raw)) return
              const v = raw === "" ? null : Number(raw)
              setForm((f) => ({ ...f, priceMin: v }))
              setFormError(undefined)
            }}
            disabled={saving || uploading || uncertainCreate}
          />
          <Input
            label="Harga maksimum (opsional)"
            keyboardType="number-pad"
            value={form.priceMax == null ? "" : String(form.priceMax)}
            maxLength={15}
            onChangeText={(raw) => {
              if (!/^\d*$/.test(raw)) return
              const v = raw === "" ? null : Number(raw)
              setForm((f) => ({ ...f, priceMax: v }))
              setFormError(undefined)
            }}
            errorText={formError && form.title.trim() ? formError : undefined}
            disabled={saving || uploading || uncertainCreate}
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
              disabled={saving || uploading || uncertainCreate}
            />
          </View>
        </View>
      </BottomSheet>
    </Screen>
  )
}
