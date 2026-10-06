/** expo-updates is native; component tests exercise the static version screen only. */
export const isEnabled = false
export const channel: string | null = null
export const updateId: string | null = null
export const runtimeVersion: string | null = null
export async function checkForUpdateAsync() {
  return { isAvailable: false, manifest: null }
}
export async function fetchUpdateAsync() {
  return { isNew: false, manifest: null }
}
export async function reloadAsync(): Promise<void> {}
export default {
  isEnabled,
  channel,
  updateId,
  runtimeVersion,
  checkForUpdateAsync,
  fetchUpdateAsync,
  reloadAsync,
}
