/**
 * Stub `react-native` untuk Vitest.
 *
 * `lib/api/client.ts` mengimpor `Platform` hanya untuk mengisi header
 * `X-Platform`. Memuat paket `react-native` yang asli di Node gagal pada baris
 * `import typeof …` (sintaks Flow) sebelum satu pun test berjalan. Nilai di sini
 * tidak memengaruhi logika yang diuji.
 */
export const Platform = {
  OS: "web" as const,
  select: <T,>(specific: { web?: T; default?: T }) => specific.web ?? specific.default,
}

/**
 * Komponen primitif secukupnya untuk test komponen (jsdom): cukup meneruskan
 * `children`. Test yang tidak me-render komponen tidak terpengaruh (superset).
 */
type AnyProps = { children?: unknown }
const passthrough = (props: AnyProps) => (props.children as never) ?? null
export const View = passthrough
export const ScrollView = passthrough
export const Text = passthrough
export const Pressable = passthrough
export const TouchableOpacity = passthrough
export const Image = passthrough
export const Modal = passthrough
export const TextInput = passthrough
export const useWindowDimensions = () => ({ width: 390, height: 844, scale: 2, fontScale: 1 })
export const StyleSheet = {
  create: <T,>(styles: T) => styles,
  flatten: (style: unknown) => style,
  absoluteFill: {} as Record<string, unknown>,
  hairlineWidth: 1,
}

export default {
  Platform,
  View,
  ScrollView,
  Text,
  Pressable,
  TouchableOpacity,
  Image,
  Modal,
  TextInput,
  useWindowDimensions,
  StyleSheet,
}
