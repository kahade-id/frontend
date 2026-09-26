/**
 * Etalase management: upload-only drafts, explicit publication, recoverable
 * photo ordering. Legacy auto-create upload is intentionally disabled; see the
 * deep-audit remediation log.
 *
 * Revisi 2026-09-26 — MEMBUAT karya pindah ke halaman penuh `/showcase/create`
 * (permintaan produk): sheet form di sini terlalu sempit untuk pratinjau foto
 * yang bisa diurutkan + enam field, dan ikon pensil di header Etalase kini
 * berujung langsung ke halaman itu. Halaman ini tersisa untuk MENGUBAH karya
 * yang sudah ada: detail teks, foto, urutan cover, sembunyikan, hapus.
 */

import { Crossfade } from "@/components/ui/fade-in"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Linking, Platform, View } from "react-native"
import { useNavigation, usePreventRemove, type NavigationAction } from "@react-navigation/native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { CaretLeft, CaretRight, Eye, EyeSlash, Images, PencilSimple, Plus, Trash } from "phosphor-react-native"
import { router, useLocalSearchParams } from "expo-router"
import { translate } from "@/lib/i18n/translate"
import { useLanguage } from "@/lib/i18n"

import { api, userMessage } from "@/lib/api"
import { API_CONSTRAINTS } from "@/lib/api/constraints"
import type { ShowcaseImage, ShowcaseItem } from "@/lib/api/users"
import { validImageOrder, showcaseIsHidden } from "@/lib/showcase-state"
import { SHOWCASE_MAX_IMAGES } from "@/lib/showcase-limits"
import { useShowcaseOperation } from "@/lib/use-showcase-operation"
import { useSessionRevision } from "@/lib/guest-gate"
import { getSessionRevision } from "@/lib/api/session"
import { pickImages } from "@/lib/image-picker"
import { useApiQuery } from "@/lib/use-api-query"
import { ROUTES } from "@/lib/routes"
import { showcasePriceLabel } from "@/lib/showcase-labels"
import { showcaseCoverOf, untitledShowcaseTitle } from "@/lib/showcase-social"
import { markShowcaseFeedDirty } from "@/lib/showcase-social-prefs"
import { cleanupPendingShowcaseKeys, uploadShowcasePhoto } from "@/lib/showcase-upload"
import {
  getDeletedShowcaseItems,
  markShowcaseDeleted,
  restoreDaysLeft,
  unmarkShowcaseDeleted,
  type DeletedShowcaseItem,
} from "@/lib/showcase-deleted"
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
import { ShowcaseCategoryInput } from "@/components/ui/showcase-category-input"
import { ShowcaseGalleryGrid } from "@/components/ui/showcase-gallery-grid"
import { Switch } from "@/components/ui/switch"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"
import { useToast } from "@/components/ui/toast"

/** Batas form — D-08: TURUNAN dari kontrak backend, bukan angka lokal. */
const TITLE_MAX = API_CONSTRAINTS.CreateShowcaseItemDto.title.maxLength
const DESC_MAX = API_CONSTRAINTS.CreateShowcaseItemDto.description.maxLength
const CATEGORY_MAX = API_CONSTRAINTS.CreateShowcaseItemDto.category.maxLength
/**
 * M-03 (audit 2026-09-24): batas foto per item hidup di SATU tempat.
 * Sumber: kebijakan produk/UI (kontrak `AttachShowcaseImagesDto.fileKeys`
 * TIDAK mendeklarasikan maxItems — jadi angka ini tidak bisa diturunkan dari
 * `API_CONSTRAINTS`), dipakai untuk memilih, menghitung slot, dan menonaktifkan
 * tombol. Lihat `lib/showcase-limits.ts`.
 */


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

type Editor = { mode: "edit"; item: ShowcaseItem } | null


/** Judul tampil item mentah — fallback netral bersama (J-04). */
function labelOf(it: ShowcaseItem): string {
  return it.title ?? it.caption ?? untitledShowcaseTitle()
}

