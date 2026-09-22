/**
 * Stub `react-native-safe-area-context` untuk test komponen (D-03).
 *
 * Paket aslinya memuat TurboModule native saat import (tidak ada di jsdom) dan
 * berkas Flow-nya tidak bisa di-parse Vitest. Yang dibutuhkan test render
 * hanyalah nilai inset yang deterministik: dipakai komponen seperti `Banner`
 * untuk menempel di bawah notch. Nilai 0 membuat assertion posisi apa pun
 * (kalau nanti ditambahkan) bisa dihitung tanpa perangkat.
 */
import type { ReactNode } from "react"

export const INITIAL_WINDOW_HEIGHT = 800

const insets = { top: 0, right: 0, bottom: 0, left: 0 }

export function useSafeAreaInsets() {
  return insets
}

export function useSafeAreaFrame() {
  return { x: 0, y: 0, width: 390, height: INITIAL_WINDOW_HEIGHT }
}

export const SafeAreaInsetsContext = {
  Consumer: ({ children }: { children: (value: typeof insets) => ReactNode }) => children(insets),
  Provider: ({ children }: { children: ReactNode }) => children,
}

export function SafeAreaProvider({ children }: { children: ReactNode }) {
  return children
}

export function SafeAreaView({ children }: { children: ReactNode }) {
  return children
}

export function withSafeAreaInsets<P>(Component: (props: P) => ReactNode) {
  return Component
}
