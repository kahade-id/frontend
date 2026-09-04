/**
 * Kahade — <Input> / TextField (§9.2).
 *
 * Outlined + floating label. Varian:
 *   - "text"     : default, floating label (tinggi 56 agar label punya ruang)
 *   - "search"   : ikon MagnifyingGlass kiri, tombol clear kanan, TANPA label
 *                  (tinggi 48). Dipakai juga oleh overlay Search §9.23.
 *   - "multiline": textarea, label float ke atas, tinggi mengikuti `rows`.
 * State: default, focus (border-focus 1.5px hitam/putih), error (border-error,
 * helper merah — ikon di dalam field TETAP text-tertiary §7), disabled
 * (opacity 40%, editable=false).
 *
 * Keputusan non-obvious:
 *   - Floating label pakai RN `Animated` (translateY + scale) karena posisi
 *     label adalah transform yang tidak bisa di-className. Warna & font label
 *     tetap className. Saat float, label diberi `bg-background px-1` supaya
 *     "memotong" garis border seperti outlined text field klasik.
 *   - Border width fokus 1.5 vs resting 1 menggeser konten 0.5px. Untuk
 *     menghindari layout jump, container fokus mengompensasi lewat padding
 *     (`px-[15px]`) — nilai arbitrary ini satu-satunya yang diizinkan karena
 *     merupakan turunan langsung dari borderWidth token (16 - (1.5 - 1)).
 *   - `placeholderTextColor`, `selectionColor`, `cursorColor` adalah prop RN,
 *     bukan style — di-resolve dari tokens lewat useTheme() (pengecualian yang
 *     sama seperti Icon). Placeholder hanya muncul saat label sudah float
 *     (atau tanpa label), agar tidak bertabrakan dengan label resting.
 *   - Tidak ada shake pada error (§8) — cukup border + helper text.
 *   - `secureTextEntry` otomatis menyediakan toggle Eye/EyeSlash di kanan
 *     kecuali `rightIcon` dikirim eksplisit.
 *   - Web (§11): `outlineStyle: none` wajib agar focus ring browser tidak
 *     dobel dengan border-focus sistem. Ini satu-satunya style inline.
 */
import { Eye, EyeSlash, MagnifyingGlass, X } from "phosphor-react-native"
import { forwardRef, useCallback, useEffect, useRef, useState } from "react"
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  TextInput,
  View,
  type TextInputProps,
} from "react-native"

import { useTheme } from "@/components/theme-provider"
import { Field, type FieldProps } from "@/components/ui/field"
import { Icon, type IconComponent } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"
import { motionDuration, useReducedMotion } from "@/lib/use-reduced-motion"

export type InputVariant = "text" | "search" | "multiline"

export type InputProps = Omit<TextInputProps, "style" | "editable"> &
  Pick<FieldProps, "helperText" | "errorText" | "reserveHelperSpace" | "required"> & {
    /** Floating label (varian text/multiline). Untuk search gunakan `placeholder`. */
    label?: string
    variant?: InputVariant
    disabled?: boolean
    /** Ikon kiri (Phosphor). Search sudah punya default MagnifyingGlass. */
    leftIcon?: IconComponent
    /** Ikon kanan — override toggle password / tombol clear */
    rightIcon?: IconComponent
    onRightIconPress?: () => void
    /**
     * Label a11y tombol `rightIcon` — WAJIB bila `onRightIconPress` diisi:
     * tombol ikon tanpa label hanya terbaca "button" oleh screen reader.
     */
    rightIconAccessibilityLabel?: string
    /** Tombol X untuk mengosongkan nilai (default true untuk search) */
    clearable?: boolean
    onClear?: () => void
    /** Jumlah baris untuk multiline (tinggi = rows * lineHeight body + padding) */
    rows?: number
    className?: string
    containerClassName?: string
  }

const LABEL_FLOAT_Y = -(tokens.space[3] + tokens.space[2]) // -20px: dari tengah ke garis border
const LABEL_FLOAT_SCALE = tokens.typography.caption.fontSize / tokens.typography.bodyLarge.fontSize

