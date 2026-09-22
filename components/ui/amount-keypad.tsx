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
 *   - Chip preset SATU baris (v3 2026-09-21): lima nominal cepat berbagi
 *     lebar (`flex-1`, tanpa wrap) sehingga selalu terbaca sekali lihat dan
 *     tidak pernah mendorong keypad keluar layar di 360dp. Dulu `flex-wrap`
 *     membuat preset pecah jadi 2–3 baris dan baris kunci paling bawah
 *     (0 / hapus) tertutup footer sampai pengguna menggulir.
 *   - Kepadatan adaptif: tinggi layar memutuskan ukuran kunci (64 → 56px) dan
 *     padding area nominal. Keypad adalah kontrol utama layar ini — ia tidak
 *     boleh ikut tergulir, jadi yang menyusut adalah keypad-nya, bukan
 *     memaksa pengguna scroll untuk menemukan tombol hapus.
 *   - `slot` = satu kartu konteks (metode pembayaran / rekening tujuan /
 *     catatan transfer) yang selalu duduk TEPAT di atas keypad dan di bawah
 *     nominal. Urutan bacanya: nominal → cara bayar → keypad.
 *   - Batas `max` ditegakkan di sini: digit yang melebihi maksimum tidak
 *     ditambahkan (bukan error merah yang terlambat).
 *   - Backspace di awal tidak menghasilkan angka negatif; angka selalu
 *     positif karena nominal Rupiah bulat.
 *   - Tampilan selalu diformat groupThousands agar terasa "hidup" saat
 *     digit bertambah — momen yang sama dengan count-up Amount.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Animated, Easing, View, useWindowDimensions, type ViewProps } from "react-native"
import { Backspace, Check } from "phosphor-react-native"

import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { Chip } from "@/components/ui/chip"
import { Icon } from "@/components/ui/icon"
import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"
import { formatRupiah, groupThousands } from "@/lib/format"
import { translate } from "@/lib/i18n"
import { useReducedMotion } from "@/lib/use-reduced-motion"
import { haptic } from "@/lib/haptics"
import { focusRing } from "@/lib/focus-ring"

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
  /**
   * Kartu konteks yang dirender di antara preset dan keypad (metode
   * pembayaran, rekening tujuan, catatan transfer). Lebar penuh; padding
   * horizontal diatur pemanggil.
   */
  slot?: ReactNode
  className?: string
}

const CURSOR_BLINK_MS = 530

/**
 * Batas panjang digit — "batas keras triliunan" yang dulu hanya berlaku pada
 * tombol digit tunggal. A-06 memindahkannya ke satu jalur commit agar tombol
 * "00" dan preset mengikuti aturan yang sama.
 */
const MAX_DIGITS = 12

/**
 * Ambang tinggi layar (dp) untuk keypad padat. Di bawah angka ini, area
 * nominal + 4 baris kunci 64px + kartu slot + CTA tidak muat sekaligus
 * (iPhone SE 568dp, separuh layar Android, jendela web pendek) sehingga
 * baris "0 / hapus" jatuh ke bawah lipatan. Kunci padat 56px tetap jauh di
 * atas target sentuh minimum 44pt (audit #1).
 */
