import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({
  presign: vi.fn(), transfer: vi.fn(), confirm: vi.fn(), cleanup: vi.fn(), legacy: vi.fn(), read: vi.fn(), log: vi.fn(),
}))
vi.mock("@/lib/api", () => ({ api: {
  upload: { requestPresignedUrl: mocks.presign, uploadToPresignedUrl: mocks.transfer, confirmUpload: mocks.confirm, cleanupUploads: mocks.cleanup },
  users: { uploadShowcase: mocks.legacy },
} }))
vi.mock("@/lib/image-picker", () => ({ pickedImageToBlob: mocks.read }))
vi.mock("@/lib/telemetry", () => ({ logWarn: mocks.log }))
import { cleanupPendingShowcaseKeys, uploadShowcasePhoto } from "@/lib/showcase-upload"
const asset = { uri: "file://local.jpg", name: "private-name.jpg", mimeType: "image/jpeg", size: 5, width: 100, height: 100 }

beforeEach(() => {
  vi.resetAllMocks()
  mocks.read.mockResolvedValue(new Blob(["photo"], { type: "image/jpeg" }))
  mocks.presign.mockResolvedValue({ fileKey: "key", url: "https://storage.example/signed-secret" })
  mocks.transfer.mockResolvedValue(undefined)
  mocks.confirm.mockResolvedValue({ fileKey: "key" })
  mocks.cleanup.mockResolvedValue(undefined)
})

describe("Etalase upload transaction E38–E42/E68", () => {
  it("only returns a key after presign, transfer, confirm, never auto-creates", async () => {
    expect(await uploadShowcasePhoto(asset)).toEqual({ kind: "fileKey", fileKey: "key" })
    expect(mocks.presign.mock.invocationCallOrder[0]).toBeLessThan(mocks.transfer.mock.invocationCallOrder[0])
    expect(mocks.transfer.mock.invocationCallOrder[0]).toBeLessThan(mocks.confirm.mock.invocationCallOrder[0])
    expect(mocks.legacy).not.toHaveBeenCalled()
    expect(mocks.cleanup).not.toHaveBeenCalled()
  })
  it.each([400, 404, 405, 501])("never falls back to auto-publishing legacy on status %s", async status => {
    mocks.presign.mockRejectedValue({ status })
    await expect(uploadShowcasePhoto(asset)).rejects.toEqual({ status })
    expect(mocks.legacy).not.toHaveBeenCalled()
    expect(mocks.cleanup).not.toHaveBeenCalled()
  })
  it("cleans known key when transfer fails", async () => {
    mocks.transfer.mockRejectedValue(new Error("failed"))
    await expect(uploadShowcasePhoto(asset)).rejects.toThrow("failed")
    expect(mocks.cleanup).toHaveBeenCalledWith(["key"])
    expect(mocks.confirm).not.toHaveBeenCalled()
  })
  it("cleans an uploaded object when confirmation fails", async () => {
    mocks.confirm.mockRejectedValue(new Error("confirm unavailable"))
    await expect(uploadShowcasePhoto(asset)).rejects.toThrow("confirm unavailable")
    expect(mocks.cleanup).toHaveBeenCalledWith(["key"])
  })
  it("abort before upload performs no network operations", async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(uploadShowcasePhoto(asset, controller.signal)).rejects.toMatchObject({ code: "ABORTED" })
    expect(mocks.presign).not.toHaveBeenCalled()
  })
  it("abort after PUT prevents confirm and cleans the orphan", async () => {
    const controller = new AbortController()
    mocks.transfer.mockImplementation(async () => { controller.abort() })
    await expect(uploadShowcasePhoto(asset, controller.signal)).rejects.toMatchObject({ code: "ABORTED" })
    expect(mocks.confirm).not.toHaveBeenCalled()
    expect(mocks.cleanup).toHaveBeenCalledWith(["key"])
  })
  it("cleanup batches at most 20 keys and records sanitized failures", async () => {
    mocks.cleanup.mockRejectedValue(new Error("secret-server-details"))
    await cleanupPendingShowcaseKeys(Array.from({ length: 25 }, (_, i) => `private-key-${i}`))
    expect(mocks.cleanup.mock.calls.map(call => call[0].length)).toEqual([20, 5])
    expect(mocks.log).toHaveBeenCalledTimes(2)
    expect(JSON.stringify(mocks.log.mock.calls)).not.toContain("private-key")
    expect(JSON.stringify(mocks.log.mock.calls)).not.toContain("secret-server-details")
  })
})
