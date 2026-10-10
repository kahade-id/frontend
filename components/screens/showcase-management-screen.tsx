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
import { useNavigation, usePreventRemove, type NavigationAction } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { BookmarkSimple, CalendarBlank, CaretRight, DotsSixVertical, Eye, EyeSlash, Images, PencilSimple, Plus, Star, Ticket, Trash } from "phosphor-react-native"
import { router, useLocalSearchParams } from "expo-router"
import { translate } from "@/lib/i18n/translate"
import { useLanguage } from "@/lib/i18n"

import { api, isApiError, userMessage } from "@/lib/api"
import { API_CONSTRAINTS } from "@/lib/api/constraints"
import type { ShowcaseImage, ShowcaseItem } from "@/lib/api/users"
import { buildMediaReplacePayload } from "@/lib/showcase-media-replace"
import {
  buildCommercePatch,
  commerceFormFromFields,
  commerceFormFromShowcaseItem,
  getCommerceFieldsCache,
  setCommerceFieldsCache,
} from "@/lib/commerce-fields"
import { ServiceSlotManagerSheet } from "@/components/showcase/service-slot-manager"
import {
  CommerceProductFields,
  EMPTY_COMMERCE_FORM,
  type CommerceFormValues,
} from "@/components/ui/commerce-product-fields"
import { validImageOrder, showcaseIsHidden } from "@/lib/showcase-state"
import { moveMediaToFront, moveMediaItem } from "@/lib/showcase-media-order"
import { formatRupiahTyping, isPriceRangeValid, parseRupiahTyping } from "@/lib/rupiah-input"
import { getShowcasePhotoLimit } from "@/lib/showcase-limits"
import { useKahadePlus } from "@/lib/use-kahade-plus"
import { ShowcaseHtmlDescriptionEditor } from "@/components/ui/showcase-html-description-editor"
import { sanitizeShowcaseHtml } from "@/lib/showcase-html"
import { useShowcaseOperation } from "@/lib/use-showcase-operation"
import { useHasSession, useSessionRevision } from "@/lib/guest-gate"
import { getSessionRevision } from "@/lib/api/session"
import { pickImages, type PickedImage } from "@/lib/image-picker"
import { useApiQuery } from "@/lib/use-api-query"
import { ROUTES } from "@/lib/routes"
import { showcasePriceLabel, showcasePriceLabelOrFallback } from "@/lib/showcase-labels"
import { showcaseCoverOf, untitledShowcaseTitle } from "@/lib/showcase-social"
import { markShowcaseFeedDirty } from "@/lib/showcase-social-prefs"
import { uploadMessage } from "@/lib/upload-errors"
import { cleanupPendingShowcaseKeys, uploadShowcasePhoto } from "@/lib/showcase-upload"
import {
  getRecoverableShowcaseItems,
  markShowcaseDeleted,
  restoreDaysLeft,
  unmarkShowcaseDeleted,
  type RecoverableShowcaseItem,
} from "@/lib/showcase-deleted"
import { tokens } from "@/lib/tokens"

import { ActionSheet, type ActionSheetItem } from "@/components/ui/action-sheet"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { ValidationSummary } from "@/components/ui/validation-summary"
import { DragSortList } from "@/components/showcase-media-drag-sort"
import { Icon, type IconComponent } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { ShowcaseFeedItem } from "@/components/ui/showcase-feed-item"
import type { ShowcaseMedia, ShowcaseSocialItem } from "@/lib/api/showcase"
import { Button } from "@/components/ui/button"
import { Dialog } from "@/components/ui/modal"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Header } from "@/components/ui/header"
import { IconButton } from "@/components/ui/icon-button"
import { Input } from "@/components/ui/input"
import { Picture } from "@/components/ui/picture"
import { ProgressBar } from "@/components/ui/progress-bar"
import { PullToRefresh } from "@/components/ui/pull-to-refresh"
import { Screen } from "@/components/ui/screen"
import { SectionHeader, MenuGroupLabel } from "@/components/ui/section"
import { SavedCollection } from "@/components/ui/saved-collection"
import { SegmentedControl, type SegmentItem } from "@/components/ui/segmented-control"
import { ShowcaseCategoryInput } from "@/components/ui/showcase-category-input"
import { ShowcaseConditionInput } from "@/components/ui/showcase-condition-input"
import { ShowcaseGalleryGrid } from "@/components/ui/showcase-gallery-grid"
import { ShowcaseModerationNotice } from "@/components/ui/showcase-moderation-notice"
import { Switch } from "@/components/ui/switch"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"
import { resolveShowcaseModeration } from "@/lib/showcase-moderation"
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
  /**
   * Item 53 (FE-IMP-1): kondisi barang — "" = belum dipilih (tidak dikirim
   * ke backend; kontrak opsional).
   */
  condition: "" | "BARU" | "BEKAS"
}
const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  priceMin: null,
  priceMax: null,
  category: "",
  isPublic: true,
  condition: "",
}

type Editor = { mode: "edit"; item: ShowcaseItem } | null

/**
 * Poin 1 (2026-10-04): baris tautan seksi — entry point "Promo saya"
 * dipindah dari sheet "Toko Saya" yang dihapus. Poin 4 (2026-10-04):
 * seksi "Produk & Stok Saya" dihapus (katalog dihapus total).
 * Layar tujuannya TIDAK diubah; hanya titik masuknya.
 */
function CommerceLinkRow({
  icon,
  title,
  description,
  accessibilityLabel,
  onPress,
}: {
  icon: IconComponent
  title: string
  description: string
  accessibilityLabel: string
  onPress: () => void
}) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className="flex-row items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3"
    >
      <Icon icon={icon} size="md" tone="default" weight="bold" />
      <View className="flex-1 gap-0.5">
        <Text variant="body" weight={600}>
          {title}
        </Text>
        <Text variant="caption" tone="secondary" numberOfLines={2}>
          {description}
        </Text>
      </View>
      <Icon icon={CaretRight} size="md" tone="default" weight="bold" />
    </PressableScale>
  )
}


/**
 * CR-01: tipe produk yang DIKETAHUI — dari respons server bila ada, lalu
 * cache sesi; `undefined` = tidak diketahui (jangan menebak).
 */
function knownProductType(it: ShowcaseItem): ShowcaseItem["productType"] | undefined {
  const fromServer = commerceFormFromShowcaseItem(it)
  if (fromServer.known) return fromServer.values.productType
  return getCommerceFieldsCache(it.id)?.productType
}

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
    // Item 53: hanya kirim bila dipilih — backend opsional & case-insensitive.
    ...(form.condition === "BARU" || form.condition === "BEKAS"
      ? { condition: form.condition }
      : null),
  }
}

