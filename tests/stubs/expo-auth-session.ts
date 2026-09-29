/** Stub `expo-auth-session` untuk Vitest — hanya agar graf impor terisi. */
export function makeRedirectUri() {
  return "kahade://"
}
export function useAuthRequest() {
  return [null, null, () => Promise.resolve({ type: "dismiss" })]
}
export const ResponseType = { Code: "code", Token: "token", IdToken: "id_token" }
export default { makeRedirectUri, useAuthRequest }
