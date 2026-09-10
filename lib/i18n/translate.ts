/**
 * Kahade — penerjemah (`t`).
 *
 * Model: string Indonesia di sumber adalah KUNCINYA. Tidak ada tabel id simbolik
 * (`settings.title`) yang harus dijaga sinkron dengan kode.
 *
 * Kenapa kunci = teks sumber (non-obvious):
 *   - Menulis `t("Gagal memuat")` berarti teks fallback = teks yang benar-benar
 *     tampil kalau terjemahan belum ada. Menambah bahasa baru tidak bisa
 *     membuat layar blank atau menampilkan `settings.title`.
 *   - Menambah string UI baru = nol langkah tambahan: katalog di-generate ulang,
 *     terjemahannya menyusul, sisanya jatuh ke Indonesia. Ini yang membuat
 *     i18n bisa diadopsi bertahap di app 90 layar tanpa "big bang".
 *   - Hukumannya: mengubah copy Indonesia = mengubah kunci. Untuk itu ada
 *     `npm run check:i18n` (katalog usang → CI gagal), bukan runtime.
 *
 * Urutan pencarian untuk bahasa target:
 *   1. kunci persis (paling umum: label pendek, judul layar);
 *   2. kunci persis setelah whitespace dikompres (teks JSX multi-baris);
 *   3. BENTUK string — angka/nilai runtime diganti `{x}` (lib/i18n/shape.ts),
 *      nilai sumber dipasang kembali ke terjemahan berurutan;
 *   4. tidak ada → kembalikan sumber (Indonesia) apa adanya.
 *
 * Interpolasi bernama untuk pemanggil yang memang butuh: `t("Halo {name}", { name })`.
 */
import type { ReactNode } from "react"

import { collapse, fillTokens, interpolate, shapeOf } from "./shape"
import { SOURCE_LANGUAGE } from "./languages"
import { getLanguage } from "./store"
import { EN } from "./en"

export type TranslateVars = Record<string, string | number> | readonly (string | number)[]

type Dict = Record<string, string>

/** Kamus per bahasa target. "id" = bahasa sumber, tidak butuh kamus. */
const DICTS: Partial<Record<string, Dict>> = { en: EN }

/** Cache hasil terjemahan per (bahasa, kunci). Kunci UI itu sedikit tapi banyak;
 *  dibatasi supaya list panjang (ribuan baris transaksi) tidak menambah memori tanpa batas. */
const CACHE_MAX = 4000
const cache = new Map<string, string>()

/** Uji manual/tes: bersihkan cache setelah menukar kamus atau bahasa. */
export function clearTranslationCache(): void {
  cache.clear()
}

function lookup(dict: Dict, source: string): string | undefined {
  const exact = dict[source]
  if (exact !== undefined) return exact

  const collapsed = collapse(source)
  if (collapsed !== source) {
    const hit = dict[collapsed]
    if (hit !== undefined) return hit
  }

  const { shape, values } = shapeOf(collapsed)
  const shaped = dict[shape]
  if (shaped !== undefined) return values.length > 0 ? fillTokens(shaped, values) : shaped
  return undefined
}

/**
 * Terjemahkan `source` (teks Indonesia di kode) ke bahasa aktif.
 *
 * `source` sengaja bertipe longgar: dipakai di titik render yang bisa menerima
 * `undefined`/number dari props, dan penerjemah tidak boleh jadi sumber crash.
 */
export function translate(source: unknown, vars?: TranslateVars): string {
  if (typeof source === "number" || typeof source === "boolean") source = String(source)
  if (typeof source !== "string" || source.length === 0) return (source as string) ?? ""

  const lang = getLanguage()
  const dict = lang === SOURCE_LANGUAGE ? undefined : DICTS[lang]

  let out: string
  if (!dict) {
    out = source
  } else {
    const key = `${lang}\u0001${source}`
    const cached = cache.get(key)
    if (cached !== undefined) {
      out = cached
    } else {
      out = lookup(dict, source) ?? source
      if (cache.size >= CACHE_MAX) cache.clear()
      cache.set(key, out)
    }
  }
  return vars ? interpolate(out, vars) : out
}

/**
 * Varian untuk prop yang boleh `undefined` (`<Text accessibilityLabel={x}>`),
 * supaya pemanggil tidak perlu menulis `x ? t(x) : undefined` di mana-mana.
 */
export function translateProp(
  source: string | null | undefined,
  vars?: TranslateVars,
): string | undefined {
  if (source === null || source === undefined || source === "") return source ?? undefined
  return translate(source, vars)
}

/**
 * Terjemahkan children React (<Text> memanggil ini untuk SEMUA teks di app).
 *
 * Hanya string murni yang disentuh. Children campuran (`Halo {name}`) sengaja
 * TIDAK digabung lalu diterjemahkan: menggabungkan string di dalam <Text>
 * mengubah cara React me-render (kutipan, key) dan hasil render RN berbeda dari
 * JSX aslinya. Teks bercampur seperti itu tetap Indonesia sampai penulis
 * layar memakainya lewat `t("… {name}", { name })`.
 */
export function localizeChildren(children: ReactNode): ReactNode {
  if (typeof children === "string") return children.length > 0 ? translate(children) : children
  if (Array.isArray(children)) {
    let changed = false
    const next = children.map((child) => {
      const local = localizeChildren(child)
      if (local !== child) changed = true
      return local
    })
    return changed ? next : children
  }
  return children
}

/** Apakah `source` punya terjemahan di bahasa aktif? (dipakai tes cakupan) */
export function hasTranslation(source: string, lang = getLanguage()): boolean {
  const dict = lang === SOURCE_LANGUAGE ? undefined : DICTS[lang]
  if (!dict) return true
  return lookup(dict, source) !== undefined
}
