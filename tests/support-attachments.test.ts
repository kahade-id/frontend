/**
 * Test murni — nama berkas lampiran tiket dukungan (item 128).
 * Nama diambil dari segmen terakhir fileKey yang disanitasi — tidak pernah
 * menebak/mengekspos URL storage mentah.
 */
import { describe, expect, it } from "vitest"

import { supportAttachmentFilename } from "@/lib/support-attachments"

describe("supportAttachmentFilename", () => {
  it("mengambil segmen terakhir fileKey", () => {
    expect(supportAttachmentFilename("private/u-1/chat/abc123.jpg", 0)).toBe("abc123.jpg")
  })

  it("membuang karakter berbahaya", () => {
    expect(supportAttachmentFilename("private/u-1/chat/a b/../c.png", 0)).toBe("c.png")
  })

  it("fallback bernomor bila segmen kosong", () => {
    expect(supportAttachmentFilename("", 2)).toBe("lampiran-3")
    expect(supportAttachmentFilename("///", 0)).toBe("lampiran-1")
  })
})
