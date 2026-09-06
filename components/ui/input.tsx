/** Persistent labels keep a form understandable before, during and after entry. */
import { Eye, EyeSlash, MagnifyingGlass, X } from "phosphor-react-native"
import { forwardRef, useCallback, useEffect, useState } from "react"
import { Platform, Pressable, TextInput, View, type TextInputProps } from "react-native"
import { useTheme } from "@/components/theme-provider"
import { Field, type FieldProps } from "@/components/ui/field"
import { Icon, type IconComponent } from "@/components/ui/icon"
import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"

export type InputVariant = "text" | "search" | "multiline"
export type InputProps = Omit<TextInputProps, "style" | "editable"> &
  Pick<FieldProps, "helperText" | "errorText" | "reserveHelperSpace" | "required"> & {
    label?: string
    variant?: InputVariant
    disabled?: boolean
    leftIcon?: IconComponent
    rightIcon?: IconComponent
    onRightIconPress?: () => void
    rightIconAccessibilityLabel?: string
    clearable?: boolean
    onClear?: () => void
    rows?: number
    className?: string
    containerClassName?: string
  }
const actionClass = "min-h-11 min-w-11 items-center justify-center rounded-sm web:outline-none web:focus-visible:ring-2 web:focus-visible:ring-border-focus"
export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, variant = "text", disabled = false, required, helperText, errorText,
    reserveHelperSpace, leftIcon, rightIcon, onRightIconPress, rightIconAccessibilityLabel,
    accessibilityHint, clearable, onClear, rows = 4, value, defaultValue, placeholder,
    secureTextEntry, onFocus, onBlur, onChangeText, className, containerClassName,
    multiline: _ignoredMultiline, ...rest }, ref,
) {
  const { mode } = useTheme()
  const palette = tokens.colors[mode]
  const [focused, setFocused] = useState(false)
  const [secure, setSecure] = useState(!!secureTextEntry)
  const [internal, setInternal] = useState(defaultValue ?? "")
  useEffect(() => setSecure(!!secureTextEntry), [secureTextEntry])
  const current = value ?? internal
  const isSearch = variant === "search"
  const isMultiline = variant === "multiline"
  const showClear = (clearable ?? isSearch) && current.length > 0 && !disabled
  const showSecureToggle = !!secureTextEntry && !rightIcon && !showClear
  const resolvedLeft = leftIcon ?? (isSearch ? MagnifyingGlass : undefined)
  const handleChange = useCallback((text: string) => {
    if (value === undefined) setInternal(text)
    onChangeText?.(text)
  }, [onChangeText, value])
  const handleClear = useCallback(() => { handleChange(""); onClear?.() }, [handleChange, onClear])
  const multilineStyle = isMultiline
    ? { minHeight: Math.max(1, rows) * tokens.typography.body.lineHeight + tokens.space[6] }
    : undefined
  return (
    <Field
      label={label}
      required={required}
      helperText={helperText}
      errorText={errorText}
      reserveHelperSpace={reserveHelperSpace}
      disabled={disabled}
      className={containerClassName}
    >
      <View
        accessible={false}
        className={cn(
          "w-full min-w-0 flex-row rounded-sm bg-background",
          isMultiline ? "items-start" : "items-center",
          isSearch ? "min-h-12" : "min-h-14",
          // Two-pixel focus/error borders exchange one pixel of inner padding.
          errorText ? "border-error border-border-error px-[15px]" : focused ? "border-focus border-border-focus px-[15px]" : "border border-border-control px-4",
          disabled && "opacity-disabled", className,
        )}
        style={multilineStyle}
      >
        {resolvedLeft ? <View className={cn("mr-2", isMultiline && "pt-3")}><Icon icon={resolvedLeft} size="sm" tone={focused ? "active" : "default"} /></View> : null}
        <TextInput
          ref={ref}
          value={value === undefined ? internal : value}
          editable={!disabled}
          multiline={isMultiline}
          textAlignVertical={isMultiline ? "top" : "center"}
          secureTextEntry={secure}
          placeholder={placeholder}
          placeholderTextColor={palette.textSecondary}
          selectionColor={palette.accent}
          cursorColor={palette.accent}
          allowFontScaling
          maxFontSizeMultiplier={2}
          onFocus={(e) => { setFocused(true); onFocus?.(e) }}
          onBlur={(e) => { setFocused(false); onBlur?.(e) }}
          onChangeText={handleChange}
          accessibilityLabel={label ?? placeholder}
          accessibilityHint={errorText ?? accessibilityHint}
          accessibilityState={{ disabled }}
          className={cn("min-w-0 flex-1 self-stretch py-3 font-sans-400 text-body text-text-primary", disabled && "text-text-disabled", Platform.OS === "web" && "outline-none")}
          style={Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : undefined}
          {...rest}
        />
        {showClear ? (
          <Pressable onPress={handleClear} accessibilityRole="button" accessibilityLabel="Hapus teks" accessibilityHint="Mengosongkan kolom ini" className={actionClass}>
            <Icon icon={X} size="sm" />
          </Pressable>
        ) : showSecureToggle ? (
          <Pressable onPress={() => setSecure((s) => !s)} disabled={disabled} accessibilityRole="button"
            accessibilityLabel={secure ? "Tampilkan kata sandi" : "Sembunyikan kata sandi"}
            accessibilityHint={secure ? "Menampilkan kata sandi sebagai teks" : "Menyembunyikan kata sandi"}
            accessibilityState={{ disabled, checked: !secure }} className={actionClass}>
            <Icon icon={secure ? Eye : EyeSlash} size="sm" />
          </Pressable>
        ) : rightIcon ? (
          onRightIconPress ? (
            <Pressable onPress={onRightIconPress} disabled={disabled} accessibilityRole="button"
              accessibilityLabel={rightIconAccessibilityLabel} accessibilityState={{ disabled }} className={actionClass}>
              <Icon icon={rightIcon} size="sm" />
            </Pressable>
          ) : <View className="ml-2"><Icon icon={rightIcon} size="sm" /></View>
        ) : null}
      </View>
    </Field>
  )
})