/** Kategori/visibilitas/kondisi dari respons mentah (ShowcaseItem belum mengetiknya). */
function rawMeta(it: ShowcaseItem): { category: string; isPublic: boolean; condition: "" | "BARU" | "BEKAS" } {
  const raw = it as ShowcaseItem & {
    category?: string | null
    visibility?: string | null
    condition?: string | null
  }
  return {
    category: typeof raw.category === "string" ? raw.category : "",
    // SH-F-011 (audit 2026-09-27): fail-CLOSED — nilai asing (bukan "PUBLIC")
    // diperlakukan sebagai privat, bukan publik. Sebelumnya `!== "PRIVATE"`
    // membuat "FOLLOWERS"/"UNLISTED" masa depan tampil sebagai publik.
    isPublic: raw.visibility === "PUBLIC",
    // Item 53: fail-closed — hanya "BARU"/"BEKAS" (case-insensitive, backend
    // juga mentransformasi begitu) yang diisi ke form; sisanya "" (= tak dipilih).
    condition:
      typeof raw.condition === "string" && raw.condition.toUpperCase() === "BARU"
        ? "BARU"
        : typeof raw.condition === "string" && raw.condition.toUpperCase() === "BEKAS"
          ? "BEKAS"
          : "",
  }
}

export default function ShowcaseScreen() {
  const revision = useSessionRevision()
  return <ShowcaseManagement key={revision} />
}

/**
 * Sidebar 2026-10-05: Kelola Etalase punya dua tab — "Kelola" (daftar karya
 * sendiri) dan "Tersimpan" (pindahan /saved: profil + karya tersimpan).
 * Deep-link: ?tab=saved (redirect app/saved.tsx).
 */
type MgmtTab = "manage" | "saved"

