/**
 * Kahade — <GesturePressable> + useTransformAwarePressable().
 *
 * Pressable react-native-gesture-handler yang sudah di-interop NativeWind,
 * dipakai HANYA di dalam subtree ber-transform Reanimated (lihat
 * reanimated-pressable-context.ts: BottomSheet, SwipeableListItem terbuka).
 * RNGH Pressable dibangun di atas
 * `Gesture.Native()` (NativeViewGestureHandler): target sentuh dihitung dari
 * hierarki VIEW NATIVE, bukan `UIManager.measure` shadow tree yang basi
 * setelah animasi Reanimated di UI thread (facebook/react-native#51621).
 *
 * Kenapa tidak dipakai untuk semua tombol:
 *   - Di web (react-native-web) RNGH merender elemen <button> dengan semantik
 *     dan manajemen fokus yang berbeda dari Pressable biasa; ring fokus
 *     NativeWind (focusRing) dan a11y web sudah diuji terhadap Pressable RNW.
 *     Karena bug shadow-tree hanya ada di Fabric native, pemakaian dibatasi
 *     native lewat pembacaan context (hook di bawah).
 *   - RNGH Pressable defaultnya TANPA ripple (android_ripple tidak diisi) —
 *     sesuai keputusan produk "tanpa ripple Android" di PressableScale.
 *
 * cssInterop: RNGH Pressable meneruskan `style` ke NativeButton tetapi tidak
 * mengenali prop `className`; interop ini memetakan className -> style seperti
 * pada View/Pressable bawaan.
 *
 * Keterbatasan: RNGH Pressable 2.28 belum meneruskan `ref` ke native view.
 * Seluruh `returnFocusRef` overlay di proyek menunjuk ke PEMICU di belakang
 * overlay, bukan elemen di dalamnya, sehingga tidak ada pemakaian yang
 * terdampak.
 */
import { useContext } from "react"
import { Platform, Pressable, type PressableProps } from "react-native"
import { cssInterop } from "nativewind"
import { Pressable as RNGHPressable } from "react-native-gesture-handler"

import { InsideReanimatedTransformContext } from "@/components/ui/reanimated-pressable-context"

/**
 * Tipenya disamakan dengan Pressable bawaan RN. RNGH Pressable kompatibel
 * dengan properti yang dipakai sistem desain kita (onPress/In/Out,
 * onLongPress, delayLongPress, unstable_pressDelay, hitSlop, disabled,
 * accessibility*, className, children, style).
 */
export const GesturePressable = cssInterop(RNGHPressable, {
  className: { target: "style" },
}) as unknown as typeof Pressable

export type GesturePressableProps = PressableProps

/**
 * Mengembalikan GesturePressable hanya saat komponen dirender di dalam
 * subtree ber-transform Reanimated pada perangkat native; selain itu
 * Pressable bawaan RN. Dipakai oleh PressableScale (seluruh tombol/baris di
 * BottomSheet — ActionSheet, Select/BankSelect, PinPad, form — dan baris
 * SwipeableListItem yang tersnap) serta ikon clear/secure di <Input>.
 */
export function useTransformAwarePressable(): typeof Pressable {
  const insideReanimatedOverlay = useContext(InsideReanimatedTransformContext)
  // Web tetap memakai Pressable RNW (lihat catatan file): bug Fabric hanya di
  // native.
  return insideReanimatedOverlay && Platform.OS !== "web"
    ? GesturePressable
    : Pressable
}
