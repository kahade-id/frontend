/**
 * Kahade — state registrasi sementara (alur phone-register multi-step).
 *
 * Menyimpan `tempToken` dari `verify-otp` + metadata yang diperlukan screen
 * berikutnya (Buat Keamanan → Data Diri → `phone-register`). Module-level
 * memory, BUKAN SecureStore:
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
 * Hanya SATU registrasi aktif pada satu waktu. `setRegistrationState`
 * menimpa state sebelumnya.
 */
import type { OtpMethod } from "@/lib/api"

export type RegistrationState = {
  /** Temp token dari `POST /v1/auth/verify-otp` (isNewUser: true). */
  tempToken: string
  /** Nomor HP E.164 yang sedang didaftarkan — dipakai lagi di `phone-register`. */
  phoneNumber: string
  /** Metode OTP yang dipilih (dokumentasi; tidak wajib di `phone-register`). */
  method: OtpMethod
  /** Kata sandi dari screen #4 (Buat Keamanan). */
  password?: string
  /** PIN wallet 6 digit dari screen #4. */
  pin?: string
  /** Nama lengkap dari screen #5 — dipakai untuk sapaan di Setup Profil. */
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
