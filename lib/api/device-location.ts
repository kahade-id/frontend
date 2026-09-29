/**
 * Kahade — lokasi presisi untuk aksi sensitif (kontrak lintas tim 2026-09-27).
 *
 * Backend menerima field `deviceLocation?: LocationDto` (opsional) di body
 * request aksi sensitif: buat/bayar/konfirmasi/batalkan order, top-up,
 * withdraw (+konfirmasi OTP), transfer, ganti PIN wallet, buka sengketa,
 * ubah nomor HP/email, hapus akun.
 *
 * Sifatnya OPSIONAL dan tidak pernah memblokir alur (lihat lib/location.ts):
 * lokasi diambil TEPAT SEBELUM request dikirim — satu pengambilan per aksi,
 * bukan saat app dibuka. Bila izin ditolak/gagal → dikirim sebagai `null`
 * (backend mencatat locationDenied=true); transaksi TIDAK boleh gagal
 * karena ini.
 */
import type { LocationDto } from "@/lib/api/types"
// N1-002 (PERF): JANGAN impor statis `@/lib/location` di sini — rantai
// itu menarik `expo-location` ke graph evaluasi boot (via lib/api →
// account-deletion → file ini), padahal lokasi hanya dipakai saat aksi
// sensitif benar-benar berjalan. `getAuthLocation` dimuat via dynamic
// import tepat saat dibutuhkan (pola ST-005); perilaku IDENTIK.

/**
 * Alias konteks aksi untuk `getAuthLocation` — perilaku IDENTIK: tidak
 * pernah throw, timeout 8 detik, `null` bila izin ditolak/gagal.
 *
 * Modul `@/lib/location` (dan `expo-location` di bawahnya) baru dievaluasi
 * pada pemanggilan pertama, bukan saat boot.
 */
export async function captureActionLocation(): Promise<LocationDto | null> {
  const { getAuthLocation } = await import("@/lib/location")
  return getAuthLocation()
}

/** Body request yang membawa `deviceLocation` (kontrak lintas tim). */
export type WithDeviceLocation<T> = T & { deviceLocation?: LocationDto | null }

/**
 * Bungkus dto dengan lokasi perangkat yang diambil saat ini juga.
 *
 * Panggil SETELAH validasi lokal lolos dan TEPAT SEBELUM request dikirim —
 * supaya prompt izin tidak muncul untuk input yang pasti ditolak validasi.
 *
 * Sabuk pengaman ganda: `getAuthLocation` berjanji tidak pernah throw, tapi
 * bila ia tetap throw (bug di bawahnya), tangkap di sini — aksi sensitif
 * TIDAK BOLEH gagal hanya karena lokasi.
 */
export async function withDeviceLocation<T extends object>(
  dto: T,
): Promise<WithDeviceLocation<T>> {
  let deviceLocation: LocationDto | null = null
  try {
    deviceLocation = await captureActionLocation()
  } catch {
    deviceLocation = null
  }
  return { ...dto, deviceLocation }
}

/** Body untuk endpoint yang tidak punya body lain: hanya `deviceLocation`. */
export async function deviceLocationOnlyBody(): Promise<{
  deviceLocation: LocationDto | null
}> {
  try {
    return { deviceLocation: await captureActionLocation() }
  } catch {
    return { deviceLocation: null }
  }
}
