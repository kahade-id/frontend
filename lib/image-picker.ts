/**
 * Kahade — pemilih gambar (kamera/galeri) + konversi ke bentuk yang diterima
 * endpoint upload.
 *
 * Satu tempat untuk pola yang sebelumnya ditulis ulang di setup-profile,
 * showcase, KYC, dan sengketa: minta izin → buka picker → ambil asset →
 * bungkus jadi FormData (endpoint `/direct`) atau Blob (`uploadPresigned`).
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
  allowsEditing?: boolean
  /** 0–1, default 0.7 (§9.19: klien mengirim JPG terkompresi) */
  quality?: number
}

const DEFAULT_MIME = "image/jpeg"
const DEFAULT_QUALITY = 0.7

function toPicked(asset: ImagePicker.ImagePickerAsset, fallbackName: string): PickedImage {
  return {
    uri: asset.uri,
    name: asset.fileName ?? fallbackName,
    mimeType: asset.mimeType ?? DEFAULT_MIME,
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
    mediaTypes: ["images"],
    allowsEditing: opts.allowsEditing ?? opts.square ?? false,
    aspect: opts.square ? [1, 1] : undefined,
    quality: opts.quality ?? DEFAULT_QUALITY,
  }

  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync(pickerOptions)
      : await ImagePicker.launchImageLibraryAsync(pickerOptions)

  const asset = result.canceled ? null : (result.assets[0] ?? null)
  if (!asset) return { status: "cancelled" }
  return { status: "picked", asset: toPicked(asset, `image-${Date.now()}.jpg`) }
}

/** Blob untuk `api.upload.uploadPresigned` (PUT ke presigned URL). */
export async function pickedImageToBlob(img: PickedImage): Promise<Blob> {
  return (await fetch(img.uri)).blob()
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
