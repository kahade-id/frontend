/**
 * Kahade — pengelompokan order per hari kalender WIB (murni, tanpa render).
 *
 * Dipakai tab Transaksi untuk memecah daftar order menjadi kelompok
 * "Hari ini" / "Kemarin" / tanggal panjang — pola yang sama dengan riwayat
 * dompet (lib/wallet-history-grouping.ts), tetapi generik atas tipe order
 * (tidak menghitung agregat masuk/keluar).
 *
 * Logika tanggal WIB dipakai ulang dari `wibCalendarDay`: satu sumber
 * kebenaran batas hari kalender, supaya order jam 00:30 WIB tidak masuk
 * "kemarin" di perangkat WITA/WIT.
 *
 * TIDAK menyentuh nilai apa pun — hanya mengelompokkan referensi item.
 */
import { formatDate, formatDateLong } from "@/lib/format"
import { wibCalendarDay } from "@/lib/wallet-history-grouping"
import { translate } from "@/lib/i18n/translate"

/** Satu kelompok hari di daftar transaksi. */
export type OrderDayGroup<T> = {
  /** Key stabil untuk FlatList (`txday:2026-9-8`). */
  id: string
  /** "Hari ini" / "Kemarin" / "Senin, 8 September 2026". */
  label: string
  /** Sub-label tanggal pendek untuk "Hari ini"/"Kemarin" ("8 Sep 2026"). */
  sub: string | null
  /** Jumlah order di kelompok ini (untuk "N transaksi"). */
  count: number
  /** Order-order hari itu, urutan masuk dipertahankan (sudah diurut server). */
  orders: T[]
}

/**
 * Kelompokkan order per hari kalender WIB berdasarkan `createdAt`.
 * Item dengan tanggal tidak valid jatuh ke kelompok "Tanggal tidak tersedia".
 */
export function groupOrdersByDay<T extends { id: string; createdAt: string }>(
  orders: readonly T[],
): OrderDayGroup<T>[] {
  const todayKey = wibCalendarDay(new Date())?.key ?? null
  const yesterdayKey = wibCalendarDay(new Date(Date.now() - 86_400_000))?.key ?? null
  const byKey = new Map<string, OrderDayGroup<T>>()
  for (const order of orders) {
    const date = new Date(order.createdAt)
    const valid = !Number.isNaN(date.getTime())
    const wib = valid ? wibCalendarDay(date) : null
    const key = wib?.key ?? "invalid"
    let group = byKey.get(key)
    if (!group) {
      const isToday = todayKey != null && key === todayKey
      const isYesterday = yesterdayKey != null && key === yesterdayKey
      group = {
        id: `txday:${key}`,
        label: isToday
          ? translate("Hari ini")
          : isYesterday
            ? translate("Kemarin")
            : wib
              ? formatDateLong(wib.date)
              : translate("Tanggal tidak tersedia"),
        sub: isToday || isYesterday ? (wib ? formatDate(wib.date) : null) : null,
        count: 0,
        orders: [],
      }
      byKey.set(key, group)
    }
    group.orders.push(order)
    group.count += 1
  }
  return [...byKey.values()]
}