export const Input = forwardRef<TextInput, InputProps>(function Input(
  {
    label,
    variant = "text",
    disabled = false,
    required,
    helperText,
    errorText,
    reserveHelperSpace,
    leftIcon,
    rightIcon,
    onRightIconPress,
    rightIconAccessibilityLabel,
    accessibilityHint,
    clearable,
    onClear,
    rows = 4,
    value,
    defaultValue,
    placeholder,
    secureTextEntry,
    onFocus,
    onBlur,
    onChangeText,
    className,
    containerClassName,
    multiline: _ignoredMultiline,
    ...rest
  },
  ref,
) {
  const { mode } = useTheme()
  const palette = tokens.colors[mode]

  const [focused, setFocused] = useState(false)
  const [secure, setSecure] = useState(!!secureTextEntry)
  const [internal, setInternal] = useState(defaultValue ?? "")
  const current = value ?? internal
  const hasValue = current.length > 0

  const isSearch = variant === "search"
  const isMultiline = variant === "multiline"
  const hasError = !!errorText
  const showLabel = !!label && !isSearch
  const floated = focused || hasValue
  const isClearable = clearable ?? isSearch

  // --- Floating label animation (transform-only, tidak bisa di-className) ---
  const progress = useRef(new Animated.Value(floated ? 1 : 0)).current
  // Reduce Motion (audit #2): label melayang pindah posisi instan.
  const reducedMotion = useReducedMotion()
  useEffect(() => {
    Animated.timing(progress, {
      toValue: floated ? 1 : 0,
      duration: motionDuration(reducedMotion, tokens.motion.duration.fast),
      easing: Easing.bezier(...tokens.motion.easing.standard),
      useNativeDriver: true,
    }).start()
  }, [floated, progress, reducedMotion])

  const labelStyle = {
    transform: [
      { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, LABEL_FLOAT_Y] }) },
      { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, LABEL_FLOAT_SCALE] }) },
    ],
  }

  // Tipe event diambil dari TextInputProps (RN 0.81: FocusEvent/BlurEvent),
  // bukan NativeSyntheticEvent<TextInputFocusEventData> yang sudah usang.
  const handleFocus = useCallback<NonNullable<TextInputProps["onFocus"]>>(
    (e) => {
      setFocused(true)
      onFocus?.(e)
    },
    [onFocus],
  )
  const handleBlur = useCallback<NonNullable<TextInputProps["onBlur"]>>(
    (e) => {
      setFocused(false)
      onBlur?.(e)
    },
    [onBlur],
  )
  const handleChange = useCallback(
    (t: string) => {
      if (value === undefined) setInternal(t)
      onChangeText?.(t)
    },
    [onChangeText, value],
  )
  const handleClear = useCallback(() => {
    handleChange("")
    onClear?.()
  }, [handleChange, onClear])

  // --- Right adornment: eksplisit > clear > toggle password ---
  const showClear = isClearable && hasValue && !disabled
  const showSecureToggle = !!secureTextEntry && !rightIcon && !showClear
  const resolvedLeft = leftIcon ?? (isSearch ? MagnifyingGlass : undefined)

  // Tinggi: text 56 (ruang label), search 48, multiline dari rows
  const boxHeight = isMultiline
    ? undefined
    : showLabel
      ? "h-14"
      : "h-12"
  const multilineMinHeight = isMultiline
    ? { minHeight: rows * tokens.typography.bodyLarge.lineHeight + tokens.space[4] * 2 }
    : undefined

  return (
    <Field
      required={required}
      helperText={helperText}
      errorText={errorText}
      reserveHelperSpace={reserveHelperSpace}
      disabled={disabled}
      className={containerClassName}
    >
      <View
        className={cn(
          "w-full flex-row rounded-sm bg-background",
          isMultiline ? "items-start py-4" : "items-center",
          // Border: resting 1px default -> focus/error 1.5px, padding dikompensasi
          hasError
            ? "border-error border-border-error px-[15px]"
            : focused
              ? "border-focus border-border-focus px-[15px]"
              : "border border-border px-4",
          boxHeight,
          disabled && "opacity-disabled",
          className,
        )}
        style={multilineMinHeight}
      >
        {resolvedLeft ? (
          <View className={cn("mr-2", isMultiline && "mt-[3px]")}>
            {/* Ikon di dalam field TIDAK ikut merah saat error (§7) */}
            <Icon icon={resolvedLeft} size="sm" tone={focused ? "active" : "default"} />
          </View>
        ) : null}

        <View className="relative flex-1 justify-center self-stretch">
          {showLabel ? (
            // Wrapper className (posisi) dipisah dari Animated.View (transform
            // saja) karena Animated.* tidak di-interop NativeWind.
            <View
              pointerEvents="none"
              className={cn(
                "absolute inset-0 items-start",
                isMultiline ? "justify-start" : "justify-center",
              )}
            >
              <Animated.View style={[labelStyle, { transformOrigin: "left center" }]}>
                {/* bg-background + px-1 "memotong" garis border saat float */}
                <View className={cn("-mx-1 px-1", floated && "bg-background")}>
                  <Text
                    variant="bodyLarge"
                    tone={hasError ? "danger" : focused ? "primary" : "secondary"}
                    numberOfLines={1}
                  >
                    {label}
                    {required ? (
                      <Text variant="bodyLarge" tone="danger">
                        {" *"}
                      </Text>
                    ) : null}
                  </Text>
                </View>
              </Animated.View>
            </View>
          ) : null}

          <TextInput
            ref={ref}
            value={value}
            defaultValue={defaultValue}
            editable={!disabled}
            multiline={isMultiline}
            textAlignVertical={isMultiline ? "top" : "center"}
            secureTextEntry={secure}
            // Placeholder hanya tampil saat label sudah float / tanpa label
            placeholder={!showLabel || floated ? placeholder : undefined}
            placeholderTextColor={palette.textDisabled}
            selectionColor={palette.primary}
            cursorColor={palette.primary}
            allowFontScaling={false}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onChangeText={handleChange}
            accessibilityLabel={label ?? placeholder}
            // Error dibaca bersama field saat fokus (bukan hanya saat muncul):
            // RN tidak punya aria-invalid/errormessage lintas platform, jadi
            // pesan error dipromosikan ke hint. Hint pemanggil tetap dipakai
            // saat tidak ada error.
            accessibilityHint={errorText ?? accessibilityHint}
            accessibilityState={{ disabled }}
            className={cn(
              "w-full font-sans-400 text-bodyLarge text-text-primary",
              // Saat label float, teks turun sedikit agar tidak menempel label
              showLabel && !isMultiline && "pt-3",
              isMultiline && showLabel && "pt-4",
              disabled && "text-text-disabled",
              Platform.OS === "web" && "outline-none",
            )}
            // outlineStyle bukan util NativeWind di semua versi — jaga eksplisit
            style={Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : undefined}
            {...rest}
          />
        </View>

        {showClear ? (
          <Pressable
            onPress={handleClear}
            hitSlop={tokens.space[2]}
            accessibilityRole="button"
            accessibilityLabel="Hapus teks"
            className="ml-2"
          >
            <Icon icon={X} size="sm" />
          </Pressable>
        ) : showSecureToggle ? (
          <Pressable
            onPress={() => setSecure((s) => !s)}
            hitSlop={tokens.space[2]}
            accessibilityRole="button"
            accessibilityLabel={secure ? "Tampilkan kata sandi" : "Sembunyikan kata sandi"}
            className="ml-2"
          >
            <Icon icon={secure ? Eye : EyeSlash} size="sm" />
          </Pressable>
        ) : rightIcon ? (
          onRightIconPress ? (
            <Pressable
              onPress={onRightIconPress}
              disabled={disabled}
              hitSlop={tokens.space[2]}
              accessibilityRole="button"
              accessibilityLabel={rightIconAccessibilityLabel}
              accessibilityState={{ disabled }}
              className="ml-2"
            >
              <Icon icon={rightIcon} size="sm" />
            </Pressable>
          ) : (
            <View className="ml-2">
              <Icon icon={rightIcon} size="sm" />
            </View>
          )
        ) : null}
      </View>
    </Field>
  )
})
