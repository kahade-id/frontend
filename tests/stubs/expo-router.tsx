/**
 * Stub `expo-router` untuk Vitest (config komponen).
 *
 * Router asli menarik seluruh runtime navigasi (react-navigation + expo
 * linking) yang butuh native globals. Test komponen hanya butuh <Link> yang
 * merender anak-anaknya dan hook params yang mengembalikan nilai kosong.
 */
import React from "react"
import type { ReactNode } from "react"

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

export function useLocalSearchParams(): Record<string, string | undefined> {
  return {}
}
export function useGlobalSearchParams(): Record<string, string | undefined> {
  return {}
}
export function usePathname(): string {
  return "/"
}
export function useSegments(): string[] {
  return []
}
export function useRouter() {
  return router
}
export function useFocusEffect(effect: () => void): void {
  React.useEffect(effect, [])
}
export const router = {
  push: (_href: Href) => undefined,
  replace: (_href: Href) => undefined,
  back: () => undefined,
  navigate: (_href: Href) => undefined,
  canGoBack: () => false,
}
export default { Link, router, useRouter, useLocalSearchParams, usePathname }
