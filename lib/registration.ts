/**
 * Kahade — state registrasi sementara (alur phone-register, auth-rework).
 *
 * Menyimpan `tempToken` dari `verify-otp` (status `new_user`) + nomor HP yang
 * sedang didaftarkan untuk layar berikutnya (buat kata sandi + data diri →
 * `phone-register`). Module-level memory, BUKAN SecureStore:
 *
 *   - `tempToken` short-lived (beberapa menit sebelum expire di backend).
 *   - Bukan rahasia jangka panjang — hanya bermakna di dalam alur registrasi
 *     yang sedang berjalan.
 *   - Tidak perlu bertahan dari app restart: kalau user menutup app di tengah
 *     registrasi, alur diulang dari awal (OTP baru, tempToken baru). Ini
 *     lebih aman daripada menyimpan token yang mungkin sudah expire.
 *   - SecureStore di iOS/Android tetap aman, tapi menambahkan I/O async di
 *     setiap baca — tidak sepadan untuk data yang hanya hidup beberapa menit.
 *
 * Web: module-level variable hilang saat reload, sama seperti SecureStore
 * (yang di web jatuh ke memori proses). Konsisten.
 *
 * Auth-rework: phone-register disederhanakan — hanya tempToken, nama
 * lengkap, username opsional, dan password. Password dikumpulkan dan langsung
 * disubmit di layar yang sama (tidak lagi disimpan di state antar-screen),
 * dan PIN wallet tidak lagi diminta saat registrasi.
 *
 * Hanya SATU registrasi aktif pada satu waktu. `setRegistrationState`
 * menimpa state sebelumnya.
 */
export type RegistrationState = {
  /** Temp token dari `POST /v1/auth/verify-otp` (status `new_user`). */
  tempToken: string
  /** Nomor HP E.164 yang sedang didaftarkan — untuk ditampilkan kembali. */
  phoneNumber: string
  /**
   * Nama lengkap pasca phone-register — hanya untuk sapaan di
   * setup-profile. Tidak pernah menyimpan password. Boleh kosong saat
   * phone-register belum dipanggil.
   */
  fullName?: string
}

let state: RegistrationState | null = null

/** Simpan state registrasi. Menimpa state sebelumnya bila ada. */
export function setRegistrationState(data: RegistrationState): void {
  state = data
}

/** Baca state registrasi aktif. `null` bila tidak ada alur yang berjalan. */
export function getRegistrationState(): RegistrationState | null {
  return state
}

/** Hapus state — dipanggil setelah `phone-register` berhasil, atau user membatalkan. */
export function clearRegistrationState(): void {
  state = null
}

/** Reset memori (dipakai test). */
export function resetRegistrationStateForTest(): void {
  state = null
}
