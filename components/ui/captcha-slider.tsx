/**
 * Kahade — <CaptchaSlider> (captcha geser untuk endpoint auth yang mewajibkannya).
 *
 * Kontrak backend (`POST /v1/auth/captcha/generate`):
 *   - respons: `{ challengeId, targetX }`, `targetX` = persen (20–80);
 *   - jawaban: `captchaAnswer` = posisi slider pengguna dalam persen (0–100);
 *   - backend menerima selisih ≤4 poin, tantangan kedaluwarsa 120 detik,
 *     dan solusi <800 ms dianggap bot.
 *
 * Kenapa komponen ini ada (non-obvious): backend mewajibkan captcha pada
 * `register`/`forgot-password` (dan pada `login` setelah 3 kegagalan per IP),
 * tetapi aplikasi tidak pernah mengirim `captchaId`/`captchaAnswer` — tiap
 * request dijawab 401 `CAPTCHA_REQUIRED` dan pengguna hanya melihat
 * "Captcha verification is required" di layar "Gagal mengirim kode".
 * Komponen ini menggantikan <CaptchaField> (captcha gambar+teks) yang tidak
 * pernah cocok dengan backend dan tidak dipakai layar mana pun.
 *
 * Keputusan non-obvious:
 *   - Dua jalur input: geser (PanResponder, native+web) dan ketuk lintasan
 *     untuk melompat langsung — di web dengan tetikus, menggeser knob kecil
 *     terasa tidak perlu.
 *   - `onSolve` HANYA dipanggil saat pengguna melepas/mengonfirmasi, bukan
 *     tiap frame: pemanggil memakai nilai itu untuk membangun request, jadi
 *     satu nilai final lebih jelas daripada nilai yang berubah-ubah.
 *   - `resetKey` (id tantangan) mengembalikan posisi knob ke 0: tantangan baru
 *     harus dijawab dari awal, bukan menyisakan posisi lama yang kebetulan
 *     cocok dengan target baru.
 *   - Backend mengukur waktu sejak challenge dibuat; karena challenge dibuat
 *     saat komponen ini muncul (bukan saat submit), ambang 800 ms sudah
 *     terlampaui secara alami oleh interaksi manusia.
 *   - Aksesibilitas: lintasan memakai role `adjustable` + aksi increment/
 *     decrement/activate sehingga pengguna screen reader bisa memposisikan
 *     jawaban tanpa gestur.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { PanResponder, View, type GestureResponderEvent, type LayoutChangeEvent } from "react-native"

import { ArrowsClockwise } from "phosphor-react-native"

import { FieldHelper, FieldLabel } from "@/components/ui/field"
import { IconButton } from "@/components/ui/icon-button"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"

/** Lebar knob yang bisa digeser di lintasan (px) */
const KNOB_SIZE = 48
/** Langkah aksi aksesibilitas (increment/decrement) dalam persen */
const A11Y_STEP = 10

/**
 * Nama kunci sengaja memakai kosakata prop teks yang sudah dikenal repo
 * (label/helperText/rightLabel/leftLabel/…): `scripts/gen-i18n-catalog.mjs`
 * hanya mengumpulkan literal dari nama prop itu, sehingga copy di sini ikut
 * masuk katalog terjemahan tanpa pengecualian baru di skrip.
 */
export type CaptchaSliderLabels = {
  label: string
  helperText: string
  accessibilityLabel: string
  message: string
  rightLabel: string
  leftLabel: string
  confirmLabel: string
}

const DEFAULT_LABELS: CaptchaSliderLabels = {
  label: "Verifikasi keamanan",
  helperText: "Geser atau ketuk lintasan sampai penanda sejajar dengan garis tujuan.",
  accessibilityLabel: "Muat ulang tantangan",
  message: "Verifikasi siap dikirim.",
  rightLabel: "Geser ke kanan",
  leftLabel: "Geser ke kiri",
  confirmLabel: "Kirim jawaban",
}

export type CaptchaSliderProps = {
  /** Posisi target dari server, persen 0–100 */
  targetX: number
  /** Dipanggil dengan jawaban (persen 0–100) saat pengguna melepas knob */
  onSolve: (answerX: number) => void
  /** ID tantangan — perubahan nilai ini mereset posisi knob */
  resetKey?: string
  disabled?: boolean
  /** Sudah dijawab (jawaban disimpan pemanggil) */
  solved?: boolean
  /** Memuat tantangan baru */
  loading?: boolean
  onRefresh: () => void
  errorText?: string | null
  labels?: Partial<CaptchaSliderLabels>
  containerClassName?: string
}

