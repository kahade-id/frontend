/**
 * Kahade — string instruksi passkey per platform, Bahasa Indonesia (G048).
 *
 * Dipakai di layar login (web vs native) dan layar kelola passkey.
 * Jelas membedakan "Passkey" (kredensial WebAuthn terverifikasi server)
 * dari "Kunci biometrik perangkat" (app-lock lokal via expo-local-authentication,
 * BUKAN autentikasi server — lihat lib/biometrics.ts).
 */
import { Platform } from "react-native"

import type { PasskeyUnsupportedReason } from "@/lib/passkey-types"

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

  /**
   * Browser tanpa WebAuthn (reason WEB_UNSUPPORTED). Dibedakan dari
   * `loginNativeInfo` karena jalan keluarnya lain: di web pengguna bisa
   * mengganti browser, di native tidak.
   */
  loginWebUnsupported: {
    title: "Browser ini tidak mendukung passkey",
    body: "Coba browser lain, atau masuk dengan kata sandi atau kode WhatsApp. Passkey yang sudah Anda daftarkan tetap tersimpan di akun.",
  } as const,

  /**
   * Pesan error masuk passkey per penyebab.
   *
   * Disimpan DI SINI (lib/, object map) bukan di dalam hook: generator katalog
   * i18n hanya mengumpulkan literal di JSX, atribut teks, dan nilai object
   * literal di `lib/` — string yang dikembalikan dari `return "…"` di dalam
   * fungsi komponen tidak pernah masuk katalog, jadi tidak akan pernah bisa
   * diterjemahkan (pengguna English melihat Bahasa Indonesia).
   */
  loginErrors: {
    rateLimited:
      "Terlalu banyak percobaan passkey. Tunggu beberapa saat sebelum mencoba lagi.",
    unknownCredential:
      "Passkey ini tidak dikenali. Pastikan passkey sudah terdaftar di akun Anda, atau masuk dengan metode lain.",
    network: "Tidak dapat menghubungi Kahade. Periksa koneksi internet lalu coba lagi.",
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

  /**
   * Pesan yang DILEMPAR sebagai PasskeyError NOT_SUPPORTED (berbeda dari
   * dialog/toast di atas: ini muncul di Alert atau di logika pemanggil).
   *
   * Disimpan sebagai object map di lib/ supaya terkatalog i18n — string yang
   * dikembalikan langsung dari `return "…"` di dalam fungsi tidak pernah
   * sampai ke kamus English (lihat docblock lib/auth-security-info.ts untuk
   * aturan pengumpulan yang sama).
   */
  unsupportedMessages: {
    web: "Browser ini tidak mendukung passkey. Coba browser lain, atau masuk dengan kata sandi atau kode WhatsApp.",
    native:
      "Passkey belum tersedia di aplikasi native ini. Masuk dengan kata sandi atau kode WhatsApp, atau pakai aplikasi web Kahade untuk passkey.",
    webauthn: "Passkey di perangkat ini memakai WebAuthn browser.",
    default: "Perangkat ini tidak mendukung passkey.",
  } as const,
} as const

/**
 * Copy penjelasan bila passkey tidak tersedia di perangkat/browser ini.
 *
 * SENGAJA hanya dua varian, padahal `PasskeyUnsupportedReason` punya enam:
 * perbedaan DISABLED / MODULE_MISSING / PROVIDER_INCOMPLETE / RUNTIME_ERROR
 * hanya bisa ditindaklanjuti tim (lihat docblock lib/passkey-native.ts), bukan
 * pengguna — di layar semuanya berarti "belum bisa di aplikasi native ini".
 * Alasan rincinya tetap dikirim ke telemetri oleh pemanggil.
 */
export function passkeyUnsupportedCopy(reason?: PasskeyUnsupportedReason): {
  title: string
  body: string
} {
  if (reason === "WEB_UNSUPPORTED") {
    return {
      title: PASSKEY_COPY.loginWebUnsupported.title,
      body: PASSKEY_COPY.loginWebUnsupported.body,
    }
  }
  return { title: PASSKEY_COPY.loginNativeInfo.title, body: PASSKEY_COPY.loginNativeInfo.body }
}
