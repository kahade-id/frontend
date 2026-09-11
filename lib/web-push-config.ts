/**
 * Kahade — konfigurasi Firebase Web Push (FCM untuk browser).
 *
 * Dipakai DUA tempat yang tidak boleh saling import:
 *   1. `lib/web-push.web.ts` (kode aplikasi: getToken, onMessage).
 *   2. `scripts/gen-fcm-sw.mjs` (build: membundle service worker) — lewat
 *      `FIREBASE_WEB_ENV_NAMES` untuk pesan error yang konsisten.
 *
 * Karena itu file ini MURNI: tidak import firebase, tidak import
 * react-native, aman di-bundle ke native maupun dijalankan di Node.
 * Nilai dibaca dari `EXPO_PUBLIC_*` — config Firebase Web memang
 * public-by-design (kuncinya dibatasi lewat Firebase Console > App Check /
 * API restrictions, bukan lewat kerahasiaan).
 *
 * PENTING — akses `process.env` di bawah HARUS literal per variabel
 * (`process.env.EXPO_PUBLIC_FIREBASE_API_KEY`), JANGAN via helper dinamis
 * `process.env[name]`. Metro meng-inline `EXPO_PUBLIC_*` ke bundle web saat
 * build dengan pencocokan sintaks literal; akses computed tidak diganti dan
 * config akan selalu kosong di browser (terbukti saat audit: bundle tidak
 * mengandung nilai env). Lihat juga lib/api/config.ts yang berpola sama.
 *
 * Cara mendapatkan nilai (sekali saja, project `kahade-fcm`):
 *   Firebase Console > Project settings > General > Your apps > Web app
 *   (bila belum ada, "Add app" > Web dengan nickname mis. "Kahade Web")
 *     → apiKey, authDomain, projectId, storageBucket,
 *       messagingSenderId, appId
 *   Firebase Console > Project settings > Cloud Messaging
 *     > Web Push certificates > Generate key pair
 *     → VAPID key (EXPO_PUBLIC_FIREBASE_VAPID_KEY)
 *
 * Tanpa env ini web push NONAKTIF dengan anggun (fungsi mengembalikan null,
 * build tetap sukses) — lihat `isWebPushConfigured()`.
 */

export type FirebaseWebConfig = {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
  vapidKey: string
}

/** Nama variabel env, sejalan dengan `getFirebaseWebConfig()` di bawah. */
export const FIREBASE_WEB_ENV_NAMES = [
  "EXPO_PUBLIC_FIREBASE_API_KEY",
  "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
  "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "EXPO_PUBLIC_FIREBASE_APP_ID",
  "EXPO_PUBLIC_FIREBASE_VAPID_KEY",
] as const

/**
 * Config Firebase Web bila SEMUA variabel terisi, else `null`.
 * Satu-satunya gate: pemanggil tidak perlu mengecek variabel satu per satu.
 */
export function getFirebaseWebConfig(): FirebaseWebConfig | null {
  // Literal — lihat catatan PENTING di header file.
  const config: FirebaseWebConfig = {
    apiKey: (process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? "").trim(),
    authDomain: (process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "").trim(),
    projectId: (process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "").trim(),
    storageBucket: (process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "").trim(),
    messagingSenderId: (process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "").trim(),
    appId: (process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? "").trim(),
    vapidKey: (process.env.EXPO_PUBLIC_FIREBASE_VAPID_KEY ?? "").trim(),
  }
  const missing = (Object.keys(config) as (keyof FirebaseWebConfig)[]).filter(
    (key) => !config[key],
  )
  return missing.length === 0 ? config : null
}

/** True bila web push bisa dipakai (semua env terisi). */
export function isWebPushConfigured(): boolean {
  return getFirebaseWebConfig() !== null
}

/**
 * Nama variabel yang belum diisi — untuk pesan build/test yang actionable
 * ("isi X", bukan "konfigurasi tidak lengkap").
 */
export function missingFirebaseEnvNames(): string[] {
  // Literal — lihat catatan PENTING di header file.
  const values: Record<keyof FirebaseWebConfig, string> = {
    apiKey: (process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? "").trim(),
    authDomain: (process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "").trim(),
    projectId: (process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? "").trim(),
    storageBucket: (process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "").trim(),
    messagingSenderId: (process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "").trim(),
    appId: (process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? "").trim(),
    vapidKey: (process.env.EXPO_PUBLIC_FIREBASE_VAPID_KEY ?? "").trim(),
  }
  const names: Record<keyof FirebaseWebConfig, string> = {
    apiKey: "EXPO_PUBLIC_FIREBASE_API_KEY",
    authDomain: "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
    projectId: "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
    storageBucket: "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET",
    messagingSenderId: "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    appId: "EXPO_PUBLIC_FIREBASE_APP_ID",
    vapidKey: "EXPO_PUBLIC_FIREBASE_VAPID_KEY",
  }
  return (Object.keys(names) as (keyof FirebaseWebConfig)[])
    .filter((key) => !values[key])
    .map((key) => names[key])
}
