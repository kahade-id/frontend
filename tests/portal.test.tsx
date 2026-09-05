// @vitest-environment jsdom
/**
 * Kahade — regresi performa <Portal>.
 *
 * Kenapa berkas ini ada: pernah ada render loop tak terbatas di sini, dan
 * loop-nya TIDAK terlihat sebagai bug fungsional. Overlay tetap tampil benar;
 * yang terjadi hanya React merender ulang ratusan kali per detik selama
 * overlay terbuka — baterai habis, animasi tersendat, dan di perangkat lambat
 * interaksi berhenti merespons.
 *
 * Penyebabnya adalah pasangan yang tampak wajar bila dibaca terpisah:
 *   1. <Portal> memasang `children` lewat effect dengan `children` di deps.
 *      Elemen React adalah objek baru tiap render, jadi effect ini jalan
 *      setiap kali induknya render.
 *   2. Overlay (Modal/BottomSheet/SearchOverlay/LoadingOverlay) memanggil
 *      `useBlockingOverlay`, yang dulu berlangganan context yang SAMA dengan
 *      tempat `nodes` disimpan.
 * Gabungannya: mount() → setNodes → context berubah → overlay render →
 * elemen `children` baru → effect jalan → mount() → …
 *
 * Uji "overlay TERBUKA" di bawah gagal (502 render, React melempar "Maximum
 * update depth exceeded") sebelum context dipecah jadi API + State di
 * components/ui/portal.tsx. Jangan gabungkan keduanya lagi.
 */
import { afterEach, describe, expect, it } from "vitest"
import { useState } from "react"
import { cleanup, render, act } from "@testing-library/react"

import { Portal, PortalHost, PortalProvider, useBlockingOverlay } from "@/components/ui/portal"

/** Batas aman: di atas ini kita anggap loop, bukan sekadar render berlebih. */
const RENDER_CAP = 200

let sheetRenders = 0

/**
 * Tiruan minimal <BottomSheet>/<Modal>: mendaftar sebagai overlay pemblokir
 * lalu merender isinya lewat <Portal>. Isi sengaja berupa JSX inline supaya
 * identitas elemennya berubah tiap render — persis seperti komponen asli.
 */
function FakeOverlay({ visible }: { visible: boolean }) {
  sheetRenders++
  if (sheetRenders > RENDER_CAP) throw new Error(`render loop: FakeOverlay > ${RENDER_CAP}x`)
  useBlockingOverlay(visible)
  if (!visible) return null
  return (
    <Portal>
      <span>isi overlay</span>
    </Portal>
  )
}

function Harness({ open }: { open: boolean }) {
  const [visible] = useState(open)
  return (
    <PortalProvider>
      <span>konten app</span>
      <FakeOverlay visible={visible} />
      <PortalHost />
    </PortalProvider>
  )
}

async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50))
  })
}

describe("Portal", () => {
  // globals:false → auto-cleanup RTL tidak aktif; tanpa ini DOM test
  // sebelumnya ikut terbawa dan query menemukan elemen ganda.
  afterEach(cleanup)

  it("stabil saat overlay tertutup", async () => {
    sheetRenders = 0
    render(<Harness open={false} />)
    await settle()
    expect(sheetRenders).toBeLessThanOrEqual(2)
  })

  it("tidak merender berulang tanpa henti saat overlay terbuka", async () => {
    sheetRenders = 0
    render(<Harness open />)
    await settle()
    expect(sheetRenders).toBeLessThanOrEqual(2)
  })

  it("tetap merender isi overlay ke dalam host", async () => {
    sheetRenders = 0
    const { getByText } = render(<Harness open />)
    await settle()
    expect(getByText("isi overlay")).toBeTruthy()
  })

  it("melepas node saat overlay unmount", async () => {
    sheetRenders = 0
    const { queryByText, unmount } = render(<Harness open />)
    await settle()
    expect(queryByText("isi overlay")).not.toBeNull()
    unmount()
    expect(queryByText("isi overlay")).toBeNull()
  })
})
