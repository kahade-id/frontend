/**
 * Kahade — <ContentContainer> pembatas lebar web (§11).
 *
 * Di >= 768px (prefix `md:`) konten di-cap 520px dan di-center; di bawahnya
 * `w-full` biasa. Aturan ini SUDAH diterapkan sekali di AppShell (_layout.tsx)
 * untuk seluruh <Stack>, jadi route biasa TIDAK perlu komponen ini (Screen
 * sengaja tidak memasangnya — lihat komentar di screen.tsx).
 *
 * Kapan dipakai (non-obvious): elemen yang dirender DI LUAR tree Stack —
 * Portal host untuk Bottom Sheet, Modal, Banner (z-index §6.2), overlay
 * Search full-screen (§9.23), atau layar auth/splash yang punya root sendiri.
 * Tanpa pembatas ini, sheet di web lebar akan membentang ke 100% viewport
 * sementara kontennya di bawah hanya 520px — terasa rusak.
 *
 * `bordered` menggambar border kiri-kanan di web lebar, sama dengan AppShell,
 * agar batas konten terlihat tanpa shadow (§6). Default false karena overlay
 * biasanya sudah punya backdrop yang memberi batas visual.
 */
import type { ReactNode } from "react"
import { View, type ViewProps } from "react-native"

import { cn } from "@/lib/cn"

export type ContentContainerProps = Omit<ViewProps, "children"> & {
  children?: ReactNode
  /** Border kiri-kanan di >= md, seperti AppShell */
  bordered?: boolean
  /** flex-1 (default true — umumnya membungkus seluruh tinggi) */
  flex?: boolean
  className?: string
}

export function ContentContainer({
  children,
  bordered = false,
  flex = true,
  className,
  ...rest
}: ContentContainerProps) {
  return (
    <View
      className={cn(
        "w-full self-center md:max-w-content",
        flex && "flex-1",
        bordered && "md:border-x md:border-border",
        className,
      )}
      {...rest}
    >
      {children}
    </View>
  )
}
