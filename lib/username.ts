/**
 * Kahade — util username murni (Batch 139, E01).
 *
 * Normalisasi username dipakai di SEMUA titik input (edit profil,
 * registrasi): lowercase, hanya [a-z0-9._], maks 20 karakter. Nilai yang
 * dinormalisasi inilah yang dicek ketersediaannya dan dikirim ke server —
 * tidak ada lagi tebakan "yang dicek itu versi apa".
 */

export const USERNAME_MIN = 3
export const USERNAME_MAX = 20

/** Bentuk FINAL username: persis string yang dikirim ke server. */
export function normalizeUsername(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9._]/g, "").slice(0, USERNAME_MAX)
}
