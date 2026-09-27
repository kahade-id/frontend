/**
 * Kahade — helper waktu "HH:mm" murni (item #26).
 *
 * Dipisah dari <TimePickerSheet> agar bisa di-unit-test tanpa runtime
 * React Native: parsing toleran + format + cek rentang "sekarang".
 */

const pad = (n: number) => String(n).padStart(2, "0")

/**
 * Parse "HH:mm" (24 jam) secara toleran. Input tak valid → fallback 22:00
 * (fail-safe untuk jadwal jangan-ganggu, bukan throw).
 */
export function parseTimeValue(value: string): { hour: number; minute: number } {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  const hour = m ? Number(m[1]) : 22
  const minute = m ? Number(m[2]) : 0
  return {
    hour: hour >= 0 && hour <= 23 ? hour : 22,
    minute: minute >= 0 && minute <= 59 ? minute : 0,
  }
}

/** Format {hour, minute} → "HH:mm". */
export function formatTimeValue(hour: number, minute: number): string {
  return `${pad(hour)}:${pad(minute)}`
}

/**
 * true bila `now` masuk rentang [start, end) — mendukung rentang yang
 * melewati tengah malam (mis. 22:00–06:00). `now` default = waktu perangkat.
 */
export function isTimeInRange(start: string, end: string, now = new Date()): boolean {
  const s = parseTimeValue(start)
  const e = parseTimeValue(end)
  const a = s.hour * 60 + s.minute
  const b = e.hour * 60 + e.minute
  if (a === b) return false
  const mins = now.getHours() * 60 + now.getMinutes()
  return a < b ? mins >= a && mins < b : mins >= a || mins < b
}
