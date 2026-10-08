/**
 * Kahade — penentuan posisi awal thread chat (audit chat I23).
 *
 * Thread adalah FlatList VIRTUAL: saat dimuat ia merender baris-baris PERTAMA
 * (yang tertua) lalu program menggulir ke ujung bawah. Selama gulir itu belum
 * selesai dan baris-baris di ujung belum ter-mount, pengguna melihat
 *   (a) pesan tertua sesaat, lalu melompat ke bawah, atau
 *   (b) area KOSONG di ujung bawah sampai batch render menyusul
 * — keduanya terbaca sebagai "layar kosong saat buka ruang".
 *
 * Hook ini menahan SHIMMER di atas list sampai posisi benar-benar stabil:
 *   - `begin()` dipanggil saat muat awal berhasil membawa pesan (satu batch
 *     dengan `setMessages`). Menunggu satu frame layout, lalu gulir ke ujung;
 *   - tiap perubahan ukuran konten SESUDAH itu (baris di ujung ter-mount dan
 *     terukur → total tinggi berubah) menggulir ulang ke ujung — selagi
 *     ditutupi shimmer, tidak terlihat;
 *   - posisi dianggap stabil saat tidak ada perubahan ukuran konten selama
 *     `POSITION_QUIET_MS`, DENGAN batas waktu `POSITION_SAFETY_MS` — shimmer
 *     tidak mungkin menggantung walau event layout tak pernah datang.
 *
 * Hanya muat awal yang memicu `begin()`: pesan pertama yang dikirim di ruang
 * kosong, atau pesan realtime, TIDAK ditutup shimmer.
 */
import { useCallback, useEffect, useRef, useState } from "react"

/** Menunggu satu frame layout FlatList sebelum gulir pertama (nilai lama: 100 ms). */
export const POSITION_START_DELAY_MS = 100
/** Hening (tanpa perubahan ukuran konten) selama ini ⇒ posisi stabil. */
export const POSITION_QUIET_MS = 150
/** Batas keras: shimmer pasti dilepas. */
export const POSITION_SAFETY_MS = 800
/** Batas gulir ulang akibat perubahan ukuran (cegah lingkaran tak berujung). */
export const POSITION_MAX_RESCROLLS = 6

type Timer = ReturnType<typeof setTimeout>

export type ThreadPositioning = {
  /** true = shimmer penutup harus tampil di atas list. */
  positioning: boolean
  /** Muat awal membawa pesan: mulai menempatkan posisi. */
  begin: () => void
  /** Teruskan dari `onContentSizeChange` FlatList. */
  onContentSizeChange: () => void
}

export function useThreadPositioning(scrollToEnd: () => void): ThreadPositioning {
  const [positioning, setPositioning] = useState(false)
  const activeRef = useRef(false)
  const rescrollsRef = useRef(0)
  const startTimer = useRef<Timer | null>(null)
  const quietTimer = useRef<Timer | null>(null)
  const safetyTimer = useRef<Timer | null>(null)
  // Selalu memakai fungsi gulir TERBARU tanpa mengubah identitas callback.
  const scrollRef = useRef(scrollToEnd)
  scrollRef.current = scrollToEnd

  const clearTimers = useCallback(() => {
    if (startTimer.current) clearTimeout(startTimer.current)
    if (quietTimer.current) clearTimeout(quietTimer.current)
    if (safetyTimer.current) clearTimeout(safetyTimer.current)
    startTimer.current = null
    quietTimer.current = null
    safetyTimer.current = null
  }, [])

  const settle = useCallback(() => {
    clearTimers()
    if (!activeRef.current) return
    activeRef.current = false
    setPositioning(false)
  }, [clearTimers])

  const armQuiet = useCallback(() => {
    if (quietTimer.current) clearTimeout(quietTimer.current)
    quietTimer.current = setTimeout(settle, POSITION_QUIET_MS)
  }, [settle])

  const begin = useCallback(() => {
    clearTimers()
    activeRef.current = true
    rescrollsRef.current = 0
    setPositioning(true)
    startTimer.current = setTimeout(() => {
      startTimer.current = null
      if (!activeRef.current) return
      scrollRef.current()
      armQuiet()
    }, POSITION_START_DELAY_MS)
    safetyTimer.current = setTimeout(settle, POSITION_SAFETY_MS)
  }, [armQuiet, clearTimers, settle])

  const onContentSizeChange = useCallback(() => {
    // Sebelum gulir pertama (menunggu frame layout) atau setelah stabil: abaikan.
    if (!activeRef.current || startTimer.current) return
    if (rescrollsRef.current >= POSITION_MAX_RESCROLLS) return
    rescrollsRef.current += 1
    scrollRef.current()
    armQuiet()
  }, [armQuiet])

  // Keluar dari layar: semua timer dilepas.
  useEffect(() => clearTimers, [clearTimers])

  return { positioning, begin, onContentSizeChange }
}
