/**
 * Regresi crash Bug 1 (2026-10-08): updater `useAnimatedStyle` memanggil fungsi JS.
 *
 * Penyebab: `entranceStyle` di chat-message-bubble memanggil `bubbleEntranceVector`
 * (fungsi JS biasa dari lib/chat-bubble-motion) DARI DALAM updater. Updater
 * berjalan di UI thread; di sana fungsi JS jadi remote function dan pemanggilan
 * sinkron melempar → app putih/macet. Setiap bubble yang ter-mount memicunya.
 *
 * Kenapa test ini memakai Babel dan bukan test komponen: stub Reanimated di
 * Vitest menjalankan updater langsung di JS thread, jadi bug ini TIDAK terlihat
 * di test komponen. Di sini kita transform file sungguhan dengan konfigurasi
 * Babel proyek (plugin worklet ikut di dalamnya) dan memeriksa `__closure` tiap
 * worklet: tidak boleh ada referensi ke modul motion yang tidak diberi direktif
 * "worklet".
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { describe, expect, it } from "vitest"

/**
 * `@babel/core` ikut sebagai dependensi transitif dari babel-preset-expo (yang
 * dipakai babel.config.js), dan repo tidak punya @types/babel__core. Tipe
 * minimal di sini; bila paket itu hilang, `require` gagal dan test ikut gagal.
 */
type BabelTransformSync = (
  code: string,
  options: Record<string, unknown>,
) => { code?: string | null } | null
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { transformSync } = require("@babel/core") as { transformSync: BabelTransformSync }

const ROOT = resolve(__dirname, "..")

/** Modul JS biasa yang fungsinya TIDAK boleh dipanggil dari dalam worklet. */
const NON_WORKLET_MODULE_ALIASES = ["_chatBubbleMotion"]
/**
 * Bug #9 (audit Pesan 2026-10-10, force close saat swipe reply): fungsi dari
 * lib/chat-bubble yang pernah dipanggil dari worklet pan. Modulnya juga
 * mengekspor KONSTANTA yang sah ditangkap worklet (nilai), jadi yang dilarang
 * adalah referensi FUNGSI-nya, bukan seluruh modul.
 */
const NON_WORKLET_FUNCTION_REFS = ["_chatBubble.clampSwipeReply", "_chatBubble.shouldTriggerSwipeReply"]

/** Transform satu berkas dengan konfigurasi Babel proyek (caller = Metro, dev). */
function transformWithProjectBabel(relativePath: string): string {
  const filename = resolve(ROOT, relativePath)
  const out = transformSync(readFileSync(filename, "utf8"), {
    cwd: ROOT,
    filename,
    caller: { name: "metro", platform: "android", bundler: "metro", isDev: true, supportsStaticESM: false },
    babelrc: false,
    configFile: resolve(ROOT, "babel.config.js"),
    compact: false,
    sourceMaps: false,
  })
  if (!out?.code) throw new Error(`Babel tidak menghasilkan kode untuk ${relativePath}`)
  return out.code
}

/**
 * Daftar nilai yang ditangkap setiap worklet. Plugin menulis dua bentuk: array
 * `__closure` (memakai nama lokal hasil destrukturisasi) dan argumen factory
 * `}([_worklet_<hash>_init_data, <nilai>...])` yang memakai nama modul penuh
 * (mis. `_chatBubbleMotion.bubbleEntranceVector`). Yang kedua dipakai karena
 * di situlah referensi modul terlihat.
 */
function closureBodies(code: string): string[] {
  const bodies: string[] = []
  const pattern = /\}\(\[(_worklet_[^\]]*)\]/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(code)) !== null) bodies.push(match[1] ?? "")
  return bodies
}

