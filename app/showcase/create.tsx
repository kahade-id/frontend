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
import { useCallback, useEffect, useRef, useState } from "react"
import { Linking, Platform, View } from "react-native"
import { useNavigation, usePreventRemove, type NavigationAction } from "@react-navigation/native"
import { useRouter } from "expo-router"
import {
  CaretLeft,
  CaretRight,
  Eye,
  EyeSlash,
  Images,
  Plus,
  Trash,
} from "phosphor-react-native"

import { api, isApiError, userMessage } from "@/lib/api"
import { createIdempotencyKey } from "@/lib/api/client"
import type { CreateShowcaseItemDto } from "@/lib/api/types"
import { API_CONSTRAINTS } from "@/lib/api/constraints"
import { getSessionRevision } from "@/lib/api/session"
import { useSessionRevision } from "@/lib/guest-gate"
import { pickImages, type PickedImage } from "@/lib/image-picker"
import { markShowcaseFeedDirty } from "@/lib/showcase-social-prefs"
import { SHOWCASE_MAX_IMAGES, SHOWCASE_IMAGE_MAX_BYTES } from "@/lib/showcase-limits"
import { cleanupPendingShowcaseKeys, uploadShowcasePhoto } from "@/lib/showcase-upload"
import {
  saveShowcaseDraft,
  loadShowcaseDraft,
  clearShowcaseDraft,
  isDraftMeaningful,
  type ShowcaseDraft,
} from "@/lib/showcase-draft"
import { tokens } from "@/lib/tokens"
import { translate } from "@/lib/i18n/translate"
import { useLanguage } from "@/lib/i18n"

import { Button } from "@/components/ui/button"
import { ProgressBar } from "@/components/ui/progress-bar"
import { Dialog } from "@/components/ui/modal"
import { EmptyState } from "@/components/ui/empty-state"
import { Header } from "@/components/ui/header"
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { Input } from "@/components/ui/input"
import { Picture } from "@/components/ui/picture"
import { Screen } from "@/components/ui/screen"
import { SectionHeader } from "@/components/ui/section"
import { ShowcaseCategoryInput } from "@/components/ui/showcase-category-input"
import { Switch } from "@/components/ui/switch"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"
import { useToast } from "@/components/ui/toast"

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
}

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  priceMin: null,
  priceMax: null,
  category: "",
  isPublic: true,
}

type Preview = { fileKey: string; asset: PickedImage }

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
  }
}

