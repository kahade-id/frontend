/**
 * H-01 (audit 2026-09-22): antrean toast.
 *
 * Dua cacat yang dikunci di sini:
 *   1. Antrean tumbuh TANPA BATAS — sekumpulan request gagal bersamaan
 *      menghasilkan puluhan toast; yang terakhir tampil belasan detik setelah
 *      kejadiannya dan sudah tidak relevan.
 *   2. Toast identik (judul + deskripsi + tone + posisi) yang datang beruntun
 *      menumpuk jadi dua baris kembar, bukan satu pesan.
 *
 * Logikanya diuji langsung lewat `enqueueToast` (fungsi murni) supaya batas
 * antrean & jendela koalesensi bisa diperiksa angka-angkanya, lalu satu test
 * DOM memastikan hasilnya benar-benar terlihat sebagai baris di layar.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"

import { ThemeProvider } from "@/components/theme-provider"
import { ToastProvider, enqueueToast, useToast, type ToastRecord } from "@/components/ui/toast"

afterEach(cleanup)

const at = 1_700_000_000_000

describe("enqueueToast (H-01)", () => {
  it("membatasi antrean per posisi; yang tertua dibuang", () => {
    let queue: ToastRecord[] = []
    let recent = new Map<string, { id: string; at: number }>()
    for (let i = 0; i < 9; i++) {
      const id = `t${i}`
      ;({ queue, recent } = enqueueToast(queue, recent, { title: `Pesan ${i}` }, id, at + i))
    }
    expect(queue.length).toBe(5)
    // Yang bertahan = lima pesan TERAKHIR; pesan paling lama sudah usang.
    expect(queue.map((t) => t.title)).toEqual(["Pesan 4", "Pesan 5", "Pesan 6", "Pesan 7", "Pesan 8"])
    // Peta koalesensi ikut dibersihkan (tidak tumbuh selamanya).
    expect(recent.size).toBeLessThanOrEqual(5)
  })

  it("posisi berbeda punya jatah sendiri — toast bawah tidak terbuang oleh atas", () => {
    let queue: ToastRecord[] = []
    let recent = new Map<string, { id: string; at: number }>()
    for (let i = 0; i < 6; i++) {
      ;({ queue, recent } = enqueueToast(queue, recent, { title: `Atas ${i}` }, `a${i}`, at + i))
      ;({ queue, recent } = enqueueToast(
        queue,
        recent,
        { title: `Bawah ${i}`, position: "bottom" },
        `b${i}`,
        at + i,
      ))
    }
    expect(queue.filter((t) => (t.position ?? "top") === "top").length).toBe(5)
    expect(queue.filter((t) => t.position === "bottom").length).toBe(5)
  })

  it("mengkoalesensikan toast identik dalam jendela singkat", () => {
    let queue: ToastRecord[] = []
    let recent = new Map<string, { id: string; at: number }>()
    for (let i = 0; i < 3; i++) {
      ;({ queue, recent } = enqueueToast(
        queue,
        recent,
        { title: "Koneksi terputus", tone: "danger" },
        `t${i}`,
        at + i * 200, // beruntun, di bawah 1500 ms
      ))
    }
    expect(queue.map((t) => t.title)).toEqual(["Koneksi terputus"])
    // Yang tersisa adalah yang TERBARU (durasi mulai ulang), bukan yang pertama.
    expect(queue[0]?.id).toBe("t2")
  })

  it("isi yang sama setelah jendela lewat dianggap pesan baru", () => {
    let queue: ToastRecord[] = []
    let recent = new Map<string, { id: string; at: number }>()
    ;({ queue, recent } = enqueueToast(queue, recent, { title: "Koneksi terputus" }, "t0", at))
    ;({ queue, recent } = enqueueToast(queue, recent, { title: "Koneksi terputus" }, "t1", at + 5000))
    expect(queue.length).toBe(2)
  })

  it("judul sama tapi tone/posisi berbeda tidak dikoalesensikan", () => {
    let queue: ToastRecord[] = []
    let recent = new Map<string, { id: string; at: number }>()
    ;({ queue, recent } = enqueueToast(queue, recent, { title: "Selesai", tone: "success" }, "t0", at))
    ;({ queue, recent } = enqueueToast(queue, recent, { title: "Selesai", tone: "danger" }, "t1", at + 100))
    ;({ queue, recent } = enqueueToast(
      queue,
      recent,
      { title: "Selesai", tone: "success", position: "bottom" },
      "t2",
      at + 200,
    ))
    expect(queue.length).toBe(3)
  })
})

describe("<ToastProvider> (H-01)", () => {
  it("hujan pesan error hanya menyisakan baris terbaru yang muat di layar", () => {
    function Harness() {
      const toast = useToast()
      return (
        <button
          type="button"
          onClick={() => {
            for (let i = 0; i < 9; i++) toast.show({ title: `Gagal memuat bagian ${i}`, duration: 0 })
          }}
        >
          tampilkan
        </button>
      )
    }
    render(
      <ThemeProvider>
        <ToastProvider>
          <Harness />
        </ToastProvider>
      </ThemeProvider>,
    )
    fireEvent.click(screen.getByText("tampilkan"))

    // MAX_VISIBLE = 2: pesan paling lama TIDAK lagi memenuhi layar...
    expect(screen.queryByText("Gagal memuat bagian 0")).toBeNull()
    expect(screen.queryAllByText(/Gagal memuat bagian/).length).toBe(2)
    // ...dan antreannya sudah dipangkas ke MAX_QUEUE, jadi yang tampil adalah
    // sisa tertua dari lima pesan terakhir (yang lain menunggu, bukan hilang).
    expect(screen.getByText("Gagal memuat bagian 4")).toBeTruthy()
  })
})
