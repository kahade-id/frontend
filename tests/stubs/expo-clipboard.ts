/**
 * Stub `expo-clipboard` untuk Vitest — dua kebutuhan dirangkul:
 *  1. Test komponen (jsdom) memakai perilaku papan klip STATEFUL supaya
 *     fallback lib/clipboard.ts bisa diuji utuh (stub asli sebelumnya).
 *  2. Test logika murni (mis. showcase-social) hanya perlu bentuk fungsi,
 *     tetapi tetap mendapat stimulasi yang sama — tidak ada efek samping.
 * `setStringAsync` mengembalikan boolean: lib/clipboard.ts menyalin nilai
 * baliknya sebagai keberhasilan (`copyToClipboard`).
 */
let clip = ""

export async function setStringAsync(value: string): Promise<boolean> {
  clip = value
  return true
}
export async function getStringAsync(): Promise<string> {
  return clip
}
export async function hasStringAsync(): Promise<boolean> {
  return clip.length > 0
}
export async function setUrlAsync(url: string): Promise<boolean> {
  clip = url
  return true
}
export async function hasUrlAsync(): Promise<boolean> {
  return /^https?:\/\//.test(clip)
}

export default { setStringAsync, getStringAsync, hasStringAsync, setUrlAsync, hasUrlAsync }
