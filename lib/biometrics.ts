/**
 * Kahade — biometrik (expo-local-authentication) untuk §9.21 PIN/Biometric
 * Sheet dan §14 re-autentikasi setelah background > 1 menit.
 *
 * Hasil dinormalkan ke `BiometricOutcome` supaya <BiometricPromptTrigger> dan
 * layar pemanggil bisa memutuskan SATU hal: lanjut, atau fallback ke PIN Pad.
 *
 *   - "success"      : lanjut.
 *   - "cancelled"    : pengguna menutup prompt — biasanya tidak perlu apa-apa
 *                      (atau tawarkan PIN, tanpa pesan error).
 *   - "fallback"     : pengguna menekan "Gunakan PIN" di prompt OS -> buka PinPad.
 *   - "failed"       : sidik jari/wajah tidak cocok berulang -> PinPad + Banner.
 *   - "lockout"      : OS mengunci biometrik sementara -> PinPad WAJIB.
 *   - "unavailable"  : tidak ada sensor / belum enroll / web -> PinPad, dan
 *                      sembunyikan tombol biometrik.
 *
 * Keputusan non-obvious:
 *   - `disableDeviceFallback: true` — prompt OS TIDAK menawarkan passcode
 *     perangkat. Alasan: passcode perangkat ≠ PIN Kahade; membiarkan OS
 *     menerima passcode akan melewati PIN transaksi kita (§14). Fallback
 *     ditangani sendiri lewat outcome "fallback" -> <PinPad>.
 *   - `biometricsSecurityLevel: "strong"` (Android) — menolak face unlock
 *     kelas "weak" (Class 2) yang bisa ditipu foto. Untuk konfirmasi dana,
 *     hanya Class 3 (sidik jari / wajah 3D) yang diterima.
 *   - `requireConfirmation: false` — Android biasanya menambah tombol
 *     "Konfirmasi" setelah wajah dikenali; dimatikan agar satu langkah,
 *     karena sheet kita sudah merupakan langkah konfirmasi eksplisit.
 *   - `cancelLabel` mengikuti §12 ("Batal"), `fallbackLabel` iOS = "Gunakan PIN".
 *   - Label jenis biometrik (`describeBiometrics`) memilih kata yang tepat
 *     ("Face ID" hanya di iOS; Android = "wajah"), supaya copy tidak
 *     menyebut merek yang tidak ada di perangkat.
 */
import * as LocalAuthentication from "expo-local-authentication"
import { Platform } from "react-native"

export type BiometricOutcome = "success" | "cancelled" | "fallback" | "failed" | "lockout" | "unavailable"

export type BiometricKind = "face" | "fingerprint" | "iris" | "none"

export type BiometricCapability = {
  available: boolean
  kind: BiometricKind
  /** Label manusiawi: "Face ID", "Touch ID", "sidik jari", "wajah" */
  label: string
}

export async function getBiometricCapability(): Promise<BiometricCapability> {
  if (Platform.OS === "web") return { available: false, kind: "none", label: "biometrik" }

  const [hasHardware, enrolled, types] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
  ])
  const kind = pickKind(types)
  return { available: hasHardware && enrolled && kind !== "none", kind, label: describeBiometrics(kind) }
}

function pickKind(types: LocalAuthentication.AuthenticationType[]): BiometricKind {
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) return "face"
  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return "fingerprint"
  if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) return "iris"
  return "none"
}

export function describeBiometrics(kind: BiometricKind): string {
  if (Platform.OS === "ios") {
    if (kind === "face") return "Face ID"
    if (kind === "fingerprint") return "Touch ID"
  }
  switch (kind) {
    case "face":
      return "wajah"
    case "fingerprint":
      return "sidik jari"
    case "iris":
      return "iris"
    default:
      return "biometrik"
  }
}

export type AuthenticateOptions = {
  /** Judul prompt OS, mis. "Konfirmasi transfer Rp1.500.000" */
  promptMessage: string
  /** Baris kedua (Android) */
  promptSubtitle?: string
  cancelLabel?: string
  fallbackLabel?: string
}

export async function authenticateBiometric(opts: AuthenticateOptions): Promise<BiometricOutcome> {
  const cap = await getBiometricCapability()
  if (!cap.available) return "unavailable"

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: opts.promptMessage,
    promptSubtitle: opts.promptSubtitle,
    cancelLabel: opts.cancelLabel ?? "Batal",
    fallbackLabel: opts.fallbackLabel ?? "Gunakan PIN",
    disableDeviceFallback: true,
    requireConfirmation: false,
    biometricsSecurityLevel: "strong",
  })

  if (result.success) return "success"
  return mapError(result.error)
}

function mapError(error: LocalAuthentication.LocalAuthenticationError): BiometricOutcome {
  switch (error) {
    case "user_cancel":
    case "app_cancel":
    case "system_cancel":
      return "cancelled"
    case "user_fallback":
      return "fallback"
    case "lockout":
      return "lockout"
    case "not_enrolled":
    case "not_available":
    case "passcode_not_set":
    case "no_space":
    case "invalid_context":
      return "unavailable"
    case "authentication_failed":
    case "timeout":
    case "unable_to_process":
    case "unknown":
    default:
      return "failed"
  }
}