const COMPACT_BELOW_HEIGHT = 760

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
  slot,
  className,
  ...rest
}: AmountKeypadProps) {
  const reducedMotion = useReducedMotion()
  const { height: windowHeight } = useWindowDimensions()
  const compact = windowHeight < COMPACT_BELOW_HEIGHT

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

  /**
   * A-06/H-02 (audit 2026-09-22): dulu batas panjang 12 digit hanya ditegakkan
   * di jalur digit tunggal, sedangkan tombol "00" HANYA memeriksa `max`. Tanpa
   * `max` (mis. top-up) satu tekanan "00" bisa melewati batas keras itu, dan
   * `Number.isFinite` masih meloloskan nilai non-`Number.isSafeInteger`
   * (Rp1e21) ke state form. Sekarang satu jalur commit dipakai ketiga tombol:
   * leading zero dibuang, panjang dibatasi, dan nilai WAJIB safe integer.
   */
  const commitDigits = useCallback(
    (next: string): boolean => {
      const trimmed = next.replace(/^0+(?=\d)/, "")
      // Keystroke yang melewati batas panjang DITOLAK (bukan dipotong diam-diam):
      // memotong "1234567890100" → "123456789010" membuat angka di layar
      // berbeda dari yang diketuk pengguna.
      if (trimmed.length > MAX_DIGITS) {
        haptic("warning")
        return false
      }
      const n = trimmed.length === 0 ? 0 : parseInt(trimmed, 10)
      if (!Number.isSafeInteger(n)) {
        haptic("warning")
        return false
      }
      if (max != null && n > max) {
        haptic("warning")
        return false
      }
      if (trimmed === digits) return false // tidak ada perubahan nyata
      haptic("select")
      onChange(n)
      return true
    },
    [digits, max, onChange],
  )

  const pressDigit = useCallback(
    (d: string) => {
      if (disabled) return
      // Mencegah leading zero banyak-banyak: "0" lalu "0" → tetap "0"
      commitDigits(digits === "0" ? d : digits + d)
    },
    [commitDigits, digits, disabled],
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
    if (commitDigits(digits + "00")) return
    // Ditolak (max/panjang): coba satu nol saja — perilaku lama dipertahankan,
    // tapi sekarang lewat jalur commit yang sama sehingga batas kerasnya
    // berlaku juga di sini.
    if (digits !== "0") commitDigits(digits + "0")
  }, [commitDigits, digits, disabled, onChange])

  const pressAction = useCallback(() => {
    if (disabled) return
    if (actionKey === "check" && onAction) {
      haptic("success")
      onAction()
    }
  }, [disabled, actionKey, onAction])

  /**
   * A-07 (audit 2026-09-22): hapus-semua dulu punya DUA mekanisme pada satu
   * tekanan — timer 650 ms di `onPressIn` DAN `onLongPress` bawaan RN (~500 ms).
   * Keduanya memanggil `onChange(0)`, lalu saat jari diangkat `onPress` lama
   * masih memegang `digits` sebelum reset sehingga nilai yang baru dihapus
   * HIDUP LAGI. Sekarang hanya `onLongPress` yang bekerja, dan tekanan setelah
   * long-press ditelan agar tidak ada backspace susulan.
   */
  const suppressNextBackspaceRef = useRef(false)
  const handleBackspaceLongPress = useCallback(() => {
    if (disabled) return
    suppressNextBackspaceRef.current = true
    haptic("success")
    onChange(0)
  }, [disabled, onChange])
  const handleBackspacePress = useCallback(() => {
    if (suppressNextBackspaceRef.current) {
      suppressNextBackspaceRef.current = false
      return
    }
    pressBackspace()
  }, [pressBackspace])

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
        className={cn(
          "items-center justify-center rounded-full",
          compact ? "h-14 w-14" : "h-16 w-16",
        )}
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
    [disabled, canPressAction, compact],
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
      <View
        className={cn(
          "w-full items-center px-5",
          compact ? "min-h-24 py-2" : "min-h-40 py-6",
        )}
      >
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

        {/*
         * F-04/A-18 (audit 2026-09-22): baris nominal kini satu elemen
         * aksesibilitas berlabel — sebelumnya pembaca layar mengumumkan "Rp"
         * dan angkanya sebagai dua potongan terpisah, dan "0" (belum diisi vs
         * nol) tidak bisa dibedakan. Subtree di dalamnya murni <Text> dekoratif.
         */}
        <Animated.View
          accessible
          accessibilityRole="text"
          accessibilityLabel={
            value > 0
              ? translate("Nominal {x}", { x: formatRupiah(value) })
              : translate("Nominal belum diisi")
          }
          style={{ transform: [{ scale }] }}
          className="flex-row items-end justify-center"
        >
          <Text
            variant="monoBody"
            tone={digits.length === 0 ? "disabled" : "secondary"}
            className="mb-1 mr-1"
          >
            Rp
          </Text>
          <View className="flex-row items-end">
            <Text
              variant="monoLarge"
              tone={digits.length === 0 ? "disabled" : resolvedError ? "danger" : "primary"}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
              numberOfLines={1}
            >
              {displayed}
            </Text>
            {/* Kursor */}
            {!disabled && digits.length > 0 && !resolvedError ? (
              // Kursor berkedip: opacity dianimasikan; warna & dimensi via className token.
              <View
                className="mb-1.5 ml-0.5 h-8 w-0.5 bg-primary"
                style={{ opacity: cursorVisible ? 1 : 0 }}
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
        // SATU baris, tanpa wrap: tiap chip `flex-1` sehingga lima nominal
        // selalu muat selebar layar (label memakai format compact "Rp50 rb").
        // `flex-nowrap` eksplisit — default RN sudah nowrap, tapi kelas ini
        // menahan siapa pun mengembalikan wrap yang membuat keypad terdorong.
        <View
          className={cn(
            "w-full flex-row flex-nowrap items-center gap-1.5 px-4",
            compact ? "pb-2" : "pb-4",
          )}
        >
          {presets.map((p) => (
            <Chip
              key={p}
              selected={value === p}
              disabled={disabled || (max != null && p > max)}
              haptic
              onPress={() => onChange(p)}
              containerClassName="min-w-0 flex-1 self-stretch"
              className="h-8 justify-center px-1"
            >
              {formatRupiah(p, { compact: true })}
            </Chip>
          ))}
        </View>
      ) : null}

      {/* Kartu konteks (metode / rekening / catatan) — selalu tepat di atas
          keypad, di bawah nominal. */}
      {slot ? <View className={cn("w-full", compact ? "pb-2" : "pb-3")}>{slot}</View> : null}

      {/* ----- Keypad ----- */}
      {/*
       * F-01 (audit 2026-09-22) — regresi aksesibilitas paling berat di app:
       * `accessible` pada View ini menjadikan SELURUH subtree satu elemen
       * aksesibilitas, sehingga 12 tombol digit berhenti menjadi target fokus
       * dan pengguna TalkBack/VoiceOver TIDAK bisa memasukkan nominal sama
       * sekali (transfer, tarik dana, top-up, langganan). Komentar gate di
       * scripts/check-a11y.mjs mencatat alasan yang sama untuk pin-pad.tsx —
       * amount-keypad justru melakukan kebalikannya. Label area dipindah ke
       * baris nominal di atas (yang memang satu informasi), bukan ke keypad.
       */}
      <View
        className={cn("w-full items-center px-2", compact ? "gap-1" : "gap-2")}
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
                <Text variant="h2" tone="primary">
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
              <Text variant="h2" tone="primary">
                00
              </Text>
            </Key>
          ) : (
            <View className={compact ? "h-14 w-14" : "h-16 w-16"} />
          )}

          {/* Nol tengah */}
          <Key label="0" onPress={() => pressDigit("0")}>
            <Text variant="h2" tone="primary">
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
              onPress={handleBackspacePress}
              onLongPress={handleBackspaceLongPress}
            >
              <Icon icon={Backspace} size="lg" tone="active" />
            </Key>
          )}
        </View>
      </View>
    </View>
  )
}
