/**
 * Kahade — deteksi perangkat ter-root / ter-jailbreak (M-1 audit ronde-2).
 *
 * Latar: di perangkat yang sudah di-root/jailbreak, aplikasi lain (dengan
 * hak root) bisa membaca memori aplikasi, menyadap input PIN, atau memodifikasi
 * perilaku aplikasi. Untuk aplikasi yang memindahkan uang asli, aksi FINANSIAL
 * (bayar, tarik, transfer) diblokir di perangkat seperti itu — aksi
 * non-finansial (lihat etalase, chat, dsb.) tetap boleh.
 *
 * Implementasi: `Device.isRootedExperimentalAsync()` dari `expo-device`
 * (modul Expo resmi — bekerja di EAS managed build, tanpa native code
 * manual / config plugin tambahan). Hasil di-cache per sesi aplikasi agar
 * pemeriksaan hanya berjalan sekali.
 *
 * BATASAN (jujur, dari dokumentasi expo-device):
 * - Metode ini "experimental" dan TIDAK sepenuhnya andal: ada tool
 *   (mis. XCon di iOS, berbagai root-cloak di Android) yang memang
 *   dirancang mengelabui deteksi root, dan deteksi bisa di-bypass lewat
 *   reverse engineering. Ini lapisan pertahanan tambahan, BUKAN jaminan.
 * - Android: mendeteksi keberadaan executable `su`; sebagian kecil
 *   perangkat non-root bisa false positive.
 * - iOS: memakai sekumpulan pemeriksaan jailbreak umum.
 * - Web: selalu `false` (tidak didukung).
 * - Karena itu validasi keamanan yang sesungguhnya TETAP di server
 *   (PIN, OTP, limit, deteksi anomali) — blokir ini hanya mengurangi
 *   permukaan serangan di sisi klien.
 */
import { Alert, Platform } from "react-native"
import * as Device from "expo-device"

export type DeviceIntegrity = {
  /** Pemeriksaan sudah selesai (false = belum / gagal diperiksa). */
  checked: boolean
  /** true = terdeteksi root/jailbreak. */
  compromised: boolean
  /** Pesan error bila pemeriksaan gagal (diperlakukan sebagai unknown). */
  error?: string
}

let cached: Promise<DeviceIntegrity> | null = null

/**
 * Periksa integritas perangkat (sekali per sesi — hasilnya di-cache).
 * Tidak pernah melempar; kegagalan = `{ checked: false }` (unknown),
 * dan unknown TIDAK memblokir (fail-open untuk ketersediaan, karena
 * pemeriksaan ini best-effort; proteksi utama tetap di server).
 */
export function checkDeviceIntegrity(): Promise<DeviceIntegrity> {
  if (!cached) {
    cached = (async (): Promise<DeviceIntegrity> => {
      try {
        const rooted = await Device.isRootedExperimentalAsync()
        return { checked: true, compromised: rooted === true }
      } catch (err) {
        return {
          checked: false,
          compromised: false,
          error: err instanceof Error ? err.message : String(err),
        }
      }
    })()
  }
  return cached
}

/** Untuk test: reset cache antar kasus uji. */
export function __resetDeviceIntegrityCache(): void {
  cached = null
}

/**
 * Penjaga aksi finansial. Kembalikan `true` bila aksi boleh lanjut.
 * Bila perangkat terdeteksi compromised: tampilkan Alert berbahasa
 * Indonesia yang jelas dan kembalikan `false` — pemanggil WAJIB
 * membatalkan aksi finansialnya.
 *
 * Dipakai di titik commit dana: transfer (`transferFunds`), tarik dana
 * (`createWithdraw`), dan buat intent bayar QRIS (`payOrderQris`).
 */
export async function assertDeviceNotCompromised(): Promise<boolean> {
  // Web tidak didukung deteksi — lewati (transaksi web bukan jalur utama).
  if (Platform.OS === "web") return true
  const integrity = await checkDeviceIntegrity()
  if (integrity.checked && integrity.compromised) {
    Alert.alert(
      "Perangkat tidak aman",
      "Perangkat ini terdeteksi sudah di-root atau di-jailbreak. " +
        "Demi keamanan dana Anda, pembayaran, penarikan, dan transfer " +
        "diblokir di perangkat ini.\n\nAnda tetap bisa memakai fitur lain " +
        "seperti melihat etalase dan chat. Untuk bertransaksi, gunakan " +
        "perangkat yang belum di-root/jailbreak.",
      [{ text: "Mengerti", style: "default" }],
    )
    return false
  }
  return true
}
