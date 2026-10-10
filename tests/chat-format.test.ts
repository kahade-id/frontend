/**
 * Batch 43 FE-CHAT: parser & toolbar pemformatan teks chat.
 * Lapisan murni — Node saja, tanpa RN.
 */
import { describe, expect, it } from "vitest"
import {
  applyChatFormat,
  hasChatMarkup,
  parseChatMarkup,
  plainChatText,
  stripChatHtml,
  type ChatSegment,
} from "@/lib/chat-format"

describe("stripChatHtml (batch 3 2026-10-10)", () => {
  it("hanya tag sungguhan yang dibuang — perbandingan matematis utuh", () => {
    expect(stripChatHtml("1<2 dan 3>2")).toBe("1<2 dan 3>2")
    expect(stripChatHtml("harga <100rb> ok")).toBe("harga <100rb> ok")
    expect(stripChatHtml("a < b > c")).toBe("a < b > c")
  })
  it("tag HTML dilepas, formatting dipertahankan sebagai marker", () => {
    expect(stripChatHtml('<p><b>halo</b> <a href="https://kahade.id">tautan</a></p>')).toBe(
      "**halo** tautan",
    )
    expect(stripChatHtml("<i class=\"x\">miring</i><br/>baris<img src=x/>")).toBe("_miring_\nbaris")
    expect(stripChatHtml("<s>coret</s> &amp; &lt;b&gt;")).toBe("~coret~ & <b>")
  })
  it("teks tanpa < atau & dikembalikan apa adanya", () => {
    const s = "pesan biasa"
    expect(stripChatHtml(s)).toBe(s)
  })
})

describe("plainChatText", () => {
  it("marker dilepas, tautan markdown jadi label", () => {
    expect(plainChatText("*tebal* dan _miring_ [lihat](https://kahade.id/p/1)")).toBe(
      "tebal dan miring lihat",
    )
    expect(plainChatText("<b>halo</b> 1<2")).toBe("halo 1<2")
    expect(plainChatText("polos")).toBe("polos")
  })
})

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
  it("bug #6: *tebal* satu bintang & ~coret~ (gaya WhatsApp) dikenali", () => {
    expect(hasChatMarkup("*tebal*")).toBe(true)
    expect(hasChatMarkup("harga ~100rb~ 80rb")).toBe(true)
  })
  it("perkalian / tilde di tengah kata bukan markup", () => {
    expect(hasChatMarkup("2*3*4")).toBe(false)
    expect(hasChatMarkup("a~b")).toBe(false)
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
  it("bug #6: *tebal* satu bintang (WhatsApp) jadi bold", () => {
    const segs = parseChatMarkup("ini *penting* ya")
    expect(texts(segs)).toEqual(["ini ", "penting", " ya"])
    expect(segs[1].bold).toBe(true)
  })
  it("bug #6: ~coret~ jadi strike", () => {
    const segs = parseChatMarkup("harga ~100rb~ jadi 80rb")
    expect(segs[1]).toMatchObject({ text: "100rb", strike: true })
  })
  it("perkalian & spasi di dalam marker tetap literal", () => {
    expect(texts(parseChatMarkup("2*3*4 = 24"))).toEqual(["2*3*4 = 24"])
    expect(texts(parseChatMarkup("2 * 3 * 4"))).toEqual(["2 * 3 * 4"])
    expect(texts(parseChatMarkup("tanda ~ saja ~ di sini"))).toEqual(["tanda ~ saja ~ di sini"])
  })
  it("** dua bintang tetap didahulukan atas * satu bintang", () => {
    const segs = parseChatMarkup("**tebal** dan *juga*")
    expect(segs[0]).toMatchObject({ text: "tebal", bold: true })
    expect(segs[2]).toMatchObject({ text: "juga", bold: true })
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
