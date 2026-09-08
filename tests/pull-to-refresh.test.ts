/**
 * Kahade — lib/pull-math (keputusan gesture <PullToRefresh>).
 *
 * Kenapa berkas ini ada: laporan pengguna "pull to refresh ga bisa di scroll"
 * TIDAK bisa direproduksi di jsdom (perlu sentuhan nyata + RNGH native), dan
 * tidak ada satu pun barisnya yang tertangkap typecheck. Yang bisa dikunci di
 * sini adalah KONTRAK KEPUTUSAN-nya: kapan pan mengambil alih gerakan, dan
 * berapa jauh konten boleh bergeser. Setiap regresi pada kontrak inilah yang
 * berubah menjadi "scroll macet" atau "tarikan tidak pernah memicu refresh"
 * di perangkat — lihat docs/audit/PULL-TO-REFRESH-2026-09-08.md.
 *
 * Aturan yang dijaga:
 *   1. "Di puncak" adalah pertanyaan dengan toleransi, bukan `offset > 0`.
 *   2. Gesture yang bukan tarikan harus FAIL, bukan dibiarkan menggantung.
 *   3. Tarikan tidak pernah bernilai negatif dan tidak pernah tanpa batas.
 */
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

import {
  AT_TOP_EPSILON,
  decidePull,
  FAIL_OFFSET_X,
  FAIL_OFFSET_Y,
  isAtTop,
  pullDistance,
  reachedThreshold,
  PULL_ACTIVATE_OFFSET,
} from "@/lib/pull-math"

const THRESHOLD = 64

describe("isAtTop — 'di puncak' toleran terhadap sub-piksel", () => {
  /**
   * Inti regresi 1: ScrollView melaporkan offset 0.33 / 0.997 di puncak
   * (setelah fling berhenti, atau setelah contentContainerStyle berubah
   * tinggi). Perbandingan ketat `offset > 0` membuat tarikan dianggap "belum
   * di puncak" selamanya -> pull-to-refresh mati tanpa pesan.
   */
  it("menerima offset sub-piksel sebagai puncak", () => {
    expect(isAtTop(0)).toBe(true)
    expect(isAtTop(0.33)).toBe(true)
    expect(isAtTop(0.997)).toBe(true)
    expect(isAtTop(AT_TOP_EPSILON)).toBe(true)
  })

  it("menolak offset yang benar-benar sudah bergulir", () => {
    expect(isAtTop(AT_TOP_EPSILON + 0.01)).toBe(false)
    expect(isAtTop(240)).toBe(false)
  })

  /** iOS rubber-band: offset negatif itu sah dan tetap "di puncak". */
  it("menganggap offset negatif (overscroll iOS) sebagai puncak", () => {
    expect(isAtTop(-18)).toBe(true)
  })
})

