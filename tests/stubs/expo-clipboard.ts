/**
 * Stub `expo-clipboard` untuk Vitest (config komponen) — papan klip sistem
 * tidak ada di jsdom; lib/clipboard.ts punya fallback yang justru ingin diuji.
 */
let clip = ""
export async function getStringAsync(): Promise<string> {
  return clip
}
export async function setStringAsync(value: string): Promise<void> {
  clip = value
}
export function hasStringAsync(): Promise<boolean> {
  return Promise.resolve(clip.length > 0)
}
export default { getStringAsync, setStringAsync, hasStringAsync }
