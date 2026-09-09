/**
 * Kahade — resolusi URL media (lib/media.ts).
 *
 * Kenapa diuji: kegagalannya SENYAP dan total. Backend yang mengembalikan
 * `/uploads/avatar/x.jpg` membuat avatar tidak pernah tampil — di web browser
 * menyelelesaikan path itu ke origin preview (404), di native URI-nya tidak
 * valid — dan yang terlihat pengguna hanya inisial/placeholder, tanpa error.
 * Tidak ada layar yang melempar, jadi hanya uji unit yang bisa menjaganya.
 */
import { describe, expect, it, vi } from "vitest"

/*
 * `lib/api/config` menarik expo-constants → expo-modules-core, yang butuh
 * global Expo native dan meledak di node. Nilai base URL-nya yang dipakai
 * lib/media.ts, jadi modulnya ditiru dengan host produksi yang sama.
 */
vi.mock("@/lib/api/config", () => ({ API_BASE_URL: "https://api.kahade.id" }))

const { resolveMediaSource, resolveMediaUrl } = await import("@/lib/media")

const BASE = "https://api.kahade.id"

describe("resolveMediaUrl", () => {
  it("membiarkan URL https absolut apa adanya", () => {
    expect(resolveMediaUrl("https://cdn.kahade.id/avatar/a.jpg")).toBe(
      "https://cdn.kahade.id/avatar/a.jpg",
    )
  })

  it("menempelkan path relatif (dengan dan tanpa slash depan) ke host API", () => {
    expect(resolveMediaUrl("/uploads/avatar/a.jpg")).toBe(`${BASE}/uploads/avatar/a.jpg`)
    expect(resolveMediaUrl("uploads/avatar/a.jpg")).toBe(`${BASE}/uploads/avatar/a.jpg`)
  })

  it("tidak menggandakan slash pemisah", () => {
    expect(resolveMediaUrl("/uploads/a.jpg")).not.toContain("//uploads")
    expect(resolveMediaUrl("uploads/a.jpg")).toBe(`${BASE}/uploads/a.jpg`)
  })

  it("melengkapi protocol-relative dengan https", () => {
    expect(resolveMediaUrl("//cdn.kahade.id/a.jpg")).toMatch(/^https:\/\//)
  })

  it("meng-upgrade http ke https hanya untuk host API sendiri", () => {
    const apiHost = new URL(BASE).host
    expect(resolveMediaUrl(`http://${apiHost}/uploads/a.jpg`)).toBe(
      `https://${apiHost}/uploads/a.jpg`,
    )
    // Host lain tidak ditebak: bisa jadi memang hanya melayani http (native
    // masih bisa memuatnya), dan upgrade paksa mengubah gambar jadi gagal.
    expect(resolveMediaUrl("http://mitra.example/a.jpg")).toBe("http://mitra.example/a.jpg")
  })

  it("membiarkan URI lokal (image-picker, blob preview)", () => {
    expect(resolveMediaUrl("file:///cache/img.jpg")).toBe("file:///cache/img.jpg")
    expect(resolveMediaUrl("content://media/1")).toBe("content://media/1")
    expect(resolveMediaUrl("blob:https://x/1")).toBe("blob:https://x/1")
    expect(resolveMediaUrl("data:image/png;base64,AAA")).toBe("data:image/png;base64,AAA")
    expect(resolveMediaUrl("ph://E2E5")).toBe("ph://E2E5")
  })

  it("mengembalikan undefined untuk nilai kosong atau skema tak dikenal", () => {
    expect(resolveMediaUrl(undefined)).toBeUndefined()
    expect(resolveMediaUrl(null)).toBeUndefined()
    expect(resolveMediaUrl("")).toBeUndefined()
    expect(resolveMediaUrl("   ")).toBeUndefined()
    expect(resolveMediaUrl(123)).toBeUndefined()
    expect(resolveMediaUrl("ftp://x/a.jpg")).toBeUndefined()
  })
})

describe("resolveMediaSource", () => {
  it("mengubah string menjadi { uri } yang sudah dinormalkan", () => {
    expect(resolveMediaSource("/uploads/a.jpg")).toEqual({ uri: `${BASE}/uploads/a.jpg` })
  })

  it("meneruskan require() (number) dan menormalkan objek { uri }", () => {
    expect(resolveMediaSource(7)).toBe(7)
    expect(resolveMediaSource({ uri: "/uploads/a.jpg" })).toEqual({
      uri: `${BASE}/uploads/a.jpg`,
    })
  })

  it("mengambil elemen pertama array (bentuk ImageSourcePropType)", () => {
    expect(resolveMediaSource([{ uri: "https://cdn.kahade.id/a.jpg" }])).toEqual({
      uri: "https://cdn.kahade.id/a.jpg",
    })
  })

  it("menghasilkan undefined bila tidak ada gambar yang bisa dimuat", () => {
    expect(resolveMediaSource(undefined)).toBeUndefined()
    expect(resolveMediaSource(null)).toBeUndefined()
    expect(resolveMediaSource("")).toBeUndefined()
    expect(resolveMediaSource({ uri: null })).toBeUndefined()
    expect(resolveMediaSource([])).toBeUndefined()
  })
})
