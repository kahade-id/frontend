/**
 * Kahade — `elevationStyle()` satu-satunya jalan memakai shadow (v2 §5.2).
 *
 * Kenapa helper ini ada (bukan utility Tailwind, bukan inline style):
 * shadow membutuhkan TIGA hal sekaligus yang tidak bisa diwakili satu class
 * statis — nilai iOS (shadowColor/Offset/Opacity/Radius), `elevation` Android
 * (selalu netral, tidak bisa diwarnai), dan `box-shadow` CSS di web — SERTA
 * resolusi warna/opacity per mode (light warm-tinted, dark menghitam + boost).
 * Semua nilai mentah tetap di lib/tokens.ts (`shadow.*`); file ini hanya
 * me-resolve-nya per platform + mode. Jangan tulis `shadow*` / `elevation` /
 * `boxShadow` manual di komponen mana pun.
 *
 * Aturan level (lihat komentar `shadow` di tokens.ts):
 * flat = struktural (border saja), low = kartu interaktif, medium = toast/FAB/
 * popover, high = sheet/modal. Jangan tempel level yang sama ke semua card.
 */
import { Platform, type ViewStyle } from "react-native"

import { shadow, type ColorMode, type ElevationLevel } from "./tokens"

export type { ElevationLevel }

export function elevationStyle(level: ElevationLevel, mode: ColorMode): ViewStyle {
  if (level === "flat") return {}
  const spec = shadow[level]
  const opacity = spec.shadowOpacity[mode]
  const base: ViewStyle = {
    shadowColor: shadow.color[mode],
    shadowOffset: spec.shadowOffset,
    shadowOpacity: opacity,
    shadowRadius: spec.shadowRadius,
    elevation: spec.elevation,
  }
  if (Platform.OS !== "web") return base
  // react-native-web meneruskan `boxShadow` ke CSS. Warna ditulis sebagai
  // rgb triplet agar alpha mengikuti opacity token per mode.
  const rgb = mode === "light" ? "28,25,23" : "0,0,0"
  const web = {
    boxShadow: `0 ${spec.shadowOffset.height}px ${spec.shadowRadius}px rgba(${rgb},${opacity})`,
  } as unknown as ViewStyle
  return { ...base, ...web }
}