describe("decidePull — satu keputusan per sentuhan", () => {
  it("mengaktifkan pan hanya bila di puncak DAN menarik turun melewati ambang", () => {
    expect(decidePull({ offsetY: 0, dy: PULL_ACTIVATE_OFFSET, dx: 0 })).toBe("hold")
    expect(decidePull({ offsetY: 0, dy: PULL_ACTIVATE_OFFSET + 1, dx: 0 })).toBe("activate")
    expect(decidePull({ offsetY: 0.5, dy: 40, dx: 0 })).toBe("activate")
  })

  it("belum memutuskan apa pun untuk sentuhan yang masih diragukan", () => {
    expect(decidePull({ offsetY: 0, dy: 2, dx: 1 })).toBe("hold")
  })

  /**
   * Inti regresi 2 (keluhan "list tidak bisa di-scroll sampai ujung"): di
   * tengah list, pan harus KELUAR dari antrean gesture, bukan diam sebagai
   * handler UNDETERMINED. Handler yang menggantung ikut menahan sentuhan
   * sepanjang gesture dan itulah yang membuat scroll terasa tersendat.
   */
  it("gagal permanen saat list belum di puncak dan jari sudah bergerak", () => {
    expect(decidePull({ offsetY: 400, dy: FAIL_OFFSET_Y + 1, dx: 0 })).toBe("fail")
    expect(decidePull({ offsetY: 400, dy: -300, dx: 0 })).toBe("fail")
    expect(decidePull({ offsetY: 400, dy: 0, dx: FAIL_OFFSET_X + 1 })).toBe("fail")
    // Geser <1px (jari baru menempel, belum tentu scroll): jangan gagal dulu,
    // supaya tap pada baris tidak dianggap gesture yang batal.
    expect(decidePull({ offsetY: 400, dy: 3, dx: 2 })).toBe("hold")
  })

  it("gagal saat di puncak tapi jari mendorong ke atas (itu tugas scroll)", () => {
    expect(decidePull({ offsetY: 0, dy: -(FAIL_OFFSET_Y + 1), dx: 0 })).toBe("fail")
  })

  it("gagal untuk tarikan menyamping (swipe baris, bukan refresh)", () => {
    expect(decidePull({ offsetY: 0, dy: 4, dx: 60 })).toBe("fail")
  })

  it("`blocked` mematahkan sentuhan seketika, bukan menahannya", () => {
    // Kasus nyata: refresh sedang berjalan dan pengguna mulai menarik di puncak.
    // Tanpa `blocked` keputusan ini "activate" -> pan ikut memegang sentuhan
    // selama indikator hidup.
    expect(decidePull({ offsetY: 0, dy: PULL_ACTIVATE_OFFSET + 5, dx: 0 })).toBe("activate")
    expect(
      decidePull({ offsetY: 0, dy: PULL_ACTIVATE_OFFSET + 5, dx: 0, blocked: true }),
    ).toBe("fail")
    // Bukan sekadar `hold`: gerakan kecil pun harus melepas antrean gesture.
    expect(decidePull({ offsetY: 0, dy: 1, dx: 0, blocked: true })).toBe("fail")
    // Status layar lain (sudah bergulir) tidak mengubah hasilnya.
    expect(decidePull({ offsetY: 500, dy: 40, dx: 0, blocked: true })).toBe("fail")
  })

  it("`blocked` default false — pemanggil lama tidak berubah perilakunya", () => {
    expect(decidePull({ offsetY: 0, dy: PULL_ACTIVATE_OFFSET + 5, dx: 0 })).toBe(
      decidePull({ offsetY: 0, dy: PULL_ACTIVATE_OFFSET + 5, dx: 0, blocked: false }),
    )
  })
})

describe("pullDistance — 1:1 sampai ambang, lalu melawan, selalu ada batas", () => {
  it("1:1 sebelum ambang", () => {
    expect(pullDistance(12, THRESHOLD)).toBe(12)
    expect(pullDistance(THRESHOLD, THRESHOLD)).toBe(THRESHOLD)
  })

  /**
   * Tidak boleh ada lompatan di ambang: bila nilai tepat di ambang dan tepat
   * di atasnya berbeda jauh, logo "tersentak" setiap kali ambang dilewati.
   */
  it("kontinu di titik ambang", () => {
    const atThreshold = pullDistance(THRESHOLD, THRESHOLD)
    const justAbove = pullDistance(THRESHOLD + 0.0001, THRESHOLD)
    expect(Math.abs(justAbove - atThreshold)).toBeLessThan(0.0001)
  })

  it("melawan setelah ambang dan dibatasi 1.6x", () => {
    const beyond = pullDistance(THRESHOLD * 4, THRESHOLD)
    expect(beyond).toBeLessThan(THRESHOLD * 4)
    expect(beyond).toBeCloseTo(THRESHOLD * 1.6, 6)
    // Seberapa jauh pun jari menarik, konten tidak pernah lewat dari batas.
    expect(pullDistance(100_000, THRESHOLD)).toBeCloseTo(THRESHOLD * 1.6, 6)
  })

  /**
   * Negatif = konten terdorong ke ATAS. Itu bukan tugas pull-to-refresh
   * (scroll yang mengurusnya), dan membolehkannya membuat konten "menembus"
   * header lalu tertinggal di sana.
   */
  it("tidak pernah negatif", () => {
    expect(pullDistance(-240, THRESHOLD)).toBe(0)
    expect(pullDistance(0, THRESHOLD)).toBe(0)
  })

  /** Pemanggil boleh mengirim `threshold={0}`; tidak boleh jadi tarik-bebas. */
  it("aman untuk threshold nol", () => {
    expect(pullDistance(500, 0)).toBe(0)
    expect(reachedThreshold(500, 0)).toBe(false)
  })
})

