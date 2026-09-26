/**
 * Kahade — pemilih gambar (kamera/galeri) + konversi ke bentuk yang diterima
 * endpoint upload.
 *
 * Satu tempat untuk pola yang sebelumnya ditulis ulang di setup-profile,
 * showcase, KYC, dan sengketa: minta izin → buka picker → ambil asset →
 * bungkus jadi FormData (endpoint `/direct`) atau Blob (legacy).
 *
 * Keputusan non-obvious:
 *   - Izin hanya diminta di native; di web expo-image-picker memakai
 *     <input type="file"> yang tidak punya permission API.
 *   - Hasil "denied" dibedakan dari "cancelled": pemanggil menampilkan toast
 *     "Izin ditolak" hanya untuk yang pertama — batal memilih bukan error.
 *   - `mimeType`/`fileSize` diambil dari asset bila ada; fallback hanya bila
 *     platform tidak mengisinya (Android lama). Jangan mengirim `size: 0`
 *     ke <UploadField> — ukuran dipakai untuk label & validasi batas.
 *   - Di web, FormData tidak menerima objek `{ uri }` — file di-fetch ke
 *     Blob dulu. Di native sebaliknya: `{ uri, name, type }` adalah bentuk
 *     yang dikenali jembatan multipart RN.
 */
import * as ImagePicker from "expo-image-picker"
import { Platform } from "react-native"
import { ApiError } from "@/lib/api/errors"

export type PickedImage = {
  uri: string
  name: string
  mimeType: string
  /** Byte; 0 hanya bila platform tidak melaporkan ukuran */
  size: number
  width?: number
  height?: number
}

export type PickImageResult =
  | { status: "picked"; asset: PickedImage }
  | { status: "cancelled" }
  | { status: "denied" }

export type PickImageOptions = {
  source?: "library" | "camera"
  /** Crop persegi (avatar) */
  square?: boolean
  /**
   * Rasio crop [lebar, tinggi] saat `allowsEditing`. `square` adalah shortcut
   * [1, 1]; `aspect` dipakai gambar yang bentuk tampilannya bukan persegi —
   * foto sampul profil (16:6) misalnya. Diabaikan bila keduanya kosong.
   */
  aspect?: readonly [number, number]
  allowsEditing?: boolean
  /** 0–1, default 0.7 (§9.19: klien mengirim JPG terkompresi) */
  quality?: number
  /**
   * R2 (audit ronde-2, butir #34): sertakan video dalam pemilih (bukti
   * sengketa/pengiriman — kontrak mendukung video/mp4|quicktime|webm).
   * OPT-IN agar avatar/sampul/profil tidak ikut berubah perilaku.
   * `allowsEditing` diabaikan untuk video oleh expo-image-picker.
   */
  allowVideos?: boolean
}

const DEFAULT_MIME = "image/jpeg"
const DEFAULT_QUALITY = 0.7

function toPicked(asset: ImagePicker.ImagePickerAsset, fallbackName: string): PickedImage {
  // R2 (butir #34): MIME fallback mengikuti JENIS aset — video yang tidak
  // melaporkan mimeType (Android lama) tidak boleh dilabeli image/jpeg.
  const isVideo = asset.type === "video"
  return {
    uri: asset.uri,
    name: asset.fileName ?? fallbackName,
    mimeType: asset.mimeType ?? (isVideo ? "video/mp4" : DEFAULT_MIME),
    size: asset.fileSize ?? 0,
    width: asset.width,
    height: asset.height,
  }
}

export async function pickImage(opts: PickImageOptions = {}): Promise<PickImageResult> {
  const source = opts.source ?? "library"

  if (Platform.OS !== "web") {
    const perm =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) return { status: "denied" }
  }

  const pickerOptions: ImagePicker.ImagePickerOptions = {
    mediaTypes: opts.allowVideos ? ["images", "videos"] : ["images"],
    allowsEditing: opts.allowsEditing ?? opts.square ?? false,
    aspect: opts.square
      ? [1, 1]
      : opts.aspect
        ? [opts.aspect[0], opts.aspect[1]]
        : undefined,
    quality: opts.quality ?? DEFAULT_QUALITY,
  }

  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync(pickerOptions)
      : await ImagePicker.launchImageLibraryAsync(pickerOptions)

  const asset = result.canceled ? null : (result.assets[0] ?? null)
  if (!asset) return { status: "cancelled" }
  return {
    status: "picked",
    asset: toPicked(
      asset,
      asset.type === "video" ? `video-${Date.now()}.mp4` : `image-${Date.now()}.jpg`,
    ),
  }
}

