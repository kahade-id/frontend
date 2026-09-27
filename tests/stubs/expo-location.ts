/**
 * Stub `expo-location` untuk Vitest.
 *
 * `lib/location.ts` (getAuthLocation) kini berada di graf impor facade API
 * (orders/wallet/auth/account-deletion) yang diuji di Node. Paket aslinya
 * memanggil `expo-modules-core` yang butuh global native — pengumpulan modul
 * gagal sebelum test jalan.
 *
 * Perilaku stub = "izin ditolak": `getAuthLocation()` mengembalikan `null`
 * tanpa pernah throw — persis sifat fail-safe yang diandalkan kode produksi.
 */
export enum PermissionStatus {
  UNDETERMINED = "undetermined",
  DENIED = "denied",
  GRANTED = "granted",
  LIMITED = "limited",
}

export enum Accuracy {
  Lowest = 1,
  Low = 2,
  Balanced = 3,
  High = 4,
  Highest = 5,
  BestForNavigation = 6,
}

export async function requestForegroundPermissionsAsync() {
  return {
    status: PermissionStatus.DENIED,
    granted: false,
    canAskAgain: false,
    expires: "never" as const,
  }
}

export async function getCurrentPositionAsync(): Promise<never> {
  throw new Error("expo-location tidak tersedia di Node (stub test)")
}
