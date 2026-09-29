/** Stub `expo-web-browser` untuk Vitest — `maybeCompleteAuthSession()` dipanggil di top level. */
export function maybeCompleteAuthSession() {
  return false
}
export async function openAuthSessionAsync() {
  throw new Error("expo-web-browser tidak tersedia di Node")
}
export default { maybeCompleteAuthSession, openAuthSessionAsync }
