/**
 * Dipakai `Stack.Protected` di root layout (P0-1/P0-2, audit perf/UX
 * 2026-10-03).
 *
 * Guard lama `Boolean(session.token)` mencabut ~100 layar ber-auth pada frame
 * pertama tanpa token. Saat sesi benar-benar kedaluwarsa, pencabutan itulah
 * yang menghancurkan navigation stack SEBELUM modal pemulihan lembut sempat
 * tampil — pengguna yang login ulang lalu tidak bisa kembali ke alur
 * semula.
 *
 * P0-2 menambahkan suku ketiga: restorasi sesi optimistis (ST-002) merender
 * dengan token null selagi verifikasi background berjalan. Selama jendela
 * toleransi (`verifying`, lihat lib/session-verify-grace.ts) stack harus tetap
 * ter-mount — kalau tidak, pengguna terlempar dari layar yang sedang dibuka
 * padahal sesinya masih sah.
 *
 * Fungsi murni (tanpa React) supaya kontraknya bisa diuji langsung —
 * "token null + verifying true → guard tetap true".
 */
export function shouldMountAuthStack(input: {
  /** Web: guard selalu true (pemblokiran tamu lewat GuestLoginPrompt). */
  isWeb: boolean
  token: string | null
  /**
   * Verifikasi sesi background (ST-002) sedang berjalan DAN masih di dalam
   * jendela toleransi 10 detik (P0-2). Verifikasi yang menggantung lebih lama
   * tidak lagi menahan stack.
   */
  verifying: boolean
  /** Modal pemulihan lembut sedang tampil (P0-1) — stack harus tetap hidup. */
  softReauth: boolean
}): boolean {
  if (input.isWeb) return true
  if (input.token) return true
  if (input.verifying) return true
  return input.softReauth
}
