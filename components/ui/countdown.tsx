/**
 * Kahade — <Countdown> + useCountdown (§9.21 lockout, OTP resend, deadline).
 *
 * Satu implementasi hitung mundur untuk tiga kasus escrow:
 *   - OTP    : "Kirim ulang dalam 00:59"
 *   - Lockout: countdown progresif di dalam PIN Sheet (§9.21)
 *   - Deadline: batas konfirmasi penerimaan barang
 *
 * Angka SELALU JetBrains Mono (§3.1 "timestamp teknis") lewat `formatCountdown`
 * di lib/format — bukan format sendiri. Tidak ada relative time (§13).
 *
 * Keputusan non-obvious:
 *   - Sumber waktu bisa `seconds` (durasi dari mount/reset) ATAU `until`
 *     (timestamp absolut). Untuk lockout/deadline pakai `until` — kalau app
 *     ke background lalu kembali, hitungan tetap benar karena dihitung dari
 *     Date.now(), bukan dari jumlah tick yang berjalan.
 *   - Tick 1000ms disinkronkan ke detik nyata (setTimeout ke batas detik
 *     berikutnya, bukan setInterval buta) supaya angka tidak "loncat" dua
 *     detik saat JS thread sibuk.
 *   - `onComplete` dipanggil sekali lewat ref guard; parent yang memutuskan
 *     apa yang terjadi (enable tombol kirim ulang, buka kunci PIN).
 *   - `prefix`/`suffix` dirender Sofia Sans di sekitar angka mono, agar
 *     kalimat tetap terbaca sebagai teks UI dan hanya digit yang presisi.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { View, type ViewProps } from "react-native"

import { Text, type TextTone } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { formatCountdown } from "@/lib/format"

export type UseCountdownOptions = {
  /** Durasi detik dari saat mulai (diabaikan kalau `until` ada) */
  seconds?: number
  /** Timestamp absolut berakhirnya hitungan */
  until?: Date | number
  onComplete?: () => void
  /** Jalankan otomatis (default true) */
  autoStart?: boolean
}

export function useCountdown({ seconds = 0, until, onComplete, autoStart = true }: UseCountdownOptions) {
  /**
   * `until` berasal dari data server dan tidak divalidasi. Tanggal yang tidak
   * bisa di-parse menghasilkan `NaN`, dan `endAt = NaN` membuat tick
   * TERJADWAL TERUS (`NaN % 1000 || 1000` jatuh ke 1000) tanpa pernah
   * memanggil `onComplete` — timer yang hidup selamanya di balik layar.
   * Karena itu waktu yang tidak valid dikembalikan sebagai `null`.
   */
  const computeEnd = useCallback(() => {
    if (until != null) {
      const parsed = new Date(until).getTime()
      return Number.isFinite(parsed) ? parsed : null
    }
    const parsed = Date.now() + seconds * 1000
    return Number.isFinite(parsed) ? parsed : null
  }, [until, seconds])
  /**
   * `autoStart={false}` juga menghasilkan `endAt === null`, jadi "tanggal
   * tidak valid" dilacak terpisah — tanpa ini hitungan yang belum dimulai
   * akan tampil sebagai "—".
   */
  const endInvalid =
    until != null &&
    !Number.isFinite(until instanceof Date ? until.getTime() : new Date(until).getTime())
  const [endAt, setEndAt] = useState<number | null>(autoStart ? computeEnd : null)
  const [remaining, setRemaining] = useState(() =>
    endAt != null ? Math.max(0, Math.ceil((endAt - Date.now()) / 1000)) : seconds,
  )
  const completedRef = useRef(false)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  // Reset saat sumber waktu berubah
  useEffect(() => {
    if (!autoStart) return
    completedRef.current = false
    setEndAt(computeEnd())
  }, [computeEnd, autoStart])

  useEffect(() => {
    if (endAt == null) return
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      const ms = endAt - Date.now()
      const s = Math.max(0, Math.ceil(ms / 1000))
      setRemaining(s)
      if (s <= 0) {
        if (!completedRef.current) {
          completedRef.current = true
          onCompleteRef.current?.()
        }
        return
      }
      // Sinkron ke batas detik berikutnya
      timer = setTimeout(tick, ms % 1000 || 1000)
    }
    tick()
    return () => clearTimeout(timer)
  }, [endAt])

  const restart = useCallback(() => {
    completedRef.current = false
    setEndAt(computeEnd())
  }, [computeEnd])

  return {
    remaining,
    done: remaining <= 0,
    restart,
    // `—` (bukan "00:00") bila sumber waktu tidak valid: nol detik akan
    // terbaca sebagai "tenggat sudah lewat" padahal nilainya tidak diketahui.
    formatted: endInvalid ? "—" : formatCountdown(remaining),
  }
}

export type CountdownProps = Omit<ViewProps, "children"> &
  UseCountdownOptions & {
    /** Teks Sofia Sans sebelum angka, mis. "Kirim ulang dalam" */
    prefix?: string
    suffix?: string
    tone?: Extract<TextTone, "primary" | "secondary" | "danger" | "inverse">
    /** Angka besar (monoLarge) untuk lockout PIN / deadline utama */
    large?: boolean
    className?: string
  }

export function Countdown({
  seconds,
  until,
  onComplete,
  autoStart,
  prefix,
  suffix,
  tone = "secondary",
  large = false,
  className,
  ...rest
}: CountdownProps) {
  const { formatted } = useCountdown({ seconds, until, onComplete, autoStart })
  const label = [prefix, formatted, suffix].filter(Boolean).join(" ")

  return (
    <View accessible={false}
      accessibilityRole="timer"
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
      className={cn("flex-row items-baseline gap-1", className)}
      {...rest}
    >
      {prefix ? (
        <Text variant={large ? "body" : "caption"} tone={tone}>
          {prefix}
        </Text>
      ) : null}
      <Text variant={large ? "monoLarge" : "monoBody"} tone={tone}>
        {formatted}
      </Text>
      {suffix ? (
        <Text variant={large ? "body" : "caption"} tone={tone}>
          {suffix}
        </Text>
      ) : null}
    </View>
  )
}
