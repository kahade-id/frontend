/**
 * R2 (audit escrow ronde-2, butir #64): SATU detak 1-Hz bersama untuk seluruh
 * aplikasi, menggantikan pola "satu interval per kartu countdown" (20 kartu =
 * 20 interval yang masing-masing setState pada sel FlatList host — jank
 * terlihat di perangkat kelas Android Go).
 *
 * Model: subscriber-set + interval modul tunggal yang hidup hanya selama ada
 * pelanggan pertama, dan mati saat pelanggan terakhir lepas. Disederhanakan
 * sengaja: tanpa AbortController/backpressure — ini detak lokal murah, bukan
 * request jaringan; layar yang tidak fokus tetap subscribe tapi pekerjaan
 * per tick hanya Math pada angka yang sudah ada.
 */
import { useEffect, useState } from "react"
import { serverNow } from "@/lib/server-time"

const listeners = new Set<(nowMs: number) => void>()
let interval: ReturnType<typeof setInterval> | null = null

function tick() {
  const now = serverNow()
  for (const fn of listeners) fn(now)
}

function subscribe(fn: (nowMs: number) => void): () => void {
  listeners.add(fn)
  if (interval == null) interval = setInterval(tick, 1000)
  return () => {
    listeners.delete(fn)
    if (listeners.size === 0 && interval != null) {
      clearInterval(interval)
      interval = null
    }
  }
}

/**
 * `nowMs` yang menyegar tiap detik SELAMA `active` — false menghentikan
 * langganan (kartu dengan tenggat habis tidak lagi menahan detak jalan).
 */
export function useClockTick(active: boolean): number {
  const [nowMs, setNowMs] = useState(() => serverNow())
  useEffect(() => {
    if (!active) return
    // Sinkronkan seketika saat (kembali) aktif — tanpa menunggu tick pertama.
    setNowMs(serverNow())
    return subscribe(setNowMs)
  }, [active])
  return nowMs
}
