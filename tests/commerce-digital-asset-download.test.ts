/**
 * BE-5 (audit etalase 2026-10-10): unduhan aset FILE lewat URL bertanda
 * tangan — GET /v1/commerce/digital-assets/:id/download.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), del: vi.fn() }))
vi.mock("@/lib/api/client", () => ({
  http: { get: mocks.get, post: mocks.post, delete: mocks.del },
  seg: (v: string) => encodeURIComponent(v),
}))

import { getDigitalAssetDownload } from "@/lib/api/commerce"

beforeEach(() => vi.resetAllMocks())

describe("getDigitalAssetDownload", () => {
  it("GET path + auth required; respons {id, downloadUrl, expiresAt} diparse", async () => {
    mocks.get.mockResolvedValue({
      id: "da1",
      downloadUrl: "https://api.kahade.id/v1/upload/signed?key=digital-assets%2Fu1%2Fa.pdf&exp=1&sig=abc",
      expiresAt: "2026-10-10T08:15:00.000Z",
    })
    const out = await getDigitalAssetDownload("da1")
    expect(mocks.get).toHaveBeenCalledWith("/v1/commerce/digital-assets/da1/download", expect.objectContaining({ auth: "required" }))
    expect(out).toEqual({
      id: "da1",
      downloadUrl: "https://api.kahade.id/v1/upload/signed?key=digital-assets%2Fu1%2Fa.pdf&exp=1&sig=abc",
      expiresAt: "2026-10-10T08:15:00.000Z",
    })
  })

  it("tanpa downloadUrl → error PARSE (bukan objek rusak ke UI)", async () => {
    mocks.get.mockResolvedValue({ id: "da1" })
    await expect(getDigitalAssetDownload("da1")).rejects.toMatchObject({ code: "PARSE" })
  })
})
