/**
 * Test regresi identitas untuk blokir & lapor.
 *
 * Cacat yang dilaporkan pengguna: menekan "Blokir pengguna" / "Laporkan akun"
 * DI HALAMAN PROFIL orang itu sendiri gagal dengan "user tidak tersedia".
 * Sebabnya: endpoint memakai `{userId}` sedangkan layar profil publik hanya
 * pasti punya username, dan `profile.id` bisa kosong.
 *
 * Perilakuan yang dikunci di sini:
 *   1. id dicoba lebih dulu;
 *   2. bila backend menjawab 404, username dicoba (backend boleh menerima
 *      keduanya) — dan ini AMAN karena 404 berarti tidak ada data yang dibuat,
 *      jadi laporan tidak mungkin ganda;
 *   3. id kosong tidak pernah dikirim ke server;
 *   4. error non-404 (mis. 403) langsung dilempar, tidak diulang.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

import { ApiError } from "@/lib/api/errors"

const httpMock = {
  post: vi.fn(),
  delete: vi.fn(),
}

vi.mock("@/lib/api/client", () => ({
  http: httpMock,
  seg: (value: string) => {
    const segment = String(value)
    if (!segment || segment === "undefined" || segment === "null")
      throw new ApiError({ code: "BAD_REQUEST", message: "Identitas data tidak valid." })
    return encodeURIComponent(segment)
  },
}))

const { blockUser, reportUser, unblockUser } = await import("@/lib/api/settings")

const notFound = () => new ApiError({ code: "NOT_FOUND", status: 404, message: "user tidak tersedia" })
const forbidden = () => new ApiError({ code: "FORBIDDEN", status: 403, message: "tidak berhak" })

beforeEach(() => {
  httpMock.post.mockReset()
  httpMock.delete.mockReset()
})

describe("blockUser", () => {
  it("memakai id lebih dulu dan tidak memanggil ulang bila berhasil", async () => {
    httpMock.post.mockResolvedValue({ id: "u1" })
    await blockUser("u1", "budi")
    expect(httpMock.post).toHaveBeenCalledTimes(1)
    expect(httpMock.post.mock.calls[0][0]).toBe("/v1/settings/block/u1")
  })

  it("jatuh ke username saat backend menjawab 404 untuk id", async () => {
    httpMock.post.mockRejectedValueOnce(notFound()).mockResolvedValueOnce({ id: "u1" })
    await blockUser("profil-id-yang-tidak-dikenali", "budi")
    expect(httpMock.post).toHaveBeenCalledTimes(2)
    expect(httpMock.post.mock.calls[1][0]).toBe("/v1/settings/block/budi")
  })

  it("langsung memakai username bila id kosong — tidak pernah mengirim path kosong", async () => {
    httpMock.post.mockResolvedValue({ id: "u1" })
    await blockUser("", "budi")
    expect(httpMock.post).toHaveBeenCalledTimes(1)
    expect(httpMock.post.mock.calls[0][0]).toBe("/v1/settings/block/budi")
  })

  it("melempar error yang jelas bila id DAN username tidak ada", async () => {
    await expect(blockUser("", "")).rejects.toMatchObject({ code: "VALIDATION" })
    expect(httpMock.post).not.toHaveBeenCalled()
  })

  it("tidak mengulang pada 403 — server sudah menjawab dengan alasan yang benar", async () => {
    httpMock.post.mockRejectedValue(forbidden())
    await expect(blockUser("u1", "budi")).rejects.toMatchObject({ code: "FORBIDDEN" })
    expect(httpMock.post).toHaveBeenCalledTimes(1)
  })
})

describe("reportUser", () => {
  const dto = { targetId: "u1", category: "SPAM" as const, description: "akun penipuan" }

  it("mengirim targetId dari dto", async () => {
    httpMock.post.mockResolvedValue({ id: "r1" })
    await reportUser(dto, "budi")
    expect(httpMock.post.mock.calls[0][1]).toMatchObject({ targetId: "u1", category: "SPAM" })
  })

  it("mengganti targetId dengan username pada percobaan kedua", async () => {
    httpMock.post.mockRejectedValueOnce(notFound()).mockResolvedValueOnce({ id: "r1" })
    await reportUser(dto, "budi")
    expect(httpMock.post).toHaveBeenCalledTimes(2)
    expect(httpMock.post.mock.calls[1][1]).toMatchObject({ targetId: "budi" })
  })

  it("tidak membuat laporan ganda bila percobaan pertama gagal selain 404", async () => {
    httpMock.post.mockRejectedValue(forbidden())
    await expect(reportUser(dto, "budi")).rejects.toMatchObject({ code: "FORBIDDEN" })
    expect(httpMock.post).toHaveBeenCalledTimes(1)
  })
})

describe("unblockUser", () => {
  it("memakai jalur identitas yang sama", async () => {
    httpMock.delete.mockRejectedValueOnce(notFound()).mockResolvedValueOnce(undefined)
    await unblockUser("id-lama", "budi")
    expect(httpMock.delete).toHaveBeenCalledTimes(2)
    expect(httpMock.delete.mock.calls[1][0]).toBe("/v1/settings/block/budi")
  })
})
