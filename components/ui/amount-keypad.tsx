/**
 * Kahade — <AmountKeypad> (nominal dengan keypad custom, gaya premium).
 *
 * Input nominal yang ditampilkan SECARA TERPUSAT di layar dengan keypad
 * numerik custom (PinPad), tanpa memunculkan keyboard OS. Terinspirasi dari
 * pola Apple Cash / perbankan premium:
 *   - Tampilan nominal BESAR dan CENTERED (monoLarge 32px+) di area atas
 *   - Prefix "Rp" dengan tone sekunder agar digit yang sedang aktif menjadi
 *     titik fokus
 *   - Chip preset nominal cepat di atas keypad
 *   - Kursor berkedip di digit terakhir (opsional)
 *   - Error/batas/helper di bawah nominal dengan tone yang sesuai
 *   - Tombol bawah-kanan bisa dijadikan CTA (centang/hijau) selain backspace
 *
 * Keputusan non-obvious:
 *   - Keypad memakai PinPad (1–9, biometric-dikosongkan atau diisi CTA, 0,
 *     backspace) sehingga bahasa visual konsisten dengan PIN — memori otot
 *     user terjaga, tapi konteksnya nominal, bukan PIN.
 *   - Kunci "00" (double-zero) menggantikan slot biometric saat `doubleZero`
 *     diaktifkan, mempercepat input nominal besar (100.000 → 1 + 00 + 000).
 *     Slot biometric hanya relevan untuk PIN.
 *   - Batas `max` ditegakkan di sini: digit yang melebihi maksimum tidak
 *     ditambahkan (bukan error merah yang terlambat).
 *   - Backspace di awal tidak menghasilkan angka negatif; angka selalu
 *     positif karena nominal Rupiah bulat.
 *   - Tampilan selalu diformat groupThousands agar terasa "hidup" saat
 *     digit bertambah — momen yang sama dengan count-up Amount.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Animated, Easing, View, type ViewProps } from "react-native"
import { Backspace, Check } from "phosphor-react-native"

import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { Chip } from "@/components/ui/chip"
import { Icon } from "@/components/ui/icon"
import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"
import { formatRupiah, groupThousands } from "@/lib/format"
import { useReducedMotion } from "@/lib/use-reduced-motion"
import { haptic } from "@/lib/haptics"
import { focusRing } from "@/lib/focus-ring"
import { useTheme } from "@/components/theme-provider"

export type AmountKeypadProps = Omit<ViewProps, "children"> & {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  /** Nominal cepat (chip) */
  presets?: number[]
  /** Error tampil di bawah nominal (mis. dari submit) */
  errorText?: string
  /** Tampilkan tombol centang di kanan-bawah (sebagai pengganti backspace);
   *  bila diset, backspace pindah ke long-press tombol 0 atau biarkan via props */
  actionKey?: "check" | "backspace" | "00"
  /** Label bantu (mis. "Min. top-up Rp10.000" atau sisa saldo) */
  helperText?: string
  /** Saldo tersedia — ditampilkan sebagai teks hint */
  balance?: number
  /** Non-aktifkan seluruh keypad */
  disabled?: boolean
  /** Dipanggil saat tombol centang ditekan */
  onAction?: () => void
  /** Apakah aksi saat ini bisa dijalankan (tombol check aktif/merah) */
  actionEnabled?: boolean
  className?: string
}

const CURSOR_BLINK_MS = 530

