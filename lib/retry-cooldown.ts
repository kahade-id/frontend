/**
 * Kahade — cooldown terpusat untuk 429 / lockout (Audit Auth 2026-10-10,
 * #FE-L1/#FE-L2).
 *
 * Masalah: hampir semua titik masuk auth (login sandi, login WA, OTP, trigger
 * WhatsApp, registrasi, migrasi, passkey) menangani 429 sebagai teks statis
 * "tunggu beberapa saat" — tanpa durasi, tanpa mengunci tombol — padahal
 * `ApiError.retryAfterMs` sudah diparse transport dari `Retry-After` dan dari
 * body (`retryAfter`/`lockoutRemainingSeconds`). Pengguna menekan lagi terlalu
 * cepat dan memperpanjang pembatasannya sendiri; aturan CLAUDE.md §3 (pesan
 * spesifik) pun dilanggar.
 *
 * Satu pola untuk semua: `useRetryCooldown()` memegang deadline, mengekspos
 * sisa detik + label tombol; `retryAfterMessage()` menyusun kalimat dengan
 * durasi nyata bila server mengirimnya. Bagian murni (tanpa React) diekspor
 * terpisah agar bisa diuji.
 */
import { useCallback, useEffect, useMemo, useState } from "react"

import { isApiError } from "@/lib/api/errors"
import { formatCountdown } from "@/lib/format"
import { translate } from "@/lib/i18n/translate"

/** Cadangan bila server tidak mengirim Retry-After (detik). */
export const DEFAULT_RETRY_COOLDOWN_MS = 60_000

/** Sisa milidetik dari error, atau `undefined` bila server tidak menyebutnya. */
export function retryAfterMsFrom(err: unknown): number | undefined {
  if (!isApiError(err)) return undefined
  const ms = err.retryAfterMs
  return typeof ms === "number" && Number.isFinite(ms) && ms > 0 ? ms : undefined
}

/** Apakah error ini bermakna "tunggu dulu" (429, lockout akun, lockout PIN). */
export function isCooldownError(err: unknown): boolean {
  if (!isApiError(err)) return false
  return (
    err.status === 429 ||
    err.code === "RATE_LIMITED" ||
    err.code === "ACCOUNT_LOCKED" ||
    err.code === "PIN_RATE_LIMITED" ||
    (err.backendCode ?? "").toUpperCase() === "TOO_MANY_REQUESTS"
  )
}

/**
 * Kalimat Indonesia dengan durasi nyata. `base` adalah kalimat awal tanpa
 * titik akhir (mis. "Terlalu banyak percobaan"); bila server tidak mengirim
 * durasi, `fallback` dipakai utuh.
 */
export function retryAfterMessage(err: unknown, fallback: string, base?: string): string {
  const ms = retryAfterMsFrom(err)
  if (!ms) return fallback
  const seconds = Math.ceil(ms / 1000)
  const lead = base ?? "Terlalu banyak percobaan"
  return translate("{x}. Coba lagi dalam {y}.", { x: lead, y: formatCountdown(seconds) })
}

export type RetryCooldown = {
  /** Detik tersisa (0 bila tidak sedang cooldown). */
  secondsLeft: number
  isCoolingDown: boolean
  /** Mulai cooldown eksplisit (ms dari sekarang). */
  start: (ms: number) => void
  /**
   * Mulai cooldown dari error: memakai `retryAfterMs` bila ada, selain itu
   * `fallbackMs`. Mengembalikan `true` bila error memang error cooldown
   * (pemanggil memakai ini untuk memilih pesan).
   */
  startFromError: (err: unknown, fallbackMs?: number) => boolean
  clear: () => void
  /** Label tombol: `base` saat idle, "Coba lagi dalam mm:ss" saat cooldown. */
  label: (base: string) => string
}

export function useRetryCooldown(): RetryCooldown {
  const [until, setUntil] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (until === null) return
    setNow(Date.now())
    const id = setInterval(() => {
      const t = Date.now()
      setNow(t)
      if (t >= until) {
        setUntil(null)
        clearInterval(id)
      }
    }, 1000)
    return () => clearInterval(id)
  }, [until])

  const secondsLeft = until === null ? 0 : Math.max(0, Math.ceil((until - now) / 1000))
  const isCoolingDown = secondsLeft > 0

  const start = useCallback((ms: number) => {
    if (!(ms > 0)) return
    setUntil(Date.now() + ms)
    setNow(Date.now())
  }, [])

  const startFromError = useCallback(
    (err: unknown, fallbackMs: number = DEFAULT_RETRY_COOLDOWN_MS) => {
      if (!isCooldownError(err)) return false
      start(retryAfterMsFrom(err) ?? fallbackMs)
      return true
    },
    [start],
  )

  const clear = useCallback(() => setUntil(null), [])

  const label = useCallback(
    (base: string) =>
      isCoolingDown ? translate("Coba lagi dalam {x}", { x: formatCountdown(secondsLeft) }) : base,
    [isCoolingDown, secondsLeft],
  )

  return useMemo(
    () => ({ secondsLeft, isCoolingDown, start, startFromError, clear, label }),
    [secondsLeft, isCoolingDown, start, startFromError, clear, label],
  )
}
