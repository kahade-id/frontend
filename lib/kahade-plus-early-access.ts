/**
 * Kahade — gate fitur akses awal (benefit 6 Kahade+).
 *
 * Layar Patungan & Split Bill BELUM ADA di repo ini (pencarian 2026-09-26:
 * tidak ada file/route yang memakainya). Saat layar itu dibangun, gate
 * tombol/menu-nya lewat fungsi ini — BUKAN lewat `useKahadePlus()` langsung
 * di tiap call site, supaya definisi "boleh akses" tetap satu tempat bila
 * aturannya berkembang (mis. tambah syarat versi app minimum).
 *
 * Sumber kebenaran tetap store `use-kahade-plus.ts`; fungsi ini hanya
 * proyeksi non-hook untuk dipakai di luar render (handler, util navigasi).
 * Di dalam render, pakai `useKahadePlus().earlyAccess`.
 */
import { getKahadePlusSnapshot } from "@/lib/use-kahade-plus"

export type EarlyFeatureKey = "patungan" | "split-bill"

/**
 * true bila anggota Kahade+ aktif DAN backend mengizinkan fitur ini
 * (`earlyAccess` dari GET /v1/subscriptions/me).
 */
export function canAccessEarlyFeature(key: EarlyFeatureKey): boolean {
  const snap = getKahadePlusSnapshot()
  if (!snap.isActive) return false
  return snap.earlyAccess[key] === true
}
