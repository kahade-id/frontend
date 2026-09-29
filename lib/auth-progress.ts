/**
 * Kahade — progress langkah per alur auth (UI-UX T1-002).
 *
 * Layar `verify-otp` dan `whatsapp-trigger` dipakai BERSAMA oleh 4 alur
 * (registrasi, login via WA, lupa kata sandi, migrasi nomor). Progress bar
 * yang di-hardcode satu angka untuk semua alur membuat alur lupa kata sandi
 * menampilkan 1/3 → 2/4 → 3/3 (bar mundur/maju tidak konsisten) dan alur
 * login melihat "langkah 2 dari 4" seolah sedang mendaftar.
 *
 * Aturan:
 *  - register        → 2/4 (registrasi via HP = 4 langkah: nomor → trigger
 *                        WA → OTP → kata sandi + data diri)
 *  - forgot_password → 2/3 (lupa kata sandi = 3 langkah: nomor → trigger
 *                        WA → OTP → kata sandi baru)
 *  - login / migrate_phone → undefined (sembunyikan bar — login WA bukan
 *                        bagian dari wizard pendaftaran)
 *
 * `undefined` = <Header> tidak merender <StepProgress> (prop opsional).
 * Murni presentasi: tidak mengubah alur, request, atau keamanan apa pun.
 */
import type { OtpFlowPurpose } from "@/lib/otp-flow"

export function otpStepProgress(purpose: OtpFlowPurpose): number | undefined {
  switch (purpose) {
    case "register":
      return 2 / 4
    case "forgot_password":
      return 2 / 3
    case "login":
    case "migrate_phone":
    default:
      return undefined
  }
}
