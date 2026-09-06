/**
 * Kahade — <SearchOverlay> (§9.23 Search).
 *
 * Overlay FULL-SCREEN yang dibuka oleh <SearchTrigger> — bukan inline expand.
 * Berisi (dari atas): <SearchField> hidup + tombol "Batal", lalu salah satu:
 *   - query kosong  → recent searches (dengan hapus per item / semua)
 *   - query terisi  → suggestion list, atau slot `children` untuk hasil nyata
 *     (list transaksi) yang dirender pemanggil.
 *
 * Keputusan non-obvious:
 *   - Dirender lewat <Portal> di `z-modal`, bg-background PENUH (bukan scrim):
 *     §9.23 menyebut "full-screen overlay", secara mental model ini layar
 *     baru sementara, bukan dialog. Menutup tab bar di bawahnya juga
 *     disengaja — fokus tunggal ke pencarian.
 *   - Tidak dipush lewat router: overlay harus muncul dari halaman mana pun
 *     tanpa mengubah stack navigasi, dan Back/Escape menutupnya lewat
 *     `useOverlayDismissKeys` (satu konsep dismiss dengan Modal/Sheet).
 *   - Header search TANPA border-b: field sudah punya border sendiri, garis
 *     kedua akan berlapis. Pemisahan dengan konten cukup dari spacing.
 *   - Recent/suggestion memakai <ListItem> supaya tinggi baris & divider
 *     konsisten dengan list lain (§9.17).
 *   - Web `md:max-w-content` (§11) diterapkan di kolom konten agar tetap
 *     terasa mobile di viewport lebar.
 *   - Fokus & modalitas SR (audit #3): overlay memblokir seluruh layar ->
 *     `useBlockingOverlay` menyembunyikan <Stack> dari screen reader.
 *     SearchField sudah `autoFocus` (keyboard); `useOverlayFocus` menyusul
 *     memindahkan fokus SR ke field yang sama dan mengembalikannya ke
 *     `returnFocusRef` (biasanya <SearchTrigger>) saat tutup.
 */
import { Clock, MagnifyingGlass, X } from "phosphor-react-native"
import { useRef, type ReactNode } from "react"
import { Animated, ScrollView, StyleSheet, View, type TextInput } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { useOverlayDismissKeys, useOverlayPresence } from "@/components/ui/backdrop"
import { Button } from "@/components/ui/button"
import { IconButton } from "@/components/ui/icon-button"
import { ListItem } from "@/components/ui/list-item"
import { Portal, useBlockingOverlay } from "@/components/ui/portal"
import { SearchField, type SearchFieldProps } from "@/components/ui/search-field"
import { Spinner } from "@/components/ui/spinner"
import { Text } from "@/components/ui/text"
import { TextLink } from "@/components/ui/text-link"
import { useOverlayFocus, type A11yNodeRef } from "@/lib/use-overlay-focus"

export type SearchOverlayProps = Pick<SearchFieldProps, "placeholder" | "onSearch" | "debounceMs"> & {
  visible: boolean
  onRequestClose: () => void
  value: string
  onChangeText: (q: string) => void
  /** Pencarian terakhir — tampil saat query kosong */
  recent?: readonly string[]
  onSelectRecent?: (q: string) => void
  onRemoveRecent?: (q: string) => void
  onClearRecent?: () => void
  /** Saran saat mengetik — tampil kalau `children` tidak diberikan */
  suggestions?: readonly string[]
  onSelectSuggestion?: (q: string) => void
  /** Hasil nyata (list transaksi) — menggantikan suggestion */
  children?: ReactNode
  loading?: boolean
  cancelLabel?: string
  recentTitle?: string
  /** Pemicu (SearchTrigger) yang menerima fokus kembali saat overlay tutup. */
  returnFocusRef?: A11yNodeRef
}

export function SearchOverlay({
  visible,
  onRequestClose,
  value,
  onChangeText,
  placeholder,
  onSearch,
  debounceMs,
  recent = [],
  onSelectRecent,
  onRemoveRecent,
  onClearRecent,
  suggestions = [],
  onSelectSuggestion,
  children,
  loading = false,
  cancelLabel = "Batal",
  recentTitle = "Pencarian terakhir",
  returnFocusRef,
}: SearchOverlayProps) {
  const insets = useSafeAreaInsets()
  const { mounted, progress } = useOverlayPresence(visible)
  const fieldRef = useRef<TextInput>(null)
  useOverlayDismissKeys(visible, onRequestClose)
  useBlockingOverlay(visible)
  useOverlayFocus(visible, fieldRef, { returnFocusRef })

  if (!mounted) return null

  const hasQuery = value.trim().length > 0

  return (
    <Portal>
      {/* absoluteFill (idiom RN, sama dengan <Backdrop>) — bukan literal top/right/bottom/left (audit #10) */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: progress }]}>
        <View accessible={false}
          accessibilityViewIsModal
          accessibilityRole="search"
          className="flex-1 z-modal items-center bg-background"
          style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
        >
          <View className="w-full flex-1 md:max-w-content">
            {/* Header: field hidup + batal */}
            <View className="flex-row items-center gap-2 px-6 py-3">
              <View className="flex-1">
                <SearchField
                  ref={fieldRef}
                  value={value}
                  onChangeText={onChangeText}
                  onSearch={onSearch}
                  debounceMs={debounceMs}
                  placeholder={placeholder}
                  clearable
                  onClear={() => onChangeText("")}
                />
              </View>
              <Button variant="ghost" size="sm" fullWidth={false} onPress={onRequestClose}>
                {cancelLabel}
              </Button>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              contentContainerClassName="pb-8"
            >
              {loading ? (
                <View className="flex-row items-center gap-2 px-6 py-3 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
                  <Spinner size="sm" />
                  <Text variant="caption" tone="secondary">
                    Mencari
                  </Text>
                </View>
              ) : null}

              {!hasQuery ? (
                recent.length > 0 ? (
                  <View>
                    <View className="flex-row items-center justify-between px-6 pb-1 pt-3">
                      <Text variant="label" tone="secondary">
                        {recentTitle}
                      </Text>
                      {onClearRecent ? (
                        <TextLink onPress={onClearRecent} variant="caption">
                          Hapus semua
                        </TextLink>
                      ) : null}
                    </View>
                    {recent.map((q) => (
                      <ListItem
                        key={q}
                        leading={Clock}
                        title={q}
                        onPress={() => onSelectRecent?.(q)}
                        trailing={
                          onRemoveRecent ? (
                            <IconButton accessibilityHint="Ketuk untuk berinteraksi"
                              icon={X}
                              size="sm"
                              variant="ghost"
                              accessibilityLabel={`Hapus "${q}" dari pencarian terakhir`}
                              onPress={() => onRemoveRecent(q)}
                            />
                          ) : undefined
                        }
                        divider
                      />
                    ))}
                  </View>
                ) : null
              ) : children ? (
                children
              ) : (
                suggestions.map((s) => (
                  <ListItem
                    key={s}
                    leading={MagnifyingGlass}
                    title={s}
                    onPress={() => onSelectSuggestion?.(s)}
                    divider
                  />
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Animated.View>
    </Portal>
  )
}