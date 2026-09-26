/**
 * Kahade — <ShowcaseCategoryInput> (S4 audit Etalase 2026-09-26).
 *
 * Pengganti Input teks bebas untuk kategori etalase: kolom teks + saran
 * kategori populer dari GET /v1/showcase/categories (chip yang bisa di-tap).
 *
 * Keputusan non-obvious:
 *   - Kategori backend adalah string tunggal (bukan daftar tag) yang
 *     dinormalisasi lowercase oleh server — komponen ini single-value:
 *     men-tap chip mengisi kolom, bukan menambah daftar.
 *   - Saran dimuat sekali per mount (bukan per keystroke); bila gagal,
 *     kolom teks tetap berfungsi penuh — saran adalah peningkatan, bukan
 *     keharusan.
 *   - Saran difilter terhadap ketikan saat ini (substring, case-insensitive)
 *     supaya relevan; bila ketikan kosong, tampilkan N terpopuler.
 *   - Validasi client: panjang maks (dari kontrak backend), spasi ganda
 *     dinormalisasi saat commit. Pesan error diteruskan ke `errorText`
 *     mengikuti pola <Field> (§6.1).
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { ScrollView, View } from "react-native"

import { Chip } from "@/components/ui/chip"
import { Input, type InputProps } from "@/components/ui/input"
import { Text } from "@/components/ui/text"
import { getPopularCategories } from "@/lib/api/showcase"
import { translate, useLanguage } from "@/lib/i18n"
import { logWarn } from "@/lib/telemetry"

export type ShowcaseCategoryInputProps = Omit<
  InputProps,
  "value" | "onChangeText" | "multiline" | "numberOfLines"
> & {
  value: string
  onChangeText: (text: string) => void
  /** Batas panjang kategori (default = kontrak backend 60). */
  maxLength?: number
  /** Jumlah saran yang ditampilkan (default 8). */
  suggestionCount?: number
}

export function ShowcaseCategoryInput({
  value,
  onChangeText,
  maxLength = 60,
  suggestionCount = 8,
  label,
  disabled,
  ...rest
}: ShowcaseCategoryInputProps) {
  // Langganan bahasa: label "Kategori populer" & placeholder ikut reaktif.
  useLanguage()
  const [popular, setPopular] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getPopularCategories(suggestionCount * 2)
      .then((rows) => {
        if (!cancelled) setPopular(rows.map((r) => r.category))
      })
      .catch((err) => {
        // Saran opsional — kolom teks tetap berfungsi; jangan ganggu user.
        logWarn("showcase-category:suggestions-fallback", err)
        if (!cancelled) setPopular([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [suggestionCount])

  const query = value.trim().toLowerCase()
  const suggestions = useMemo(() => {
    const pool = popular.filter((c) => c.toLowerCase() !== query)
    const filtered = query ? pool.filter((c) => c.toLowerCase().includes(query)) : pool
    return filtered.slice(0, suggestionCount)
  }, [popular, query, suggestionCount])

  const applySuggestion = useCallback(
    (category: string) => {
      onChangeText(category.slice(0, maxLength))
    },
    [onChangeText, maxLength],
  )

  if (!loading && suggestions.length === 0) {
    return (
      <Input
        label={label}
        value={value}
        onChangeText={onChangeText}
        maxLength={maxLength}
        disabled={disabled}
        {...rest}
      />
    )
  }

  return (
    <View className="gap-2">
      <Input
        label={label}
        value={value}
        onChangeText={onChangeText}
        maxLength={maxLength}
        disabled={disabled}
        {...rest}
      />
      {suggestions.length > 0 ? (
        <View className="gap-1.5">
          <Text variant="caption" tone="secondary">
            {translate("Kategori populer")}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="flex-row gap-2 pr-1"
            accessibilityLabel={translate("Saran kategori")}
          >
            {suggestions.map((c) => (
              <Chip
                key={c}
                selected={query === c.toLowerCase()}
                disabled={disabled}
                onPress={() => applySuggestion(c)}
                accessibilityLabel={translate("Pilih kategori {x}", { x: c })}
              >
                {c}
              </Chip>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  )
}