/** Explicit zero is a valid price; null means no draft price. */
function formToPayload(form: FormState) {
  /*
   * Harga minimum TANPA maksimum = HARGA PASTI (2026-09-26): penjual yang
   * menetapkan satu harga hanya mengisi kolom pertama, dan menyimpannya apa
   * adanya membuat kartu etalase menampilkan "Mulai Rp 100.000" seolah itu
   * sekadar batas bawah. Lihat lib/showcase-labels.ts.
   */
  const priceMin = form.priceMin ?? undefined
  const priceMax = form.priceMax ?? (form.priceMin != null ? form.priceMin : undefined)
  return {
    description: form.description.trim(),
    priceMin,
    priceMax,
    category: form.category.trim().replace(/\s+/g, " "),
    visibility: form.isPublic ? ("PUBLIC" as const) : ("PRIVATE" as const),
  }
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
  // i18n: label mengikuti bahasa aktif.
  useLanguage()
  const insets = useSafeAreaInsets()
  const toast = useToast()
  const revision = useSessionRevision()
  const mutations = useShowcaseOperation("management")
  const navigation = useNavigation()
  const pendingNavigation = useRef<NavigationAction | null>(null)
  // S8 (audit 2026-09-26): deep link edit — `?edit=<id>` dari tombol "Ubah
  // karya" di detail langsung membuka editor item tersebut, bukan daftar.
  const { edit: editParam } = useLocalSearchParams<{ edit?: string }>()

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

  const [menuItem, setMenuItem] = useState<ShowcaseItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ShowcaseItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [toggling, setToggling] = useState(false)

  /** Daftar karya yang di-soft-delete (lokal, untuk dipulihkan dalam 30 hari). */
  const [deletedItems, setDeletedItems] = useState<DeletedShowcaseItem[]>([])
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const refreshDeleted = useCallback(async () => {
    setDeletedItems(await getDeletedShowcaseItems())
  }, [])
  useEffect(() => {
    void refreshDeleted()
  }, [refreshDeleted])

  const [editor, setEditor] = useState<Editor>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | undefined>()
  const [saving, setSaving] = useState(false)
  const uploadAbort = useRef<AbortController | null>(null)
  const uploadBusy = useRef(false)
  const saveBusy = useRef(false)
  const mounted = useRef(true)
  const [discardOpen, setDiscardOpen] = useState(false)
  const initialForm = useRef(EMPTY_FORM)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      uploadAbort.current?.abort()
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

  // ── Ubah detail item ──────────────────────────────────────────────
  // ALUR BUAT KARYA BARU dipindah ke halaman penuh `/showcase/create`
  // (2026-09-26): form + pratinjau foto yang bisa diurutkan terlalu tinggi
  // untuk BottomSheet, dan ikon pensil di header Etalase kini berujung di
  // sana. Halaman ini hanya mengubah item yang sudah ada.
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
    setFormError(undefined)
    setEditor({ mode: "edit", item })
  }, [])

  /** Tutup editor (ubah detail). */
  const closeEditor = useCallback(() => {
    if (saveBusy.current || uploadBusy.current) return
    setEditor(null)
    setDiscardOpen(false)
    const action = pendingNavigation.current
    pendingNavigation.current = null
    if (action) navigation.dispatch(action)
  }, [editor, navigation])
  const requestCloseEditor = useCallback(() => {
    if (saveBusy.current || uploadBusy.current) return
    if (JSON.stringify(form) !== JSON.stringify(initialForm.current)) setDiscardOpen(true)
    else closeEditor()
  }, [editor, form, closeEditor])

  const dirtyEditor = editor != null && JSON.stringify(form) !== JSON.stringify(initialForm.current)
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

  // S8: buka editor otomatis bila datang via `?edit=<id>` (dari detail).
  // Hanya sekali per nilai param; abaikan bila item tidak ada di daftar.
  const deepLinkedEdit = useRef<string | null>(null)
  useEffect(() => {
    if (!editParam || deepLinkedEdit.current === editParam || loading || items.length === 0) return
    const target = items.find((it) => it.id === editParam)
    if (target) {
      deepLinkedEdit.current = editParam
      openEdit(target)
    }
  }, [editParam, items, loading, openEdit])

  const handleSave = useCallback(async () => {
    if (!editor || saveBusy.current || uploadBusy.current) return
    const title = form.title.trim()
    if (!title) {
      setFormError(translate("Judul wajib diisi."))
      return
    }
    if (form.priceMin != null && form.priceMax != null && form.priceMax < form.priceMin) {
      setFormError(translate("Harga maksimum harus ≥ harga minimum."))
      return
    }
    // S5: tolak harga maksimum tanpa minimum — rentang tak bermakna.
    if (form.priceMin == null && form.priceMax != null) {
      setFormError(translate("Isi harga minimum dulu bila memakai harga maksimum."))
      return
    }
    if (editor.item.priceMin != null && form.priceMin == null) {
      setFormError(translate("Harga yang sudah terisi belum dapat dikosongkan. Masukkan nominal baru, termasuk 0 untuk gratis."))
      return
    }
    saveBusy.current = true
    setSaving(true)
    const payload = { title, ...formToPayload(form) }
    try {
      await api.users.updateShowcase(editor.item.id, payload)
      if (!mounted.current || revision !== getSessionRevision()) return
      toast.show({ title: translate("Detail diperbarui"), tone: "success", duration: 3000 })
      setEditor(null)
      touchFeed()
      await query.refresh()
    } catch (err) {
      if (!mounted.current || revision !== getSessionRevision()) return
      toast.show({ title: translate("Gagal menyimpan"), description: userMessage(err), tone: "danger" })
    } finally {
      saveBusy.current = false
      if (mounted.current) setSaving(false)
    }
  }, [editor, form, toast, query, touchFeed, revision])

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
          title: translate("Gagal mengubah visibilitas"),
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
    const target = deleteTarget
    try {
      await api.users.deleteShowcase(target.id)
      if (!task.valid()) return
      // Soft-delete: catat lokal agar bisa dipulihkan dalam 30 hari.
      await markShowcaseDeleted({
        id: target.id,
        title: target.title?.trim() || untitledShowcaseTitle(),
        deletedAt: new Date().toISOString(),
        coverUrl: showcaseCoverOf(target) ?? undefined,
      })
      toast.show({ title: translate("Karya dihapus. Dapat dipulihkan dalam 30 hari."), tone: "success", duration: 3000 })
      setDeleteTarget(null)
      touchFeed()
      await query.refresh()
      await refreshDeleted()
    } catch (err) {
      if (!task.valid()) return
      toast.show({ title: translate("Gagal menghapus"), description: userMessage(err), tone: "danger" })
    } finally {
      task.finish()
      if (task.valid()) setDeleting(false)
    }
  }, [deleteTarget, toast, query, touchFeed, mutations, refreshDeleted])

  /** Pulihkan karya yang di-soft-delete. */
  const handleRestore = useCallback(
    async (item: DeletedShowcaseItem) => {
      if (restoringId) return
      setRestoringId(item.id)
      try {
        await api.users.restoreShowcaseItem(item.id)
        await unmarkShowcaseDeleted(item.id)
        toast.show({ title: translate("Karya dipulihkan"), tone: "success", duration: 2500 })
        touchFeed()
        await query.refresh()
        await refreshDeleted()
      } catch (err) {
        toast.show({ title: translate("Gagal memulihkan"), description: userMessage(err), tone: "danger" })
      } finally {
        setRestoringId(null)
      }
    },
    [restoringId, toast, query, touchFeed, refreshDeleted],
  )

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
          title: translate("Akses galeri ditolak"),
          description: translate("Izinkan akses foto di pengaturan perangkat untuk memilih karya."),
          tone: "danger",
          // G-22 (audit 2026-09-23): tanpa jalan pintas, pengguna harus
          // mencari sendiri halaman izin di OS.
          action: { label: translate("Buka pengaturan"), onPress: () => void Linking.openSettings() },
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
      toast.show({ title: translate("Foto dilampirkan"), tone: "success" })
    } catch (error) {
      if (!controller.signal.aborted && task.valid()) toast.show({
        title: submitted ? translate("Status lampiran belum dapat dipastikan. Segarkan sebelum mencoba lagi.") : translate("Gagal mengunggah foto"),
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
      toast.show({ title: translate("Urutan foto disimpan"), tone: "success" })
    } catch (error) {
      if (!task.valid()) return
      toast.show({ title: translate("Gagal mengubah urutan foto"), description: userMessage(error), tone: "danger" })
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
      toast.show({ title: translate("Foto dihapus"), tone: "success", duration: 2500 })
      setDeleteImage(null)
      setOrderDraft(null)
      touchFeed()
      await query.refresh()
    } catch (err) {
      if (!task.valid()) return
      toast.show({ title: translate("Gagal menghapus foto"), description: userMessage(err), tone: "danger" })
    } finally {
      task.finish()
      if (task.valid()) setDeletingImage(false)
    }
  }, [imagesItem, deleteImage, deletingImage, committingOrder, attaching, toast, query, touchFeed, mutations])

  const menuActions: ActionSheetItem[] = menuItem
    ? [
        {
          key: "view",
          label: translate("Lihat detail"),
          description: translate("Halaman sosial: suka, komentar, bagikan"),
          icon: Eye,
          onPress: () => {
            const it = menuItem
            setMenuItem(null)
            router.push(ROUTES.showcaseDetail(it.id))
          },
        },
        {
          key: "edit",
          label: translate("Ubah detail"),
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
          label: translate("Kelola foto"),
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
          label: (menuItem.isActive ?? true) ? translate("Nonaktifkan karya") : translate("Aktifkan karya"),
          icon: (menuItem.isActive ?? true) ? EyeSlash : Eye,
          disabled: toggling,
          onPress: () => void handleToggleActive(menuItem),
        },
        {
          key: "delete",
          label: translate("Hapus"),
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
                    // M-05 (audit 2026-09-24): kuota foto dulu hanya terlihat
                    // setelah membuka editor galeri; sekarang tampil di sel.
                    meta: translate("{x}/{y} foto", {
                      x: it.images?.length ?? 0,
                      y: SHOWCASE_MAX_IMAGES,
                    }),
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
            {items.length > renderLimit ? <Button variant="ghost" onPress={() => setRenderLimit((limit) => limit + 60)}>{translate("Tampilkan karya lainnya")}</Button> : null}
            <Text variant="caption" tone="secondary">
              Ketuk karya untuk mengubah detail, menyembunyikan, atau menghapus.
            </Text>

            {/* Soft-delete: karya yang dihapus bisa dipulihkan dalam 30 hari. */}
            {deletedItems.length > 0 ? (
              <View className="gap-2">
                <SectionHeader
                  title="Baru dihapus"
                  subtitle="Dapat dipulihkan dalam 30 hari"
                />
                {deletedItems.map((item) => {
                  const daysLeft = restoreDaysLeft(item.deletedAt)
                  return (
                    <View
                      key={item.id}
                      className="flex-row items-center gap-3 rounded-2xl border border-line bg-surface p-3"
                    >
                      {item.coverUrl ? (
                        <Picture
                          source={item.coverUrl}
                          alt={item.title}
                          className="h-12 w-12 rounded-xl"
                        />
                      ) : null}
                      <View className="flex-1 gap-0.5">
                        <Text variant="body" numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text variant="caption" tone="secondary">
                          {daysLeft > 0
                            ? `Sisa ${daysLeft} hari untuk memulihkan`
                            : translate("Segera dihapus permanen")}
                        </Text>
                      </View>
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={restoringId === item.id}
                        disabled={restoringId !== null}
                        onPress={() => void handleRestore(item)}
                      >
                        Pulihkan
                      </Button>
                    </View>
                  )
                })}
              </View>
            ) : null}
            {/*
              Buat karya = HALAMAN PENUH (/showcase/create, 2026-09-26):
              form + pratinjau yang bisa diurutkan terlalu tinggi untuk sheet.
            */}
            <Button
              leftIcon={Plus}
              variant="secondary"
              onPress={() => router.push(ROUTES.showcaseCreate)}
            >
              Buat karya baru
            </Button>
          </View>
        )}
      </PullToRefresh>

      <Dialog visible={discardOpen} title={translate("Buang perubahan?")} description={translate("Perubahan dan foto yang belum disimpan akan dibuang.")} confirmLabel={translate("Buang")} cancelLabel={translate("Lanjut mengedit")} destructive onConfirm={closeEditor} onCancel={cancelDiscard} onRequestClose={cancelDiscard} />
      <ActionSheet
        visible={!!menuItem}
        onRequestClose={() => setMenuItem(null)}
        title={menuItem ? labelOf(menuItem) : undefined}
        description={menuItem?.isActive === false ? translate("Disembunyikan dari profil publik") : undefined}
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
                {i === 0 ? <Text variant="caption" tone="secondary">{translate("Cover karya")}</Text> : null}
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
        title={translate("Hapus foto ini?")}
        description={
          deleteImage && imagesItem?.images?.[0]?.id === deleteImage.id
            ? translate("Foto cover akan digantikan foto berikutnya.")
            : translate("Foto akan dihapus permanen dari karya ini.")
        }
        visible={!!deleteImage}
        destructive
        loading={deletingImage}
        confirmLabel={translate("Hapus")}
        cancelLabel={translate("Batal")}
        onConfirm={() => void handleDeleteImage()}
        onCancel={() => setDeleteImage(null)}
        onRequestClose={() => setDeleteImage(null)}
      />

      <Dialog
        title={translate("Hapus karya ini?")}
        description={translate("Karya akan dihapus dan dapat dipulihkan dalam 30 hari.")}
        visible={!!deleteTarget}
        destructive
        loading={deleting}
        confirmLabel={translate("Hapus")}
        cancelLabel={translate("Batal")}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
        onRequestClose={() => setDeleteTarget(null)}
      />

      <BottomSheet
        avoidKeyboard
        visible={!!editor}
        onRequestClose={requestCloseEditor}
        title="Ubah detail"
        description="Judul, kategori, dan rentang harga membantu calon pembeli memahami penawaran Anda."
        footer={
          <View className="gap-2">
            <Button variant="primary" loading={saving} onPress={() => void handleSave()} fullWidth>
              Simpan
            </Button>
            <Button variant="ghost" disabled={saving} onPress={requestCloseEditor} fullWidth>
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
          {/* D-02: kategori (kontrak menganggur sebelum audit) — S4: saran populer */}
          <ShowcaseCategoryInput
            label={translate("Kategori (opsional)")}
            value={form.category}
            onChangeText={(t) => setForm((f) => ({ ...f, category: t }))}
            placeholder={translate("Jasa desain, kerajinan, digital…")}
            autoCapitalize="sentences"
            maxLength={CATEGORY_MAX}
            disabled={saving}
          />
          <Input
            label="Harga minimum (opsional)"
            keyboardType="number-pad"
            value={form.priceMin == null ? "" : String(form.priceMin)}
            maxLength={15}
            onChangeText={(raw) => {
              // S4: terima paste "1.000.000" — buang pemisah ribuan.
              const digits = raw.replace(/[.\s,]/g, "")
              if (!/^\d*$/.test(digits)) return
              const v = digits === "" ? null : Number(digits)
              setForm((f) => ({ ...f, priceMin: v }))
              setFormError(undefined)
            }}
            helperText={
              form.priceMin === 0
                ? translate("Harga {x} ditampilkan sebagai Gratis.", { x: 0 })
                : undefined
            }
            disabled={saving}
          />
          <Input
            label="Harga maksimum (opsional)"
            keyboardType="number-pad"
            value={form.priceMax == null ? "" : String(form.priceMax)}
            maxLength={15}
            onChangeText={(raw) => {
              // S4: terima paste "1.000.000" — buang pemisah ribuan.
              const digits = raw.replace(/[.\s,]/g, "")
              if (!/^\d*$/.test(digits)) return
              const v = digits === "" ? null : Number(digits)
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
                  ? translate("Karya terlihat di feed & profil publik Anda.")
                  : translate("Karya disimpan sebagai draf privat (tidak terlihat pengunjung).")}
              </Text>
            </View>
            <Switch
              value={form.isPublic}
              onChange={(v) => setForm((f) => ({ ...f, isPublic: v }))}
              accessibilityLabel={translate("Tampilkan secara publik")}
              disabled={saving}
            />
          </View>
        </View>
      </BottomSheet>
    </Screen>
  )
}
