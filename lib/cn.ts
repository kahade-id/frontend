/**
 * Kahade — `cn()`: gabung className DAN selesaikan konfliknya.
 *
 * SEJARAH (penting, jangan diulang):
 * Versi lama fungsi ini hanya MENGGABUNG string dan menyerahkan urutan
 * override ke Tailwind, dengan alasan `text-h1` (type scale) vs
 * `text-text-primary` (warna) akan saling menimpa di tailwind-merge default.
 * Akibatnya nyata dan dilaporkan QA (2026-09): className berisi dua utility
 * yang saling bertentangan, mis.
 *
 *     cn("shrink px-5 pt-2 pb-4", contentClassName)  // contentClassName="px-0 pb-0"
 *     -> "shrink px-5 pt-2 pb-4 px-0 pb-0"
 *
 * Pemenangnya BUKAN yang ditulis terakhir, melainkan yang paling akhir muncul
 * di CSS hasil Tailwind — dan Tailwind memancarkan utility satu kelompok dari
 * skala terkecil, jadi NILAI BESAR selalu menang:
 *
 *   - web    : cascade CSS biasa. Bukti: dist/_expo/static/css/web-*.css,
 *              `.px-0` (byte 16605) mendahului `.px-5` (byte 17142).
 *   - native : react-native-css-interop mengurutkan rule lewat
 *              `specificityCompare` dengan tie-break `SpecificityIndex.Order`
 *              = urutan sumber CSS (dist/runtime/native/native-interop.js:238-242,
 *              569-597), lalu mendeklarasikannya berurutan.
 *
 * Jadi `px-0` dikalahkan `px-5`, `pb-0` oleh `pb-4`, `gap-1` oleh `gap-4`,
 * `px-4` oleh `px-5`, `w-10` oleh `w-full`. Gejalanya: override pemanggil
 * diabaikan, padding default komponen tetap dipakai, konten menjorok ke
 * kanan/kiri dan tidak sejajar judul di atasnya (BottomSheet komentar,
 * ActionSheet, BankSelect, DataScreen, ListItem, Input, …).
 *
 * PERBAIKAN: merge sungguhan (tailwind-merge) sehingga yang ditulis TERAKHIR
 * menang — persis niat penulis `cn(default, override)`. Kekhawatiran lama
 * (`text-h1` vs warna) diselesaikan dengan mendaftarkan type scale Kahade ke
 * classGroup `font-size`, sehingga `text-h1` dibaca sebagai UKURAN dan
 * `text-primary` tetap WARNA; keduanya tidak pernah saling membuang.
 *
 * Daftar `audit-class-conflicts.mjs` (npm run audit:classes) menemukan situs
 * yang dulunya rusak; setelah merge ini jumlahnya harus nol.
 */
import { extendTailwindMerge } from "tailwind-merge"

/**
 * Kunci type scale (§3.2) — sumber: `typography` di lib/tokens.ts, yang oleh
 * `toTailwindTheme()` dipetakan ke `theme.extend.fontSize`. Bila menambah
 * varian tipografi baru, tambahkan di sini juga (ada test penjaga di
 * tests/cn-merge.test.ts yang membandingkannya dengan tokens).
 */
const TYPE_SCALE = [
  "display",
  "h1",
  "h2",
  "h3",
  "bodyLarge",
  "body",
  "caption",
  "label",
  "monoLarge",
  "monoBody",
] as const

const mergeClasses = extendTailwindMerge({
  extend: {
    classGroups: {
      // `extend` (bukan `override`): ukuran bawaan Tailwind & nilai arbitrary
      // (text-[14px]) tetap terdaftar, nama type scale Kahade ditambahkan.
      "font-size": [{ text: [...TYPE_SCALE] }],
    },
  },
})

export type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | ClassValue[]
  | Record<string, boolean | null | undefined>

/** Gabung className kondisional, lalu selesaikan konflik: yang terakhir menang. */
export function cn(...inputs: ClassValue[]): string {
  return mergeClasses(join(inputs))
}

/** Penggabungan mentah (tanpa resolusi konflik) — dipakai cn() dan test. */
function join(inputs: ClassValue[]): string {
  const out: string[] = []
  for (const v of inputs) {
    if (!v) continue
    if (typeof v === "string" || typeof v === "number") {
      out.push(String(v))
    } else if (Array.isArray(v)) {
      const inner = join(v)
      if (inner) out.push(inner)
    } else {
      for (const [k, on] of Object.entries(v)) if (on) out.push(k)
    }
  }
  return out.join(" ")
}

/** Diekspor untuk test penjaga type scale. */
export const CN_TYPE_SCALE: readonly string[] = TYPE_SCALE
