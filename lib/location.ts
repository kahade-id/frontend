/**
 * Kahade — lokasi presisi untuk keamanan akun (auth-rework 2026-09-26).
 *
 * Keputusan produk: setiap aksi auth sensitif (login, registrasi, lupa/reset
 * kata sandi, verifikasi OTP, migrasi nomor HP) MELAMPIRKAN lokasi presisi
 * perangkat bila tersedia. Backend memakainya untuk security log, deteksi
 * lokasi baru, dan impossible-travel detection.
 *
 * Sifatnya OPSIONAL dan tidak pernah memblokir alur:
 *   - izin ditolak / dibatasi → return null, lanjut tanpa lokasi
 *   - GPS gagal / timeout 8 detik → return null, lanjut tanpa lokasi
 *   - error apa pun → return null, jangan crash
 *
 * Backend menerima `location` sebagai field opsional (LocationDto) — request
 * tanpa lokasi tetap valid, hanya kehilangan sinyal keamanannya.
 */
import * as Location from "expo-location"
import type { LocationDto } from "@/lib/api/types"

/** Timeout pengambilan posisi (ms) — jangan menahan alur auth. */
const LOCATION_TIMEOUT_MS = 8000

/**
 * Minta izin lokasi (alasan: keamanan akun) lalu ambil posisi sekali dengan
 * akurasi balanced. Return `LocationDto` atau `null` bila tidak tersedia.
 *
 * Aman dipanggil dari alur apa pun: tidak pernah throw.
 */
export async function getAuthLocation(): Promise<LocationDto | null> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync()
    if (permission.status !== Location.PermissionStatus.GRANTED) return null

    const position = await withTimeout(
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      }),
      LOCATION_TIMEOUT_MS,
    )
    if (!position) return null

    const { latitude, longitude } = position.coords
    if (
      typeof latitude !== "number" ||
      typeof longitude !== "number" ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      return null
    }

    const result: LocationDto = {
      latitude,
      longitude,
      source: "gps",
    }
    const accuracy = position.coords.accuracy
    if (typeof accuracy === "number" && Number.isFinite(accuracy) && accuracy >= 0) {
      result.accuracy = accuracy
    }
    if (typeof position.timestamp === "number" && Number.isFinite(position.timestamp)) {
      result.timestamp = new Date(position.timestamp).toISOString()
    }
    return result
  } catch {
    // Izin ditolak, layanan lokasi mati, timeout, atau platform tidak
    // mendukung — semuanya berarti "tanpa lokasi", bukan kegagalan alur.
    return null
  }
}

/** Promise.race dengan timeout yang me-resolve `null` (bukan reject). */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), ms)
      }),
    ])
  } catch {
    return null
  } finally {
    if (timer) clearTimeout(timer)
  }
}