/** Daftar pelanggaran: closure worklet yang memuat referensi modul non-worklet. */
function nonWorkletClosureRefs(code: string): string[] {
  return closureBodies(code).filter(
    (body) =>
      NON_WORKLET_MODULE_ALIASES.some((alias) => body.includes(alias)) ||
      NON_WORKLET_FUNCTION_REFS.some((ref) => body.includes(ref)),
  )
}

describe("regresi crash worklet (Bug 1)", () => {
  it("chat-message-bubble: tidak ada worklet yang memanggil helper motion JS", () => {
    const code = transformWithProjectBabel("components/ui/chat-message-bubble.tsx")
    // Worklet memang terbentuk (kalau tidak, test ini kosong dan lulus diam-diam).
    expect(closureBodies(code).length).toBeGreaterThanOrEqual(5)
    expect(nonWorkletClosureRefs(code)).toEqual([])
  }, 60_000)

  it("chat-message-row: tidak ada worklet yang memanggil helper motion JS", () => {
    const code = transformWithProjectBabel("components/ui/chat-message-row.tsx")
    expect(nonWorkletClosureRefs(code)).toEqual([])
  }, 60_000)

  it("use-swipe-reply-pan: gesture worklet hanya membawa konstanta dan callback runOnJS", () => {
    const code = transformWithProjectBabel("lib/use-swipe-reply-pan.ts")
    expect(closureBodies(code).length).toBeGreaterThanOrEqual(2)
    expect(nonWorkletClosureRefs(code)).toEqual([])
  }, 60_000)

  it("bug #9 (force close swipe reply): onUpdate TIDAK memanggil clampSwipeReply dari lib/chat-bubble", () => {
    // Regresi 23a8c12 (#11): `swipeX.value = clampSwipeReply(e.translationX)`
    // di dalam worklet → remote function call di UI thread → app tertutup
    // paksa begitu bubble digeser. Closure worklet hanya boleh memuat
    // konstanta modul, bukan fungsinya.
    const code = transformWithProjectBabel("lib/use-swipe-reply-pan.ts")
    const bodies = closureBodies(code)
    expect(bodies.some((b) => b.includes("_chatBubble.SWIPE_REPLY_MAX_PX"))).toBe(true)
    expect(bodies.filter((b) => b.includes("_chatBubble.clampSwipeReply"))).toEqual([])
  }, 60_000)

  it("use-safe-animated-style: pembungkus membawa updater + fallback, tanpa helper motion", () => {
    const code = transformWithProjectBabel("lib/use-safe-animated-style.ts")
    expect(closureBodies(code).length).toBeGreaterThanOrEqual(1)
    expect(nonWorkletClosureRefs(code)).toEqual([])
  }, 60_000)

  it("detektor menangkap pola yang menjadi penyebab crash (uji diri detektor)", () => {
    // Berkas sintetis di direktori sementara: plugin worklet membaca sumbernya dari disk.
    const dir = mkdtempSync(join(tmpdir(), "worklet-closure-"))
    try {
      const filename = join(dir, "synthetic-bad.tsx")
      writeFileSync(
        filename,
        [
          'import { bubbleEntranceVector } from "@/lib/chat-bubble-motion"',
          'import { useAnimatedStyle } from "react-native-reanimated"',
          "export function useBad(direction, entrance) {",
          "  return useAnimatedStyle(() => {",
          "    const from = bubbleEntranceVector(direction)",
          "    return { opacity: entrance.value, transform: [{ translateX: from.translateX }] }",
          "  })",
          "}",
        ].join("\n"),
      )
      const bad = transformSync(readFileSync(filename, "utf8"), {
        cwd: ROOT,
        filename,
        caller: { name: "metro", platform: "android", bundler: "metro", isDev: true, supportsStaticESM: false },
        babelrc: false,
        configFile: resolve(ROOT, "babel.config.js"),
        sourceMaps: false,
      })?.code
      expect(bad).toBeTruthy()
      expect(nonWorkletClosureRefs(bad ?? "").length).toBeGreaterThan(0)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }, 60_000)
})
