/**
 * Validasi URL eksternal sebelum diserahkan ke `Linking.openURL` (D-01 audit).
 *
 * Kenapa modul terpisah (non-obvious): sebelum ini ada dua validator ad-hoc —
 * `safeHttpsUrl()` di `lib/version.ts` dan `safeWhatsAppUrl()` lokal di dalam
 * satu layar. Keduanya benar, tetapi aturannya tersebar: layar berikutnya yang
 * butuh membuka tautan dari server harus ingat menulis validatornya sendiri,
 * dan tidak ada yang memaksa call-site baru memvalidasi apa pun. Modul ini
 * menyediakan satu pengevaluasi dengan allowlist EKSPLISIT, lalu seluruh
 * call-site memakainya (aturan + gate: `scripts/check-external-urls.mjs`).
 *
 * Bahaya yang dicegah: `Linking.openURL("javascript:…")` mengeksekusi skrip di
 * web, `intent://`/skema aplikasi lain meluncurkan komponen native dari data
 * yang tidak kita percaya, dan URL dengan kredensial (`https://user:pass@…`)
 * menyembunyikan tujuan sebenarnya.
 */

export type ExternalUrlOptions = {
  /**
   * Skema yang diizinkan, dalam bentuk lengkap (`"https:"`). Wajib eksplisit:
   * pemanggil harus menuliskan apa yang ia terima, bukan mengandalkan default
   * implisit yang bisa melebar tanpa sadar.
   */
  allow: readonly string[]
  /**
   * Daftar host yang diizinkan (opsional). Bila diisi, host selain daftar ini
   * ditolak — dipakai untuk deeplink pihak ketiga (mis. WhatsApp) di mana
   * membuka host sembarangan sama saja tidak memvalidasi.
   */
  hosts?: readonly string[]
}

/**
 * Kembalikan URL yang sudah dinormalisasi bila lolos allowlist, atau
 * `undefined`. Tidak pernah melempar — pemanggil menampilkan fallback.
 */
export function safeExternalUrl(value: unknown, options: ExternalUrlOptions): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return undefined
  }
  if (!options.allow.includes(url.protocol)) return undefined
  // Kredensial di URL menyembunyikan tujuan yang sebenarnya dilihat pengguna.
  if (url.username || url.password) return undefined
  if (options.hosts && !options.hosts.includes(url.hostname)) return undefined
  // Protokol http/https tanpa host (mis. `https://`) tidak berguna dan
  // biasanya pertanda nilai yang salah, bukan tautan.
  if ((url.protocol === "https:" || url.protocol === "http:") && !url.hostname) return undefined
  return url.toString()
}

/** Host resmi WhatsApp — satu-satunya tujuan deeplink WhatsApp yang diterima. */
export const WHATSAPP_HOSTS = ["wa.me", "api.whatsapp.com", "chat.whatsapp.com"] as const

/** Tautan HTTPS biasa (tanpa batasan host) — untuk tautan yang berasal dari server. */
export function safeHttpsLink(value: unknown): string | undefined {
  return safeExternalUrl(value, { allow: ["https:"] })
}

/** Deeplink WhatsApp: HTTPS + host resmi WhatsApp. */
export function safeWhatsAppLink(value: unknown): string | undefined {
  return safeExternalUrl(value, { allow: ["https:"], hosts: WHATSAPP_HOSTS })
}
