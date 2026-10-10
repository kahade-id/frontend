/**
 * FD-09 (audit etalase 2026-10-10): ember menit untuk cap waktu relatif —
 * modul murni (tanpa impor React/expo) agar bisa dipakai & diuji di mana saja.
 */
export function minuteBucket(nowMs: number): number {
  return Math.floor(nowMs / 60_000)
}
