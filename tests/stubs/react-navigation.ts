/**
 * Stub `@react-navigation/native` untuk Vitest (config komponen).
 *
 * `useApiQuery`/`usePaginatedQuery`/`usePolling` memakai `useIsFocused` untuk
 * refresh-on-focus (F-01/F-02). Paket navigasi asli butuh NavigationContainer
 * — di test, fokus dikendalikan manual lewat `__setFocused()` lalu
 * `rerender()` dari renderHook.
 */
let focused = true

/** Test helper: ubah nilai yang akan dibaca `useIsFocused()` pada render berikut. */
export function __setFocused(next: boolean): void {
  focused = next
}

export function useIsFocused(): boolean {
  return focused
}

export function useNavigation(): unknown {
  return { navigate: () => undefined, goBack: () => undefined }
}

export function useFocusEffect(): void {
  /* no-op: efek fokus diuji lewat useIsFocused */
}

export default { useIsFocused, useNavigation, useFocusEffect }