describe("reachedThreshold — pemicu refresh, sekali per gesture", () => {
  it("inklusif di ambang", () => {
    expect(reachedThreshold(THRESHOLD - 0.5, THRESHOLD)).toBe(false)
    expect(reachedThreshold(THRESHOLD, THRESHOLD)).toBe(true)
  })

  it("tetap benar di sepanjang overpull (jarak sudah dibatasi, bukan mentok)", () => {
    expect(reachedThreshold(pullDistance(THRESHOLD * 3, THRESHOLD), THRESHOLD)).toBe(true)
  })
})

/**
 * Kontrak yang tidak bisa dibaca dari satu fungsi, jadi dikunci di sini:
 * ambang aktivasi HARUS lebih kecil dari ambang gagal-ke-atas, kalau tidak
 * sentuhan singkat ke atas akan membunuh gesture yang sedang sah ditarik.
 */
it("ambang aktivasi < ambang gagal vertikal", () => {
  expect(PULL_ACTIVATE_OFFSET).toBeLessThanOrEqual(FAIL_OFFSET_Y + FAIL_OFFSET_X)
  expect(PULL_ACTIVATE_OFFSET).toBeGreaterThan(0)
})

/**
 * Kontrak TOOLCHAIN — bagian ini bukan tes logika, tapi pengunci build.
 *
 * Empat fungsi di lib/pull-math.ts dipanggil dari dalam `Gesture.Pan()`, yaitu
 * worklet yang dikompilasi plugin Reanimated untuk UI thread. Supaya sah,
 * fungsinya sendiri harus berstatus worklet: direktif `"worklet"` di baris
 * pertama badan fungsi. Bentuknya memang string literal yang tidak melakukan
 * apa pun di JS — persis tipe baris yang dihapus orang saat "merapikan kode",
 * dan hilangnya baru kelihatan di perangkat (gesture error di UI thread), bukan
 * di typecheck. Bukti empiris perbedaan keduanya, dijalankan dengan config
 * babel repo:
 *
 *   tanpa direktif  -> lib/pull-math.ts: __workletHash 0   (worklet pemanggil
 *                      menangkapnya sebagai closure: `decidePull:decidePull`)
 *   dengan direktif -> lib/pull-math.ts: __workletHash 4
 *
 * Kalau tes ini gagal: jangan hapus direktifnya — perbaiki pemanggilnya.
 */
describe("lib/pull-math bertahan sebagai worklet", () => {
  const here = fileURLToPath(import.meta.url)
  const src = readFileSync(resolve(here, "..", "..", "lib", "pull-math.ts"), "utf8")
  const exported = [...src.matchAll(/export function (\w+)/g)].map((m) => m[1])

  it("menemukan keempat fungsi yang dipakai dari worklet", () => {
    expect(exported.sort()).toEqual(
      ["decidePull", "isAtTop", "pullDistance", "reachedThreshold"].sort(),
    )
  })

  it.each(exported)("%s dibuka dengan direktif worklet", (name) => {
    // Batasi ke badan fungsi ini SAJA: tanpa batas, pencarian bisa "lari" ke
    // fungsi berikutnya yang punya direktif dan lolos walau direktifnya dihapus
    // (itu justru yang terjadi saat tes ini ditulis ulang, dan tertangkap oleh
    // uji-mati-tes). Kurung kurawal pembuka dikenali dari `)` sebelumnya, karena
    // signature decidePull memuat object literal untuk tipenya.
    const at = src.indexOf(`export function ${name}`)
    const next = src.indexOf("export function", at + 1)
    const body = src.slice(at, next === -1 ? undefined : next)
    expect(/\)\s*(?::[^{}]*?)?\{\s*"worklet"/.test(body)).toBe(true)
  })
})
