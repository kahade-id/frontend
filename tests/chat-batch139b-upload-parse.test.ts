/**
 * Test B04: parse respons upload chat (lib/api/chat.ts → parseChatUploadResponse).
 *
 * XHR tidak melewati client fetch, jadi unwrap envelope `{success,data}` /
 * `{data}` harus dilakukan manual — dulu respons di-cast buta sebagai
 * ChatAttachmentDto sehingga envelope lolos sebagai DTO palsu (id/url
 * undefined). Parser ini fail-closed: PARSE bila bentuk tidak valid.
 */
import { describe, expect, it } from "vitest"

import { ApiError } from "@/lib/api/errors"
import { parseChatUploadResponse } from "@/lib/api/chat"

const DTO = {
  fileName: "foto.jpg",
  fileUrl: "https://cdn.example/foto.jpg",
  mimeType: "image/jpeg",
  sizeBytes: 12345,
}

describe("parseChatUploadResponse", () => {
  it("menerima DTO polos", () => {
    const out = parseChatUploadResponse(JSON.stringify(DTO))
    expect(out.fileName).toBe("foto.jpg")
    expect(out.fileUrl).toBe("https://cdn.example/foto.jpg")
  })

  it("meng-unwrap envelope {success:true,data}", () => {
    const out = parseChatUploadResponse(JSON.stringify({ success: true, data: DTO }))
    expect(out.fileName).toBe("foto.jpg")
    expect(out.fileUrl).toBe("https://cdn.example/foto.jpg")
  })

  it("meng-unwrap envelope murni {data}", () => {
    const out = parseChatUploadResponse(JSON.stringify({ data: DTO }))
    expect(out.fileUrl).toBe("https://cdn.example/foto.jpg")
  })

  it("PARSE bila body bukan JSON", () => {
    expect(() => parseChatUploadResponse("bukan json")).toThrow(ApiError)
    try {
      parseChatUploadResponse("bukan json")
    } catch (err) {
      expect((err as ApiError).code).toBe("PARSE")
    }
  })

  it("PARSE bila DTO tidak punya fileName/fileUrl string", () => {
    expect(() => parseChatUploadResponse(JSON.stringify({ success: true, data: {} }))).toThrow(
      ApiError,
    )
    expect(() =>
      parseChatUploadResponse(JSON.stringify({ fileName: "a.jpg" })),
    ).toThrow(ApiError)
  })

  it("PARSE bila body null/array", () => {
    expect(() => parseChatUploadResponse("null")).toThrow(ApiError)
    expect(() => parseChatUploadResponse("[]")).toThrow(ApiError)
  })
})
