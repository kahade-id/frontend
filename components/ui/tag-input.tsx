/**
 * Kahade — <TagInput> (§9.25 Chip + §9.2 Input).
 *
 * Input daftar tag: chip yang bisa dihapus + kolom teks; tag baru dibuat saat
 * Enter, koma, atau spasi (opsional), dan saat blur bila ada sisa teks.
 * Dipakai untuk kata kunci showcase, kategori transaksi kustom, dsb.
 *
 * Keputusan non-obvious:
 *   - Chip dan TextInput hidup dalam satu kotak berborder (bukan Input di
 *     atas + chip di bawah) supaya terasa satu field; border ikut fokus/error
 *     mengikuti aturan §6.1 dan kompensasi padding yang sama seperti <Input>.
 *   - Backspace pada input kosong menghapus tag terakhir (kebiasaan umum).
 *   - Normalisasi: trim + lowercase opsional + dedupe case-insensitive;
 *     tag kosong/duplikat diabaikan diam-diam (bukan error) agar tidak bising.
 *   - `maxTags` tercapai -> input disembunyikan, bukan disabled, supaya
 *     tinggi kotak menyusut rapi.
 */
import { useCallback, useRef, useState } from "react"
import {
  Platform,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
  type ViewProps,
} from "react-native"

import { useTheme } from "@/components/theme-provider"
import { Chip } from "@/components/ui/chip"
import { Field, type FieldProps } from "@/components/ui/field"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"

export type TagInputProps = Omit<ViewProps, "children"> &
  Pick<FieldProps, "label" | "helperText" | "errorText" | "reserveHelperSpace" | "required"> & {
    value: readonly string[]
    onChange: (tags: string[]) => void
    placeholder?: string
    maxTags?: number
    maxTagLength?: number
    lowercase?: boolean
    /** Spasi juga memisahkan tag (default false — tag boleh berisi spasi) */
    splitOnSpace?: boolean
    disabled?: boolean
    className?: string
  }

export function TagInput({
  value,
  onChange,
  placeholder,
  maxTags,
  maxTagLength = 24,
  lowercase = false,
  splitOnSpace = false,
  disabled = false,
  label,
  required,
  helperText,
  errorText,
  reserveHelperSpace,
  className,
  ...rest
}: TagInputProps) {
  const { mode } = useTheme()
  const palette = tokens.colors[mode]
  const inputRef = useRef<TextInput>(null)
  const [draft, setDraft] = useState("")
  const [focused, setFocused] = useState(false)

  const full = maxTags != null && value.length >= maxTags
  const hasError = !!errorText

  const commit = useCallback(
    (raw: string) => {
      const pieces = raw
        .split(splitOnSpace ? /[,\s]+/ : /,+/)
        .map((s) => (lowercase ? s.toLowerCase() : s).trim().slice(0, maxTagLength))
        .filter(Boolean)
      if (pieces.length === 0) return
      const seen = new Set(value.map((v) => v.toLowerCase()))
      const next = [...value]
      for (const p of pieces) {
        if (maxTags != null && next.length >= maxTags) break
        if (seen.has(p.toLowerCase())) continue
        seen.add(p.toLowerCase())
        next.push(p)
      }
      if (next.length !== value.length) onChange(next)
      setDraft("")
    },
    [value, onChange, maxTags, maxTagLength, lowercase, splitOnSpace],
  )

  const handleChange = (text: string) => {
    const sep = splitOnSpace ? /[,\s]/ : /,/
    if (sep.test(text)) commit(text)
    else setDraft(text)
  }

  const handleKey = (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (e.nativeEvent.key === "Backspace" && draft.length === 0 && value.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  const remove = (idx: number) => onChange(value.filter((_, i) => i !== idx))

  return (
    <Field
      label={label}
      required={required}
      helperText={helperText}
      errorText={errorText}
      reserveHelperSpace={reserveHelperSpace}
      disabled={disabled}
    >
      <View accessible={false}
        className={cn(
          "min-h-12 w-full flex-row flex-wrap items-center gap-2 rounded-sm bg-background py-2",
          hasError
            ? "border-error border-border-error px-[15px]"
            : focused
              ? "border-focus border-border-focus px-[15px]"
              : "border border-border-control px-4",
          disabled && "opacity-disabled",
          className,
        )}
        onStartShouldSetResponder={() => true}
        onResponderRelease={() => inputRef.current?.focus()}
        {...rest}
      >
        {value.map((tag, i) => (
          <Chip key={`${tag}-${i}`} onRemove={disabled ? undefined : () => remove(i)} disabled={disabled}>
            {tag}
          </Chip>
        ))}

        {!full ? (
          <TextInput
            ref={inputRef}
            value={draft}
            editable={!disabled}
            placeholder={value.length === 0 ? placeholder : undefined}
            placeholderTextColor={palette.textSecondary}
            selectionColor={palette.primary}
            cursorColor={palette.primary}
            allowFontScaling={false}
            autoCapitalize="none"
            autoCorrect={false}
            blurOnSubmit={false}
            onChangeText={handleChange}
            onKeyPress={handleKey}
            onSubmitEditing={() => commit(draft)}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false)
              commit(draft)
            }}
            accessibilityLabel={label ?? placeholder}
            className={cn("min-w-[80px] flex-1 font-sans-400 text-body text-text-primary", Platform.OS === "web" && "outline-none")}
            style={Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : undefined}
          />
        ) : null}

        {maxTags != null ? (
          <Text variant="caption" tone="secondary" className="ml-auto">
            {value.length}/{maxTags}
          </Text>
        ) : null}
      </View>
    </Field>
  )
}
