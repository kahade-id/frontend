/**
 * Kahade — progress langkah per alur auth (UI-UX T1-002, FE-040).
 *
 * Layar `verify-otp` dan `whatsapp-trigger` dipakai BERSAMA oleh 4 alur
 * (registrasi, login via WA, lupa kata sandi, migrasi nomor).
 *
 * FE-040: dua layar berurutan (`whatsapp-trigger` → `verify-otp`) memakai
 * nilai progress yang SAMA (2/4) — user pindah layar (usaha nyata, termasuk
 * keluar-masuk WhatsApp) tapi bar tidak bergerak, lalu meloncat ke 4/4.
 * Bar yang macet memberi kesan aplikasi hang/berputar di tempat.
 *
 * Perbaikan: progress dipecah per langkah NYATA —
 *   nomor (1/4) → kirim pesan WA (2/4) → masukkan OTP (3/4) → kata sandi (4/4)
 * untuk registrasi maupun lupa kata sandi. Login WA / migrasi nomor bukan
 * bagian wizard pendaftaran → bar disembunyikan.
 *
 * `undefined` = <Header> tidak merender <StepProgress> (prop opsional).
 * Murni presentasi: tidak mengubah alur, request, atau keamanan apa pun.
 */
import type { OtpFlowPurpose } from "@/lib/otp-flow"

export function otpStepProgress(
  purpose: OtpFlowPurpose,
  screen: "trigger" | "otp",
): number | undefined {
  switch (purpose) {
    case "register":
    case "forgot_password":
      // FE-040: trigger = langkah "kirim pesan WA" (2/4), otp = langkah
      // "masukkan OTP" (3/4). Bukan lagi satu angka untuk dua layar.
      return screen === "trigger" ? 2 / 4 : 3 / 4
    case "login":
    case "migrate_phone":
    default:
      return undefined
  }
}
