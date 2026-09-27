/**
 * Pengurutan ulasan profil publik (item 70, mega-batch 2026-09-28).
 *
 * Murni — dipisah dari `components/ui/profile-ratings-tab.tsx` agar bisa
 * di-unit-test tanpa runtime React Native. Semantik:
 * - "newest": pertahankan urutan server (endpoint mengembalikan terbaru dulu;
 *   tiebreak id) — stabil, jangan diacak ulang.
 * - "top": bintang tertinggi dulu, seri diputus tanggal terbaru.
 * Tidak mengubah array asli.
 */
import type { Rating } from "@/lib/api/ratings"

export type ProfileRatingSort = "newest" | "top"

export function sortProfileRatings(ratings: readonly Rating[], sort: ProfileRatingSort): Rating[] {
  if (sort !== "top") return [...ratings]
  return [...ratings].sort((a, b) => {
    if (b.stars !== a.stars) return b.stars - a.stars
    return String(b.createdAt).localeCompare(String(a.createdAt))
  })
}
