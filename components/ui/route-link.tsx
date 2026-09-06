/**
 * Kahade — <RouteLink> navigasi deklaratif berbasis href (§10 Push, §11 Web).
 *
 * Membungkus `expo-router` <Link asChild> di atas <PressableScale>, sehingga
 * kartu/list item/blok apa pun bisa menjadi tautan rute dengan:
 *   - pressed scale 0.97 + disabled opacity (dari PressableScale, §9.1)
 *   - di WEB: elemen dirender sebagai <a href> sungguhan -> bisa
 *     buka-di-tab-baru, tampil di status bar, ter-crawl, dan dapat fokus
 *     keyboard + focusRing (ini yang tidak didapat dari `router.push` di
 *     onPress biasa)
 *   - di native: push/replace Stack sesuai §10 (transisi slide 300ms diatur
 *     di _layout.tsx, bukan di sini)
 *
 * Kenapa bukan menambah `href` ke <TextLink> (non-obvious): TextLink adalah
 * teks inline (§2.3 "primary + underline") untuk rujukan di dalam kalimat.
 * RouteLink adalah KOTAK yang bisa ditekan (kartu transaksi -> detail,
 * baris menu -> layar setting) dan tidak punya underline. Keduanya sengaja
 * dipisah supaya tidak ada komponen dengan dua bahasa visual.
 *
 * `href` bertipe `Href` expo-router: typo rute = compile error saat typed
 * routes aktif. `disabled` mematikan Link (asChild meneruskan onPress ke
 * Pressable yang disabled -> tidak navigasi) dan tetap memberi opacity.
 */
import { forwardRef } from "react"
import type { View as RNView } from "react-native"
import { Link, type Href } from "expo-router"

import { PressableScale, type PressableScaleProps } from "@/components/ui/pressable-scale"
import { cn } from "@/lib/cn"
import { focusRing } from "@/lib/focus-ring"

export type RouteLinkProps = Omit<PressableScaleProps, "onPress"> & {
  href: Href
  /** Ganti layar saat ini alih-alih push (mis. setelah sukses -> hasil) */
  replace?: boolean
  /** Dipanggil sebelum navigasi (analytics/haptic). Tidak bisa membatalkan. */
  onPress?: PressableScaleProps["onPress"]
}

export const RouteLink = forwardRef<RNView, RouteLinkProps>(function RouteLink(
  { href, replace = false, disabled, containerClassName, className, children, ...rest },
  ref,
) {
  return (
    <Link href={href} replace={replace} asChild>
      <PressableScale accessibilityHint="Ketuk untuk berinteraksi" hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityRole="button"
        ref={ref}
        accessibilityRole="link"
        disabled={disabled}
        containerClassName={cn(focusRing, containerClassName)}
        className={className}
        {...rest}
      >
        {children}
      </PressableScale>
    </Link>
  )
})
