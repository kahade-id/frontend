/**
 * Guard "Media detail dari chat" (permintaan produk 2026-10-08, bagian 4).
 *
 * KEPUTUSAN PRODUK: media yang dibuka dari chat memakai HALAMAN YANG SAMA
 * dengan `/media-viewer` — bukan penampil kedua dengan gaya sendiri.
 *
 * Bagian ini sudah benar sejak 2026-10-07 (semua lampiran chat diarahkan ke
 * `/media-viewer`), jadi test di bawah bukan "memperbaiki", melainkan MENGUNCI
 * kontraknya supaya tidak pernah bercabang lagi menjadi dua gaya:
 *
 *   - foto  → album (swipe antar foto dalam pesan yang sama) + zoom + panel info
 *   - video → pemutar penuh: putar/jeda, seek, fullscreen
 *   - berkas→ kartu pratinjau + "Unduh" / "Buka dengan aplikasi lain"
 *   - audio & lokasi ikut rute yang sama (tidak ada rute terpisah)
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const ROOT = resolve(__dirname, "..")

function src(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8")
}

describe("chat → media viewer (satu gaya, satu rute)", () => {
  const room = src("components/screens/chat-room-screen.tsx")

  it("semua lampiran chat dibuka lewat mediaViewerHref (tanpa penampil kedua)", () => {
    expect(room).toContain("mediaViewerHref")
    // Tidak ada jalur lain: tidak membuka browser luar, tidak merender
    // penampil media milik ruang chat.
    expect(room).not.toMatch(/Linking\.openURL\([^)]*fileUrl/)
    expect(room).not.toContain("components/ui/image-viewer")
  })

  it("foto dikirim sebagai album + index awal (swipe antar foto)", () => {
    expect(room).toMatch(/type: "photo"/)
    expect(room).toContain("items,")
    expect(room).toMatch(/index: at/)
  })

  it("video/berkas/audio memakai rute yang sama dengan tipe terklasifikasi", () => {
    // `classifyMedia` → salah satu dari photo/video/file/audio/location;
    // tipe itu diteruskan apa adanya ke rute (satu pintu).
    expect(room).toContain("classifyMedia")
    expect(room).toMatch(/mediaViewerHref\(\{\s*\n\s*type,/)
  })
})

describe("kelengkapan penampil (yang diminta produk)", () => {
  it("foto: zoom + swipe + panel info", () => {
    const photo = src("components/media-viewer/photo-viewer.tsx")
    expect(photo).toContain("ZoomableImage")
    expect(photo).toContain("Info foto: {x}")
    // Panel info menyebut nama berkas, ukuran, dimensi, dan waktu kirim.
    expect(photo).toContain("Nama berkas")
    expect(photo).toContain("Dimensi")
    expect(photo).toContain("Dikirim")
  })

  it("video: putar/jeda + seek + fullscreen", () => {
    const video = src("components/media-viewer/video-player.tsx")
    expect(video).toContain("togglePlay")
    expect(video).toContain("seekTo")
    expect(video).toContain("SEEK_STEP_SECONDS")
    expect(video.toLowerCase()).toContain("fullscreen")
  })

  it("berkas: pratinjau in-app + buka/unduh yang tidak ambigu", () => {
    const file = src("components/media-viewer/file-viewer.tsx")
    expect(file).toContain('label="Unduh"')
    expect(file).toContain('label="Buka dengan aplikasi lain"')
    expect(file).toContain("Menyiapkan pratinjau berkas…")
  })
})
