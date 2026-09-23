/**
 * Kahade — SATU implementasi label harga item Etalase (audit D-05/B-01).
 *
 * Sebelumnya ada TIGA implementasi dengan perilaku berbeda:
 *   - manajemen (`showcase-management.tsx`): min == max → "Rp X – Rp X"
 *     (rentang ganda); template "Mulai/Hingga" tidak bisa diterjemahkan.
 *   - feed (`showcase-feed-item.tsx`): item dengan hanya `priceMax`
 *     ditampilkan "Harga lewat diskusi" — data harga dibuang.
 *   - detail (`showcase/[id].tsx`): rentang menulis "Rp X – Rp Y" (Rp ganda)
 *     padahal feed menulis "Rp X – Y"; "Harga lewat diskusi" tidak ada di
 *     katalog i18n (ternary lolos dari pemindai gen-i18n-catalog).
 *
 * Semuanya kini lewat `showcasePriceLabel` + test table-driven
 * (`tests/showcase-labels.test.ts`) sehingga tidak bisa drift lagi.
 *
 * Semantik (disepakati dari union tiga layar):
 *   min & max berbeda → "Rp {min} – {max}" (satu prefiks Rp)
 *   min == max        → "Rp {min}" (harga pasti, bukan rentang)
 *   hanya min         → "Mulai Rp {min}"  (penjual membuka dari harga tsb.)
 *   hanya max         → "Hingga Rp {max}" (penjual menutup di harga tsb.)
 *   keduanya kosong   → "Harga lewat diskusi"
 *
 * `translate()` dipanggil dengan LITERAL eksplisit (bukan variabel) supaya
 * pemindai `gen:i18n` menangkap bentuknya dengan token {x}.
 */
import { formatNumber } from "@/lib/format"
import { translate } from "@/lib/i18n/translate"

export type ShowcasePriceLike = {
  priceMin?: number | null
  priceMax?: number | null
}

/**
 * Label harga siap tampil, atau `null` bila tidak ada harga sama sekali
 * (pemanggil yang ingin menampilkan fallback "Harga lewat diskusi" memakai
 * `showcasePriceLabelOrFallback`).
 */
export function showcasePriceLabel(item: ShowcasePriceLike): string | null {
  // Zero is a valid explicit price; null means unspecified. Invalid legacy ranges fall back to the lower bound.
  const min = item.priceMin ?? null
  const max = item.priceMax ?? null
  const lo = min != null && Number.isFinite(min) && min >= 0 ? min : null
  const hi = max != null && Number.isFinite(max) && max >= 0 ? max : null
  // B-06 (audit 2026-09-23): nol eksplisit = GRATIS (form manajemen menyebut
  // "0 untuk gratis") — jangan tampilkan "Rp 0". Berlaku untuk 0/0 maupun
  // satu-satunya terikat yang bernilai 0. Rentang 0–N (> 0) tetap "Rp 0 – N".
  if (lo === 0 && (hi === null || hi === 0)) return translate("Gratis")
  if (hi === 0 && lo === null) return translate("Gratis")
  if (lo != null && hi != null && hi < lo) return translate("Mulai Rp {x}", { x: formatNumber(lo) })
  if (lo != null && hi != null) {
    if (lo === hi) return translate("Rp {x}", { x: formatNumber(lo) })
    return translate("Rp {x} – {y}", { x: formatNumber(lo), y: formatNumber(hi) })
  }
  if (lo != null) return translate("Mulai Rp {x}", { x: formatNumber(lo) })
  if (hi != null) return translate("Hingga Rp {x}", { x: formatNumber(hi) })
  return null
}

/** Label harga dengan fallback netral bila item tidak mencantumkan harga. */
export function showcasePriceLabelOrFallback(item: ShowcasePriceLike): string {
  return showcasePriceLabel(item) ?? translate("Harga lewat diskusi")
}