const MGMT_TABS: readonly SegmentItem<MgmtTab>[] = [
  { value: "manage", label: "Kelola", icon: Images },
  { value: "saved", label: "Tersimpan", icon: BookmarkSimple },
]

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
  const { edit: editParam, tab: tabParam } = useLocalSearchParams<{ edit?: string; tab?: string }>()
  // Sidebar 2026-10-05: tab Kelola | Tersimpan — `?tab=saved` dari redirect
  // /saved mendarat di tab Tersimpan.
  const [tab, setTab] = useState<MgmtTab>(() => (tabParam === "saved" ? "saved" : "manage"))
  useEffect(() => {
    setTab(tabParam === "saved" ? "saved" : "manage")
  }, [tabParam])
  // Tombol Buat di header (syarat hapus pensil drawer): ke halaman penuh
  // /showcase/create — stabil untuk memo <Header> (pola FE-064).
  const headerRight = useMemo(
    () => (
      <IconButton
        icon={Plus}
        variant="ghost"
        accessibilityLabel={translate("Buat etalase baru")}
        onPress={() => router.push(ROUTES.showcaseCreate)}
      />
    ),
    [],
  )

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
    // PERF-FIX (network P0): dulu `useCache: false` + refresh tiap fokus =
    // seluruh katalog diunduh ulang setiap kembali ke layar. Kini cache 60 dtk
    // (lihat QUERY_CACHE_TTL_RULES) + refresh saat fokus hanya bila data
    // lebih tua dari 60 dtk. Mutasi di layar ini memanggil query.refresh()
    // eksplisit; create/update dari layar lain menginvalidasi prefix
    // "my-showcase" (lihat app/showcase/create.tsx).
    { refreshOnFocus: true, refreshOnFocusStaleMs: 60_000 },
  )
  const items = query.data ?? []
  const [renderLimit, setRenderLimit] = useState(60)
  const { loading, error, refreshing } = query

  const [menuItem, setMenuItem] = useState<ShowcaseItem | null>(null)
  // Batch 43 (item 12): sheet kelola slot jasa per produk.
  const [slotManagerItem, setSlotManagerItem] = useState<ShowcaseItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ShowcaseItem | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [toggling, setToggling] = useState(false)

  /**
   * Benefit 7 Kahade+ ("custom etalase"): anggota aktif mendapat editor
   * deskripsi HTML + limit 18 foto (bukan 8). Status dibaca dari
   * `useKahadePlus()` — satu-satunya sumber status langganan di UI.
   */
  const { isActive: isPlusActive } = useKahadePlus()
  const photoLimit = getShowcasePhotoLimit(isPlusActive)

  /** Daftar karya yang di-soft-delete (server + lokal, untuk dipulihkan dalam 30 hari). */
  const hasSession = useHasSession()
  const [deletedItems, setDeletedItems] = useState<RecoverableShowcaseItem[]>([])
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const refreshDeleted = useCallback(async () => {
    // SH-F-003: daftar pulihkan dari server (SS-012) digabung catatan lokal.
    setDeletedItems(await getRecoverableShowcaseItems(hasSession))
  }, [hasSession])
  useEffect(() => {
    void refreshDeleted()
  }, [refreshDeleted])

  const [editor, setEditor] = useState<Editor>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  /** C11 (batch 139): pratinjau kartu feed dari draft editor. */
  const [editorPreviewVisible, setEditorPreviewVisible] = useState(false)
  /**
   * SH-03 (audit 2026-10-09): satu state `formError` tunggal dulu menampilkan
   * SEMUA pesan di input "Harga maksimum" (termasuk error milik field
   * komersial & harga minimum). Sekarang tiap pesan menempel di fieldnya:
   * judul → input Judul; min/maks → input harga; komersial → ValidationSummary
   * (field komersial punya mekanisme error sendiri di CommerceProductFields).
   */
  const [titleError, setTitleError] = useState<string | undefined>()
  const [priceMinError, setPriceMinError] = useState<string | undefined>()
  const [priceMaxError, setPriceMaxError] = useState<string | undefined>()
  const [summaryError, setSummaryError] = useState<string | undefined>()
  const clearFormErrors = useCallback(() => {
    setTitleError(undefined)
    setPriceMinError(undefined)
    setPriceMaxError(undefined)
    setSummaryError(undefined)
  }, [])
  /**
   * C10 (batch 139): relasi harga min–maks divalidasi LANGSUNG saat mengetik
   * (computed, bukan hanya saat simpan).
   */
  const priceRangeError = !isPriceRangeValid(form.priceMin, form.priceMax)
    ? translate("Harga minimum tidak boleh lebih besar dari harga maksimum.")
    : undefined
  // Batch 43 (commerce): field commerce editor — prefill dari cache sesi
  // (backend belum mengeksposnya lewat GET showcase mana pun).
  const [commerce, setCommerce] = useState<CommerceFormValues>(EMPTY_COMMERCE_FORM)
  const initialCommerce = useRef<CommerceFormValues>(EMPTY_COMMERCE_FORM)
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
  // Audit 2026-10-09 E1/D1: foto yang gagal di lampir di-retry PER FILE
  // (dulu: satu gagal = seluruh batch dibersihkan, user ulang dari nol),
  // dan unggahan berjalan bisa dibatalkan + progres byte-nya jujur.
  const [failedAttach, setFailedAttach] = useState<{ asset: PickedImage; message: string }[]>([])
  const [attachProgress, setAttachProgress] = useState(0)

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
    clearFormErrors()
    // CR-01 (audit etalase 2026-10-10): prefill commerce dari respons server
    // (GET /me/showcase menyerialkan field commerce pemilik), lalu cache sesi
    // (hasil PATCH), terakhir default kosong. Simpan HANYA mengirim delta
    // (buildCommercePatch) — default kosong tidak pernah menimpa server.
    const fromServer = commerceFormFromShowcaseItem(item)
    const cached = fromServer.known ? null : getCommerceFieldsCache(item.id)
    const nextCommerce: CommerceFormValues = fromServer.known
      ? fromServer.values
      : cached
        ? commerceFormFromFields(cached)
        : EMPTY_COMMERCE_FORM
    initialCommerce.current = nextCommerce
    setCommerce(nextCommerce)
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
  // TIM 8 (perf): satu flag dirty di-memo dipakai bersama — sebelumnya
  // 4× JSON.stringify per render (2 di requestCloseEditor + 2 di dirtyEditor).
  const dirtyEditor = useMemo(
    () =>
      editor != null &&
      (JSON.stringify(form) !== JSON.stringify(initialForm.current) ||
        JSON.stringify(commerce) !== JSON.stringify(initialCommerce.current)),
    [editor, form, commerce],
  )
  const requestCloseEditor = useCallback(() => {
    // B2-SC-03: beri feedback saat X ditekan ketika upload/save busy.
    if (saveBusy.current || uploadBusy.current) {
      toast.show({ title: translate("Tunggu unggahan selesai…"), tone: "info" })
      return
    }
    if (dirtyEditor) setDiscardOpen(true)
    else closeEditor()
  }, [dirtyEditor, closeEditor, toast.show])

  usePreventRemove(dirtyEditor, ({ data }) => {
    // B2-SC-03: hardware back juga diberi feedback saat busy.
    if (saveBusy.current || uploadBusy.current) {
      toast.show({ title: translate("Tunggu unggahan selesai…"), tone: "info" })
      return
    }
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
      // SH-03: error menempel di fieldnya (bukan di input harga).
      setTitleError(translate("Judul wajib diisi."))
      return
    }
    if (form.priceMin != null && form.priceMax != null && form.priceMax < form.priceMin) {
      // (priceRangeError biasanya sudah menampilkan pesan live di input maks;
      // ini cadangan bila kondisi muncul tanpa perubahan ketikan.)
      setPriceMaxError(translate("Harga maksimum harus ≥ harga minimum."))
      return
    }
    // S5: tolak harga maksimum tanpa minimum — rentang tak bermakna.
    if (form.priceMin == null && form.priceMax != null) {
      setPriceMaxError(translate("Isi harga minimum dulu bila memakai harga maksimum."))
      return
    }
    if (editor.item.priceMin != null && form.priceMin == null) {
      setPriceMinError(translate("Harga yang sudah terisi belum dapat dikosongkan. Masukkan nominal baru, termasuk 0 untuk gratis."))
      return
    }
    // Batch 43: validasi field commerce (sama seperti layar buat).
    // SH-03: error komersial tidak pernah lagi mendarat di input harga —
    // diringkas di atas sheet (field komersial punya error sendiri).
    if (commerce.productType === "JASA" && commerce.serviceDeadlineDays == null) {
      setSummaryError(translate("Produk jasa wajib memiliki tenggat pengerjaan."))
      return
    }
    const salePrice = form.priceMin ?? form.priceMax
    if (commerce.originalPriceIdr != null && salePrice != null && commerce.originalPriceIdr <= salePrice) {
      setSummaryError(translate("Harga coret harus lebih besar dari harga jual."))
      return
    }
    saveBusy.current = true
    setSaving(true)
    const payload = { title, ...formToPayload(form) }
    // Benefit 7 Kahade+: deskripsi HTML disanitasi allowlist SEBELUM dikirim —
    // jangan pernah mengirim HTML mentah ketikan user ke backend.
    if (isPlusActive) payload.description = sanitizeShowcaseHtml(payload.description)
    // Batch 43 (item 15): replace media existing via PUT penuh memakai fileKey
    // owner-only. Return null bila tidak mungkin (video/spin360 tanpa
    // fileKey lengkap) → detail disimpan tanpa menyentuh media.
    const media = buildMediaReplacePayload(editor.item.images ?? [])
    const savePayload = media ? { ...payload, media } : payload
    try {
      await api.users.updateShowcase(editor.item.id, savePayload)
      if (!mounted.current || revision !== getSessionRevision()) return
      // Batch 43: PATCH commerce (best-effort; detail sudah tersimpan).
      // CR-01: hanya field yang DIUBAH pengguna — tanpa PATCH sama sekali bila
      // form commerce tidak disentuh (dulu seluruh form, termasuk default
      // LAINNYA + null, dikirim tiap simpan dan menghapus data di server).
      let commerceWarned = false
      const commercePatch = buildCommercePatch(initialCommerce.current, commerce)
      try {
        if (commercePatch) {
          const updated = await api.commerce.updateProductCommerce(editor.item.id, commercePatch)
          if (updated) setCommerceFieldsCache(editor.item.id, updated)
        }
      } catch {
        commerceWarned = true
        if (mounted.current && revision === getSessionRevision()) {
          toast.show({
            title: translate("Detail diperbarui"),
            description: translate("Field commerce gagal disimpan — coba lagi nanti."),
            tone: "warning",
            duration: 4000,
          })
        }
      }
      if (!commerceWarned) {
        toast.show({ title: translate("Detail diperbarui"), tone: "success", duration: 3000 })
      }
      setEditor(null)
      touchFeed()
      await query.refresh()
    } catch (err) {
      if (!mounted.current || revision !== getSessionRevision()) return
      // Kontrak server: fileKey existing bisa ditolak (UPLOAD_NOT_CONFIRMED,
      // konfirmasi one-time) — fallback simpan detail TANPA media supaya
      // edit detail tidak ikut gagal.
      if (media && isApiError(err) && err.backendCode === "UPLOAD_NOT_CONFIRMED") {
        try {
          await api.users.updateShowcase(editor.item.id, payload)
          if (mounted.current && revision === getSessionRevision()) {
            toast.show({
              title: translate("Detail diperbarui"),
              description: translate("Media tidak ikut tersimpan (server menolak fileKey lama) — ubah media lewat Kelola Foto."),
              tone: "warning",
              duration: 5000,
            })
            setEditor(null)
            touchFeed()
            await query.refresh()
          }
          return
        } catch (retryErr) {
          toast.show({ title: translate("Gagal menyimpan"), description: userMessage(retryErr), tone: "danger" })
          return
        }
      }
      toast.show({ title: translate("Gagal menyimpan"), description: userMessage(err), tone: "danger" })
    } finally {
      saveBusy.current = false
      if (mounted.current) setSaving(false)
    }
  }, [editor, form, toast, query, touchFeed, revision, isPlusActive, commerce])

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
          title: next ? translate("Etalase diaktifkan; pengaturan publik atau privat tetap berlaku") : translate("Etalase dinonaktifkan"),
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
      toast.show({ title: translate("Etalase dihapus. Dapat dipulihkan dalam 30 hari."), tone: "success", duration: 3000 })
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
    async (item: RecoverableShowcaseItem) => {
      if (restoringId) return
      setRestoringId(item.id)
      try {
        await api.users.restoreShowcaseItem(item.id)
        await unmarkShowcaseDeleted(item.id)
        toast.show({ title: translate("Etalase dipulihkan"), tone: "success", duration: 2500 })
        touchFeed()
        await query.refresh()
        await refreshDeleted()
      } catch (err) {
        // CR-06 (audit etalase 2026-10-10): 404 (sudah dipulihkan dari
        // perangkat lain / dihapus permanen) dan 410 (lewat 30 hari) berarti
        // entri lokal BASI — buang & segarkan daftar, bukan "Gagal memulihkan"
        // berulang setiap ketuk sampai 30 hari berlalu.
        if (isApiError(err) && (err.status === 404 || err.status === 410)) {
          await unmarkShowcaseDeleted(item.id)
          await refreshDeleted()
          touchFeed()
          void query.refresh()
          toast.show({
            title:
              err.status === 410
                ? translate("Masa pemulihan sudah lewat")
                : translate("Etalase ini sudah tidak ada di daftar hapus"),
            description:
              err.status === 410
                ? translate("Etalase dihapus permanen setelah 30 hari.")
                : translate("Mungkin sudah dipulihkan dari perangkat lain."),
            tone: "info",
            duration: 4000,
          })
          return
        }
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
    const slots = photoLimit - (item.images?.length ?? 0)
    if (slots <= 0) return
    const task = mutations.begin()
    if (!task) return
    uploadBusy.current = true
    const controller = new AbortController()
    uploadAbort.current = controller
    const keys: string[] = []
    // PERF-FIX (NP-001): kumpulkan thumbnail foto auto-generate server-side
    // untuk dikirim bersama attach — tanpa ini thumbnail yatim di storage.
    const thumbMap: Record<string, string> = {}
    let submitted = false
    try {
      const picked = await pickImages({ selectionLimit: slots })
      if (picked.status === "denied") {
        toast.show({
          title: translate("Akses galeri ditolak"),
          description: translate("Izinkan akses foto di pengaturan perangkat untuk memilih etalase."),
          tone: "danger",
          // G-22 (audit 2026-09-23): tanpa jalan pintas, pengguna harus
          // mencari sendiri halaman izin di OS.
          action: { label: translate("Buka pengaturan"), onPress: () => void Linking.openSettings() },
        })
        return
      }
      if (picked.status !== "picked" || controller.signal.aborted) return
      setAttaching(true)
      setAttachProgress(0)
      // Audit 2026-10-09 E1: kegagalan PER FILE tidak lagi menggagalkan
      // seluruh batch (dulu: 1 foto gagal = semua key yang sudah terunggah
      // dibersihkan dan user mengulang dari nol). Foto yang gagal masuk
      // daftar "Coba lagi foto gagal"; yang berhasil tetap dilampirkan.
      const failures: { asset: PickedImage; message: string }[] = []
      for (const [index, asset] of picked.assets.entries()) {
        if (controller.signal.aborted) break
        try {
          const result = await uploadShowcasePhoto(asset, {
            signal: controller.signal,
            // Audit 2026-10-09 C5: progres byte jujur per file (0–1).
            onProgress: (fraction) => setAttachProgress((index + fraction) / picked.assets.length),
          })
          keys.push(result.fileKey)
          if (result.thumbnailFileKey) thumbMap[result.fileKey] = result.thumbnailFileKey
        } catch (err) {
          if (controller.signal.aborted) break
          // Audit 2026-10-09 A1: copy spesifik per tipe kegagalan.
          failures.push({ asset, message: uploadMessage(err, { purpose: "SHOWCASE_IMAGE" }) })
        }
      }
      if (keys.length === 0) {
        // SEMUA foto gagal (atau user batal di foto pertama).
        if (!controller.signal.aborted && task.valid() && failures.length > 0) {
          setFailedAttach(failures)
          toast.show({
            title: translate("Gagal mengunggah foto"),
            description: failures[0].message,
            tone: "danger",
          })
        }
        return
      }
      if (controller.signal.aborted || !task.valid()) return
      submitted = true
      await api.users.attachShowcaseImages(item.id, keys, thumbMap)
      if (!task.valid()) return
      touchFeed()
      setOrderDraft(null)
      await query.refresh()
      if (failures.length > 0) {
        setFailedAttach(failures)
        toast.show({
          title: translate("{x} dari {y} foto gagal diunggah", {
            x: failures.length,
            y: picked.assets.length,
          }),
          description: failures[0].message,
          tone: "warning",
        })
      } else {
        setFailedAttach([])
        toast.show({ title: translate("Foto dilampirkan"), tone: "success" })
      }
    } catch (error) {
      // Hanya kegagalan di luar loop per-file yang sampai sini
      // (picker, attach) — bukan kegagalan upload per foto.
      if (!controller.signal.aborted && task.valid()) toast.show({
        title: submitted ? translate("Status lampiran belum dapat dipastikan. Segarkan sebelum mencoba lagi.") : translate("Gagal mengunggah foto"),
        description: userMessage(error), tone: "danger",
      })
    } finally {
      // An ambiguous attach timeout may already have committed: never delete those objects.
      // PERF-FIX (NP-001): bersihkan thumbnail foto yang ikut terunggah juga.
      if (!submitted) void cleanupPendingShowcaseKeys([...keys, ...Object.values(thumbMap)])
      task.finish()
      uploadBusy.current = false
      if (uploadAbort.current === controller) uploadAbort.current = null
      if (task.valid()) {
        setAttaching(false)
        setAttachProgress(0)
      }
    }
  }, [committingOrder, deletingImage, toast, query, touchFeed, mutations, photoLimit])

  /**
   * Audit 2026-10-09 E1: "Coba lagi" mengulang HANYA foto yang gagal —
   * key yang sudah terlampirkan tidak disentuh, tidak diunggah ulang.
   * `uploadAbort` mengizinkan tombol "Batalkan" menghentikan foto berikut.
   */
  const retryFailedAttach = useCallback(async () => {
    if (uploadBusy.current || committingOrder || deletingImage || failedAttach.length === 0) return
    const item = imagesItem
    if (!item) return
    const task = mutations.begin()
    if (!task) return
    uploadBusy.current = true
    setAttaching(true)
    setAttachProgress(0)
    const controller = new AbortController()
    uploadAbort.current = controller
    const keys: string[] = []
    const thumbMap: Record<string, string> = {}
    let submitted = false
    try {
      const remaining: { asset: PickedImage; message: string }[] = []
      for (const [index, failed] of failedAttach.entries()) {
        if (controller.signal.aborted) break
        try {
          const result = await uploadShowcasePhoto(failed.asset, {
            signal: controller.signal,
            onProgress: (fraction) => setAttachProgress((index + fraction) / failedAttach.length),
          })
          keys.push(result.fileKey)
          if (result.thumbnailFileKey) thumbMap[result.fileKey] = result.thumbnailFileKey
        } catch (err) {
          if (controller.signal.aborted) break
          remaining.push({ asset: failed.asset, message: uploadMessage(err, { purpose: "SHOWCASE_IMAGE" }) })
        }
      }
      if (keys.length > 0 && !controller.signal.aborted && task.valid()) {
        submitted = true
        await api.users.attachShowcaseImages(item.id, keys, thumbMap)
        if (task.valid()) {
          touchFeed()
          setOrderDraft(null)
          await query.refresh()
          toast.show({ title: translate("Foto dilampirkan"), tone: "success" })
        }
      }
      setFailedAttach(remaining)
      if (remaining.length > 0 && !controller.signal.aborted && task.valid()) {
        toast.show({
          title: translate("Masih ada foto yang gagal diunggah"),
          description: remaining[0].message,
          tone: "warning",
        })
      }
    } catch (error) {
      if (!controller.signal.aborted && task.valid()) toast.show({
        title: submitted ? translate("Status lampiran belum dapat dipastikan. Segarkan sebelum mencoba lagi.") : translate("Gagal mengunggah foto"),
        description: userMessage(error), tone: "danger",
      })
    } finally {
      if (!submitted) void cleanupPendingShowcaseKeys([...keys, ...Object.values(thumbMap)])
      task.finish()
      uploadBusy.current = false
      if (uploadAbort.current === controller) uploadAbort.current = null
      if (task.valid()) {
        setAttaching(false)
        setAttachProgress(0)
      }
    }
  }, [failedAttach, imagesItem, committingOrder, deletingImage, toast, query, touchFeed, mutations])

  // ── D-10: reorder foto — draft lokal, SATU commit saat sheet tutup ──
  const openImagesSheet = useCallback((item: ShowcaseItem) => {
    setOrderDraft(null)
    // Audit 2026-10-09 E1: daftar gagal adalah per-item — reset saat pindah item.
    setFailedAttach([])
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

  /**
   * C09 (batch 139): drag-reorder — pindahkan foto dari→ke dalam draft
   * urutan (commit saat sheet ditutup).
   */
  const reorderImages = useCallback(
    (from: number, to: number) => {
      if (committingOrder || attaching || deletingImage) return
      setOrderDraft(moveMediaItem(effectiveImageIds, from, to))
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
        // Batch 43 (item 12): kalender slot hanya untuk produk JASA. CR-01:
        // tipe produk dibaca dari respons GET owner, lalu cache sesi; bila
        // tidak diketahui, tampilkan dan biarkan server memvalidasi.
        ...(knownProductType(menuItem) !== undefined && knownProductType(menuItem) !== "JASA"
          ? []
          : [
              {
                key: "slots",
                label: translate("Kelola slot jasa"),
                description: translate("Kalender ketersediaan untuk booking"),
                icon: CalendarBlank,
                onPress: () => {
                  const it = menuItem
                  setMenuItem(null)
                  setSlotManagerItem(it)
                },
              } as ActionSheetItem,
            ]),
        {
          key: "toggle",
          label: (menuItem.isActive ?? true) ? translate("Nonaktifkan etalase") : translate("Aktifkan etalase"),
          icon: (menuItem.isActive ?? true) ? EyeSlash : Eye,
          disabled: toggling,
          onPress: () => void handleToggleActive(menuItem),
        },        {
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

  // TIM 8 (perf): full scan hanya saat `items` berubah — sebelumnya
  // dihitung tiap render.
  const hiddenCount = useMemo(() => items.filter(showcaseIsHidden).length, [items])

  /**
   * Baris foto mengikuti effectiveImageIds (draft D-10).
   * TIM 8 (perf): Map id→image menggantikan `.find` linear per id (O(n×m)
   * tiap render) + di-memo.
   */
  const imageRows = useMemo(() => {
    const byId = new Map((imagesItem?.images ?? []).map((entry) => [entry.id, entry]))
    return effectiveImageIds.flatMap((id) => {
      const img = byId.get(id)
      return img ? [img] : []
    })
  }, [imagesItem, effectiveImageIds])

  /**
   * TIM 8 (perf): transform API→view model grid di-memo — sebelumnya
   * `items.slice(0, renderLimit).map(...)` + 2 `translate()` per item di body
   * render; array+objek baru tiap render membatalkan memo ShowcaseGalleryGrid.
   */
  const galleryItems = useMemo(
    () =>
      items.slice(0, renderLimit).map((it) => {
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
            y: photoLimit,
          }),
        }
      }),
    [items, renderLimit, photoLimit],
  )

  /**
   * C11 (batch 139): rakit item pratinjau dari draft editor — media milik
   * item yang ada, judul/deskripsi/kategori/harga dari form. Kartu yang
   * dirender adalah `ShowcaseFeedItem` yang sama dengan feed (non-interaktif).
   */
  const editorPreviewItem: ShowcaseSocialItem | null = useMemo(() => {
    if (!editorPreviewVisible || !editor) return null
    const item = editor.item
    const images: ShowcaseMedia[] = (item.images ?? []).map((img, index) => ({
      id: img.id,
      kind: img.kind === "video" ? ("video" as const) : ("image" as const),
      imageUrl: img.imageUrl,
      thumbnailUrl: img.thumbnailUrl ?? img.imageUrl,
      sortOrder: index,
      width: img.width ?? undefined,
      height: img.height ?? undefined,
    }))
    const rawDescription = form.description.trim()
    // Plus: deskripsi HTML → teks polos untuk kartu (kartu feed hanya
    // menampilkan teks; HTML penuh dirender di detail).
    const description = rawDescription
      ? isPlusActive
        ? rawDescription.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || null
        : rawDescription
      : null
    return {
      id: item.id,
      title: form.title.trim() || translate("Tanpa judul"),
      description,
      category: form.category.trim() || null,
      images,
      priceMin: form.priceMin,
      priceMax: form.priceMax,
      likeCount: 0,
      commentCount: 0,
      viewCount: 0,
      saveCount: 0,
      isLiked: false,
      isSaved: false,
      isOwner: true,
      createdAt: item.createdAt,
      updatedAt: item.createdAt,
      author: {
        userId: "preview-local",
        username: translate("Anda"),
        fullName: null,
      },
    }
  }, [editorPreviewVisible, editor, form, isPlusActive])

  return (
    <Screen edges={["top"]} padded={false}>
      <Header title={translate("Kelola Etalase")} right={headerRight} />
      <View className="px-5 pb-1 pt-3">
        <SegmentedControl
          accessibilityLabel={translate("Bagian kelola etalase")}
          items={MGMT_TABS}
          value={tab}
          onChange={setTab}
        />
      </View>
      {tab === "saved" ? (
        <SavedCollection />
      ) : (
      <PullToRefresh
        onRefresh={() => {
          void query.refresh()
          void refreshDeleted()
        }}
        refreshing={refreshing}
        contentContainerClassName="px-5"
        scrollViewProps={{
          contentContainerStyle: { paddingBottom: insets.bottom + tokens.space[8] },
        }}
      >
        {error ? (
          <ErrorState title={translate("Gagal memuat")} description={error} onRetry={() => void query.reload()} />
        ) : (
          <View className="gap-4" style={{ paddingTop: tokens.space[3] }}>
            <SectionHeader
              title={translate("Etalase Anda")}
              subtitle={
                items.length
                  ? [
                      translate("{x} etalase", { x: items.length }),
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
                items={galleryItems}
                onPressItem={(_, index) => setMenuItem(items[index] ?? null)}
                loading={false}
                empty={
                  <EmptyState
                    icon={Images}
                    // T2-F09 (audit UI/UX 2026-09-28): ini daftar KARYA,
                    // bukan daftar foto — copy salah konteks diperbaiki.
                    title={translate("Belum ada etalase")}
                    description={translate("Buat etalase pertama Anda — produk, jasa, atau hasil kerja.")}
                  />
                }
              />
            </Crossfade>
            {items.length > renderLimit ? <Button variant="ghost" onPress={() => setRenderLimit((limit) => limit + 60)}>{translate("Tampilkan etalase lainnya")}</Button> : null}
            <Text variant="caption" tone="secondary">
              {translate("Ketuk etalase untuk mengubah detail, menyembunyikan, atau menghapus.")}
            </Text>

            {/* Soft-delete: karya yang dihapus bisa dipulihkan dalam 30 hari. */}
            {deletedItems.length > 0 ? (
              <View className="gap-2">
                <SectionHeader
                  title={translate("Baru dihapus")}
                  subtitle={translate("Dapat dipulihkan dalam 30 hari")}
                />
                {deletedItems.map((item) => {
                  // SH-F-003: daysRemaining server diutamakan (kanonis);
                  // entri lokal dihitung dari deletedAt.
                  const daysLeft =
                    item.daysRemaining ?? (item.deletedAt ? restoreDaysLeft(item.deletedAt) : 0)
                  return (
                    <View
                      key={item.id}
                      className="flex-row items-center gap-3 rounded-lg border border-border bg-surface p-3"
                    >
                      {item.coverUrl ? (
                        <Picture
                          source={item.coverUrl}
                          alt={item.title}
                          className="h-12 w-12 rounded-lg"
                        />
                      ) : null}
                      <View className="flex-1 gap-0.5">
                        <Text variant="body" numberOfLines={1}>
                          {item.title}
                        </Text>
                        <Text variant="caption" tone="secondary">
                          {daysLeft > 0
                            ? // SH-F-015: lewat translate (jangan template literal mentah).
                              translate("Sisa {x} hari untuk memulihkan", { x: daysLeft })
                            : translate("Segera dihapus permanen")}
                        </Text>
                      </View>
                      <Button
                        variant="secondary"
                        size="sm"
                        fullWidth={false}
                        loading={restoringId === item.id}
                        disabled={restoringId !== null}
                        onPress={() => void handleRestore(item)}
                      >
                        {translate("Pulihkan")}
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
              {translate("Buat etalase baru")}
            </Button>
            {/*
              Poin 1 (2026-10-04): redistribusi sheet "Toko Saya" yang
              dihapus — "Voucher Toko" pindah ke sini sebagai seksi
              "Promo saya". Poin 4 (2026-10-04): "Produk & Stok Saya"
              DIHAPUS — katalog dihapus total, entry point tidak lagi ada.
              Layar tujuan (/seller/vouchers) TIDAK diubah.
            */}
            <View className="gap-2">
              <MenuGroupLabel>{translate("Promo saya")}</MenuGroupLabel>
              <CommerceLinkRow
                icon={Ticket}
                title={translate("Promo saya")}
                description={translate("Voucher diskon untuk pembeli Anda.")}
                accessibilityLabel={translate("Buka promo saya")}
                onPress={() => router.push(ROUTES.sellerVouchers)}
              />
            </View>
          </View>
        )}
      </PullToRefresh>
      )}

      <Dialog visible={discardOpen} title={translate("Buang perubahan?")} description={translate("Perubahan dan foto yang belum disimpan akan dibuang.")} confirmLabel={translate("Buang")} cancelLabel={translate("Lanjut mengedit")} destructive onConfirm={closeEditor} onCancel={cancelDiscard} onRequestClose={cancelDiscard} />
      <ActionSheet
        visible={!!menuItem}
        onRequestClose={() => setMenuItem(null)}
        title={menuItem ? labelOf(menuItem) : undefined}
        description={menuItem?.isActive === false ? translate("Disembunyikan dari profil publik") : undefined}
        actions={menuActions}
      />

      {/* Batch 43 (item 12): kalender slot jasa per produk. */}
      {slotManagerItem ? (
        <ServiceSlotManagerSheet
          visible={slotManagerItem != null}
          onRequestClose={() => setSlotManagerItem(null)}
          showcaseId={slotManagerItem.id}
          productTitle={labelOf(slotManagerItem)}
        />
      ) : null}

      {/* ── Kelola foto item (multi-image; D-10 reorder lokal) ─────── */}
      <BottomSheet
        avoidKeyboard
        visible={imagesItem != null}
        onRequestClose={() => void closeImagesSheet()}
        title={imagesItem ? translate("Media: {x}", { x: labelOf(imagesItem) }) : translate("Media etalase")}
        description={translate("{x} dari {y} media. Item pertama menjadi cover etalase.", {
          x: imagesItem?.images?.length ?? 0,
          y: photoLimit,
        })}
        footer={
          <Button
            leftIcon={Plus}
            fullWidth
            variant="secondary"
            loading={attaching}
            disabled={committingOrder || deletingImage || (imagesItem?.images?.length ?? 0) >= photoLimit}
            onPress={() => imagesItem && void handleAttachImage(imagesItem)}
          >
            {translate("Tambah media")}
          </Button>
        }
      >
        <View className="gap-2">
          {/*
           * C09 (batch 139): drag-reorder — tahan baris lalu seret ke posisi
           * baru (commit saat sheet ditutup). Foto pertama = cover karya.
           */}
          <DragSortList
            items={imageRows}
            getId={(img) => img.id}
            columns={1}
            cellHeight={76}
            gap={8}
            disabled={committingOrder || attaching || deletingImage}
            onReorder={reorderImages}
            cellStyle={{ height: 76 }}
            cellClassName="relative flex-row items-center gap-2 rounded-md border border-border px-2"
            renderItem={(img, i, { dropTarget }) => (
              <>
                <View
                  accessible
                  accessibilityRole="button"
                  accessibilityLabel={translate("{x} {y} — tahan lalu seret untuk mengubah urutan", {
                    x: img.kind === "video" ? translate("Video") : translate("Foto"),
                    y: i + 1,
                  })}
                >
                  <Icon icon={DotsSixVertical} size="md" tone="default" />
                </View>
                {/*
                  T2-F05 (audit UI/UX 2026-09-28): entri video memakai
                  thumbnailUrl sebagai pratinjau — imageUrl-nya berkas video
                  (dulu URL video masuk ke image decoder → fallback rusak).
                */}
                <Picture
                  source={img.kind === "video" ? (img.thumbnailUrl ?? img.imageUrl) : img.imageUrl}
                  alt=""
                  width={56}
                  height={56}
                  radius="sm"
                />
                <View className="flex-1 gap-0.5">
                  <Text variant="body" weight={500} tone="primary">
                    {img.kind === "video"
                      ? translate("Video {x}", { x: i + 1 })
                      : translate("Foto {x}", { x: i + 1 })}
                  </Text>
                  {i === 0 ? <Text variant="caption" tone="secondary">{translate("Cover etalase")}</Text> : null}
                </View>
                {/* C09: pilih sampul eksplisit — foto pindah ke posisi pertama
                    (cover karya). Commit saat sheet ditutup. */}
                {i > 0 ? (
                  <IconButton
                    icon={Star}
                    size="sm"
                    variant="ghost"
                    accessibilityLabel={
                      img.kind === "video"
                        ? translate("Jadikan sampul: video {x}", { x: i + 1 })
                        : translate("Jadikan sampul: foto {x}", { x: i + 1 })
                    }
                    accessibilityHint={translate("Pindahkan media ini ke posisi pertama sebagai cover etalase")}
                    disabled={committingOrder || attaching || deletingImage}
                    onPress={() => {
                      if (committingOrder || attaching || deletingImage) return
                      setOrderDraft(moveMediaToFront(effectiveImageIds, i))
                    }}
                  />
                ) : null}
                <IconButton
                  icon={Trash}
                  size="sm"
                  variant="ghost"
                  accessibilityLabel={
                    img.kind === "video"
                      ? translate("Hapus video {x}", { x: i + 1 })
                      : translate("Hapus foto {x}", { x: i + 1 })
                  }
                  disabled={deletingImage}
                  onPress={() => setDeleteImage(img)}
                />
                {/* C09: penanda target drop — tanpa menggeser layout. */}
                {dropTarget ? (
                  <View className="pointer-events-none absolute inset-0 rounded-md border-2 border-accent" />
                ) : null}
              </>
            )}
          />
          {imageRows.length === 0 ? (
            <Text variant="caption" tone="secondary">
              {translate("Belum ada media — lampirkan yang pertama di bawah.")}
            </Text>
          ) : null}

          {/* Audit 2026-10-09 D1: progres byte jujur + batalkan unggahan. */}
          {attaching ? (
            <View className="gap-2">
              <ProgressBar
                value={Math.round(attachProgress * 100)}
                showValue
                accessibilityLabel={translate("Mengunggah foto")}
              />
              <Button variant="ghost" onPress={() => uploadAbort.current?.abort()}>
                {translate("Batalkan unggahan")}
              </Button>
            </View>
          ) : null}

          {/* Audit 2026-10-09 E1: retry PER FILE — key yang sudah
              terlampirkan tidak diulang; penyebab per foto ditampilkan. */}
          {failedAttach.length > 0 ? (
            <View className="gap-2">
              <Text tone="danger">
                {translate("Foto berikut gagal diunggah. Coba lagi atau abaikan.")}
              </Text>
              {failedAttach.map((failed, index) => (
                <View key={`${failed.asset.uri}-${index}`} className="gap-1">
                  <Text>{failed.asset.name}</Text>
                  <Text variant="caption" tone="danger">
                    {failed.message}
                  </Text>
                  <Button
                    variant="ghost"
                    disabled={attaching}
                    onPress={() => setFailedAttach((entries) => entries.filter((_, i) => i !== index))}
                  >
                    {translate("Abaikan foto ini")}
                  </Button>
                </View>
              ))}
              <Button
                loading={attaching}
                disabled={committingOrder || deletingImage}
                onPress={() => void retryFailedAttach()}
              >
                {translate("Coba lagi foto gagal")}
              </Button>
            </View>
          ) : null}
        </View>
      </BottomSheet>

      <Dialog
        title={
          deleteImage?.kind === "video"
            ? translate("Hapus video ini?")
            : translate("Hapus foto ini?")
        }
        description={
          deleteImage && imagesItem?.images?.[0]?.id === deleteImage.id
            ? translate("Cover etalase akan digantikan media berikutnya.")
            : translate("Media akan dihapus permanen dari etalase ini.")
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
        title={translate("Hapus etalase ini?")}
        description={translate("Etalase akan dihapus dan dapat dipulihkan dalam 30 hari.")}
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
        title={translate("Ubah detail")}
        description={translate("Judul, kategori, dan rentang harga membantu calon pembeli memahami penawaran Anda.")}
        footer={
          <View className="gap-2">
            {/* C11 (batch 139): pratinjau kartu feed dari draft sebelum simpan. */}
            <Button variant="secondary" disabled={saving} onPress={() => setEditorPreviewVisible(true)} fullWidth>
              {translate("Pratinjau")}
            </Button>
            <Button variant="primary" loading={saving} onPress={() => void handleSave()} fullWidth>
              {translate("Simpan")}
            </Button>
            <Button variant="ghost" disabled={saving} onPress={requestCloseEditor} fullWidth>
              {translate("Batal")}
            </Button>
          </View>
        }
      >
        <View className="gap-4">
          {/*
           * C12 (batch 139): status moderasi yang dapat ditindaklanjuti —
           * alasan aman + waktu + aksi. Backend belum punya endpoint
           * ajukan-ulang khusus (per 2026-09-28): "Ajukan ulang" menyimpan
           * perubahan editor ini — itulah jalur pengajuan ulang yang
           * tersedia. Graceful: tanpa field moderasi dari server, notice
           * me-render null.
           */}
          {editor ? (
            <ShowcaseModerationNotice
              info={resolveShowcaseModeration(editor.item)}
              onResubmit={() => void handleSave()}
            />
          ) : null}
          {/* SH-03: error yang bukan milik satu field tampilan (field
              komersial) — diringkas di atas form, pola C10 layar buat. */}
          {summaryError ? (
            <ValidationSummary tone="danger" errors={[summaryError]} />
          ) : null}
          <Input
            label={translate("Judul")}
            value={form.title}
            onChangeText={(t) => {
              setForm((f) => ({ ...f, title: t }))
              clearFormErrors()
            }}
            autoCapitalize="sentences"
            returnKeyType="next"
            maxLength={TITLE_MAX}
            errorText={titleError}
            required
            disabled={saving}
          />
          {/*
           * Benefit 7 Kahade+ ("custom etalase"): anggota aktif mendapat
           * editor deskripsi HTML (dengan pratinjau tersanitasi); pengguna
           * biasa tetap plaintext.
           */}
          {isPlusActive ? (
            <ShowcaseHtmlDescriptionEditor
              label="Deskripsi"
              value={form.description}
              onChangeText={(t) => setForm((f) => ({ ...f, description: t }))}
              maxLength={DESC_MAX}
              hint={translate("Eksklusif Kahade+: format teks dengan HTML ringan.")}
              disabled={saving}
            />
          ) : (
            <TextArea
              label={translate("Deskripsi")}
              value={form.description}
              onChangeText={(t) => setForm((f) => ({ ...f, description: t }))}
              maxLength={DESC_MAX}
              showCount
              rows={3}
              disabled={saving}
            />
          )}
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
          {/* Item 53 (FE-IMP-1): kondisi barang BARU/BEKAS. */}
          <ShowcaseConditionInput
            value={form.condition}
            onChange={(condition) => setForm((f) => ({ ...f, condition }))}
            disabled={saving}
          />
          <Input
            label="Harga minimum (opsional)"
            keyboardType="number-pad"
            // C10 (batch 139): pemisah ribuan live; state tetap angka.
            value={formatRupiahTyping(form.priceMin)}
            onChangeText={(raw) => {
              const parsed = parseRupiahTyping(raw)
              // undefined = ketikan tak valid (negatif/huruf/>15 digit) — abaikan.
              if (parsed === undefined) return
              setForm((f) => ({ ...f, priceMin: parsed }))
              clearFormErrors()
            }}
            errorText={priceMinError}
            helperText={
              form.priceMin === 0
                ? translate("Harga {x} ditampilkan sebagai Gratis.", { x: 0 })
                : translate("Maksimal 15 digit; nilai negatif ditolak.")
            }
            disabled={saving}
          />
          <Input
            label={translate("Harga maksimum (opsional)")}
            keyboardType="number-pad"
            value={formatRupiahTyping(form.priceMax)}
            onChangeText={(raw) => {
              const parsed = parseRupiahTyping(raw)
              if (parsed === undefined) return
              setForm((f) => ({ ...f, priceMax: parsed }))
              clearFormErrors()
            }}
            // C10: error relasi min–maks tampil langsung saat mengetik.
            errorText={priceRangeError ?? priceMaxError}
            helperText={priceRangeError || priceMaxError ? undefined : translate("Maksimal 15 digit; nilai negatif ditolak.")}
            disabled={saving}
          />
          {/* IMP-F-013: pratinjau label harga live — verifikasi "Rp 1.500.000"
              sebelum simpan. Satu baris teks, bukan redesign. */}
          {form.priceMin != null || form.priceMax != null ? (
            <Text variant="caption" tone="secondary" accessibilityLiveRegion="polite">
              {translate("Pratinjau: {x}", {
                x: showcasePriceLabelOrFallback({ priceMin: form.priceMin, priceMax: form.priceMax }),
              })}
            </Text>
          ) : null}
          {/* Batch 43 (commerce): tipe produk, harga coret, tenggat jasa,
              info digital, jadwal publish. */}
          <CommerceProductFields
            value={commerce}
            onChange={setCommerce}
            salePriceIdr={form.priceMin ?? form.priceMax}
            disabled={saving}
          />
          {/* D-02: visibilitas PUBLIC/PRIVATE */}
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-1 gap-1">
              <Text variant="body" weight={500}>
                {translate("Tampilkan secara publik")}
              </Text>
              <Text variant="caption" tone="secondary">
                {form.isPublic
                  ? translate("Etalase terlihat di feed & profil publik Anda.")
                  : translate("Etalase disimpan sebagai draf privat (tidak terlihat pengunjung).")}
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

      {/* C11 (batch 139): pratinjau sebelum simpan — komponen kartu feed YANG
          SAMA (`ShowcaseFeedItem`, mode non-interaktif), dirakit dari draft
          editor. */}
      <BottomSheet
        visible={editorPreviewVisible}
        onRequestClose={() => setEditorPreviewVisible(false)}
        title={translate("Pratinjau etalase")}
        description={translate("Tampilan kartu etalase Anda di feed dengan perubahan saat ini.")}
        footer={
          <View className="gap-2">
            <Button
              variant="primary"
              fullWidth
              loading={saving}
              onPress={() => {
                setEditorPreviewVisible(false)
                void handleSave()
              }}
            >
              {translate("Simpan perubahan")}
            </Button>
            <Button variant="ghost" fullWidth onPress={() => setEditorPreviewVisible(false)}>
              {translate("Kembali edit")}
            </Button>
          </View>
        }
      >
        {editorPreviewItem ? <ShowcaseFeedItem item={editorPreviewItem} nonInteractive /> : null}
      </BottomSheet>
    </Screen>
  )
}
