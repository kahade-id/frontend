/**
 * Stub `expo-router` untuk Vitest (config komponen).
 *
 * Router asli menarik seluruh runtime navigasi (expo-router 58 memakai
 * `standard-navigation`, bukan lagi fork @react-navigation) yang butuh native
 * globals. Test komponen hanya butuh <Link> yang merender anak-anaknya dan
 * hook params yang mengembalikan nilai kosong.
 *
 * SDK 58: hook navigasi (useIsFocused/useNavigation/useFocusEffect/
 * usePreventRemove) sekarang diimpor dari `expo-router`, bukan dari
 * `@react-navigation/native`. Implementasinya tetap dibagikan dengan
 * `stubs/react-navigation.ts` supaya `__setFocused()` tetap mengendalikan
 * `useIsFocused()` dari satu sumber (F-01/F-02).
 */
import React from "react"
import type { ReactNode } from "react"

import {
  useFocusEffect as sharedUseFocusEffect,
  useIsFocused as sharedUseIsFocused,
  useNavigation as sharedUseNavigation,
} from "./react-navigation"

export type Href = string | { pathname: string; params?: Record<string, string> }

export function Link({
  href,
  children,
  ...rest
}: {
  href: Href
  children: ReactNode
  asChild?: boolean
  [key: string]: unknown
}) {
  const target = typeof href === "string" ? href : href.pathname
  return React.createElement("a", { href: target, ...rest }, children)
}

let localSearchParams: Record<string, string | undefined> = {}

export function __setLocalSearchParams(next: Record<string, string | undefined>): void {
  localSearchParams = { ...next }
}

export function useLocalSearchParams<T extends Record<string, string | undefined> = Record<string, string | undefined>>(): T {
  return localSearchParams as T
}

export function Redirect({ href }: { href: Href }) {
  const target = typeof href === "string" ? href : href.pathname
  return React.createElement("span", { "data-testid": "router-redirect", "data-href": target })
}
export function useGlobalSearchParams(): Record<string, string | undefined> {
  return {}
}
/**
 * Pathname aktif untuk test.
 *
 * B-03 (audit): gerbang tamu web (`lib/guest-gate.ts`) memutuskan dari
 * pathname, jadi test harus bisa memindahkan layar seperti navigasi sungguhan —
 * `__setPathname()` memberi tahu pelanggan sehingga hook ikut re-render (pola
 * sama dengan `__setFocused()` di tests/stubs/react-navigation.ts).
 */
let pathname = "/"
const pathnameListeners = new Set<() => void>()

/** Test helper: pindah "layar" tanpa router sungguhan. */
export function __setPathname(next: string): void {
  if (pathname === next) return
  pathname = next
  for (const listener of pathnameListeners) listener()
}

function subscribePathname(listener: () => void): () => void {
  pathnameListeners.add(listener)
  return () => {
    pathnameListeners.delete(listener)
  }
}

const getPathname = () => pathname

export function usePathname(): string {
  return React.useSyncExternalStore(subscribePathname, getPathname, getPathname)
}
export function useSegments(): string[] {
  return []
}
export function useRouter() {
  return router
}
export const useIsFocused = sharedUseIsFocused
export const useNavigation = sharedUseNavigation
export const useFocusEffect = sharedUseFocusEffect

/**
 * SDK 58: pencegah resmi perpindahan rute. Di test tidak ada navigator, jadi
 * stub ini hanya menyimpan callback terakhir agar test bisa memicu
 * "percobaan keluar" secara eksplisit lewat `__triggerPreventedRemove()`.
 */
type PreventRemoveCallback = (options: {
  data: { action: { type: string } }
  repeat: () => void
}) => void
let preventRemoveCallback: PreventRemoveCallback | null = null

export function usePreventRemove(preventRemove: boolean, callback?: PreventRemoveCallback): void {
  preventRemoveCallback = preventRemove ? (callback ?? null) : null
}

/** Test helper: simulasi aksi back/leave yang ditahan `usePreventRemove`. */
export function __triggerPreventedRemove(actionType = "GO_BACK"): void {
  preventRemoveCallback?.({ data: { action: { type: actionType } }, repeat: () => undefined })
}
export const router = {
  push: (_href: Href) => undefined,
  replace: (_href: Href) => undefined,
  back: () => undefined,
  navigate: (_href: Href) => undefined,
  canGoBack: () => false,
}
export default { Link, router, useRouter, useLocalSearchParams, usePathname }