export function CaptchaSlider({
  targetX,
  onSolve,
  resetKey,
  disabled = false,
  solved = false,
  loading = false,
  onRefresh,
  errorText,
  labels,
  containerClassName,
}: CaptchaSliderProps) {
  const t = { ...DEFAULT_LABELS, ...labels }

  const [trackWidth, setTrackWidth] = useState(0)
  const [position, setPosition] = useState(0)

  const maxTravel = Math.max(0, trackWidth - KNOB_SIZE)
  const percent = maxTravel > 0 ? (position / maxTravel) * 100 : 0
  const clampedTarget = Math.min(100, Math.max(0, targetX))

  // Ref dipakai di dalam handler PanResponder supaya pan responder tetap stabil
  // (satu instance untuk seluruh umur komponen) tanpa closure basi.
  const positionRef = useRef(0)
  const maxTravelRef = useRef(0)
  const solveRef = useRef(onSolve)
  const disabledRef = useRef(disabled)
  const dragStartRef = useRef(0)

  positionRef.current = position
  maxTravelRef.current = maxTravel
  solveRef.current = onSolve
  disabledRef.current = disabled

  // Tantangan berganti (atau dimuat ulang) → jawab dari awal.
  useEffect(() => {
    setPosition(0)
    positionRef.current = 0
  }, [resetKey])

  const commit = useCallback((nextPosition: number) => {
    const travel = maxTravelRef.current
    if (travel <= 0) return
    const answer = Math.round((nextPosition / travel) * 100)
    solveRef.current(Math.min(100, Math.max(0, answer)))
  }, [])

  const moveTo = useCallback((nextPosition: number) => {
    const travel = maxTravelRef.current
    const clamped = Math.min(travel, Math.max(0, nextPosition))
    positionRef.current = clamped
    setPosition(clamped)
    return clamped
  }, [])

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !disabledRef.current,
        onMoveShouldSetPanResponder: () => !disabledRef.current,
        onPanResponderGrant: () => {
          dragStartRef.current = positionRef.current
        },
        onPanResponderMove: (_event, gesture) => {
          moveTo(dragStartRef.current + gesture.dx)
        },
        onPanResponderRelease: () => {
          commit(positionRef.current)
        },
        onPanResponderTerminate: () => {
          commit(positionRef.current)
        },
      }),
    [commit, moveTo],
  )

  const handleTrackPress = useCallback(
    (event: GestureResponderEvent) => {
      if (disabled) return
      const travel = maxTravelRef.current
      if (travel <= 0) return
      // Ketuk lintasan = pindahkan knob ke titik ketukan (relatif terhadap
      // lintasan), lalu kirim posisi itu sebagai jawaban.
      const tapX = event.nativeEvent.locationX - KNOB_SIZE / 2
      commit(moveTo(tapX))
    },
    [commit, disabled, moveTo],
  )

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width)
  }, [])

  const handleAccessibilityAction = useCallback(
    (event: { nativeEvent: { actionName: string } }) => {
      if (disabled) return
      const travel = maxTravelRef.current
      if (travel <= 0) return
      const step = (A11Y_STEP / 100) * travel
      switch (event.nativeEvent.actionName) {
        case "increment":
          moveTo(positionRef.current + step)
          break
        case "decrement":
          moveTo(positionRef.current - step)
          break
        case "activate":
          commit(positionRef.current)
          break
        default:
          break
      }
    },
    [commit, disabled, moveTo],
  )

  // Warna knob = status jawaban, bukan kemajuan: tanpa itu pengguna tidak tahu
  // apakah jawabannya sudah tersimpan. Merah/hijau mengikuti hasil server.
  const knobClassName = solved ? "bg-success" : errorText ? "bg-danger" : "bg-primary"

  return (
    <View className={cn("w-full gap-2", containerClassName)}>
      <FieldLabel>{t.label}</FieldLabel>
      <View className="flex-row items-center gap-2">
        <View
          onLayout={handleLayout}
          className={cn(
            "h-14 flex-1 justify-center overflow-hidden rounded-sm border bg-surface",
            errorText ? "border-danger" : "border-border",
            disabled || loading ? "opacity-60" : null,
          )}
        >
          {/*
            Lintasan = satu-satunya target sentuh. `accessible` di sini TIDAK
            menelan kontrol lain karena tidak ada kontrol interaktif di dalamnya
            (tombol muat ulang adalah elemen bersaudara).
          */}
          <View
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={t.label}
            accessibilityValue={{ min: 0, max: 100, now: solved ? Math.round(clampedTarget) : Math.round(percent) }}
            accessibilityHint={t.helperText}
            accessibilityActions={[
              { name: "increment", label: t.rightLabel },
              { name: "decrement", label: t.leftLabel },
              { name: "activate", label: t.confirmLabel },
            ]}
            onAccessibilityAction={handleAccessibilityAction}
            onStartShouldSetResponder={() => !disabled}
            onResponderRelease={handleTrackPress}
            className="h-full w-full justify-center"
          >
            {/* Garis tujuan (targetX dari server) */}
            <View
              className="absolute inset-y-1 w-1 rounded-full bg-primary"
              style={{ left: `${clampedTarget}%` }}
            />
            {/* Knob yang digeser pengguna */}
            <View
              {...panResponder.panHandlers}
              className={cn(
                "absolute inset-y-1 items-center justify-center gap-0.5 rounded-sm",
                knobClassName,
              )}
              style={{ left: position, width: KNOB_SIZE }}
            >
              <View className="h-0.5 w-4 rounded-full bg-primary-foreground opacity-70" />
              <View className="h-0.5 w-4 rounded-full bg-primary-foreground opacity-70" />
            </View>
          </View>
        </View>

        <IconButton
          icon={ArrowsClockwise}
          variant="secondary"
          accessibilityLabel={t.accessibilityLabel}
          onPress={onRefresh}
          loading={loading}
          disabled={loading || disabled}
        />
      </View>

      {solved && !errorText ? (
        <Text variant="caption" tone="success">
          {t.message}
        </Text>
      ) : (
        <FieldHelper helperText={t.helperText} errorText={errorText ?? undefined} />
      )}
    </View>
  )
}
