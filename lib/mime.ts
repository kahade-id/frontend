/**
 * Kahade — klasifikasi MIME & ekstensi berkas dari response yang belum
 * divalidasi.
 *
 * Kenapa helper ini ada (non-obvious): sebagian besar adapter API mengembalikan
 * `http.get<Dto>()` mentah — tipe DTO hanya di-CAST, bukan diperiksa saat
 * runtime. Lampiran chat, bukti sengketa, dan data topup tidak punya
 * normalizer, jadi field seperti `mimeType`/`fileName`/`method` bisa saja
 * `null`, hilang, atau bukan string walau tipenya `string`.
 *
 * Akibatnya bukan label yang kosong: `undefined.startsWith("image/")` dan
 * `undefined.split(".")` melempar TypeError **saat render**, yang menjatuhkan
 * seluruh layar ke error boundary. Pola penjaga ini sebelumnya ditulis ulang
 * di empat tempat berbeda; disatukan di sini supaya tidak ada lagi yang
 * lupa, dan supaya bisa diuji tanpa menarik native/phosphor.
 */

/** Benar hanya untuk string yang benar-benar diawali `image/`. */
export function isImageMime(mime: string | null | undefined): boolean {
  return typeof mime === "string" && mime.startsWith("image/")
}

/** MIME PDF — dipakai untuk memilih penampil, bukan sekadar ikon. */
export function isPdfMime(mime: string | null | undefined): boolean {
  return typeof mime === "string" && mime === "application/pdf"
}

/**
 * Ekstensi berkas dalam huruf kapital (`"dokumen.pdf"` → `"PDF"`), atau
 * `undefined` bila tidak ada ekstensi atau namanya bukan string. Sengaja
 * mengembalikan `undefined` — badge ekstensi di ubin lampiran bersifat
 * opsional, jadi pemanggil cukup merender tanpa badge.
 */
export function fileExtension(fileName: string | null | undefined): string | undefined {
  if (typeof fileName !== "string") return undefined
  const parts = fileName.split(".")
  if (parts.length < 2) return undefined
  const last = parts.pop()
  return last ? last.toUpperCase() : undefined
}
