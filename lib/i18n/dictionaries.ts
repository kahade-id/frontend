/**
 * Kahade — registry kamus terjemahan (FE-072).
 *
 * Masalah yang dipecahkan: `translate.ts` dulu static-import `./en`
 * (±256KB JSON yang digabung jadi satu objek saat evaluasi modul) — seluruh
 * kamus English dievaluasi di graph boot padahal mayoritas pengguna berbahasa
 * Indonesia dan tidak pernah membutuhkannya.
 *
 * Model baru:
 *   - `translate.ts` membaca kamus HANYA lewat `getDictionary()` — tidak ada
 *     static import `./en` di jalur boot.
 *   - `en/index.ts` mendaftarkan dirinya sebagai side-effect saat di-import —
 *     test yang mengimpor EN langsung tetap mendapat kamus terdaftar secara
 *     sinkron, tanpa mengubah graph boot produksi.
 *   - `ensureDictionary(lang)` memuat kamus lewat dynamic `import()`; dipakai
 *     `initLanguage` / `adoptAccountLanguage` / `applyLanguage` sebelum
 *     publish, dan memicu render ulang saat kamus tiba (lihat store.ts).
 */
import { SOURCE_LANGUAGE, type LanguageCode } from "./languages"

export type Dictionary = Record<string, string>

const registry = new Map<LanguageCode, Dictionary>()

/**
 * Daftarkan kamus untuk satu bahasa. Dipanggil sebagai side-effect oleh
 * `en/index.ts` (dan calon kamus bahasa lain di masa depan).
 */
export function registerDictionary(lang: LanguageCode, dict: Dictionary): void {
  registry.set(lang, dict)
}

export function getDictionary(lang: LanguageCode): Dictionary | undefined {
  return registry.get(lang)
}

let enLoad: Promise<void> | null = null

const loadListeners = new Set<() => void>()

/**
 * FE-072: dipanggil tepat setelah sebuah kamus selesai dimuat lazy.
 * `translate.ts` berlangganan untuk mengosongkan cache terjemahan — hasil
 * lookup yang ter-cache saat kamus belum ada menyimpan fallback Indonesia
 * dan harus dibuang saat kamus tiba.
 */
export function onDictionaryLoaded(listener: () => void): () => void {
  loadListeners.add(listener)
  return () => {
    loadListeners.delete(listener)
  }
}

/**
 * Pastikan kamus `lang` tersedia. Bahasa sumber tidak butuh kamus; bahasa
 * yang belum punya loader jatuh ke teks sumber (Indonesia) — tidak throw.
 */
export function ensureDictionary(lang: LanguageCode): Promise<void> {
  if (lang === SOURCE_LANGUAGE || registry.has(lang)) return Promise.resolve()
  if (lang !== "en") return Promise.resolve()
  if (!enLoad) {
    enLoad = import("./en").then(
      () => {
        // Side-effect `./en` sudah mendaftarkan kamus; beri tahu pelanggan.
        for (const listener of [...loadListeners]) listener()
      },
      (err: unknown) => {
        // Gagal (mis. bundle korup): izinkan percobaan ulang berikutnya.
        enLoad = null
        throw err
      },
    )
  }
  return enLoad
}
