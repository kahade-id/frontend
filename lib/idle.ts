/**
 * Kahade — penjadwalan kerja non-kritis saat idle.
 *
 * Latar belakang (upgrade SDK 58, RN 0.88): `InteractionManager` dihapus dari
 * React Native, jadi `runAfterInteractions()` tidak ada lagi. Pengganti alami
 * di RN adalah `requestIdleCallback`, yang memang dipasang sebagai global oleh
 * RN (`Libraries/Core/setUpTimers.js` → `defineLazyTimer('requestIdleCallback')`).
 *
 * Masalahnya global itu TIDAK universal:
 *  - Web: WebKit/Safari tidak mengimplementasikan `requestIdleCallback`, dan
 *    aplikasi ini juga diekspor sebagai web (`npm run build:web`).
 *  - jsdom (vitest komponen): tidak menyediakannya sama sekali.
 *
 * Memanggil global itu tanpa pemeriksaan melempar `ReferenceError` di kedua
 * lingkungan tersebut — bukan degradasi halus, melainkan crash saat mount.
 * Helper ini memeriksa ketersediaannya dan jatuh ke `setTimeout(…, 0)`, yang
 * semantiknya cukup untuk maksud pemanggil: "jalankan setelah render/interaksi
 * saat ini selesai".
 */

type IdleGlobal = {
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number
  cancelIdleCallback?: (handle: number) => void
}

/**
 * Menjalankan `callback` saat runtime idle.
 * Mengembalikan fungsi pembatalan yang selalu aman dipanggil (mis. dari
 * cleanup `useEffect`), apa pun jalur penjadwalan yang terpakai.
 */
export function runWhenIdle(callback: () => void): () => void {
  const runtime = globalThis as IdleGlobal

  if (typeof runtime.requestIdleCallback === "function") {
    const handle = runtime.requestIdleCallback(callback)
    return () => {
      runtime.cancelIdleCallback?.(handle)
    }
  }

  const timer = setTimeout(callback, 0)
  return () => {
    clearTimeout(timer)
  }
}
