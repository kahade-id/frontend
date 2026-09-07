/**
 * Kahade — <Show> gating platform & breakpoint (§11 web, satu breakpoint).
 *
 * Deklaratif untuk "render ini hanya di …" tanpa menyebar `Platform.OS` dan
 * `hidden md:flex` ke banyak file:
 *   - `on`     : "web" | "native" | "ios" | "android" — pilihan platform.
 *                Ini LOGIC non-style, jadi branch manual Platform.OS
 *                diizinkan (sama seperti memilih ikon per platform).
 *   - `above`  : "md" -> tampil hanya di >= 768px (className `hidden md:flex`)
 *   - `below`  : "md" -> tampil hanya di < 768px (className `flex md:hidden`)
 *   - `when`   : boolean tambahan (mis. feature flag)
 *   - `fallback`: dirender bila kondisi platform/`when` gagal.
 *
 * Kenapa breakpoint via className, bukan `useWindowDimensions` (non-obvious):
 * NativeWind mengevaluasi media query `md:` di native maupun web dari lebar
 * window secara reaktif, tanpa re-render JS per resize dan tanpa satu frame
 * salah saat hydrate di web. Konsekuensinya: untuk `above`/`below` anak
 * tetap di-mount (hanya disembunyikan) — jangan pakai untuk gating yang
 * mahal atau berefek samping; untuk itu pakai `on`/`when`.
 *
 * Hanya `md` yang tersedia karena §11 menetapkan satu breakpoint; sm/lg/xl
 * sengaja tidak ada di tailwind.config.js.
 */
import type { ReactNode } from "react"
import { Platform, View, type ViewProps } from "react-native"

import { cn } from "@/lib/cn"

export type ShowPlatform = "web" | "native" | "ios" | "android"

export type ShowProps = Omit<ViewProps, "children"> & {
  children?: ReactNode
  on?: ShowPlatform | ShowPlatform[]
  above?: "md"
  below?: "md"
  when?: boolean
  fallback?: ReactNode
  className?: string
}

function matchesPlatform(on: ShowPlatform | ShowPlatform[] | undefined): boolean {
  if (!on) return true
  const list = Array.isArray(on) ? on : [on]
  return list.some((p) => {
    if (p === "native") return Platform.OS !== "web"
    return Platform.OS === p
  })
}

export function Show({
  children,
  on,
  above,
  below,
  when = true,
  fallback = null,
  className,
  ...rest
}: ShowProps) {
  if (!when || !matchesPlatform(on)) return <>{fallback}</>

  // Tanpa breakpoint: tidak perlu View pembungkus tambahan.
  if (!above && !below) return <>{children}</>

  return (
    <View
      className={cn(above === "md" && "hidden md:flex", below === "md" && "flex md:hidden", className)}
      {...rest}
    >
      {children}
    </View>
  )
}
