/**
 * Kahade — unggah foto etalase SATU PINTU (audit D-04, 2026-09-23).
 *
 * Latar: layar manajemen dulu "menebak" kontrak POST
 * /v1/users/me/showcase/upload tiga cabang (`imageUrl ?? url ?? key ??
 * fileKey` — respons 201 spec sendiri TANPA schema), padahal DTO create
 * (`CreateShowcaseItemDto.imageFileKeys`) mendokumentasikan alur resminya:
 * presigned URL → PUT objek → POST /upload/confirm → pakai fileKey.
 *
 * Kebijakan di sini:
 *   1. UTAMA: `api.upload.uploadPresigned("SHOWCASE_IMAGE", …)` — satu-satunya
 *      alur yang dijamin menghasilkan key ter-konfirmasi sesuai DTO.
 *   2. FALLBACK: multipart /upload lama — respons dibaca satu cabang
 *      `fileKey ?? key` (bukan empat tebakan) + komentar bahwa bentuk item
 *      utuh (`res.id`) ditangani pemanggil. Dipakai hanya bila presigned
 *      tidak tersedia (mis. kontrak backend belum mengaktifkan purpose
 *      SHOWCASE_IMAGE → 400/404/VALIDATION).
 *   3. ORPHAN (D-09): bila key sudah terunggah tapi langkah BERIKUTNYA
 *      gagal, pemanggil memanggil `cleanupPendingShowcaseKeys` (best-effort)
 *      agar file tidak menggantung permanen di storage.
 */
import { api, isApiError } from "@/lib/api"
import type { PickedImage } from "@/lib/image-picker"
import { pickedImageToBlob, pickedImageToFormData } from "@/lib/image-picker"

export type ShowcaseUploadOutcome =
  /** Hanya fileKey — lanjut ke create/attach dengan imageFileKeys. */
  | { kind: "fileKey"; fileKey: string }
  /** Respons multipart langsung berupa item utuh (backend membuat item). */
  | { kind: "item"; itemId: string; title?: string | null }

/** Apakah error layak memicu fallback multipart (presigned tidak didukung). */
function shouldFallbackToMultipart(err: unknown): boolean {
  return (
    isApiError(err) &&
    (err.status === 400 ||
      err.status === 404 ||
      err.status === 405 ||
      err.status === 501 ||
      err.code === "VALIDATION")
  )
}

/**
 * Unggah satu foto etalase. Melempar error pada kegagalan — toast/copy
 * milik pemanggil.
 */
export async function uploadShowcasePhoto(asset: PickedImage): Promise<ShowcaseUploadOutcome> {
  try {
    const blob = await pickedImageToBlob(asset)
    const { fileKey } = await api.upload.uploadPresigned(
      "SHOWCASE_IMAGE",
      asset.name,
      asset.mimeType,
      blob,
    )
    return { kind: "fileKey", fileKey }
  } catch (err) {
    if (!shouldFallbackToMultipart(err)) throw err
  }
  /**
   * Fallback terukur: multipart legacy. Dibaca SATU cabang key — bentuk item
   * utuh (`{id, title}`) MASIH didukung karena backend saat ini memang
   * melakukannya (lihat komentar di app/showcase-management.tsx D-01).
   */
  const res = (await api.users.uploadShowcase(
    await pickedImageToFormData(asset),
  )) as Record<string, unknown> | null | undefined
  const id = typeof res?.id === "string" ? (res.id as string) : null
  if (id) {
    return { kind: "item", itemId: id, title: typeof res?.title === "string" ? (res.title as string) : null }
  }
  const fileKey =
    (typeof res?.fileKey === "string" && (res.fileKey as string)) ||
    (typeof res?.key === "string" && (res.key as string)) ||
    null
  if (!fileKey) {
    throw new Error("Unggahan foto tidak menghasilkan kunci berkas.")
  }
  return { kind: "fileKey", fileKey }
}

/**
 * D-09: bersihkan key-file yang sudah terunggah tapi batal dipakai
 * (create/attach gagal). Best-effort — kegagalan cleanup tidak pernah
 * menggagalkan aksi pengguna; key dibatalkan via /v1/upload/cleanup.
 */
export async function cleanupPendingShowcaseKeys(fileKeys: string[]): Promise<void> {
  if (fileKeys.length === 0) return
  try {
    await api.upload.cleanupUploads(fileKeys)
  } catch {
    // sunyi: cleanup adalah mitigasi sampah storage, bukan aksi pengguna.
  }
}
