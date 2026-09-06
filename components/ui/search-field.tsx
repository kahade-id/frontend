/**
 * Kahade — <SearchField> + <SearchTrigger> (§9.23 Search).
 *
 * Per §9.23 pencarian dibuka sebagai overlay FULL-SCREEN, bukan inline
 * expand. Maka ada dua komponen:
 *   - <SearchTrigger> : tampilan "field palsu" di halaman (ikon + placeholder
 *                       text-disabled) yang saat di-tap membuka overlay.
 *                       Tidak fokusable sebagai TextInput — mencegah keyboard
 *                       muncul sebelum overlay siap.
 *   - <SearchField>   : Input varian search yang HIDUP, dipakai di dalam
 *                       overlay (<SearchOverlay> kelompok Overlay). Hanya
 *                       membungkus <Input variant="search"> dengan default
 *                       autoFocus, returnKeyType "search", dan debounce
 *                       `onSearch`.
 *
 * Debounce (default 300ms = motion.duration.base) diletakkan di sini supaya
 * daftar suggestion tidak me-request tiap ketukan; pemanggil menerima
 * `onChangeText` real-time untuk UI dan `onSearch` yang sudah di-debounce.
 */
import { MagnifyingGlass } from "phosphor-react-native"
import { forwardRef, useEffect, useRef } from "react"
import { TextInput, type View } from "react-native"

import { Icon } from "@/components/ui/icon"
import { Input, type InputProps } from "@/components/ui/input"
import { PressableScale, type PressableScaleProps } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"

export type SearchFieldProps = Omit<InputProps, "variant" | "label"> & {
  /** Dipanggil setelah user berhenti mengetik selama `debounceMs` */
  onSearch?: (query: string) => void
  debounceMs?: number
}

export const SearchField = forwardRef<TextInput, SearchFieldProps>(function SearchField(
  {
    onSearch,
    debounceMs = tokens.motion.duration.base,
    onChangeText,
    onSubmitEditing,
    value,
    placeholder = "Cari transaksi, pihak, atau ID",
    ...rest
  },
  ref,
) {
  const latestSearch = useRef(onSearch)
  latestSearch.current = onSearch
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  return (
    <Input
      {...rest}
      ref={ref}
      variant="search"
      value={value}
      placeholder={placeholder}
      autoFocus={rest.autoFocus ?? true}
      returnKeyType="search"
      autoCorrect={false}
      autoCapitalize="none"
      onChangeText={(t) => {
        onChangeText?.(t)
        if (!onSearch) return
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => latestSearch.current?.(t), debounceMs)
      }}
      onSubmitEditing={(e) => {
        if (timer.current) clearTimeout(timer.current)
        onSearch?.(e.nativeEvent.text)
        onSubmitEditing?.(e)
      }}
    />
  )
})

export type SearchTriggerProps = Omit<PressableScaleProps, "children" | "className"> & {
  placeholder?: string
  className?: string
}

/**
 * Field palsu di halaman — tap untuk membuka overlay Search.
 * Ref diteruskan agar bisa jadi `SearchOverlay.returnFocusRef` (audit #3).
 */
export const SearchTrigger = forwardRef<View, SearchTriggerProps>(function SearchTrigger(
  { placeholder = "Cari transaksi, pihak, atau ID", className, containerClassName, ...rest },
  ref,
) {
  return (
    <PressableScale
      ref={ref}
      accessibilityRole="search"
      accessibilityLabel={placeholder}
      accessibilityHint="Ketuk untuk mencari"
      scaleOnPress={false}
      containerClassName={cn("w-full", containerClassName)}
      className={cn(
        "min-h-12 w-full flex-row items-center gap-2 rounded-sm border border-border-control bg-background px-4 py-3",
        className,
      )}
      {...rest}
    >
      <Icon icon={MagnifyingGlass} size="sm" />
      <Text variant="bodyLarge" tone="disabled" numberOfLines={1} className="flex-1">
        {placeholder}
      </Text>
    </PressableScale>
  )
})
