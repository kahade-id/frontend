/**
 * Screen — Halaman PENUH pembuatan karya etalase (revisi 2026-09-26).
 *
 * Menggantikan BottomSheet "Detail karya baru" di halaman Kelola Etalase.
 * Alasannya bukan soal selera: form ini memuat pilih-foto (multi, sampai 8),
 * pratinjau yang bisa diurutkan, lima field, dan satu sakelar — di dalam
 * sheet setengah layar semua itu hidup di balik guliran 300px sementara
 * keyboard menutupi separuh sisanya. Halaman penuh memberi ruang bernapas,
 * footer aksi yang menempel, dan Back yang jelas.
 *
 * Pintu masuknya:
 *   - ikon PENSIL di header tab Etalase (sebelumnya justru membuka halaman
 *     Kelola Etalase — pengguna yang mau membuat karya mesti satu kali
 *     ketuk lagi dari sana), dan
 *   - tombol "Tambah foto" di halaman Kelola Etalase.
 *
 * Kontrak unggah (sama dengan halaman Kelola Etalase, jangan disimpangkan):
 *   - pilih → unggah (presigned) → KUNCI file terkumpul di state → baru
 *     `POST /v1/users/me/showcase` membawa kunci itu. Tidak ada endpoint
 *     auto-create.
 *   - Menggagalkan unggahan satu foto TIDAK membatalkan yang lain; foto gagal
 *     ditawarkan "coba lagi" dan tombol simpan tetap terkunci sampai daftarnya
 *     kosong (kalau tidak, karya terkirim tanpa foto yang dipilih pengguna).
 *   - Meninggalkan halaman sebelum simpan membersihkan kunci tertunda, KECUALI
 *     saat `POST` sedang berjalan atau hasilnya belum pasti (transport timeout
 *     bisa saja sudah tersimpan di server) — lihat `uncertainCreate`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Linking, Platform, View } from "react-native"
import { useNavigation, usePreventRemove, type NavigationAction } from "expo-router"
import {
  Eye,
  EyeSlash,
  Images,
  Play,
  Plus,
  ShieldCheck,
  Star,
  Trash,
  VideoCamera,
} from "phosphor-react-native"

import { api, isApiError, userMessage } from "@/lib/api"
import { createIdempotencyKey } from "@/lib/api/client"
import { setCommerceFieldsCache } from "@/lib/commerce-fields"
import { CommerceProductFields, EMPTY_COMMERCE_FORM, type CommerceFormValues } from "@/components/ui/commerce-product-fields"
import type { CreateShowcaseItemDto, ShowcaseMediaInput } from "@/lib/api/types"
import { API_CONSTRAINTS } from "@/lib/api/constraints"
import { getSessionRevision } from "@/lib/api/session"
import { useSessionRevision } from "@/lib/guest-gate"
import { pickImage, pickImages, pickedImageToBlob, resizePickedImage, type PickedImage } from "@/lib/image-picker"
import { markShowcaseFeedDirty } from "@/lib/showcase-social-prefs"
import { invalidateQueryPrefix } from "@/lib/query-cache"
import { partitionAssetsBySize, resolveCreateAttempt } from "@/lib/showcase-state"
import { SHOWCASE_IMAGE_MAX_BYTES, getShowcasePhotoLimit } from "@/lib/showcase-limits"
import { useKahadePlus } from "@/lib/use-kahade-plus"
import { ShowcaseHtmlDescriptionEditor } from "@/components/ui/showcase-html-description-editor"
import { sanitizeShowcaseHtml } from "@/lib/showcase-html"
import { uploadMessage } from "@/lib/upload-errors"
import {
  cleanupPendingShowcaseKeys,
  uploadShowcasePhoto,
  uploadShowcaseVideo,
  type ShowcaseVideoUploadOutcome,
} from "@/lib/showcase-upload"
import {
  saveShowcaseDraft,
  loadShowcaseDraft,
  clearShowcaseDraft,
  isDraftMeaningful,
  type ShowcaseDraft,
} from "@/lib/showcase-draft"
import { showcasePriceLabelOrFallback } from "@/lib/showcase-labels"
import { moveMediaToFront, moveMediaItem } from "@/lib/showcase-media-order"
import { formatRupiahTyping, isPriceRangeValid, parseRupiahTyping } from "@/lib/rupiah-input"
import { tokens } from "@/lib/tokens"
import { translate } from "@/lib/i18n/translate"
import { useLanguage } from "@/lib/i18n"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ProgressBar } from "@/components/ui/progress-bar"
import { Dialog } from "@/components/ui/modal"
import { EmptyState } from "@/components/ui/empty-state"
import { Header } from "@/components/ui/header"
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { Input } from "@/components/ui/input"
import { Picture } from "@/components/ui/picture"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Screen } from "@/components/ui/screen"
import { DragSortList } from "@/components/showcase-media-drag-sort"
import { SectionHeader } from "@/components/ui/section"
import { ShowcaseCategoryInput } from "@/components/ui/showcase-category-input"
import { ShowcaseConditionInput } from "@/components/ui/showcase-condition-input"
import { Switch } from "@/components/ui/switch"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"
import { useToast } from "@/components/ui/toast"
import { ValidationSummary } from "@/components/ui/validation-summary"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { ShowcaseFeedItem } from "@/components/ui/showcase-feed-item"
import type { ShowcaseMedia, ShowcaseSocialItem } from "@/lib/api/showcase"
import { goBackOrNavigate } from "@/lib/navigation"
import { ROUTES } from "@/lib/routes"

/** Batas field — turunan dari kontrak backend, bukan angka lokal (D-08). */
const TITLE_MAX = API_CONSTRAINTS.CreateShowcaseItemDto.title.maxLength
const DESC_MAX = API_CONSTRAINTS.CreateShowcaseItemDto.description.maxLength
const CATEGORY_MAX = API_CONSTRAINTS.CreateShowcaseItemDto.category.maxLength

