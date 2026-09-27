/**
 * Kahade — string instruksi passkey per platform, Bahasa Indonesia (G048).
 *
 * Dipakai di layar login (web vs native) dan layar kelola passkey.
 * Jelas membedakan "Passkey" (kredensial WebAuthn terverifikasi server)
 * dari "Kunci biometrik perangkat" (app-lock lokal via expo-local-authentication,
 * BUKAN autentikasi server — lihat lib/biometrics.ts).
 */
import { Platform } from "react-native"

export type PasskeyPlatform = "web" | "android" | "ios"

export function currentPasskeyPlatform(): PasskeyPlatform {
  if (Platform.OS === "web") return "web"
  if (Platform.OS === "ios") return "ios"
  return "android"
}

export const PASSKEY_COPY = {
  /** Judul tombol di layar login — terpisah visual dari biometrik lokal. */
  loginButton: "Masuk dengan passkey",

  /** Penjelasan di bawah tombol login (web). */
  loginHintWeb:
    "Gunakan sidik jari, wajah, atau kunci keamanan perangkat Anda untuk masuk — tanpa mengetik kata sandi.",

  /** Native: penjelasan jujur bahwa passkey penuh hanya di web (G033). */
  loginNativeInfo: {
    title: "Passkey tersedia di web",
    body: "Masuk dengan passkey saat ini didukung di aplikasi web Kahade. Di aplikasi ini, silakan masuk dengan kata sandi atau OTP WhatsApp. Passkey yang Anda daftarkan di web tetap tercatat di akun Anda.",
  } as const,

  /** Perbedaan passkey vs kunci biometrik perangkat (ditampilkan di menu Keamanan). */
  vsDeviceBiometric: {
    title: "Passkey vs kunci biometrik perangkat",
    passkey:
      "Passkey adalah kredensial masuk terverifikasi server — menggantikan kata sandi saat login.",
    biometric:
      "Kunci biometrik perangkat hanya mengunci aplikasi di HP ini — bukan metode masuk akun.",
  } as const,

  /** Langkah pendaftaran per platform. */
  enrollSteps: {
    web: [
      "Buka menu Keamanan → Passkey di aplikasi web Kahade.",
      "Ketuk “Tambah passkey”, lalu verifikasi ulang kata sandi Anda.",
      "Ikuti perintah browser: gunakan sidik jari, wajah, PIN, atau kunci keamanan USB.",
      "Beri nama perangkat agar mudah dikenali, misalnya “Laptop kerja”.",
    ],
    android: [
      "Passkey didaftarkan lewat aplikasi web Kahade di browser HP Anda.",
      "Di Chrome Android, Anda bisa memakai sidik jari atau kunci layar.",
      "Setelah terdaftar, passkey tersimpan di Pengelola Sandi Google dan bisa dipakai di web.",
    ],
    ios: [
      "Passkey didaftarkan lewat aplikasi web Kahade di Safari.",
      "Gunakan Face ID atau Touch ID saat diminta.",
      "Passkey tersimpan di Rantai Kunci iCloud dan tersinkron ke perangkat Apple Anda.",
    ],
  } as Record<PasskeyPlatform, string[]>,

  /** Pemulihan bila semua passkey hilang (G039). */
  recover: {
    title: "Passkey hilang atau perangkat baru?",
    body: "Minta kode OTP via WhatsApp ke nomor HP terdaftar Anda, verifikasi, lalu daftarkan passkey baru. Kami akan memberi tahu Anda bila permintaan datang dari perangkat yang belum dikenal.",
    requestButton: "Kirim kode OTP",
    verifyButton: "Verifikasi & lanjutkan",
  } as const,

  /** Batasan jumlah (G047). */
  limitReached: (max: number) =>
    `Batas maksimal ${max} passkey per akun tercapai. Hapus salah satu untuk menambah yang baru.`,

  /** Peringatan hapus kredensial terakhir (G038). */
  lastCredentialWarning:
    "Ini satu-satunya metode masuk Anda. Tambahkan kata sandi atau metode lain dulu sebelum menghapus passkey ini.",

  /** Penjelasan autofill/conditional UI (web, G041). */
  conditionalUiHint:
    "Di browser yang mendukung, passkey bisa muncul sebagai saran otomatis di kolom username.",
} as const
