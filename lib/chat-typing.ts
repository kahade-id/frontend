/**
 * Kahade — indikator mengetik (audit chat G17, MURNI).
 *
 * Dua sisi:
 *
 *  PENGIRIM (`createTypingSender`) — mesin yang memutuskan KAPAN mengirim
 *  `typing start/stop`:
 *    - sinyal "mengetik" dikirim sekali di ketikan pertama, lalu DIULANG tiap
 *      `TYPING_KEEPALIVE_MS` selama masih mengetik. Backend menahan status
 *      mengetik 8 dtk (TYPING_HOLD_MS) dan penerima kedaluwarsa otomatis 10 dtk
 *      (TYPING_EXPIRY_MS) — tanpa denyut ini indikator lawan bicara mati di
 *      TENGAH sesi mengetik yang panjang;
 *    - berhenti `TYPING_IDLE_MS` (3 dtk) setelah ketikan terakhir;
 *    - berhenti SEGERA bila draft dikosongkan, pesan dikirim, kolom kehilangan
 *      fokus, atau aplikasi ke latar — dulu draft yang dihapus habis tetap
 *      "mengetik…" sampai timer 3 dtk habis.
 *
 *  PENERIMA (`summarizeTypers`) — teks status: DM 1:1 hanya "Sedang
 *  mengetik…" (tanpa nama, ala WhatsApp); ruang multi-pihak menyebut NAMA
 *  ("Budi sedang mengetik…", "Budi dan Ani sedang mengetik…", "Budi dan 2
 *  lainnya sedang mengetik…") — nama dari `chat.typing.username` (BFI-115).
 */

/** Berhenti mengetik setelah diam selama ini (ms). */
export const TYPING_IDLE_MS = 3000
/** Denyut ulang sinyal "mengetik" selama masih mengetik (ms) — < 8 dtk TTL server. */
export const TYPING_KEEPALIVE_MS = 5000

export type TypingSender = {
  /**
   * Panggil pada setiap perubahan draft. `hasText=false` (draft dikosongkan)
   * menghentikan indikator SEGERA.
   */
  keystroke: (hasText: boolean) => void
  /** Berhenti sekarang (kirim, blur, ke latar). Idempoten. */
  stop: () => void
  /** Bersihkan timer. Mengembalikan true bila sinyal masih aktif (pemanggil mengirim stop sendiri). */
  dispose: () => boolean
  isActive: () => boolean
}

export function createTypingSender(
  send: (isTyping: boolean) => void,
  now: () => number = Date.now,
): TypingSender {
  let active = false
  let lastSentAt = 0
  let idleTimer: ReturnType<typeof setTimeout> | null = null

  const clearIdle = () => {
    if (idleTimer) {
      clearTimeout(idleTimer)
      idleTimer = null
    }
  }
  const stop = () => {
    clearIdle()
    if (!active) return
    active = false
    send(false)
  }
  return {
    keystroke(hasText) {
      if (!hasText) {
        stop()
        return
      }
      const t = now()
      if (!active) {
        active = true
        lastSentAt = t
        send(true)
      } else if (t - lastSentAt >= TYPING_KEEPALIVE_MS) {
        lastSentAt = t
        send(true)
      }
      clearIdle()
      idleTimer = setTimeout(stop, TYPING_IDLE_MS)
    },
    stop,
    dispose() {
      clearIdle()
      const wasActive = active
      active = false
      return wasActive
    },
    isActive: () => active,
  }
}

export type TypingEntry = { userId: string; name: string | null }

export type TypingSummary =
  | { kind: "none" }
  | { kind: "generic" }
  | { kind: "one"; a: string }
  | { kind: "two"; a: string; b: string }
  | { kind: "many"; a: string; others: number }

/**
 * Ringkasan untuk teks status. `isGroup=false` (DM 1:1) selalu generik —
 * hanya ada satu lawan bicara, namanya sudah di header. Nama yang kosong
 * tidak dikarang: bila tak seorang pun punya nama → generik.
 */
export function summarizeTypers(
  typers: readonly TypingEntry[],
  opts: { isGroup: boolean },
): TypingSummary {
  if (typers.length === 0) return { kind: "none" }
  if (!opts.isGroup) return { kind: "generic" }
  const names = typers.map((t) => t.name?.trim() ?? "").filter((n) => n.length > 0)
  if (names.length === 0) return { kind: "generic" }
  if (typers.length === 1) return { kind: "one", a: names[0] as string }
  if (typers.length === 2 && names.length === 2) {
    return { kind: "two", a: names[0] as string, b: names[1] as string }
  }
  return { kind: "many", a: names[0] as string, others: typers.length - 1 }
}
