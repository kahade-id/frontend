/**
 * Stub `nativewind` untuk Vitest (config komponen).
 *
 * nativewind (react-native-css-interop) me-require paket `react-native` asli
 * dari CJS di node_modules — alias config tidak menjangkau require itu dan
 * Node tersedak sintaks Flow. Test tidak menguji styling; className sengaja
 * dilewatkan ke DOM apa adanya (lihat docblock vitest.components.config.ts).
 */
export function useColorScheme() {
  return {
    colorScheme: "light" as const,
    setColorScheme: () => undefined,
    toggleColorScheme: () => undefined,
  }
}

/** `vars()` nativewind memetakan token ke variabel CSS — identitas cukup. */
export function vars<T extends Record<string, unknown>>(values: T): T {
  return values
}

/**
 * `cssInterop(Component, mapping)` mendaftarkan className→style di runtime
 * nativewind. Di test tidak ada engine style — kembalikan komponennya apa
 * adanya supaya `export const X = cssInterop(Comp, …)` tetap bisa dirender.
 */
export function cssInterop<T>(component: T): T {
  return component
}

export const colorScheme = {
  get: () => "light" as const,
  set: (_scheme: string | null) => undefined,
  subscribe: () => () => undefined,
}

export default { useColorScheme, vars, cssInterop, colorScheme }
