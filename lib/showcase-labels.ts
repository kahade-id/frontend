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
  // Konvensi menurun dari form (priceMin/priceMax 0 = "tidak diisi") & DTO
  // (minimum: 0) → normalisasi 0 → null; tanpa ini "Rp 1.000 – 0" bisa tampil.
  const min = item.priceMin ?? null
  const max = item.priceMax ?? null
  const lo = min != null && min > 0 ? min : null
  const hi = max != null && max > 0 ? max : null
  if (lo != null && hi != null) {
    if (lo === hi) return `Rp ${formatNumber(lo)}`
    return `Rp ${formatNumber(lo)} – ${formatNumber(hi)}`
  }
  if (lo != null) return translate("Mulai Rp {x}", { x: formatNumber(lo) })
  if (hi != null) return translate("Hingga Rp {x}", { x: formatNumber(hi) })
  return null
}

/** Label harga dengan fallback netral bila item tidak mencantumkan harga. */
export function showcasePriceLabelOrFallback(item: ShowcasePriceLike): string {
  return showcasePriceLabel(item) ?? translate("Harga lewat diskusi")
}
