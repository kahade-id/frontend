/**
 * Test regresi identitas untuk blokir & lapor.
 *
 * Cacat yang dilaporkan pengguna: menekan "Blokir pengguna" / "Laporkan akun"
 * DI HALAMAN PROFIL orang itu sendiri gagal — "Invalid ID format" /
 * "targetId must be a valid ID".
 *
 * Akar masalah (dua modul backend dengan resolusi id BERBEDA):
 *   - modul users    `POST/DELETE /v1/users/{id}/block`, `POST /v1/users/{id}/report`
 *                    → service mencari kolom `user.userId` (format `USR-XXXX`,
 *                    satu-satunya id yang diumumkan profil publik);
 *   - modul settings `POST/DELETE /v1/settings/block/{id}`, `POST /v1/settings/report`
 *                    → service mencari `user.id` (CUID internal — tidak pernah
 *                    ada di profil publik).
 * Adapter lama hanya memanggil modul settings dengan `USR-XXXX` → 404 →
 * fallback username → 400 (username bukan id valid).
 *
 * Perilakuan yang dikunci di sini:
 *   1. per identifier, route modul users dicoba lebih dulu (menerima
 *      USR-XXXX — yang umum dimiliki UI), lalu modul settings (menerima CUID);
 *   2. 404/NOT_FOUND/BAD_REQUEST memicu percobaan berikutnya (AMAN: backend
 *      belum membuat apa pun, jadi laporan tidak mungkin ganda);
 *   3. identifier kosong tidak pernah dikirim ke server;
 *   4. error selain 404/400 (mis. 403) langsung dilempar, tidak diulang;
 *   5. laporan via modul users TIDAK mengirim relatedMessageId (DTO modul
 *      users tidak mengenalnya; forbidNonWhitelisted → 400).
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
  it("memakai route modul users lebih dulu dan berhenti bila berhasil", async () => {
    httpMock.post.mockResolvedValue({ message: "ok" })
    await blockUser("USR-ABC12345", "budi")
    expect(httpMock.post).toHaveBeenCalledTimes(1)
    expect(httpMock.post.mock.calls[0][0]).toBe("/v1/users/USR-ABC12345/block")
  })

  it("jatuh ke route modul settings (CUID) saat route users menjawab 404", async () => {
    httpMock.post.mockRejectedValueOnce(notFound()).mockResolvedValueOnce({ message: "ok" })
    await blockUser("cuid-internal", "budi")
    expect(httpMock.post).toHaveBeenCalledTimes(2)
    expect(httpMock.post.mock.calls[0][0]).toBe("/v1/users/cuid-internal/block")
    expect(httpMock.post.mock.calls[1][0]).toBe("/v1/settings/block/cuid-internal")
  })

  it("mencoba username pada kedua route bila id kosong — tidak pernah mengirim path kosong", async () => {
    httpMock.post.mockRejectedValueOnce(notFound()).mockResolvedValueOnce({ message: "ok" })
    await blockUser("", "budi")
    expect(httpMock.post).toHaveBeenCalledTimes(2)
    expect(httpMock.post.mock.calls[0][0]).toBe("/v1/users/budi/block")
    expect(httpMock.post.mock.calls[1][0]).toBe("/v1/settings/block/budi")
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

  it("rute users: target di PATH, bukan di body, dan tanpa relatedMessageId", async () => {
    httpMock.post.mockResolvedValue({ message: "ok" })
    await reportUser(
      { ...dto, evidenceUrls: ["https://cdn.kahade.id/a.jpg"], relatedMessageId: "m1" },
      "budi",
    )
    expect(httpMock.post.mock.calls[0][0]).toBe("/v1/users/u1/report")
    expect(httpMock.post.mock.calls[0][1]).toMatchObject({
      category: "SPAM",
      description: "akun penipuan",
      evidenceUrls: ["https://cdn.kahade.id/a.jpg"],
    })
    expect(httpMock.post.mock.calls[0][1]).not.toHaveProperty("targetId")
    expect(httpMock.post.mock.calls[0][1]).not.toHaveProperty("relatedMessageId")
  })

  it("rute settings (fallback 404): targetId kembali ke body", async () => {
    httpMock.post.mockRejectedValueOnce(notFound()).mockResolvedValueOnce({ id: "r1" })
    await reportUser(dto, "budi")
    expect(httpMock.post).toHaveBeenCalledTimes(2)
    expect(httpMock.post.mock.calls[1][0]).toBe("/v1/settings/report")
    expect(httpMock.post.mock.calls[1][1]).toMatchObject({ targetId: "u1", category: "SPAM" })
  })

  it("username dicoba sebagai targetId pada percobaan terakhir (rute settings)", async () => {
    // id 404 di kedua route, username 404 di route users, lalu berhasil di settings
    httpMock.post
      .mockRejectedValueOnce(notFound())
      .mockRejectedValueOnce(notFound())
      .mockRejectedValueOnce(notFound())
      .mockResolvedValueOnce({ id: "r1" })
    await reportUser(dto, "budi")
    expect(httpMock.post).toHaveBeenCalledTimes(4)
    expect(httpMock.post.mock.calls[3][0]).toBe("/v1/settings/report")
    expect(httpMock.post.mock.calls[3][1]).toMatchObject({ targetId: "budi" })
  })

  it("tidak membuat laporan ganda bila percobaan pertama gagal selain 404", async () => {
    httpMock.post.mockRejectedValue(forbidden())
    await expect(reportUser(dto, "budi")).rejects.toMatchObject({ code: "FORBIDDEN" })
    expect(httpMock.post).toHaveBeenCalledTimes(1)
  })
})

describe("unblockUser", () => {
  it("memakai jalur identitas yang sama (users dulu, settings cadangan)", async () => {
    httpMock.delete.mockRejectedValueOnce(notFound()).mockResolvedValueOnce({ message: "ok" })
    await unblockUser("USR-OLD12345", "budi")
    expect(httpMock.delete).toHaveBeenCalledTimes(2)
    expect(httpMock.delete.mock.calls[0][0]).toBe("/v1/users/USR-OLD12345/block")
    expect(httpMock.delete.mock.calls[1][0]).toBe("/v1/settings/block/USR-OLD12345")
  })
})