type FormState = {
  title: string
  description: string
  priceMin: number | null
  priceMax: number | null
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

/**
 * TIM-8 (audit performa 2026-09-30): bentuk kanonis EMPTY_FORM dihitung
 * sekali di module scope — sebelumnya `JSON.stringify(EMPTY_FORM)` jalan
 * tiap render.
 */
const EMPTY_FORM_JSON = JSON.stringify(EMPTY_FORM)

/**
 * Pratinjau media karya: foto, atau video (kontrak final Tim A #1/#2,
 * 2026-09-28). `video` terisi = entri video yang sudah diunggah
 * (fileKey + thumbnailFileKey wajib). `thumbnailFileKey` di root =
 * thumbnail FOTO auto-generate server-side (PERF-FIX NP-001) — dilampirkan
 * sebagai `thumbnailFileKey` di `media[]` agar feed memuat varian kecil.
 */
type Preview = { fileKey: string; asset: PickedImage; thumbnailFileKey?: string; video?: ShowcaseVideoUploadOutcome }

/** Semua key server milik satu preview (video & foto punya thumbnailFileKey juga). */
function previewServerKeys(preview: Preview): string[] {
  const keys = [preview.fileKey]
  if (preview.video?.thumbnailFileKey) keys.push(preview.video.thumbnailFileKey)
  if (preview.thumbnailFileKey) keys.push(preview.thumbnailFileKey)
  return keys
}

/** Bangun `media[]` kontrak #2 dari previews (video wajib thumbnailFileKey; foto opsional — PERF-FIX NP-001). */
function previewsToMediaInput(previews: Preview[]): ShowcaseMediaInput[] {
  return previews.map((preview): ShowcaseMediaInput => {
    if (preview.video) {
      // BFI-101: BE menerima width/height opsional (showcase-media.dto.ts);
      // tipe ShowcaseMediaInput (lib/api/types.ts — bukan file domain ini)
      // belum mendeklarasikannya, jadi pakai irisan lokal. Runtime JSON
      // tetap membawa field-nya apa pun tipe statisnya.
      const input: ShowcaseMediaInput & { width?: number; height?: number } = {
        fileKey: preview.video.fileKey,
        kind: "video",
        thumbnailFileKey: preview.video.thumbnailFileKey,
      }
      if (preview.video.durationSec != null) input.durationSec = preview.video.durationSec
      if (preview.video.width != null) input.width = preview.video.width
      if (preview.video.height != null) input.height = preview.video.height
      return input
    }
    const input: ShowcaseMediaInput = { fileKey: preview.fileKey, kind: "image" }
    if (preview.thumbnailFileKey) input.thumbnailFileKey = preview.thumbnailFileKey
    return input
  })
}

/**
 * BUG #2 (2026-09-26): kegagalan per-foto sebelumnya hanya menyimpan asset
 * tanpa alasan — user tidak pernah tahu kenapa gagal. Sekarang pesan error
 * asli (dari userMessage) ikut disimpan agar bisa ditampilkan.
 */
type FailedPhoto = { asset: PickedImage; message: string }

/**
 * Harga minimum TANPA harga maksimum berarti HARGA PASTI.
 *
 * Kolom formnya memang dua ("minimum" & "maksimum"), tetapi penjual yang
 * menetapkan satu harga hanya mengisi yang pertama — dan hasilnya dulu
 * ditampilkan sebagai "Mulai Rp 100.000", seolah harga itu sekadar batas
 * bawah. Menyimpan maksimum = minimum membuat kartu etalase menampilkan
 * "Rp 100.000" (lihat lib/showcase-labels.ts).
 */
function formToPayload(form: FormState) {
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

export default function ShowcaseCreateScreen() {
  // i18n: label mengikuti bahasa aktif.
  useLanguage()
  const navigation = useNavigation()

  // S7: cek draft tersimpan saat layar dibuka — tawarkan lanjutkan.
  // (Dijalankan sekali; guard ref supaya StrictMode double-effect aman.)
  const draftChecked = useRef(false)
  const toast = useToast()
  const revision = useSessionRevision()

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  // Batch 43 (commerce): field commerce — tipe produk, harga coret, tenggat
  // jasa, info digital, jadwal publish. Dikirim via PATCH
  // /v1/commerce/products/:id SETELAH karya terbuat.
  const [commerce, setCommerce] = useState<CommerceFormValues>(EMPTY_COMMERCE_FORM)
  // T2 (audit 2026-09-26): error per field — satu `formError` membuat pesan
  // foto/harga menempel di input yang salah.
  const [titleError, setTitleError] = useState<string | undefined>()
  const [photoError, setPhotoError] = useState<string | undefined>()
  const [priceError, setPriceError] = useState<string | undefined>()
  /**
   * C11 (batch 139): pratinjau sebelum terbit — overlay berisi komponen kartu
   * feed YANG SAMA (`ShowcaseFeedItem` mode non-interaktif).
   */
  const [previewVisible, setPreviewVisible] = useState(false)
  /**
   * C10 (batch 139): relasi harga min–maks divalidasi LANGSUNG saat mengetik
   * (computed, bukan hanya saat submit) — mencegah "min > maks" lolos.
   */
  const priceRangeError = !isPriceRangeValid(form.priceMin, form.priceMax)
    ? translate("Harga minimum tidak boleh lebih besar dari harga maksimum.")
    : undefined
  const [previews, setPreviews] = useState<Preview[]>([])
  const [failedAssets, setFailedAssets] = useState<FailedPhoto[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState("")
  // S6: progres 0..1 untuk ProgressBar (upload konkuren).
  const [uploadProgress, setUploadProgress] = useState(0)
  const [saving, setSaving] = useState(false)
  /**
   * `POST` yang hasilnya BELUM pasti (timeout/5xx) tidak boleh dibersihkan
   * kuncinya — karya bisa saja sudah tersimpan di server.
   */
  const [uncertainCreate, setUncertainCreate] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)
  // S7: draft tersimpan untuk dialog "Lanjutkan draft?".
  const [resumeDraft, setResumeDraft] = useState<ShowcaseDraft | null>(null)

  // S7: tawarkan lanjutkan draft sekali saat layar dibuka.
  useEffect(() => {
    if (draftChecked.current) return
    draftChecked.current = true
    void loadShowcaseDraft().then((d) => {
      if (d && isDraftMeaningful(d)) setResumeDraft(d)
    })
  }, [])

  // S7: autosave teks (debounce 1 dtk) — TANPA foto.
  useEffect(() => {
    const t = setTimeout(() => {
      // SH-02: draf baru saja dihapus sengaja — jangan tuliskan ulang.
      if (draftSuppressed.current) return
      const meaningful =
        form.title.trim() || form.description.trim() || form.category.trim() ||
        form.priceMin != null || form.priceMax != null || form.condition !== ""
      if (!meaningful) return
      void saveShowcaseDraft({
        title: form.title,
        description: form.description,
        category: form.category,
        priceMin: form.priceMin,
        priceMax: form.priceMax,
        isPublic: form.isPublic,
        // Item 53: kondisi ikut tersimpan di draft.
        condition: form.condition,
      })
    }, 1000)
    return () => clearTimeout(t)
  }, [form])
  /**
   * Keluar yang disengaja — terbit sukses, "Periksa daftar etalase", atau
   * konfirmasi "Buang". `usePreventRemove` HARUS sudah mati saat navigasi
   * berjalan: `beforeRemove` membaca nilai `preventRemove` dari render
   * terakhir, sementara `router.back()` expo-router menunda dispatch ke
   * effect berikutnya (saat itu `saveBusy` sudah false). Karena itu navigasi
   * yang disengaja selalu menyalakan flag ini dulu dan dieksekusi dari
   * effect di bawah — bukan langsung di handler.
   */
  const [intentionalLeave, setIntentionalLeave] = useState(false)

  const pendingKeys = useRef<string[]>([])
  /**
   * SH-02 (audit 2026-10-09): setelah draft DIHAPUS secara sengaja (terbit
   * sukses, "Buang", atau dialog "Lanjutkan draf?" → buang), timer autosave
   * 1 dtk yang belum nembak TIDAK BOLEH menulis ulang draf ke penyimpanan —
   * kalau menulis, layar terbuka lagi muncul prompt "Lanjutkan draf?" berisi
   * karya yang sudah terbit. Dicek di DALAM callback timeout (cek saat efek
   * terlambat: timer yang sudah berjalan tetap akan nembak).
   */
  const draftSuppressed = useRef(false)
  const createAttempt = useRef<{ key: string; dto: CreateShowcaseItemDto } | null>(null)
  const uploadAbort = useRef<AbortController | null>(null)
  const uploadBusy = useRef(false)
  const saveBusy = useRef(false)
  const mounted = useRef(true)
  const pendingNavigation = useRef<NavigationAction | null>(null)

  /**
   * Benefit 7 Kahade+ ("custom etalase"): anggota aktif mendapat editor
   * deskripsi HTML + limit 18 foto (bukan 8). Status dibaca dari
   * `useKahadePlus()` — satu-satunya sumber status langganan di UI.
   */
  const { isActive: isPlusActive } = useKahadePlus()
  const photoLimit = getShowcasePhotoLimit(isPlusActive)
  /**
   * C11 (batch 139): rakit item pratinjau dari state form saat ini — media
   * memakai URI lokal (belum terbit), author "Anda", count nol. Kartu yang
   * dirender adalah `ShowcaseFeedItem` yang sama dengan feed.
   */
  const previewItem: ShowcaseSocialItem | null = useMemo(() => {
    if (!previewVisible) return null
    const images: ShowcaseMedia[] = previews.map((preview, index) => ({
      id: preview.fileKey,
      kind: preview.video ? ("video" as const) : ("image" as const),
      // Pratinjau memakai URI lokal (belum terbit): video = berkas lokal,
      // thumbnail = poster backend bila sudah terunggah.
      imageUrl: preview.asset.uri,
      thumbnailUrl: preview.video?.thumbnailUrl ?? preview.asset.uri,
      sortOrder: index,
      width: preview.asset.width ?? undefined,
      height: preview.asset.height ?? undefined,
    }))
    const rawDescription = form.description.trim()
    // Plus: deskripsi HTML → teks polos untuk kartu (kartu feed hanya
    // menampilkan teks; HTML penuh dirender di detail).
    const description = rawDescription
      ? isPlusActive
        ? rawDescription.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || null
        : rawDescription
      : null
    const now = new Date().toISOString()
    return {
      id: "preview-local",
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
      createdAt: now,
      updatedAt: now,
      author: {
        userId: "preview-local",
        username: translate("Anda"),
        fullName: null,
      },
    }
  }, [previewVisible, previews, form, isPlusActive])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      uploadAbort.current?.abort()
      // Jangan pernah hapus kunci selagi create mungkin sudah tersimpan.
      if (!saveBusy.current && !createAttempt.current) {
        void cleanupPendingShowcaseKeys(pendingKeys.current)
      }
    }
  }, [])

  // TIM-8 (audit performa 2026-09-30): dirty check di-memo — sebelumnya
  // `JSON.stringify(form)` 2× per render (tiap keystroke) hanya untuk
  // perbandingan boolean.
  const dirty = useMemo(
    () => previews.length > 0 || JSON.stringify(form) !== EMPTY_FORM_JSON,
    [previews.length, form],
  )

  /** Foto + ketikan belum tersimpan — minta konfirmasi sebelum keluar. */
  const requestClose = useCallback(() => {
    // B2-SC-02: toast yang sama seperti jalur hardware back — X diam total
    // saat upload busy terasa seperti aplikasi macet.
    if (saveBusy.current || uploadBusy.current) {
      toast.show({ title: translate("Tunggu unggahan selesai…"), tone: "info" })
      return
    }
    if (dirty) setDiscardOpen(true)
    // P2-S4: fallback ke daftar etalase bila tanpa riwayat (clean state X).
    else goBackOrNavigate(ROUTES.showcase)
  }, [dirty, toast.show])

  const confirmDiscard = useCallback(() => {
    void cleanupPendingShowcaseKeys(pendingKeys.current)
    pendingKeys.current = []
    // S7: buang juga draft teks yang tersimpan.
    // SH-02: matikan autosave TERLEBIH DULU — timer 1 dtk yang belum nembak
    // (dari ketikan terakhir) tidak boleh menulis ulang draft yang dibuang.
    draftSuppressed.current = true
    void clearShowcaseDraft()
    setDiscardOpen(false)
    // Jangan dispatch di sini: penjaga masih aktif sampai commit berikutnya
    // dan `beforeRemove` akan membuka dialog lagi. Effect `intentionalLeave`
    // yang mengeksekusi navigasi tertunda (aksi tersimpan dibaca di sana).
    setIntentionalLeave(true)
  }, [])

  usePreventRemove(dirty && !intentionalLeave, ({ data }) => {
    // P1-S2: beri umpan balik saat back ditekan selama upload — sebelumnya
    // diam total dan terasa seperti aplikasi macet.
    if (saveBusy.current || uploadBusy.current) {
      toast.show({ title: translate("Tunggu unggahan selesai…"), tone: "info" })
      return
    }
    pendingNavigation.current = data.action
    setDiscardOpen(true)
  })

  // Navigasi keluar yang disengaja — berjalan setelah `intentionalLeave`
  // commit, sehingga `beforeRemove` tidak lagi dicegat.
  useEffect(() => {
    if (!intentionalLeave) return
    const action = pendingNavigation.current
    pendingNavigation.current = null
    if (action) navigation.dispatch(action)
    // B2-SC-01: fallback ke daftar etalase — router.back() no-op saat
    // cold-start (mis. setelah sukses simpan tanpa riwayat).
    else goBackOrNavigate(ROUTES.showcaseManagement)
  }, [intentionalLeave, navigation])

  // Web: peringatan bawaan browser sebelum menutup tab dengan draf hidup.
  useEffect(() => {
    if (Platform.OS !== "web" || !dirty) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    globalThis.addEventListener?.("beforeunload", warn)
    return () => globalThis.removeEventListener?.("beforeunload", warn)
  }, [dirty])

  // ── Pilih & unggah foto ─────────────────────────────────────────────
  const handlePickPhotos = useCallback(async () => {
    if (uploadBusy.current || saveBusy.current) return
    const slots = photoLimit - previews.length
    if (slots <= 0) {
      toast.show({
        title: translate("Foto sudah penuh"),
        description: translate("Satu etalase dapat memuat paling banyak {x} foto.", {
          x: photoLimit,
        }),
        tone: "info",
      })
      return
    }
    uploadBusy.current = true
    const controller = new AbortController()
    uploadAbort.current = controller
    const uploaded: Preview[] = []
    const failures: FailedPhoto[] = []
    try {
      const picked = await pickImages({ selectionLimit: slots })
      if (picked.status === "denied") {
        toast.show({
          title: translate("Akses galeri ditolak"),
          description: translate("Izinkan akses foto di pengaturan perangkat untuk memilih etalase."),
          tone: "danger",
          action: { label: translate("Buka pengaturan"), onPress: () => void Linking.openSettings() },
        })
        return
      }
      if (picked.status !== "picked" || controller.signal.aborted) return
      // SH-F-005 (audit 2026-09-27): aset yang ukurannya tidak dilaporkan
      // platform (size 0, Android lama) JANGAN lolos diam-diam — baca ukuran
      // aktual dari bytes dulu; bila tetap tak diketahui, TOLAK dengan pesan
      // jelas (jangan fail-open ke upload yang berujung 413/gantung).
      const sizedAssets = await Promise.all(
        picked.assets.map(async (asset) => {
          if (asset.size > 0) return asset
          try {
            const blob = await pickedImageToBlob(asset)
            return blob.size > 0 ? { ...asset, size: blob.size } : asset
          } catch {
            return asset
          }
        }),
      )
      const { tooBig, unknownSize } = partitionAssetsBySize(sizedAssets, SHOWCASE_IMAGE_MAX_BYTES)
      if (unknownSize.length > 0) {
        setPhotoError(
          translate("Ukuran foto {x} tidak dapat dibaca. Pilih ulang foto tersebut.", {
            x: unknownSize.map((a) => a.name ?? translate("tanpa nama")).join(", "),
          }),
        )
        return
      }
      // S6: validasi ukuran SEBELUM upload — maks 5MB (selaras backend
      // UploadPurpose.SHOWCASE_IMAGE). Tampilkan nama file yang ditolak.
      if (tooBig.length > 0) {
        setPhotoError(
          translate("Foto {x} melebihi {y} MB.", {
            x: tooBig.map((a) => a.name ?? translate("tanpa nama")).join(", "),
            y: SHOWCASE_IMAGE_MAX_BYTES / 1024 / 1024,
          }),
        )
        return
      }
      setUploading(true)
      setUploadProgress(0)
      // PERF-FIX (2026-09-30): resize SEBELUM preview dirender — pratinjau
      // 88px tidak butuh file kamera 4000px di memori (8 foto × full-res).
      // Fail-open: resizePickedImage mengembalikan aset asli bila gagal.
      // Upload di bawah juga me-resize (idempoten — sudah kecil = no-op).
      const resizedAssets = await Promise.all(sizedAssets.map((a) => resizePickedImage(a)))
      if (controller.signal.aborted) return
      // S6: upload konkuren maks 2 — lebih cepat dari sekuensial, tetap ramah
      // memori/jaringan dibanding Promise.all tak terbatas.
      const CONCURRENCY = 2
      const total = resizedAssets.length
      let completed = 0
      // Audit 2026-10-09 C5: progress JUJUR — bar = foto selesai + fraksi
      // byte foto yang sedang dikirim di tiap slot (dulu: lompat per foto
      // selesai, tanpa kemajuan byte di dalam foto).
      const inFlight: Record<number, number> = {}
      const publish = () => {
        const partial = Object.values(inFlight).reduce((a, b) => a + b, 0)
        setUploadProgress(Math.min(1, (completed + partial) / total))
      }
      const bump = () => {
        completed += 1
        publish()
        setProgress(
          translate("Mengunggah foto {x} dari {y}", {
            x: completed,
            y: total,
          }),
        )
      }
      const queue = [...resizedAssets]
      const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async (_v, slot) => {
        while (queue.length > 0) {
          if (controller.signal.aborted) return
          const asset = queue.shift()!
          inFlight[slot] = 0
          try {
            const outcome = await uploadShowcasePhoto(asset, {
              signal: controller.signal,
              onProgress: (fraction) => {
                inFlight[slot] = fraction
                publish()
              },
            })
            uploaded.push({ fileKey: outcome.fileKey, asset, thumbnailFileKey: outcome.thumbnailFileKey })
          } catch (err) {
            if (controller.signal.aborted) throw new Error("aborted")
            // BUG #2: sebelumnya hanya asset yang disimpan tanpa pesan —
            // user tidak pernah tahu penyebab gagalnya.
            // Audit 2026-10-09 A1: `uploadMessage` (bukan `userMessage`) —
            // timeout/413/5xx/network tak stabil punya copy masing-masing;
            // "Tidak ada koneksi internet" hanya bila NetInfo memverifikasi.
            failures.push({ asset, message: uploadMessage(err, { purpose: "SHOWCASE_IMAGE" }) })
          } finally {
            delete inFlight[slot]
            bump()
          }
        }
      })
      await Promise.all(workers)
      if (controller.signal.aborted || revision !== getSessionRevision()) {
        void cleanupPendingShowcaseKeys(uploaded.flatMap(previewServerKeys))
        return
      }
      // BUG #2: kegagalan per-foto sebelumnya ditelan tanpa toast; bila SEMUA
      // foto gagal, Promise.all tetap resolve sehingga toast error luar tidak
      // pernah muncul. Tampilkan ringkasan dengan pesan asli error pertama.
      if (failures.length > 0 && mounted.current) {
        const detail = failures[0].message
        if (uploaded.length === 0) {
          toast.show({
            title: translate("Gagal mengunggah foto"),
            description: detail,
            tone: "danger",
          })
        } else {
          toast.show({
            title: translate("{x} dari {y} foto gagal diunggah", {
              x: failures.length,
              y: resizedAssets.length,
            }),
            description: detail,
            tone: "warning",
          })
        }
      }
      const next = [...previews, ...uploaded]
      pendingKeys.current = next.flatMap(previewServerKeys)
      setPreviews(next)
      setPhotoError(undefined)
      setFailedAssets((current) => [...current, ...failures])
    } catch (error) {
      void cleanupPendingShowcaseKeys(uploaded.flatMap(previewServerKeys))
      if (!controller.signal.aborted && mounted.current) {
        toast.show({
          title: translate("Gagal mengunggah foto"),
          description: uploadMessage(error, { purpose: "SHOWCASE_IMAGE" }),
          tone: "danger",
        })
      }
    } finally {
      uploadBusy.current = false
      if (uploadAbort.current === controller) uploadAbort.current = null
      if (mounted.current) {
        setUploading(false)
        setProgress("")
      }
    }
  }, [previews, revision, toast, photoLimit])

  /**
   * Pilih & unggah SATU video karya (kontrak final Tim A #1, 2026-09-28).
   *
   * Alur: expo-image-picker (videoOnly) → POST /v1/upload/direct
   * (purpose=SHOWCASE_VIDEO, progress 0–1) → preview memakai thumbnail
   * backend. Error backend (FILE_TOO_LARGE, MIME_TYPE_MISMATCH,
   * VIDEO_TOO_LONG, VIDEO_UNPROCESSABLE, UPLOAD_FAILED) sudah dipetakan ke
   * pesan Indonesia di `uploadShowcaseVideo` — tampilkan via toast danger.
   * Video menempati 1 slot dari `photoLimit` (sama seperti foto).
   */
  const handlePickVideo = useCallback(async () => {
    if (uploadBusy.current || saveBusy.current) return
    const slots = photoLimit - previews.length
    if (slots <= 0) {
      toast.show({
        title: translate("Media sudah penuh"),
        description: translate("Satu etalase dapat memuat paling banyak {x} media.", {
          x: photoLimit,
        }),
        tone: "info",
      })
      return
    }
    uploadBusy.current = true
    const controller = new AbortController()
    uploadAbort.current = controller
    try {
      const picked = await pickImage({ videoOnly: true })
      if (picked.status === "denied") {
        toast.show({
          title: translate("Akses galeri ditolak"),
          description: translate("Izinkan akses media di pengaturan perangkat untuk memilih video."),
          tone: "danger",
          action: { label: translate("Buka pengaturan"), onPress: () => void Linking.openSettings() },
        })
        return
      }
      if (picked.status !== "picked" || controller.signal.aborted) return
      const asset = picked.asset
      // Ukuran tak terbaca (0, Android lama) → tolak dengan pesan jelas
      // (pola SH-F-005 untuk foto); batas atas diserahkan ke server yang
      // menjawab FILE_TOO_LARGE dengan pesan yang sudah dipetakan.
      if (asset.size <= 0) {
        try {
          const blob = await pickedImageToBlob(asset)
          if (blob.size <= 0) {
            setPhotoError(translate("Ukuran video tidak dapat dibaca. Pilih ulang video tersebut."))
            return
          }
        } catch {
          setPhotoError(translate("Ukuran video tidak dapat dibaca. Pilih ulang video tersebut."))
          return
        }
      }
      setUploading(true)
      setUploadProgress(0)
      setProgress(translate("Mengunggah video…"))
      const outcome = await uploadShowcaseVideo(asset, {
        onProgress: (fraction) => {
          setUploadProgress(fraction)
          // 100% = berkas terkirim, server sedang memproses (ffprobe+ffmpeg).
          // Tampilkan status berbeda agar tidak terlihat "stuck".
          setProgress(
            fraction >= 1
              ? translate("Memproses video…")
              : translate("Mengunggah video… {x}%", { x: Math.round(fraction * 100) }),
          )
        },
        signal: controller.signal,
      })
      if (controller.signal.aborted || revision !== getSessionRevision()) {
        void cleanupPendingShowcaseKeys(previewServerKeys({ fileKey: outcome.fileKey, asset, video: outcome }))
        return
      }
      const next = [...previews, { fileKey: outcome.fileKey, asset, video: outcome }]
      pendingKeys.current = next.flatMap(previewServerKeys)
      setPreviews(next)
      setPhotoError(undefined)
      toast.show({ title: translate("Video ditambahkan"), tone: "success", duration: 2000 })
    } catch (error) {
      if (controller.signal.aborted) return
      if (mounted.current) {
        // Audit 2026-10-09 A1/F1: `uploadMessage` — 413 menyebut "maks 100
        // MB", timeout = "koneksi lambat", offline hanya bila terverifikasi.
        // Copy backend spesifik (VIDEO_TOO_LARGE, dsb.) diteruskan apa
        // adanya oleh `uploadMessage`.
        toast.show({
          title: translate("Gagal mengunggah video"),
          description: uploadMessage(error, { purpose: "SHOWCASE_VIDEO" }),
          tone: "danger",
        })
      }
    } finally {
      uploadBusy.current = false
      if (uploadAbort.current === controller) uploadAbort.current = null
      if (mounted.current) {
        setUploading(false)
        setProgress("")
        setUploadProgress(0)
      }
    }
  }, [previews, revision, toast, photoLimit])

  const retryFailedPhotos = useCallback(async () => {
    if (uploadBusy.current || saveBusy.current || failedAssets.length === 0) return
    uploadBusy.current = true
    setUploading(true)
    setUploadProgress(0)
    const controller = new AbortController()
    uploadAbort.current = controller
    const next = [...previews]
    const failures: FailedPhoto[] = []
    try {
      for (const [index, failed] of failedAssets.entries()) {
        setProgress(
          translate("Mengunggah foto {x} dari {y}", {
            x: index + 1,
            y: failedAssets.length,
          }),
        )
        try {
          // Audit 2026-10-09 C5: retry hanya foto yang GAGAL (dulu sudah
          // begitu — dipertahankan) + progress byte jujur per file.
          const result = await uploadShowcasePhoto(failed.asset, {
            signal: controller.signal,
            onProgress: (fraction) =>
              setUploadProgress((index + fraction) / failedAssets.length),
          })
          next.push({ fileKey: result.fileKey, asset: failed.asset, thumbnailFileKey: result.thumbnailFileKey })
        } catch (err) {
          // BUG #2: pola yang sama — simpan pesan asli agar user tahu penyebabnya.
          // Audit 2026-10-09 A1: `uploadMessage` (bukan `userMessage`).
          failures.push({ asset: failed.asset, message: uploadMessage(err, { purpose: "SHOWCASE_IMAGE" }) })
        }
      }
      if (!mounted.current || revision !== getSessionRevision()) {
        void cleanupPendingShowcaseKeys(next.slice(previews.length).flatMap(previewServerKeys))
        return
      }
      pendingKeys.current = next.flatMap(previewServerKeys)
      setPreviews(next)
      setPhotoError(undefined)
      setFailedAssets(failures)
      if (failures.length > 0 && mounted.current && !controller.signal.aborted) {
        toast.show({
          title: translate("Masih ada foto yang gagal diunggah"),
          description: failures[0].message,
          tone: "warning",
        })
      }
    } finally {
      uploadBusy.current = false
      uploadAbort.current = null
      if (mounted.current) {
        setUploading(false)
        setProgress("")
      }
    }
  }, [failedAssets, previews, revision])

  /** Buang satu pratinjau media. */
  const removePreview = useCallback(
    (index: number) => {
      if (uploadBusy.current || saveBusy.current || uncertainCreate) return
      const next = [...previews]
      const [removed] = next.splice(index, 1)
      if (!removed) return
      // Video: bersihkan thumbnailFileKey juga (jangan sisakan orphan).
      void cleanupPendingShowcaseKeys(previewServerKeys(removed))
      pendingKeys.current = next.flatMap(previewServerKeys)
      setPreviews(next)
    },
    [previews, uncertainCreate],
  )

  /**
   * C09 (batch 139): drag-reorder — pindahkan media dari→ke. Aturan produk
   * tetap: media pertama = sampul karya.
   */
  const reorderPreview = useCallback(
    (from: number, to: number) => {
      if (uploadBusy.current || saveBusy.current || uncertainCreate) return
      setPreviews((current) => {
        const next = moveMediaItem(current, from, to)
        pendingKeys.current = next.flatMap(previewServerKeys)
        return next
      })
    },
    [uncertainCreate],
  )

  /**
   * C09 (batch 139): "pilih sampul" eksplisit — media pindah ke indeks 0
   * (aturan produk: media pertama = sampul karya). Urutan lain tidak berubah.
   */
  const setAsCover = useCallback(
    (index: number) => {
      if (uploadBusy.current || saveBusy.current || uncertainCreate) return
      setPreviews((current) => {
        if (index <= 0 || index >= current.length) return current
        const next = moveMediaToFront(current, index)
        pendingKeys.current = next.flatMap(previewServerKeys)
        return next
      })
    },
    [uncertainCreate],
  )

  // ── Simpan ──────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    // T1 (audit 2026-09-26): `uncertainCreate` TIDAK memblokir retry —
    // copy menjanjikan "Coba Terbitkan lagi" memakai idempotency key yang
    // sama. `saveBusy`/`uploadBusy` tetap dijaga.
    if (saveBusy.current || uploadBusy.current) return
    const title = form.title.trim()
    if (!title) {
      setTitleError(translate("Judul wajib diisi."))
      return
    }
    if (previews.length === 0) {
      setPhotoError(translate("Pilih minimal satu foto etalase."))
      return
    }
    if (failedAssets.length > 0) {
      setPhotoError(translate("Selesaikan unggahan foto yang gagal terlebih dahulu."))
      return
    }
    if (form.priceMin != null && form.priceMax != null && form.priceMax < form.priceMin) {
      setPriceError(translate("Harga maksimum harus ≥ harga minimum."))
      return
    }
    // S5: tolak harga maksimum tanpa minimum — rentang tak bermakna.
    if (form.priceMin == null && form.priceMax != null) {
      setPriceError(translate("Isi harga minimum dulu bila memakai harga maksimum."))
      return
    }
    // Batch 43: validasi field commerce.
    if (commerce.productType === "JASA" && commerce.serviceDeadlineDays == null) {
      toast.show({ title: translate("Produk jasa wajib memiliki tenggat pengerjaan."), tone: "danger" })
      return
    }
    const salePrice = form.priceMin ?? form.priceMax
    if (commerce.originalPriceIdr != null && salePrice != null && commerce.originalPriceIdr <= salePrice) {
      toast.show({ title: translate("Harga coret harus lebih besar dari harga jual."), tone: "danger" })
      return
    }
    saveBusy.current = true
    setSaving(true)
    const payload = { title, ...formToPayload(form) }
    // Benefit 7 Kahade+: deskripsi HTML disanitasi allowlist SEBELUM dikirim —
    // jangan pernah mengirim HTML mentah ketikan user ke backend.
    if (isPlusActive) payload.description = sanitizeShowcaseHtml(payload.description)
    try {
      // Idempotency-Key: mengirim ulang setelah timeout memakai kunci yang
      // SAMA, jadi karya tidak tercatat dua kali.
      // SH-F-006 (audit 2026-09-27): retry memakai kunci yang SAMA tetapi DTO
      // dibangun ulang dari form TERKINI — pengguna boleh mengedit form saat
      // status belum pasti; DTO basi percobaan pertama tidak boleh terkirim.
      // Kontrak final Tim A #2 (2026-09-28): bila ada video, SELURUH media
      // dikirim sebagai `media[]` (video wajib thumbnailFileKey+durationSec);
      // JANGAN campur dengan `imageFileKeys` (→ 400). Tanpa video, jalur
      // foto lama (`imageFileKeys`) tidak berubah.
      const hasVideo = previews.some((entry) => entry.video != null)
      const mediaPayload = hasVideo ? previewsToMediaInput(previews) : undefined
      createAttempt.current = resolveCreateAttempt(
        createAttempt.current?.key ?? null,
        () => ({
          ...payload,
          ...(mediaPayload ? { media: mediaPayload } : { imageFileKeys: previews.map((entry) => entry.fileKey) }),
        }),
        createIdempotencyKey,
      )
      const created = await api.users.createShowcase(createAttempt.current.dto, createAttempt.current.key)
      createAttempt.current = null
      pendingKeys.current = []
      // Batch 43: simpan field commerce via PATCH terpisah (endpoint create
      // tidak mengenal field ini). Kegagalan di sini TIDAK menggagalkan karya
      // yang sudah tersimpan — pengguna bisa lengkapi di Kelola Etalase.
      try {
        const updated = await api.commerce.updateProductCommerce(created.id, {
          productType: commerce.productType,
          originalPriceIdr: commerce.originalPriceIdr,
          serviceDeadlineDays: commerce.serviceDeadlineDays,
          digitalDeliveryInfo: commerce.digitalDeliveryInfo.trim() || undefined,
          scheduledAt: commerce.scheduledAt,
        })
        if (updated) setCommerceFieldsCache(created.id, updated)
      } catch {
        if (mounted.current && revision === getSessionRevision()) {
          toast.show({
            title: translate("Field commerce gagal disimpan"),
            description: translate("Etalase sudah tersimpan — lengkapi tipe produk & harga coret di Kelola Etalase."),
            tone: "warning",
            duration: 5000,
          })
        }
      }
      // S7: terbit sukses → hapus draft teks.
      // SH-02: matikan autosave TERLEBIH DULU — timer 1 dtk dari ketikan
      // terakhir tidak boleh menulis ulang draf karya yang sudah terbit.
      draftSuppressed.current = true
      void clearShowcaseDraft()
      if (!mounted.current || revision !== getSessionRevision()) return
      markShowcaseFeedDirty()
      // PERF-FIX (network P0): item baru membuat cache "Etalase Saya" basi —
      // invalidasi agar refresh saat kembali ke layar Kelola Etalase
      // mengunduh daftar terbaru (lihat refreshOnFocusStaleMs di
      // app/showcase-management.tsx).
      invalidateQueryPrefix("my-showcase")
      toast.show({ title: translate("Etalase ditambahkan"), tone: "success", duration: 3000 })
      // Jangan `router.back()` langsung di sini: dispatch expo-router
      // tertunda ke effect berikutnya, saat itu `saveBusy` sudah false dan
      // dialog "Buang karya ini?" akan terbuka. Tandai keluar disengaja;
      // effect `intentionalLeave` yang menavigasi setelah penjaga mati.
      setIntentionalLeave(true)
    } catch (error) {
      if (!mounted.current || revision !== getSessionRevision()) return
      // Hanya penolakan TEGAS yang aman dianggap belum tersimpan.
      const rejected = isApiError(error) && [400, 403, 404, 413, 422].includes(error.status ?? 0)
      if (rejected) createAttempt.current = null
      setUncertainCreate(!rejected)
      toast.show({ title: translate("Gagal menyimpan"), description: userMessage(error), tone: "danger" })
    } finally {
      saveBusy.current = false
      if (mounted.current) setSaving(false)
    }
  }, [failedAssets.length, form, previews, revision, toast, isPlusActive, commerce])

  const busy = uploading || saving

  return (
    <Screen
      edges={["top"]}
      scroll
      keyboardAvoiding
      padded={false}
      footer={
        <View className="gap-2">
          {/* C10 (batch 139): ringkasan error tepat di atas tombol terbit —
              pengguna tidak perlu mencari field yang salah satu per satu. */}
          <ValidationSummary
            errors={[titleError, photoError, priceRangeError].filter(
              (message): message is string => message != null,
            )}
          />
          {/* Audit 2026-10-08: footer SATU baris — ikon pratinjau (C11) +
              CTA terbit. Dulu tiga tombol penuh bertumpuk (~160px) menutup
              sepertiga layar kecil saat keyboard tertutup; "Batal" dibuang
              karena duplikat X header (keduanya `requestClose`, konfirmasi
              buang draf tetap sama). Pratinjau = ikon saja supaya CTA utama
              tidak terdesak pada font besar/320px. */}
          <View className="flex-row items-center gap-3">
            <IconButton
              icon={Eye}
              variant="secondary"
              size="md"
              accessibilityLabel={translate("Pratinjau")}
              accessibilityHint={translate("Lihat kartu etalase seperti yang akan tampil di feed")}
              disabled={busy || previews.length === 0}
              onPress={() => setPreviewVisible(true)}
            />
            <View className="min-w-0 flex-1">
              <Button
                variant="primary"
                fullWidth
                loading={saving}
                disabled={uploading || previews.length === 0}
                onPress={() => void handleSave()}
              >
                {translate("Terbitkan etalase")}
              </Button>
            </View>
          </View>
        </View>
      }
    >
      <Header title={translate("Etalase baru")} backKind="close" onBack={requestClose} />

      <View className="gap-6 px-5 pb-6 pt-4">
        {/* ── FOTO ── */}
        <View className="gap-3">
          <SectionHeader
            title={translate("Foto etalase")}
            action={
              <Badge>
                {translate("{x}/{y}", { x: previews.length, y: photoLimit })}
              </Badge>
            }
          />
          {previews.length ? (
            // FE-037: "foto pertama = cover" sebagai hint kecil sekali saja;
            // counter jadi badge angka di header; instruksi tahan-seret
            // dihapus (drag sudah discoverable dari UI DragSortList).
            <Text variant="caption" tone="secondary">
              {translate("Foto pertama menjadi cover.")}
            </Text>
          ) : (
            <Text variant="caption" tone="secondary">
              {translate("Paling banyak {x} foto", { x: photoLimit })}
            </Text>
          )}
          {previews.length > 0 ? (
            /*
             * C09 (batch 139): drag-reorder — tahan thumbnail lalu seret ke
             * posisi baru. Media pertama = sampul karya (aturan produk).
             */
            <DragSortList
              items={previews}
              getId={(preview) => preview.fileKey}
              columns="auto"
              cellWidth={88}
              cellHeight={88}
              gap={8}
              disabled={busy || uncertainCreate}
              onReorder={reorderPreview}
              cellStyle={{ width: 88, height: 88 }}
              renderItem={(preview, index, { dropTarget }) => {
                // Video: pratinjau memakai thumbnail backend + lencana play.
                const thumb = preview.video?.thumbnailUrl ?? preview.asset.uri
                const label = preview.video
                  ? translate("Video {x}", { x: index + 1 })
                  : translate("Foto {x}", { x: index + 1 })
                // A11y: pegangan seret adalah pratinjaunya sendiri — `accessible`
                // TIDAK di root sel, karena menelan tombol sampul/hapus di
                // dalamnya (pola sama dengan sheet media manajemen).
                return (
                  <View className="relative h-full w-full">
                    <View
                      accessible
                      accessibilityRole="button"
                      accessibilityLabel={translate("{x} — tahan lalu seret untuk mengubah urutan", { x: label })}
                    >
                      <Picture
                        source={thumb}
                        alt={label}
                        width={88}
                        height={88}
                        radius="sm"
                      />
                    </View>
                    {preview.video ? (
                      <View
                        className="absolute inset-0 items-center justify-center"
                        accessibilityElementsHidden
                        importantForAccessibility="no-hide-descendants"
                        style={{ pointerEvents: "none" }}
                      >
                        <View className="items-center justify-center rounded-full bg-overlay-media p-2">
                          <Icon icon={Play} size="sm" weight="fill" tone="inverse" />
                        </View>
                      </View>
                    ) : null}
                    {/* C09: sampul = media pertama — penanda di sampul aktif,
                        tombol bintang di lainnya untuk memindahkannya ke
                        posisi sampul. */}
                    {index === 0 ? (
                      <View className="absolute left-1 top-1 rounded-full bg-overlay-media px-1.5 py-0.5">
                        <Text variant="caption" weight={700} tone="inverse">
                          {translate("Sampul")}
                        </Text>
                      </View>
                    ) : (
                      <View className="absolute right-1 top-1">
                        <PressableScale
                          accessibilityRole="button"
                          accessibilityLabel={translate("Jadikan sampul: {x}", { x: label })}
                          accessibilityHint={translate("Pindahkan media ini ke posisi pertama sebagai sampul etalase")}
                          disabled={busy || uncertainCreate}
                          onPress={() => setAsCover(index)}
                          containerClassName="items-center justify-center rounded-full bg-overlay-media p-1.5"
                        >
                          <Icon icon={Star} size="sm" tone="inverse" />
                        </PressableScale>
                      </View>
                    )}
                    <View className="absolute bottom-1 right-1">
                      <PressableScale
                        accessibilityRole="button"
                        accessibilityLabel={translate("Hapus media {x}", { x: index + 1 })}
                        disabled={busy || uncertainCreate}
                        onPress={() => removePreview(index)}
                        containerClassName="items-center justify-center rounded-full bg-overlay-media p-1.5"
                      >
                        <Icon icon={Trash} size="sm" tone="inverse" />
                      </PressableScale>
                    </View>
                    {/* C09: penanda target drop — tanpa menggeser layout. */}
                    {dropTarget ? (
                      <View
                        className="pointer-events-none absolute inset-0 rounded-sm border-2 border-accent"
                        accessibilityElementsHidden
                        importantForAccessibility="no-hide-descendants"
                      />
                    ) : null}
                  </View>
                )
              }}
            />
          ) : (
            <EmptyState
              icon={Images}
              title={translate("Belum ada foto")}
              description={translate("Pilih foto produk atau hasil kerja Anda dari galeri.")}
            />
          )}

          <Button
            leftIcon={Plus}
            variant="secondary"
            loading={uploading}
            disabled={saving || previews.length >= photoLimit}
            onPress={() => void handlePickPhotos()}
          >
            {previews.length > 0 ? translate("Tambah foto") : translate("Pilih foto")}
          </Button>

          {/* Kontrak final Tim A #1 (2026-09-28): tambah video showcase. */}
          <Button
            leftIcon={VideoCamera}
            variant="secondary"
            disabled={uploading || saving || previews.length >= photoLimit}
            onPress={() => void handlePickVideo()}
            accessibilityHint={translate("Video diunggah dengan thumbnail otomatis")}
          >
            {translate("Tambah video")}
          </Button>

          {photoError ? (
            <Text tone="danger" accessibilityLiveRegion="polite">
              {photoError}
            </Text>
          ) : null}

          {uploading ? (
            <View className="gap-2">
              {/* S6: progress bar + teks "x dari y". */}
              <ProgressBar value={Math.round(uploadProgress * 100)} showValue accessibilityLabel={progress} />
              <Text accessibilityLiveRegion="polite" variant="caption" tone="secondary">
                {progress}
              </Text>
              <Button variant="ghost" onPress={() => uploadAbort.current?.abort()}>
                {translate("Batalkan unggahan")}
              </Button>
            </View>
          ) : null}

          {failedAssets.length > 0 ? (
            <View className="gap-2">
              <Text tone="danger">
                {translate("Foto berikut gagal diunggah. Coba lagi atau keluarkan dari pilihan sebelum menyimpan.")}
              </Text>
              {failedAssets.map((failed, index) => (
                <View key={`${failed.asset.uri}-${index}`} className="gap-1">
                  <Text>{failed.asset.name}</Text>
                  {/* BUG #2: tampilkan penyebab kegagalan per foto (pesan asli). */}
                  <Text variant="caption" tone="danger">
                    {failed.message}
                  </Text>
                  <Button
                    variant="ghost"
                    disabled={uploading}
                    onPress={() =>
                      setFailedAssets((entries) => entries.filter((_, i) => i !== index))
                    }
                  >
                    {translate("Keluarkan foto gagal")}
                  </Button>
                </View>
              ))}
              <Button loading={uploading} onPress={() => void retryFailedPhotos()}>
                {translate("Coba lagi foto gagal")}
              </Button>
            </View>
          ) : null}
        </View>

        {/* ── DETAIL ── */}
        <View className="gap-4">
          <SectionHeader title={translate("Detail etalase")} />

          {uncertainCreate ? (
            <View className="gap-2 rounded-md border border-border p-3">
              <Text tone="danger">
                {translate("Status simpan belum pasti. Coba Terbitkan lagi untuk melanjutkan permintaan yang sama, atau periksa daftar etalase Anda sebelum membuat etalase baru.")}
              </Text>
              <Button variant="secondary" onPress={() => setIntentionalLeave(true)}>
                {translate("Periksa daftar etalase")}
              </Button>
            </View>
          ) : null}

          <Input
            label={translate("Judul")}
            value={form.title}
            onChangeText={(text) => {
              setForm((current) => ({ ...current, title: text }))
              setTitleError(undefined)
            }}
            autoCapitalize="sentences"
            returnKeyType="next"
            maxLength={TITLE_MAX}
            errorText={titleError}
            required
            disabled={busy || uncertainCreate}
          />
          {/*
           * Benefit 7 Kahade+ ("custom etalase"): anggota aktif mendapat
           * editor deskripsi HTML (dengan pratinjau tersanitasi); pengguna
           * biasa tetap plaintext.
           */}
          {isPlusActive ? (
            <ShowcaseHtmlDescriptionEditor
              label={translate("Deskripsi")}
              value={form.description}
              onChangeText={(text) => setForm((current) => ({ ...current, description: text }))}
              maxLength={DESC_MAX}
              hint={translate("Eksklusif Kahade+: format teks dengan HTML ringan.")}
              disabled={busy || uncertainCreate}
            />
          ) : (
            <TextArea
              label={translate("Deskripsi")}
              value={form.description}
              onChangeText={(text) => setForm((current) => ({ ...current, description: text }))}
              maxLength={DESC_MAX}
              showCount
              rows={3}
              disabled={busy || uncertainCreate}
            />
          )}
          {/* S4 (audit 2026-09-26): kategori bukan lagi teks bebas — saran
              kategori populer dari server + tetap bisa ketik sendiri. */}
          <ShowcaseCategoryInput
            label={translate("Kategori (opsional)")}
            value={form.category}
            onChangeText={(text) => setForm((current) => ({ ...current, category: text }))}
            placeholder={translate("Jasa desain, kerajinan, digital…")}
            autoCapitalize="sentences"
            maxLength={CATEGORY_MAX}
            disabled={busy || uncertainCreate}
          />
          {/* Item 53 (FE-IMP-1): kondisi barang BARU/BEKAS. */}
          <ShowcaseConditionInput
            value={form.condition}
            onChange={(condition) => setForm((current) => ({ ...current, condition }))}
            disabled={busy || uncertainCreate}
          />
          <Input
            label={translate("Harga minimum (opsional)")}
            keyboardType="number-pad"
            // C10 (batch 139): tampilkan pemisah ribuan saat mengetik
            // ("1500000" → "1.500.000"); state tetap angka.
            value={formatRupiahTyping(form.priceMin)}
            onChangeText={(raw) => {
              const parsed = parseRupiahTyping(raw)
              // undefined = ketikan tak valid (negatif/huruf/>15 digit) — abaikan.
              if (parsed === undefined) return
              setForm((current) => ({ ...current, priceMin: parsed }))
              setPriceError(undefined)
            }}
            helperText={
              form.priceMin === 0
                ? translate("Harga {x} ditampilkan sebagai Gratis.", { x: 0 })
                : form.priceMin != null && form.priceMax == null
                  ? translate("Tanpa harga maksimum, ini ditampilkan sebagai harga pasti.")
                  : translate("Maksimal 15 digit; nilai negatif ditolak.")
            }
            disabled={busy || uncertainCreate}
          />
          <Input
            label={translate("Harga maksimum (opsional)")}
            keyboardType="number-pad"
            value={formatRupiahTyping(form.priceMax)}
            onChangeText={(raw) => {
              const parsed = parseRupiahTyping(raw)
              if (parsed === undefined) return
              setForm((current) => ({ ...current, priceMax: parsed }))
              setPriceError(undefined)
            }}
            // C10 (batch 139): validasi relasi min–maks LANGSUNG saat mengetik,
            // bukan hanya saat submit.
            errorText={priceError ?? priceRangeError}
            helperText={
              priceError ?? priceRangeError
                ? undefined
                : translate("Maksimal 15 digit; nilai negatif ditolak.")
            }
            disabled={busy || uncertainCreate}
          />
          {/* IMP-F-013: pratinjau label harga live — pengguna memverifikasi
              "Rp 1.500.000" (dengan pemisah ribuan) sebelum terbit. Satu baris
              teks, bukan redesign. */}
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
            disabled={busy || uncertainCreate}
          />

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
              onChange={(value) => setForm((current) => ({ ...current, isPublic: value }))}
              accessibilityLabel={translate("Tampilkan secara publik")}
              disabled={busy || uncertainCreate}
            />
          </View>

          {form.isPublic ? null : (
            <View className="flex-row items-start gap-2 rounded-md bg-surface p-3">
              <Icon icon={EyeSlash} size="sm" tone="default" />
              <Text variant="caption" tone="secondary" className="flex-1">
                {translate("Draf privat tetap tersimpan di etalase Anda dan bisa diterbitkan kapan saja.")}
              </Text>
            </View>
          )}
          {form.isPublic ? (
            <View className="flex-row items-start gap-2 rounded-md bg-surface p-3">
              <Icon icon={Eye} size="sm" tone="default" />
              <Text variant="caption" tone="secondary" className="flex-1">
                {translate("Karya langsung tampil di feed Etalase dan profil publik Anda.")}
              </Text>
            </View>
          ) : null}
        </View>

        {/*
          U5-013 (journey): kartu info pembayaran di form buat etalase —
          penjual paham sejak awal bahwa pembeli membayar via Kahade, bukan ke
          mereka langsung. Informatif, tidak mengubah alur.
        */}
        <View className="flex-row items-start gap-2 rounded-md bg-accent-soft p-3">
          <Icon icon={ShieldCheck} size="sm" tone="accent" />
          <Text variant="caption" tone="secondary" className="flex-1 text-pretty">
            {translate("Pembeli bayar via Kahade — kirim barang dulu, dana diteruskan ke Anda setelah pembeli konfirmasi terima.")}
          </Text>
        </View>

        <View style={{ height: tokens.space[4] }} />
      </View>

      <Dialog
        title={translate("Buang etalase ini?")}
        description={translate("Foto yang sudah diunggah dan ketikan Anda akan dibuang.")}
        visible={discardOpen}
        destructive
        confirmLabel={translate("Buang")}
        cancelLabel={translate("Lanjut mengedit")}
        onConfirm={confirmDiscard}
        onCancel={() => {
          pendingNavigation.current = null
          setDiscardOpen(false)
        }}
        onRequestClose={() => {
          pendingNavigation.current = null
          setDiscardOpen(false)
        }}
      />

      {/* S7: tawarkan lanjutkan draft teks yang tersimpan. */}
      <Dialog
        title={translate("Lanjutkan draft?")}
        description={translate("Ada ketikan etalase yang belum diterbitkan. Lanjutkan dari draft tersebut?")}
        visible={resumeDraft != null}
        confirmLabel={translate("Lanjutkan")}
        cancelLabel={translate("Buang draft")}
        onConfirm={() => {
          const d = resumeDraft
          if (d) {
            setForm({
              title: d.title,
              description: d.description,
              priceMin: d.priceMin,
              priceMax: d.priceMax,
              category: d.category,
              isPublic: d.isPublic,
              // Item 53: draft lama (sebelum field ini ada) → "".
              condition: d.condition === "BARU" || d.condition === "BEKAS" ? d.condition : "",
            })
          }
          setResumeDraft(null)
        }}
        onCancel={() => {
          // SH-02: sama — jangan biarkan timer autosave menulis ulang.
          draftSuppressed.current = true
          void clearShowcaseDraft()
          setResumeDraft(null)
        }}
        onRequestClose={() => setResumeDraft(null)}
      />

      {/* C11 (batch 139): pratinjau sebelum terbit — komponen kartu feed YANG
          SAMA (`ShowcaseFeedItem`, mode non-interaktif): media/aksi tidak
          membuka apa pun, judul/deskripsi sebagai teks biasa. */}
      <BottomSheet
        visible={previewVisible}
        onRequestClose={() => setPreviewVisible(false)}
        title={translate("Pratinjau etalase")}
        description={translate("Tampilan kartu etalase Anda di feed sebelum diterbitkan.")}
        footer={
          <View className="gap-2">
            <Button
              variant="primary"
              fullWidth
              loading={saving}
              disabled={uploading || previews.length === 0}
              onPress={() => {
                setPreviewVisible(false)
                void handleSave()
              }}
            >
              {translate("Terbitkan etalase")}
            </Button>
            <Button variant="ghost" fullWidth onPress={() => setPreviewVisible(false)}>
              {translate("Kembali edit")}
            </Button>
          </View>
        }
      >
        {previewItem ? <ShowcaseFeedItem item={previewItem} nonInteractive /> : null}
      </BottomSheet>
    </Screen>
  )
}
