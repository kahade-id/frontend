/**
 * Dipakai `Stack.Protected` di root layout (P0-1, audit perf/UX 2026-10-03).
 *
 * Guard lama `Boolean(session.token)` mencabut ~100 layar ber-auth pada frame
 * pertama tanpa token. Saat sesi benar-benar kedaluwarsa, pencabutan itulah
 * yang menghancurkan navigation stack SEBELUM modal pemulihan lembut sempat
 * tampil — pengguna yang login ulang lalu tidak bisa kembali ke alur
 * semula.
 *
 * Fungsi murni (tanpa React) supaya kontraknya bisa diuji langsung.
 */
export function shouldMountAuthStack(input: {
  /** Web: guard selalu true (pemblokiran tamu lewat GuestLoginPrompt). */
  isWeb: boolean
  token: string | null
  /** Modal pemulihan lembut sedang tampil (P0-1) — stack harus tetap hidup. */
  softReauth: boolean
}): boolean {
  if (input.isWeb) return true
  if (input.token) return true
  return input.softReauth
}
