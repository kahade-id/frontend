/**
 * Stub expo-sharing untuk Vitest (alias di vitest.config.ts) — pola sama
 * dengan stub expo-clipboard dkk.: paket asli membangun NativeEventEmitter
 * yang butuh global native. Dipakai lib/share; perilaku di-mock pemanggil.
 */
export async function isAvailableAsync(): Promise<boolean> {
  return true
}
export async function shareAsync(_url: string, _options?: object): Promise<void> {}