/** Blob dari asset lokal (legacy — `uploadPresigned` sudah dimatikan backend).
 * Android: `fetch(file://)` / `content://` tidak andal di Hermes/new-arch,
 * jadi coba fetch dulu lalu fallback ke expo-file-system (File API) yang
 * membaca byte langsung. Mime dipertahankan dari PickedImage.
 */
export async function pickedImageToBlob(img: PickedImage): Promise<Blob> {
  if (Platform.OS === "web") {
    return (await fetch(img.uri)).blob()
  }
  // Coba fetch biasa – berhasil di iOS dan sebagian Android file://
  try {
    const res = await fetch(img.uri)
    if (res.ok) {
      const blob = await res.blob()
      // Beberapa Android mengembalikan blob size 0 untuk content:// walau ok
      if (blob.size > 0) {
        // Pastikan type terisi
        if (!blob.type && img.mimeType) {
          return new Blob([blob], { type: img.mimeType })
        }
        return blob
      }
    }
  } catch {}
  // Fallback: baca via expo-file-system (mendukung file:// & content://)
  try {
    const { File } = await import("expo-file-system")
    const file = new File(img.uri)
    // File API baru (SDK 54) – cek exists lalu baca bytes
    // Fallback ke readAsStringAsync base64 jika bytes tidak tersedia
    if (typeof (file as unknown as { exists?: boolean }).exists === "boolean") {
      if (!(file as unknown as { exists: boolean }).exists) throw new Error("file not exists")
    }
    // Coba bytes()
    const maybeBytes = (file as unknown as { bytes?: () => Promise<Uint8Array> }).bytes
    if (typeof maybeBytes === "function") {
      const bytes = await maybeBytes.call(file)
      return new Blob([bytes as unknown as BlobPart], { type: img.mimeType })
    }
    // Fallback lama: base64
    const { readAsStringAsync } = await import("expo-file-system/legacy")
    const base64 = await (readAsStringAsync as unknown as (uri: string, opts: { encoding: string }) => Promise<string>)(img.uri, { encoding: "base64" } as never)
    const binary = atob(base64)
    const len = binary.length
    const bytes = new Uint8Array(len)
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i)
    return new Blob([bytes], { type: img.mimeType })
  } catch {}
  // Terakhir: coba fetch lagi – biar error asli keluar
  return (await fetch(img.uri)).blob()
}

export type PickImagesResult =
  | { status: "picked"; assets: PickedImage[] }
  | { status: "cancelled" }
  | { status: "denied" }

/**
 * Pilih BANYAK gambar sekaligus (audit D-11: etalase dulu satu-per-satu —
 * 8 foto = 16 interaksi). Tanpa crop (`allowsMultipleSelection` tidak bisa
 * digabung `allowsEditing` di expo-image-picker) — karya portrait/landscape
 * tidak lagi dipotong paksa 1:1; kartu/grid tetap membungkus visual persegi.
 */
export async function pickImages(opts: {
  /** Maksimum aset yang boleh dipilih (default 8). 1 = perilaku single. */
  selectionLimit?: number
  quality?: number
} = {}): Promise<PickImagesResult> {
  if (Platform.OS !== "web") {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) return { status: "denied" }
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsMultipleSelection: true,
    selectionLimit: Math.max(1, opts.selectionLimit ?? 8),
    quality: opts.quality ?? DEFAULT_QUALITY,
  })
  if (result.canceled) return { status: "cancelled" }
  const assets = (result.assets ?? []).map((asset, index) =>
    toPicked(asset, `image-${Date.now()}-${index}.jpg`),
  )
  if (assets.length > Math.max(1, opts.selectionLimit ?? 8)) {
    // G-05 (audit 2026-09-23): ApiError — `userMessage` meneruskan pesan ini
    // apa adanya. Error biasa ditelan jadi "Terjadi kesalahan. Coba lagi."
    throw new ApiError({
      code: "VALIDATION",
      message: `Pilih maksimal ${Math.max(1, opts.selectionLimit ?? 8)} foto.`,
    })
  }
  if (assets.length === 0) return { status: "cancelled" }
  return { status: "picked", assets }
}

/**
 * FormData multipart untuk endpoint `/direct` (avatar, showcase). Nama field
 * default `file` sesuai kontrak upload langsung.
 */
export async function pickedImageToFormData(img: PickedImage, field = "file"): Promise<FormData> {
  const form = new FormData()
  if (Platform.OS === "web") {
    form.append(field, await pickedImageToBlob(img), img.name)
  } else {
    form.append(field, { uri: img.uri, name: img.name, type: img.mimeType } as unknown as Blob)
  }
  return form
}
