/** Stub `expo-apple-authentication` untuk Vitest — hanya agar graf impor terisi. */
export const AppleAuthenticationButtonType = { SIGN_IN: 0 }
export const AppleAuthenticationButtonStyle = { BLACK: 0 }
export const AppleAuthenticationScope = { FULL_NAME: 0, EMAIL: 1 }
export async function signInAsync() {
  throw new Error("expo-apple-authentication tidak tersedia di Node")
}
export function isAvailableAsync() {
  return Promise.resolve(false)
}
export default { signInAsync, isAvailableAsync }
