/**
 * Batch 43 FE-CHAT: parser & toolbar pemformatan teks chat.
 * Lapisan murni — Node saja, tanpa RN.
 */
import { describe, expect, it } from "vitest"
import {
  applyChatFormat,
  hasChatMarkup,
  parseChatMarkup,
  type ChatSegment,
} from "@/lib/chat-format"

function texts(segments: ChatSegment[]): string[] {
  return segments.map((s) => s.text)
}

describe("hasChatMarkup", () => {
  it("false untuk teks biasa", () => {
    expect(hasChatMarkup("halo apa kabar")).toBe(false)
    expect(hasChatMarkup("")).toBe(false)
  })
  it("true untuk tiap sintaks", () => {
    expect(hasChatMarkup("**tebal**")).toBe(true)
    expect(hasChatMarkup("__garis__")).toBe(true)
    expect(hasChatMarkup("`kode`")).toBe(true)
    expect(hasChatMarkup("||spoiler||")).toBe(true)
    expect(hasChatMarkup("_miring_")).toBe(true)
    expect(hasChatMarkup("[x](https://a.id)")).toBe(true)
    expect(hasChatMarkup("lihat https://kahade.id")).toBe(true)
  })
  it("snake_case bukan markup", () => {
    expect(hasChatMarkup("variabel_foo_bar")).toBe(false)
  })
})

describe("parseChatMarkup", () => {
  it("teks biasa satu segmen", () => {
    expect(parseChatMarkup("halo")).toEqual([{ text: "halo" }])
  })
  it("bold / italic / mono / underline / spoiler", () => {
    const segs = parseChatMarkup("**tebal** dan _miring_ dan `mono` dan __bawah__ dan ||s||")
    expect(texts(segs)).toEqual(["tebal", " dan ", "miring", " dan ", "mono", " dan ", "bawah", " dan ", "s"])
    expect(segs[0].bold).toBe(true)
    expect(segs[2].italic).toBe(true)
    expect(segs[4].mono).toBe(true)
    expect(segs[6].underline).toBe(true)
    expect(segs[8].spoiler).toBe(true)
  })
  it("tautan markdown", () => {
    const segs = parseChatMarkup("buka [Kahade](https://kahade.id) ya")
    expect(segs[1]).toMatchObject({ text: "Kahade", linkUrl: "https://kahade.id" })
  })
  it("tautan telanjang + pangkas tanda baca", () => {
    const segs = parseChatMarkup("lihat https://kahade.id/produk, bagus.")
    expect(segs[1]).toMatchObject({
      text: "https://kahade.id/produk",
      linkUrl: "https://kahade.id/produk",
    })
    expect(segs[2].text).toBe(", bagus.")
  })
  it("marker tak berpasangan jadi teks biasa", () => {
    expect(texts(parseChatMarkup("**belum tutup"))).toEqual(["**belum tutup"])
    expect(texts(parseChatMarkup("||saja"))).toEqual(["||saja"])
  })
  it("snake_case tidak jadi italic", () => {
    expect(texts(parseChatMarkup("user_name_ku"))).toEqual(["user_name_ku"])
  })
  it("nesting satu level", () => {
    const segs = parseChatMarkup("**tebal dan _miring_**")
    expect(segs[0]).toMatchObject({ text: "tebal dan ", bold: true })
    expect(segs[1]).toMatchObject({ text: "miring", bold: true, italic: true })
  })
  it("isi mono literal", () => {
    const segs = parseChatMarkup("`**bukan bold**`")
    expect(segs).toHaveLength(1)
    expect(segs[0]).toMatchObject({ text: "**bukan bold**", mono: true })
  })
})

describe("applyChatFormat", () => {
  it("bungkus seleksi", () => {
    const r = applyChatFormat("halo dunia", 5, 10, "bold")
    expect(r.value).toBe("halo **dunia**")
    expect([r.start, r.end]).toEqual([7, 12])
  })
  it("toggle off bila sudah terbungkus", () => {
    const r = applyChatFormat("halo **dunia**", 7, 12, "bold")
    expect(r.value).toBe("halo dunia")
  })
  it("seleksi kosong: sisipkan marker, kursor di tengah", () => {
    const r = applyChatFormat("halo", 4, 4, "spoiler")
    expect(r.value).toBe("halo||||")
    expect(r.start).toBe(6)
    expect(r.end).toBe(6)
  })
  it("link: seleksi URL jadi [url](url)", () => {
    const r = applyChatFormat("buka https://a.id", 5, 17, "link")
    expect(r.value).toBe("buka [https://a.id](https://a.id)")
  })
  it("link: seleksi teks biasa → kursor di URL", () => {
    const r = applyChatFormat("klik saya", 5, 9, "link")
    expect(r.value).toBe("klik [saya](https://)")
    // kursor tepat di awal "https://"
    expect(r.value.slice(r.start, r.end)).toBe("https://")
  })
})