export function AmountKeypad({
  value,
  onChange,
  min,
  max,
  presets,
  errorText,
  actionKey = "backspace",
  helperText,
  balance,
  disabled = false,
  onAction,
  actionEnabled = true,
  className,
  ...rest
}: AmountKeypadProps) {
  const { mode } = useTheme()
  const palette = tokens.colors[mode]
  const reducedMotion = useReducedMotion()

  // Kita simpan digits sebagai string (digit mentah) supaya ketikan terasa
  // natural (tidak melompat saat ribuan bertambah); value ke pemanggil
  // adalah hasil parseInt.
  const digits = useMemo(() => (value > 0 ? String(value) : ""), [value])
  const [cursorVisible, setCursorVisible] = useState(true)

  const displayed = useMemo(() => {
    if (digits.length === 0) return "0"
    return groupThousands(parseInt(digits, 10))
  }, [digits])

  const belowMin = min != null && value > 0 && value < min
  const aboveMax = max != null && value > max
  const resolvedError =
    errorText ??
    (belowMin
      ? `Minimal ${formatRupiah(min ?? 0)}`
      : aboveMax
        ? `Maksimal ${formatRupiah(max ?? 0)}`
        : undefined)

  // Kursor berkedip hanya saat keypad aktif, tidak disabled, dan belum
  // ada error. Berhenti berkedip bila reduced motion.
  useEffect(() => {
    if (disabled || reducedMotion) {
      setCursorVisible(false)
      return
    }
    setCursorVisible(true)
    const t = setInterval(() => setCursorVisible((v) => !v), CURSOR_BLINK_MS)
    return () => clearInterval(t)
  }, [disabled, reducedMotion])

  const pressDigit = useCallback(
    (d: string) => {
      if (disabled) return
      // Mencegah leading zero banyak-banyak: "0" lalu "0" → tetap "0"
      const next = digits === "0" ? d : digits + d
      if (next.length > 12) return // batas keras triliunan
      const n = parseInt(next, 10)
      if (!Number.isFinite(n)) return
      if (max != null && n > max) {
        haptic("warning")
        return
      }
      haptic("select")
      onChange(n)
    },
    [digits, disabled, max, onChange],
  )

  const pressBackspace = useCallback(() => {
    if (disabled) return
    if (digits.length === 0) return
    haptic("select")
    const next = digits.slice(0, -1)
    onChange(next.length === 0 ? 0 : parseInt(next, 10))
  }, [digits, disabled, onChange])

  const pressDoubleZero = useCallback(() => {
    if (disabled) return
    if (digits.length === 0) {
      // "00" di awal = 0, bukan 00
      haptic("select")
      onChange(0)
      return
    }
    // Tambahkan dua nol sekaligus; cek max
    const next = digits + "00"
    const n = parseInt(next, 10)
    if (!Number.isFinite(n)) return
    if (max != null && n > max) {
      // fallback: coba tambah satu nol saja
      const nextSingle = digits + "0"
      const nSingle = parseInt(nextSingle, 10)
      if (Number.isFinite(nSingle) && (max == null || nSingle <= max)) {
        haptic("select")
        onChange(nSingle)
        return
      }
      haptic("warning")
      return
    }
    haptic("select")
    onChange(n)
  }, [digits, disabled, max, onChange])

  const pressAction = useCallback(() => {
    if (disabled) return
    if (actionKey === "check" && onAction) {
      haptic("success")
      onAction()
    }
  }, [disabled, actionKey, onAction])

  // Tangkap long-press backspace (hapus semua)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onPressInBackspace = useCallback(() => {
    longPressTimer.current = setTimeout(() => {
      haptic("success")
      onChange(0)
      longPressTimer.current = null
    }, 650)
  }, [onChange])
  const onPressOutBackspace = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  const canPressAction =
    actionKey === "check" && actionEnabled && !disabled && !resolvedError && value > 0

  const ROWS: string[][] = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
  ]

  const Key = useCallback(
    ({
      children,
      onPress,
      onPressIn,
      onPressOut,
      onLongPress,
      label,
      isAction = false,
      enabled = true,
    }: {
      children: React.ReactNode
      onPress?: () => void
      onPressIn?: () => void
      onPressOut?: () => void
      onLongPress?: () => void
      label: string
      isAction?: boolean
      enabled?: boolean
    }) => (
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled || !enabled}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onLongPress={onLongPress}
        haptic="light"
        containerClassName={cn("items-center rounded-full", focusRing)}
        className="h-16 w-16 items-center justify-center rounded-full"
      >
        {isAction ? (
          <View
            className={cn(
              "h-12 w-12 items-center justify-center rounded-full",
              canPressAction ? "bg-primary" : "bg-transparent border border-border",
            )}
          >
            {children}
          </View>
        ) : (
          children
        )}
      </PressableScale>
    ),
    [disabled, canPressAction],
  )

  // Tampilan nominal — animasi scale kecil saat berubah (kena tombol)
  const scale = useRef(new Animated.Value(1)).current
  useEffect(() => {
    if (reducedMotion) return
    scale.setValue(0.96)
    Animated.timing(scale, {
      toValue: 1,
      duration: tokens.motion.duration.fast,
      easing: Easing.bezier(...tokens.motion.easing.enter),
      useNativeDriver: true,
    }).start()
  }, [digits, scale, reducedMotion])

  return (
    <View className={cn("w-full items-center", className)} {...rest}>
      {/* ----- Area tampilan nominal (CENTERED, signature) ----- */}
      <View className="w-full items-center px-6 py-6" style={{ minHeight: 160 }}>
        {/* Helper: saldo / min */}
        <View className="mb-2 h-5 items-center">
          {balance != null ? (
            <Text variant="caption" tone="secondary">
              Saldo tersedia {formatRupiah(balance)}
            </Text>
          ) : helperText ? (
            <Text variant="caption" tone="secondary">
              {helperText}
            </Text>
          ) : null}
        </View>

        <Animated.View
          style={{ transform: [{ scale }] }}
          className="flex-row items-end justify-center"
        >
          <Text
            variant="monoLarge"
            tone={digits.length === 0 ? "disabled" : "secondary"}
            className="mr-1"
            // "Rp" lebih kecil dari digit utama agar fokus ke nominal
            style={{ fontSize: 22, lineHeight: 34 }}
          >
            Rp
          </Text>
          <View className="flex-row items-end">
            <Text
              variant="monoLarge"
              tone={digits.length === 0 ? "disabled" : resolvedError ? "danger" : "primary"}
              style={{ fontSize: 40, lineHeight: 48, letterSpacing: -0.5 }}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
              numberOfLines={1}
            >
              {displayed}
            </Text>
            {/* Kursor */}
            {!disabled && digits.length > 0 && !resolvedError ? (
              <View
                style={{
                  width: 2,
                  height: 34,
                  marginLeft: 2,
                  marginBottom: 6,
                  backgroundColor: palette.primary,
                  opacity: cursorVisible ? 1 : 0,
                }}
              />
            ) : null}
          </View>
        </Animated.View>

        {/* Error/helper di bawah nominal */}
        <View className="mt-3 h-5 items-center">
          {resolvedError ? (
            <Text variant="caption" tone="danger" className="text-center">
              {resolvedError}
            </Text>
          ) : !balance && helperText ? (
            <Text variant="caption" tone="secondary">
              {helperText}
            </Text>
          ) : null}
        </View>
      </View>

      {/* ----- Preset chip ----- */}
      {presets && presets.length > 0 ? (
        <View className="w-full flex-row flex-wrap justify-center gap-2 px-6 pb-4">
          {presets.map((p) => (
            <Chip
              key={p}
              selected={value === p}
              disabled={disabled || (max != null && p > max)}
              haptic
              onPress={() => onChange(p)}
            >
              {formatRupiah(p, { compact: true })}
            </Chip>
          ))}
        </View>
      ) : null}

      {/* ----- Keypad ----- */}
      <View
        accessible
        accessibilityLabel="Keypad nominal"
        className="w-full items-center gap-2 px-2"
        style={{ opacity: disabled ? tokens.motion.opacity.disabled : 1 }}
      >
        {ROWS.map((row) => (
          <View key={row.join("")} className="w-full flex-row justify-around">
            {row.map((d) => (
              <Key
                key={d}
                label={d}
                onPress={() => pressDigit(d)}
              >
                <Text variant="h2" tone="primary" style={{ fontSize: 26 }}>
                  {d}
                </Text>
              </Key>
            ))}
          </View>
        ))}
        <View className="w-full flex-row justify-around">
          {/* Kiri bawah */}
          {actionKey === "00" ? (
            <Key label="00" onPress={pressDoubleZero}>
              <Text variant="h2" tone="primary" style={{ fontSize: 22 }}>
                00
              </Text>
            </Key>
          ) : (
            <View className="h-16 w-16" />
          )}

          {/* Nol tengah */}
          <Key label="0" onPress={() => pressDigit("0")}>
            <Text variant="h2" tone="primary" style={{ fontSize: 26 }}>
              0
            </Text>
          </Key>

          {/* Kanan bawah */}
          {actionKey === "check" ? (
            <Key
              label="Lanjutkan"
              isAction
              enabled={canPressAction}
              onPress={canPressAction ? pressAction : undefined}
            >
              <Icon icon={Check} size="md" tone={canPressAction ? "inverse" : "disabled"} weight="bold" />
            </Key>
          ) : (
            <Key
              label="Hapus"
              onPress={pressBackspace}
              onPressIn={onPressInBackspace}
              onPressOut={onPressOutBackspace}
              onLongPress={() => onChange(0)}
            >
              <Icon icon={Backspace} size="lg" tone="active" />
            </Key>
          )}
        </View>
      </View>
    </View>
  )
}
