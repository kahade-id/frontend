/**
 * Kahade — orkestrasi terbitkan story (unggah media → buat story) di LATAR.
 *
 * Dipisah dari layar buat story (2026-10-10) karena layar itu langsung
 * ditutup setelah "Bagikan": pekerjaan harus hidup lebih lama dari komponen.
 *
 * Perilaku:
 *   - Entri optimistis masuk ke tray (`addPendingStoryLocal`) dengan progress
 *     byte jujur dari transport upload — video 50 MB tidak terlihat "macet".
 *   - GAGAL = TIDAK dibuang. Entri menjadi `failed` dengan pesan spesifik
 *     (`uploadMessage`: offline terverifikasi / koneksi lambat / 413 menyebut
 *     batas / 415 format), dan draft + aset disimpan di memori proses supaya
 *     tray bisa menawarkan "Coba lagi" tanpa menyusun ulang story. Sebelumnya
 *     kegagalan di menit ke-8 unggah video membuang semuanya diam-diam.
 *   - "Buang" membatalkan unggahan yang masih berjalan (AbortController) dan
 *     menghapus entri.
 *   - HEIC/HEIF (iPhone) dikonversi ke JPEG sebelum upload — server hanya
 *     menerima JPEG/PNG/WEBP (415 `STORY_MEDIA_TYPE`); `resizePickedImage`
 *     saja tidak cukup karena ia hanya mengonversi foto > 1920 px.
 */
import { createStory, uploadStoryMedia, type StoryMediaKind } from "@/lib/api/story"
import { pickedImageToFormData, resizePickedImage, type PickedImage } from "@/lib/image-picker"
import { storyImageNeedsReencode } from "@/lib/story-media-limits"
import { buildCreateInput, isMediaStoryKind, type StoryDraft } from "@/lib/story/compose"
import {
  addPendingStoryLocal,
  bumpStoryRevision,
  removePendingStoryLocal,
  setPendingProgressLocal,
  setPendingStatusLocal,
  type PendingStory,
} from "@/lib/story/local-state"
import { uploadMessage } from "@/lib/upload-errors"
import { userMessage } from "@/lib/api/errors"

export type PublishStoryJob = {
  localId: string
  draft: StoryDraft
  /** Aset lokal untuk kind image/video; null untuk teks. */
  media: PickedImage | null
}

export type PublishStoryCallbacks = {
  onSuccess?: () => void
  /** Pesan sudah spesifik & siap tampil (toast). */
  onFailure?: (message: string) => void
}

type ActiveJob = PublishStoryJob & { controller: AbortController | null }

/** Pekerjaan yang masih bisa diulang/dibuang, per localId (memori proses). */
const jobs = new Map<string, ActiveJob>()

function newLocalId(): string {
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

/**
 * Foto siap unggah: HEIC → JPEG, dan > 1920 px diperkecil (fail-open bila
 * manipulator gagal — server tetap memvalidasi).
 */
async function prepareStoryImage(asset: PickedImage): Promise<PickedImage> {
  const resized = await resizePickedImage(asset)
  if (!storyImageNeedsReencode(resized)) return resized
  try {
    const { manipulateAsync, SaveFormat } = await import("expo-image-manipulator")
    const result = await manipulateAsync(resized.uri, [], { compress: 0.86, format: SaveFormat.JPEG })
    return {
      ...resized,
      uri: result.uri,
      name: `${resized.name.replace(/\.[a-z0-9]+$/i, "") || "photo"}.jpg`,
      mimeType: "image/jpeg",
      // Ukuran pasca-konversi tidak diketahui → fail-open ke validasi server.
      size: 0,
      width: result.width,
      height: result.height,
    }
  } catch {
    return resized
  }
}

async function runJob(job: ActiveJob, cb: PublishStoryCallbacks): Promise<void> {
  const { localId, draft, media } = job
  const controller = new AbortController()
  job.controller = controller
  try {
    let mediaId: string | undefined
    if (isMediaStoryKind(draft.kind)) {
      if (!media) throw new Error("media")
      const kind: StoryMediaKind = draft.kind
      const prepared = kind === "image" ? await prepareStoryImage(media) : media
      const form = await pickedImageToFormData(prepared)
      setPendingProgressLocal(localId, 0)
      const uploaded = await uploadStoryMedia(form, {
        kind,
        fileBytes: prepared.size,
        signal: controller.signal,
        onProgress: (fraction) => setPendingProgressLocal(localId, fraction),
      })
      mediaId = uploaded.mediaId
      // Tahap buat story: progress penuh, spinner tetap sampai server menjawab.
      setPendingProgressLocal(localId, 1)
    }
    await createStory(buildCreateInput({ ...draft, mediaId: mediaId ?? null }))
    jobs.delete(localId)
    removePendingStoryLocal(localId)
    bumpStoryRevision()
    cb.onSuccess?.()
  } catch (err) {
    if (controller.signal.aborted) return // dibuang pengguna — tanpa toast
    const message = isMediaStoryKind(draft.kind)
      ? uploadMessage(err, { purpose: "STORY" })
      : userMessage(err)
    setPendingStatusLocal(localId, "failed", message)
    cb.onFailure?.(message)
  } finally {
    if (job.controller === controller) job.controller = null
  }
}

/**
 * Mulai terbitkan story: entri optimistis + pekerjaan latar. Mengembalikan
 * `localId` (untuk retry/buang dari tray).
 */
export function publishStory(
  input: { draft: StoryDraft; media: PickedImage | null },
  cb: PublishStoryCallbacks = {},
): string {
  const localId = newLocalId()
  const { draft, media } = input
  const optimistic: PendingStory = {
    localId,
    kind: draft.kind,
    mediaUri: media?.uri ?? null,
    text: draft.text.trim() || null,
    backgroundColor: draft.kind === "text" ? draft.backgroundColor : null,
    createdAt: Date.now(),
    status: "uploading",
    progress: null,
    error: null,
  }
  addPendingStoryLocal(optimistic)
  const job: ActiveJob = { localId, draft, media, controller: null }
  jobs.set(localId, job)
  void runJob(job, cb)
  return localId
}

/** Ulangi pekerjaan yang gagal. False bila pekerjaan tidak dikenal (mis. proses sudah restart). */
export function retryPublishStory(localId: string, cb: PublishStoryCallbacks = {}): boolean {
  const job = jobs.get(localId)
  if (!job || job.controller) return false
  setPendingStatusLocal(localId, "uploading")
  void runJob(job, cb)
  return true
}

/** Buang pekerjaan: batalkan unggahan yang berjalan & hapus entri tray. */
export function discardPublishStory(localId: string): void {
  const job = jobs.get(localId)
  job?.controller?.abort()
  jobs.delete(localId)
  removePendingStoryLocal(localId)
}

/** Pesan galat tersimpan untuk entri gagal (null bila tidak ada). */
export function canRetryPublishStory(localId: string): boolean {
  return jobs.has(localId)
}
