/**
 * Kahade — hitSlopToReach() (audit #1, target sentuh ≥ 44pt).
 *
 * Menghitung `hitSlop` yang membawa elemen visual kecil (ikon 16–24px, teks
 * satu baris) ke target sentuh minimum `tokens.a11y.minHitTarget` tanpa
 * mengubah tampilannya. Ada supaya call site tidak menghitung `(44 - 20) / 2`
 * sendiri-sendiri dengan angka literal.
 *
 * Kapan pakai hitSlop vs kotak nyata (`min-h-11 min-w-11`):
 *   - hitSlop  : elemen kecil di dalam container yang SUDAH ≥ 44 pada sumbu
 *                itu (ikon clear di Input h-14, thumb slider di track tinggi).
 *                Area slop tidak boleh diharapkan menembus parent yang
 *                `overflow-hidden`.
 *   - kotak    : elemen berdiri sendiri, atau berada di baris pendek (< 44)
 *                yang tidak clip — beri `min-h-11 min-w-11 items-center
 *                justify-center` dan, bila layout tidak boleh bergeser,
 *                margin negatif (`-my-3`) agar kotak "meluber" tanpa
 *                menambah tinggi baris. Contoh: toggle mata di
 *                WalletBalanceCard.
 *
 * Pembulatan ke atas agar total tidak pernah < target karena angka ganjil
 * (mis. line-height 22 -> slop 11).
 */
import type { Insets } from "react-native"

import { tokens } from "@/lib/tokens"

/**
 * @param width  lebar visual elemen (px)
 * @param height tinggi visual elemen (px); default = width (ikon persegi)
 * @param target target sentuh; default `tokens.a11y.minHitTarget` (44)
 */
export function hitSlopToReach(
  width: number,
  height: number = width,
  target: number = tokens.a11y.minHitTarget,
): Required<Insets> {
  const x = Math.max(0, Math.ceil((target - width) / 2))
  const y = Math.max(0, Math.ceil((target - height) / 2))
  return { top: y, bottom: y, left: x, right: x }
}

/** Slop siap pakai untuk `<Icon size="sm">` (20px) di dalam container ≥ 44px. */
export const ICON_SM_HIT_SLOP = hitSlopToReach(tokens.icon.size.sm)

/** Slop siap pakai untuk `<Icon size="xs">` (16px) di dalam container ≥ 44px. */
export const ICON_XS_HIT_SLOP = hitSlopToReach(tokens.icon.size.xs)
