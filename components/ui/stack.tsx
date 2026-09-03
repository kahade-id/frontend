/**
 * Kahade — <VStack> / <HStack> / <Spacer> (§4 Spacing & Layout).
 *
 * Helper layout flex dengan `gap` dari skala spacing (§4). Tujuannya bukan
 * menggantikan <View className>, tapi memaksa dua kebiasaan sistem:
 *   1. Jarak antar elemen SELALU lewat `gap` (bukan margin di anak) — sesuai
 *      aturan "jangan campur margin/padding dengan gap" dan memudahkan
 *      reorder/conditional render tanpa margin yatim.
 *   2. Nilai gap hanya dari `space` tokens (0,1,2,3,4,5,6,8,10,12,16).
 *
 * Kenapa ada tabel `gapClass` literal (non-obvious): Tailwind content
 * scanner tidak bisa melihat `gap-${n}` yang disusun saat runtime, sehingga
 * class-nya tidak akan digenerate. Tabel statis = class pasti ada. Kalau
 * `space` di tokens.ts ditambah, tabel ini harus ikut ditambah (TypeScript
 * `Record<SpaceKey, …>` akan error, jadi tidak akan terlewat).
 *
 * <Spacer> = `flex-1` pendorong (mis. dorong CTA ke bawah layar). Tanpa gap
 * tetap berguna karena mengambil sisa ruang, bukan jarak tetap.
 */
import { View, type ViewProps } from "react-native"

import { cn } from "@/lib/cn"
import type { space } from "@/lib/tokens"

export type SpaceKey = keyof typeof space
export type StackAlign = "start" | "center" | "end" | "stretch" | "baseline"
export type StackJustify = "start" | "center" | "end" | "between" | "around" | "evenly"

export type StackProps = ViewProps & {
  /** Jarak antar anak, key skala spacing (§4). Default 4 (16px). */
  gap?: SpaceKey
  align?: StackAlign
  justify?: StackJustify
  wrap?: boolean
  /** Ambil sisa ruang parent (flex-1) */
  flex?: boolean
  className?: string
}

const gapClass: Record<SpaceKey, string> = {
  0: "gap-0",
  1: "gap-1",
  2: "gap-2",
  3: "gap-3",
  4: "gap-4",
  5: "gap-5",
  6: "gap-6",
  8: "gap-8",
  10: "gap-10",
  12: "gap-12",
  16: "gap-16",
}

const alignClass: Record<StackAlign, string> = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
  baseline: "items-baseline",
}

const justifyClass: Record<StackJustify, string> = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between",
  around: "justify-around",
  evenly: "justify-evenly",
}

type StackStyleOpts = Pick<StackProps, "align" | "justify" | "wrap" | "flex" | "className"> & {
  gap: SpaceKey
}

function stackClass(
  direction: "flex-col" | "flex-row",
  { gap, align, justify, wrap, flex, className }: StackStyleOpts,
) {
  return cn(
    direction,
    gapClass[gap],
    align && alignClass[align],
    justify && justifyClass[justify],
    wrap && "flex-wrap",
    flex && "flex-1",
    className,
  )
}

/** Susunan vertikal (default align stretch mengikuti flex-col RN) */
export function VStack({ gap = 4, align, justify, wrap, flex, className, ...rest }: StackProps) {
  return (
    <View className={stackClass("flex-col", { gap, align, justify, wrap, flex, className })} {...rest} />
  )
}

/** Susunan horizontal — default `items-center` agar ikon & teks sejajar (§7) */
export function HStack({
  gap = 2,
  align = "center",
  justify,
  wrap,
  flex,
  className,
  ...rest
}: StackProps) {
  return (
    <View className={stackClass("flex-row", { gap, align, justify, wrap, flex, className })} {...rest} />
  )
}

export type SpacerProps = Omit<ViewProps, "children"> & { className?: string }

/** Pendorong flex-1 — isi sisa ruang di dalam VStack/HStack */
export function Spacer({ className, ...rest }: SpacerProps) {
  return <View className={cn("flex-1", className)} {...rest} />
}
