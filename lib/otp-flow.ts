/**
 * Kahade — state alur OTP sementara (B-07/B-14 audit, auth-rework 2026-09-26).
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
 * nama rute tanpa data. Sejak 2026-10-01 state JUGA dipersist ke SecureStore
 * (native) agar tahan restart aplikasi di tengah alur — skenario umum di
 * Android saat user pindah ke WhatsApp untuk mengirim pesan pemicu lalu OS
 * mematikan aplikasi di background. Tanpa persist, layar whatsapp-trigger /
 * verify-otp kembali dengan state kosong dan menampilkan layar putih.
 * Di web tetap memory-only (konsisten dengan registration state).
 *
 * Auth-rework: OTP HANYA via WhatsApp customer-initiated — tidak ada lagi
 * pilihan metode SMS/WhatsApp. `purpose` membedakan 4 alur yang memakai
 * layar trigger + verify-otp yang sama: register, login, forgot_password,
 * migrate_phone.
 *
 * Hanya SATU alur OTP aktif pada satu waktu; `setOtpFlow` menimpa sebelumnya.
 */
import type { OtpTriggerPurpose } from "@/lib/api/auth"
import { SecureKeys, deleteSecureItem, getSecureItem, setSecureItem } from "@/lib/secure-storage"

export type OtpFlowPurpose = OtpTriggerPurpose

export type OtpFlowState = {
  /** Nomor HP E.164 yang sedang diverifikasi. */
  phoneNumber: string
  /** Tujuan OTP — menentukan penanganan hasil di verify-otp. */
  purpose: OtpFlowPurpose
  /** Token migrasi (hanya purpose=migrate_phone) — untuk resend trigger. */
  migrationToken?: string
  /** Kode referensi trigger WhatsApp (12 hex) — mengikat pesan pemicu. */
  refCode?: string
  /** Deeplink wa.me dari backend — WAJIB lolos whitelist sebelum dibuka (B-08). */
  whatsappUrl?: string
  /** Teks pesan pemicu (fallback salin-manual bila deeplink ditolak). */
  triggerText?: string
  /** Kedaluwarsa trigger (ISO) — dokumentasi/polling. */
  expiresAt?: string
}

let state: OtpFlowState | null = null
let hydrated = false

/** Mulai/timpa alur OTP (dipanggil sebelum navigasi ke whatsapp-trigger). */
export function setOtpFlow(next: OtpFlowState): void {
  state = { ...next }
  // Persist agar tahan restart aplikasi di tengah alur (mis. user pindah ke
  // WhatsApp lalu OS mematikan aplikasi di background). Fire-and-forget:
  // layar membaca dari memori yang sudah sinkron.
  void setSecureItem(SecureKeys.otpFlow, JSON.stringify(state)).catch(() => {})
}

/** Perbarui sebagian alur (mis. hasil requestOtpTrigger saat kirim ulang). */
export function patchOtpFlow(patch: Partial<OtpFlowState>): void {
  if (state) {
    state = { ...state, ...patch }
    void setSecureItem(SecureKeys.otpFlow, JSON.stringify(state)).catch(() => {})
  }
}

/** Baca alur aktif — `null` bila tidak ada (deep-link/reload tanpa alur). */
export function getOtpFlow(): OtpFlowState | null {
  return state
}

/**
 * Pulihkan alur OTP dari penyimpanan persisten (dipanggil sekali saat
 * startup aplikasi, sebelum layar auth dirender). Tanpa ini, restart di
 * tengah alur (umum di Android saat user pindah ke WhatsApp) membuat layar
 * whatsapp-trigger/verify-otp kehilangan state dan menampilkan layar putih.
 */
export async function initOtpFlow(): Promise<void> {
  if (hydrated) return
  hydrated = true
  try {
    const raw = await getSecureItem(SecureKeys.otpFlow)
    if (raw) {
      const parsed = JSON.parse(raw) as OtpFlowState
      // Validasi minimal: tanpa phoneNumber + purpose, state tidak berguna.
      if (parsed && typeof parsed.phoneNumber === "string" && typeof parsed.purpose === "string") {
        state = parsed
      } else {
        void deleteSecureItem(SecureKeys.otpFlow).catch(() => {})
      }
    }
  } catch {
    // Gagal baca = anggap tidak ada alur; layar akan mengarahkan ke awal.
  }
}

/** Hapus alur — setelah verifikasi sukses atau pengguna membatalkan. */
export function clearOtpFlow(): void {
  state = null
  void deleteSecureItem(SecureKeys.otpFlow).catch(() => {})
}

/** Reset memori (dipakai test). */
export function resetOtpFlowForTest(): void {
  state = null
  hydrated = false
}