export default function ShowcaseCreateScreen() {
  // i18n: label mengikuti bahasa aktif.
  useLanguage()
  const router = useRouter()
  const navigation = useNavigation()

  // S7: cek draft tersimpan saat layar dibuka — tawarkan lanjutkan.
  // (Dijalankan sekali; guard ref supaya StrictMode double-effect aman.)
  const draftChecked = useRef(false)
  const toast = useToast()
  const revision = useSessionRevision()

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  // T2 (audit 2026-09-26): error per field — satu `formError` membuat pesan
  // foto/harga menempel di input yang salah.
  const [titleError, setTitleError] = useState<string | undefined>()
  const [photoError, setPhotoError] = useState<string | undefined>()
  const [priceError, setPriceError] = useState<string | undefined>()
  const [previews, setPreviews] = useState<Preview[]>([])
  const [failedAssets, setFailedAssets] = useState<PickedImage[]>([])
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
      const meaningful =
        form.title.trim() || form.description.trim() || form.category.trim() ||
        form.priceMin != null || form.priceMax != null
      if (!meaningful) return
      void saveShowcaseDraft({
        title: form.title,
        description: form.description,
        category: form.category,
        priceMin: form.priceMin,
        priceMax: form.priceMax,
        isPublic: form.isPublic,
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
  const createAttempt = useRef<{ key: string; dto: CreateShowcaseItemDto } | null>(null)
  const uploadAbort = useRef<AbortController | null>(null)
  const uploadBusy = useRef(false)
  const saveBusy = useRef(false)
  const mounted = useRef(true)
  const pendingNavigation = useRef<NavigationAction | null>(null)

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

  const dirty =
    previews.length > 0 || JSON.stringify(form) !== JSON.stringify(EMPTY_FORM)

  /** Foto + ketikan belum tersimpan — minta konfirmasi sebelum keluar. */
  const requestClose = useCallback(() => {
    if (saveBusy.current || uploadBusy.current) return
    if (dirty) setDiscardOpen(true)
    else router.back()
  }, [dirty, router])

  const confirmDiscard = useCallback(() => {
    void cleanupPendingShowcaseKeys(pendingKeys.current)
    pendingKeys.current = []
    // S7: buang juga draft teks yang tersimpan.
    void clearShowcaseDraft()
    setDiscardOpen(false)
    // Jangan dispatch di sini: penjaga masih aktif sampai commit berikutnya
    // dan `beforeRemove` akan membuka dialog lagi. Effect `intentionalLeave`
    // yang mengeksekusi navigasi tertunda (aksi tersimpan dibaca di sana).
    setIntentionalLeave(true)
  }, [])

  usePreventRemove(dirty && !intentionalLeave, ({ data }) => {
    if (saveBusy.current || uploadBusy.current) return
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
    else router.back()
  }, [intentionalLeave, navigation, router])

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
    const slots = SHOWCASE_MAX_IMAGES - previews.length
    if (slots <= 0) {
      toast.show({
        title: translate("Foto sudah penuh"),
        description: translate("Satu karya dapat memuat paling banyak {x} foto.", {
          x: SHOWCASE_MAX_IMAGES,
        }),
        tone: "info",
      })
      return
    }
    uploadBusy.current = true
    const controller = new AbortController()
    uploadAbort.current = controller
    const uploaded: Preview[] = []
    const failures: PickedImage[] = []
    try {
      const picked = await pickImages({ selectionLimit: slots })
      if (picked.status === "denied") {
        toast.show({
          title: translate("Akses galeri ditolak"),
          description: translate("Izinkan akses foto di pengaturan perangkat untuk memilih karya."),
          tone: "danger",
          action: { label: translate("Buka pengaturan"), onPress: () => void Linking.openSettings() },
        })
        return
      }
      if (picked.status !== "picked" || controller.signal.aborted) return
      // S6: validasi ukuran SEBELUM upload — maks 5MB (selaras backend
      // UploadPurpose.SHOWCASE_IMAGE). Tampilkan nama file yang ditolak.
      const tooBig = picked.assets.filter((a) => (a.size ?? 0) > SHOWCASE_IMAGE_MAX_BYTES)
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
      // S6: upload konkuren maks 2 — lebih cepat dari sekuensial, tetap ramah
      // memori/jaringan dibanding Promise.all tak terbatas.
      const CONCURRENCY = 2
      let completed = 0
      const bump = () => {
        completed += 1
        setUploadProgress(completed / picked.assets.length)
        setProgress(
          translate("Mengunggah foto {x} dari {y}", {
            x: completed,
            y: picked.assets.length,
          }),
        )
      }
      const queue = [...picked.assets]
      const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
        while (queue.length > 0) {
          if (controller.signal.aborted) return
          const asset = queue.shift()!
          try {
            const outcome = await uploadShowcasePhoto(asset, controller.signal)
            uploaded.push({ fileKey: outcome.fileKey, asset })
          } catch {
            if (controller.signal.aborted) throw new Error("aborted")
            failures.push(asset)
          } finally {
            bump()
          }
        }
      })
      await Promise.all(workers)
      if (controller.signal.aborted || revision !== getSessionRevision()) {
        void cleanupPendingShowcaseKeys(uploaded.map((entry) => entry.fileKey))
        return
      }
      const next = [...previews, ...uploaded]
      pendingKeys.current = next.map((entry) => entry.fileKey)
      setPreviews(next)
      setPhotoError(undefined)
      setFailedAssets((current) => [...current, ...failures])
    } catch (error) {
      void cleanupPendingShowcaseKeys(uploaded.map((entry) => entry.fileKey))
      if (!controller.signal.aborted && mounted.current) {
        toast.show({ title: translate("Gagal mengunggah foto"), description: userMessage(error), tone: "danger" })
      }
    } finally {
      uploadBusy.current = false
      if (uploadAbort.current === controller) uploadAbort.current = null
      if (mounted.current) {
        setUploading(false)
        setProgress("")
      }
    }
  }, [previews, revision, toast])

  const retryFailedPhotos = useCallback(async () => {
    if (uploadBusy.current || saveBusy.current || failedAssets.length === 0) return
    uploadBusy.current = true
    setUploading(true)
    const controller = new AbortController()
    uploadAbort.current = controller
    const next = [...previews]
    const failures: PickedImage[] = []
    try {
      for (const [index, asset] of failedAssets.entries()) {
        setProgress(
          translate("Mengunggah foto {x} dari {y}", {
            x: index + 1,
            y: failedAssets.length,
          }),
        )
        try {
          const result = await uploadShowcasePhoto(asset, controller.signal)
          next.push({ fileKey: result.fileKey, asset })
        } catch {
          failures.push(asset)
        }
      }
      if (!mounted.current || revision !== getSessionRevision()) {
        void cleanupPendingShowcaseKeys(next.slice(previews.length).map((entry) => entry.fileKey))
        return
      }
      pendingKeys.current = next.map((entry) => entry.fileKey)
      setPreviews(next)
      setPhotoError(undefined)
      setFailedAssets(failures)
    } finally {
      uploadBusy.current = false
      uploadAbort.current = null
      if (mounted.current) {
        setUploading(false)
        setProgress("")
      }
    }
  }, [failedAssets, previews, revision])

  /** Geser atau buang satu foto pratinjau (indeks 0 = cover). */
  const movePreview = useCallback(
    (index: number, direction: -1 | 0 | 1) => {
      if (uploadBusy.current || saveBusy.current || uncertainCreate) return
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
    },
    [previews, uncertainCreate],
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
      setPhotoError(translate("Pilih minimal satu foto karya."))
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
    saveBusy.current = true
    setSaving(true)
    const payload = { title, ...formToPayload(form) }
    try {
      // Idempotency-Key: mengirim ulang setelah timeout memakai kunci yang
      // SAMA, jadi karya tidak tercatat dua kali.
      createAttempt.current ??= {
        key: createIdempotencyKey(),
        dto: { ...payload, imageFileKeys: previews.map((entry) => entry.fileKey) },
      }
      await api.users.createShowcase(createAttempt.current.dto, createAttempt.current.key)
      createAttempt.current = null
      pendingKeys.current = []
      // S7: terbit sukses → hapus draft teks.
      void clearShowcaseDraft()
      if (!mounted.current || revision !== getSessionRevision()) return
      markShowcaseFeedDirty()
      toast.show({ title: translate("Karya ditambahkan"), tone: "success", duration: 3000 })
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
  }, [failedAssets.length, form, previews, revision, toast])

  const busy = uploading || saving

  return (
    <Screen
      edges={["top"]}
      scroll
      keyboardAvoiding
      padded={false}
      footer={
        <View className="gap-2">
          <Button
            variant="primary"
            fullWidth
            loading={saving}
            disabled={uploading || previews.length === 0}
            onPress={() => void handleSave()}
          >
            Terbitkan karya
          </Button>
          <Button variant="ghost" fullWidth disabled={busy} onPress={requestClose}>
            Batal
          </Button>
        </View>
      }
    >
      <Header title="Karya baru" backKind="close" onBack={requestClose} />

      <View className="gap-6 px-5 pb-6 pt-4">
        {/* ── FOTO ── */}
        <View className="gap-3">
          <SectionHeader
            title="Foto karya"
            subtitle={
              previews.length
                ? translate("Foto pertama menjadi cover · {x}/{y} foto", {
                    x: previews.length,
                    y: SHOWCASE_MAX_IMAGES,
                  })
                : translate("Paling banyak {x} foto", { x: SHOWCASE_MAX_IMAGES })
            }
          />
          {previews.length > 0 ? (
            <View className="flex-row flex-wrap gap-2">
              {previews.map((preview, index) => (
                <View key={preview.fileKey} className="gap-1">
                  <Picture
                    source={preview.asset.uri}
                    alt={translate("Foto {x}", { x: index + 1 })}
                    width={88}
                    height={88}
                    radius="sm"
                  />
                  <View className="flex-row items-center justify-between">
                    <IconButton
                      icon={CaretLeft}
                      size="sm"
                      variant="ghost"
                      accessibilityLabel={translate("Geser foto {x} ke kiri", { x: index + 1 })}
                      disabled={busy || uncertainCreate || index === 0}
                      onPress={() => movePreview(index, -1)}
                    />
                    <IconButton
                      icon={Trash}
                      size="sm"
                      variant="ghost"
                      accessibilityLabel={translate("Hapus foto {x}", { x: index + 1 })}
                      disabled={busy || uncertainCreate}
                      onPress={() => movePreview(index, 0)}
                    />
                    <IconButton
                      icon={CaretRight}
                      size="sm"
                      variant="ghost"
                      accessibilityLabel={translate("Geser foto {x} ke kanan", { x: index + 1 })}
                      disabled={busy || uncertainCreate || index === previews.length - 1}
                      onPress={() => movePreview(index, 1)}
                    />
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <EmptyState
              icon={Images}
              title="Belum ada foto"
              description="Pilih foto produk atau hasil kerja Anda dari galeri."
            />
          )}

          <Button
            leftIcon={Plus}
            variant="secondary"
            loading={uploading}
            disabled={saving || previews.length >= SHOWCASE_MAX_IMAGES}
            onPress={() => void handlePickPhotos()}
          >
            {previews.length > 0 ? "Tambah foto" : "Pilih foto"}
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
                Batalkan unggahan
              </Button>
            </View>
          ) : null}

          {failedAssets.length > 0 ? (
            <View className="gap-2">
              <Text tone="danger">
                Foto berikut gagal diunggah. Coba lagi atau keluarkan dari pilihan sebelum
                menyimpan.
              </Text>
              {failedAssets.map((asset, index) => (
                <View key={`${asset.uri}-${index}`} className="gap-1">
                  <Text>{asset.name}</Text>
                  <Button
                    variant="ghost"
                    disabled={uploading}
                    onPress={() =>
                      setFailedAssets((entries) => entries.filter((_, i) => i !== index))
                    }
                  >
                    Keluarkan foto gagal
                  </Button>
                </View>
              ))}
              <Button loading={uploading} onPress={() => void retryFailedPhotos()}>
                Coba lagi foto gagal
              </Button>
            </View>
          ) : null}
        </View>

        {/* ── DETAIL ── */}
        <View className="gap-4">
          <SectionHeader title="Detail karya" subtitle="Judul, kategori, dan harga membantu calon pembeli memahami penawaran Anda." />

          {uncertainCreate ? (
            <View className="gap-2 rounded-md border border-border p-3">
              <Text tone="danger">
                Status simpan belum pasti. Coba Terbitkan lagi untuk melanjutkan permintaan yang
                sama, atau periksa daftar etalase Anda sebelum membuat karya baru.
              </Text>
              <Button variant="secondary" onPress={() => setIntentionalLeave(true)}>
                Periksa daftar etalase
              </Button>
            </View>
          ) : null}

          <Input
            label="Judul"
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
          <TextArea
            label="Deskripsi"
            value={form.description}
            onChangeText={(text) => setForm((current) => ({ ...current, description: text }))}
            maxLength={DESC_MAX}
            showCount
            rows={3}
            disabled={busy || uncertainCreate}
          />
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
          <Input
            label="Harga minimum (opsional)"
            keyboardType="number-pad"
            value={form.priceMin == null ? "" : String(form.priceMin)}
            maxLength={15}
            onChangeText={(raw) => {
              // S4: terima paste "1.000.000" / "1,000,000" — buang pemisah ribuan.
              const digits = raw.replace(/[.\s,]/g, "")
              if (!/^\d*$/.test(digits)) return
              const value = digits === "" ? null : Number(digits)
              setForm((current) => ({ ...current, priceMin: value }))
              setPriceError(undefined)
            }}
            helperText={
              form.priceMin === 0
                ? translate("Harga {x} ditampilkan sebagai Gratis.", { x: 0 })
                : form.priceMin != null && form.priceMax == null
                  ? "Tanpa harga maksimum, ini ditampilkan sebagai harga pasti."
                  : undefined
            }
            disabled={busy || uncertainCreate}
          />
          <Input
            label="Harga maksimum (opsional)"
            keyboardType="number-pad"
            value={form.priceMax == null ? "" : String(form.priceMax)}
            maxLength={15}
            onChangeText={(raw) => {
              // S4: terima paste "1.000.000" / "1,000,000" — buang pemisah ribuan.
              const digits = raw.replace(/[.\s,]/g, "")
              if (!/^\d*$/.test(digits)) return
              const value = digits === "" ? null : Number(digits)
              setForm((current) => ({ ...current, priceMax: value }))
              setPriceError(undefined)
            }}
            errorText={priceError}
            disabled={busy || uncertainCreate}
          />

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
              onChange={(value) => setForm((current) => ({ ...current, isPublic: value }))}
              accessibilityLabel={translate("Tampilkan secara publik")}
              disabled={busy || uncertainCreate}
            />
          </View>

          {form.isPublic ? null : (
            <View className="flex-row items-start gap-2 rounded-md bg-surface p-3">
              <Icon icon={EyeSlash} size="sm" tone="default" />
              <Text variant="caption" tone="secondary" className="flex-1">
                Draf privat tetap tersimpan di etalase Anda dan bisa diterbitkan kapan saja.
              </Text>
            </View>
          )}
          {form.isPublic ? (
            <View className="flex-row items-start gap-2 rounded-md bg-surface p-3">
              <Icon icon={Eye} size="sm" tone="default" />
              <Text variant="caption" tone="secondary" className="flex-1">
                Karya langsung tampil di feed Etalase dan profil publik Anda.
              </Text>
            </View>
          ) : null}
        </View>

        <View style={{ height: tokens.space[4] }} />
      </View>

      <Dialog
        title="Buang karya ini?"
        description="Foto yang sudah diunggah dan ketikan Anda akan dibuang."
        visible={discardOpen}
        destructive
        confirmLabel="Buang"
        cancelLabel="Lanjut mengedit"
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
        title="Lanjutkan draft?"
        description="Ada ketikan karya yang belum diterbitkan. Lanjutkan dari draft tersebut?"
        visible={resumeDraft != null}
        confirmLabel="Lanjutkan"
        cancelLabel="Buang draft"
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
            })
          }
          setResumeDraft(null)
        }}
        onCancel={() => {
          void clearShowcaseDraft()
          setResumeDraft(null)
        }}
        onRequestClose={() => setResumeDraft(null)}
      />
    </Screen>
  )
}
