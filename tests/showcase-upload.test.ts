/**
 * Kontrak unggah foto Etalase (self-hosted, 2026-09-26): resize → guard 5MB
 * → POST /v1/upload/direct (auto-confirm di server) → kunci dikembalikan.
 * Tidak ada presigned URL, tidak ada /upload/confirm, tidak ada auto-create.
 * Kegagalan setelah kunci diterima = kompensasi cleanup; telemetri tidak
 * boleh membawa nama berkas/kunci.
 *
 * Audit upload 2026-10-09: jalur foto kini lewat transport XHR terpusat
 * (`api.upload.uploadFileWithProgress` + `parseDirectUploadObject`) — timeout
 * adaptif, NetInfo pre-check, progress jujur, retry transien, abort per file.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({
  direct: vi.fn(),
  cleanup: vi.fn(),
  resize: vi.fn(),
  toFormData: vi.fn(),
  log: vi.fn(),
}))
vi.mock("@/lib/api", () => ({
  api: { upload: { uploadFileWithProgress: mocks.direct, cleanupUploads: mocks.cleanup } },
}))
vi.mock("@/lib/image-picker", () => ({
  resizePickedImage: mocks.resize,
  pickedImageToFormData: mocks.toFormData,
}))
vi.mock("@/lib/telemetry", () => ({ logWarn: mocks.log }))
import { cleanupPendingShowcaseKeys, uploadShowcasePhoto } from "@/lib/showcase-upload"
const asset = { uri: "file://local.jpg", name: "private-name.jpg", mimeType: "image/jpeg", size: 5, width: 100, height: 100 }

beforeEach(() => {
  vi.resetAllMocks()
  mocks.resize.mockImplementation((a: typeof asset) => Promise.resolve(a))
  mocks.toFormData.mockImplementation(() => Promise.resolve({ append: vi.fn() }))
  mocks.cleanup.mockResolvedValue(undefined)
})

describe("Etalase upload transaction E38–E42/E68", () => {
  it("returns the key only after a direct upload, never auto-creates", async () => {
    mocks.direct.mockResolvedValue({ fileKey: "key", thumbnailFileKey: "thumb" })
    await expect(uploadShowcasePhoto(asset)).resolves.toEqual({
      kind: "fileKey",
      fileKey: "key",
      thumbnailFileKey: "thumb",
    })
    expect(mocks.resize).toHaveBeenCalledWith(asset)
    expect(mocks.direct).toHaveBeenCalledTimes(1)
    const formData = await mocks.toFormData.mock.results[0]!.value
    expect(formData.append).toHaveBeenCalledWith("purpose", "SHOWCASE_IMAGE")
    expect(mocks.cleanup).not.toHaveBeenCalled()
  })
  it("pass-through fileBytes hasil resize untuk timeout adaptif (audit B1)", async () => {
    const small = { ...asset, uri: "file://small.jpg", size: 3 }
    mocks.resize.mockResolvedValue(small)
    mocks.direct.mockResolvedValue({ fileKey: "key" })
    await uploadShowcasePhoto(asset)
    expect(mocks.toFormData).toHaveBeenCalledWith(small, "file")
    const opts = mocks.direct.mock.calls[0]![1] as Record<string, unknown>
    expect(opts.fileBytes).toBe(3)
    expect(opts.timeoutKind).toBe("photo")
  })
  it("uploads the RESIZED asset, not the original", async () => {
    const small = { ...asset, uri: "file://small.jpg", size: 3 }
    mocks.resize.mockResolvedValue(small)
    mocks.direct.mockResolvedValue({ fileKey: "key" })
    await uploadShowcasePhoto(asset)
    expect(mocks.toFormData).toHaveBeenCalledWith(small, "file")
  })
  it("rejects a missing key as PARSE without cleanup", async () => {
    mocks.direct.mockResolvedValue({})
    await expect(uploadShowcasePhoto(asset)).rejects.toMatchObject({ code: "PARSE" })
    expect(mocks.cleanup).not.toHaveBeenCalled()
  })
  it("propagates transfer failure without cleanup when no key exists yet", async () => {
    mocks.direct.mockRejectedValue(new Error("failed"))
    await expect(uploadShowcasePhoto(asset)).rejects.toThrow("failed")
    expect(mocks.cleanup).not.toHaveBeenCalled()
  })
  it("abort before upload performs no network operations", async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(uploadShowcasePhoto(asset, { signal: controller.signal })).rejects.toMatchObject({ code: "ABORTED" })
    expect(mocks.direct).not.toHaveBeenCalled()
    expect(mocks.cleanup).not.toHaveBeenCalled()
  })
  it("abort after the key is issued cleans the orphan (file + thumbnail)", async () => {
    const controller = new AbortController()
    mocks.direct.mockImplementation(async () => {
      controller.abort()
      return { fileKey: "key", thumbnailFileKey: "thumb" }
    })
    await expect(uploadShowcasePhoto(asset, { signal: controller.signal })).rejects.toMatchObject({ code: "ABORTED" })
    expect(mocks.cleanup).toHaveBeenCalledWith(["key", "thumb"])
  })
  it("telemetry never carries file names or keys", async () => {
    mocks.direct.mockRejectedValue(new Error("failed"))
    await expect(uploadShowcasePhoto(asset)).rejects.toThrow()
    const logged = JSON.stringify(mocks.log.mock.calls)
    expect(logged).not.toContain("private-name")
    expect(logged).not.toContain("local.jpg")
  })
  it("cleanup batches at most 20 keys and records sanitized failures", async () => {
    mocks.cleanup.mockRejectedValue(new Error("secret-server-details"))
    await cleanupPendingShowcaseKeys(Array.from({ length: 25 }, (_, i) => `private-key-${i}`))
    expect(mocks.cleanup.mock.calls.map(call => call[0].length)).toEqual([20, 5])
    expect(mocks.log).toHaveBeenCalledTimes(2)
    expect(JSON.stringify(mocks.log.mock.calls)).not.toContain("secret-server-details")
  })
})
