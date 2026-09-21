/**
 * Kahade — state alur OTP sementara (B-07/B-14 audit).
 *
 * Sebelumnya `phoneNumber`, `refCode`, `whatsappUrl`, `triggerText`, dan
 * `expiresAt` dilewatkan sebagai QUERY PARAMETER URL antar layar auth. Di web
 * itu berarti nomor HP + kode referensi masuk history browser, berpotensi
 * masuk log hosting/CDN, dan bocor lewat header Referer saat
 * `Linking.openURL` keluar aplikasi. Lebih buruk: `/verify-otp?phoneNumber=X`
 * bisa dibuka siapa pun untuk memicu resend OTP ke nomor korban (vektor OTP
 * bombing — B-14).
 *
 * Solusinya mengikuti preseden yang sudah ada di repo (`lib/registration.ts`,
 * tempToken 2FA di login): state alur disimpan di MEMORI modul, URL hanya
 * nama rute tanpa data. Konsekuensi yang diterima (sama seperti
 * registration state): reload web / restart app di tengah alur → state hilang
 * → layar OTP mengembalikan pengguna ke Register. Itu aman: OTP yang belum
 * diverifikasi memang tidak boleh bertahan dari sesi browser yang baru.
 *
 * Hanya SATU alur OTP aktif pada satu waktu; `setOtpFlow` menimpa sebelumnya.
 */
import type { OtpMethod } from "@/lib/api"

export type OtpFlowState = {
  /** Nomor HP E.164 yang sedang diverifikasi. */
  phoneNumber: string
  /** Metode pengiriman OTP. */
  method: OtpMethod
  /** Kode referensi trigger WhatsApp (customer-initiated) — jalur WHATSAPP. */
  refCode?: string
  /** Deeplink wa.me dari backend — WAJIB lolos whitelist sebelum dibuka (B-08). */
  whatsappUrl?: string
  /** Teks pesan pemicu (fallback salin-manual bila deeplink ditolak). */
  triggerText?: string
  /** Kedaluwarsa trigger (ISO) — dokumentasi/polling. */
  expiresAt?: string
}

let state: OtpFlowState | null = null

/** Mulai/timpa alur OTP (dipanggil Register sebelum navigasi). */
export function setOtpFlow(next: OtpFlowState): void {
  state = { ...next }
}

/** Perbarui sebagian alur (mis. hasil requestOtpTrigger saat resend). */
export function patchOtpFlow(patch: Partial<OtpFlowState>): void {
  if (state) state = { ...state, ...patch }
}

/** Baca alur aktif — `null` bila tidak ada (deep-link/reload tanpa alur). */
export function getOtpFlow(): OtpFlowState | null {
  return state
}

/** Hapus alur — setelah verifikasi sukses atau pengguna membatalkan. */
export function clearOtpFlow(): void {
  state = null
}

/** Reset memori (dipakai test). */
export function resetOtpFlowForTest(): void {
  state = null
}
