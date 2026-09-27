/**
 * Kahade — logika presentasi murni gelembung chat (tanpa React Native).
 *
 * Modul ini adalah SATU sumber kebenaran untuk kontrak visual yang dikeluhkan
 * pemakai nyata (revisi 2026-09-27, TIM CHAT):
 *   a. simetri kiri/kanan bubble masuk vs keluar,
 *   b. jam hanya tampil di bubble TERAKHIR tiap grup menit,
 *   c. ketukan bubble teks = no-op; aksi hanya via tekan lama,
 *   d. posisi popover reaksi mengambang,
 *   e. badge reaksi overlap di sudut bubble (bukan di bawahnya).
 *
 * Sengaja tanpa import `react-native` supaya bisa diuji di vitest (node).
 * Komponen (`chat-message-bubble`, `chat-message-row`,
 * `chat-reaction-popover`) MENGONSUMSI konstanta & helper di sini — test di
 * `tests/chat-bubble-redesign.test.tsx` mengunci kontraknya.
 */

/** Arah gelembung — mirror dari `ChatMessageDirection` di komponen. */
export type ChatBubbleSide = "incoming" | "outgoing" | "system"

/**
 * Gutter horizontal luar baris pesan (px) — SATU nilai untuk kiri & kanan.
 * Di komponen dipakai sebagai `px-5` pada baris; FlatList TIDAK lagi memberi
 * padding sendiri supaya tidak dobel (40px → 20px).
 */
export const CHAT_MESSAGE_GUTTER_PX = 20

/** Lebar maksimum kolom pesan (% lebar baris) — SAMA untuk kedua arah. */
export const CHAT_BUBBLE_MAX_WIDTH_PCT = 76

/**
 * Lebar kolom avatar pesan masuk: avatar 24px + gap 8px. Kolom ini hidup DI
 * DALAM batas 76% (bukan di luarnya) — itu yang membuat inset kiri bubble
 * masuk == inset kanan bubble keluar.
 */
export const CHAT_AVATAR_COLUMN_PX = 32

export type ChatBubbleGeometry = {
  /** Inset horizontal luar baris (px) — identik kiri & kanan (mirror). */
  gutter: number
  /** Lebar maksimum kolom pesan (% lebar baris) — identik incoming/outgoing. */
  maxWidthPct: number
  /** Penyelarasan isi kolom: `start` (kiri) vs `end` (kanan) — mirror. */
  align: "start" | "end"
}

/**
 * Geometri kolom pesan per arah. Invarian simetri: `gutter` dan `maxWidthPct`
 * IDENTIK untuk incoming & outgoing; hanya `align` yang di-mirror.
 */
export function chatBubbleGeometry(side: ChatBubbleSide): ChatBubbleGeometry {
  return {
    gutter: CHAT_MESSAGE_GUTTER_PX,
    maxWidthPct: CHAT_BUBBLE_MAX_WIDTH_PCT,
    align: side === "outgoing" ? "end" : "start",
  }
}

/**
 * Kunci grup menit (zona perangkat — sama dengan `formatTime` tanpa opsi
 * timeZone): "YYYY-MM-DDTHH:MM". Dua pesan segrup menit bila pengirimnya sama
 * DAN kunci ini sama.
 */
export function chatMinuteKey(iso: string): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, "0")
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `T${p(d.getHours())}:${p(d.getMinutes())}`
  )
}

/**
 * Apakah pesan ini bubble TERAKHIR dalam grup menitnya — satu-satunya yang
 * menampilkan jam (ala WhatsApp). `next` = pesan tepat DI BAWAHNYA di thread
 * (daftar diurut menaik). Beda pengirim atau beda menit → grup berakhir di
 * pesan ini → jam tampil.
 */
export function isLastInMinuteGroup(
  message: { fromUser: boolean; createdAt: string },
  next?: { fromUser: boolean; createdAt: string },
): boolean {
  if (!next) return true
  if (next.fromUser !== message.fromUser) return true
  return chatMinuteKey(next.createdAt) !== chatMinuteKey(message.createdAt)
}

/**
 * Jangkar posisi bubble di window — untuk popover reaksi mengambang.
 * `width`/`height` = 0 bila diukur dari titik sentuh (fallback).
 */
export type ChatBubbleAnchor = {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Badge reaksi: MENGAMBANG overlap di sudut kanan-bawah bubble
 * (ala WhatsApp/iMessage) — BUKAN baris chip di bawah bubble.
 * `bottom` negatif = sebagian badan badge menimpa bubble.
 */
export const REACTION_BADGE_ANCHOR = {
  position: "absolute",
  bottom: -12,
  right: 4,
} as const

/** Ruang di bawah bubble saat badge tampil — 12px badge + 4px napas. */
export const REACTION_BADGE_CLEARANCE_PX = 16

export type BubblePressDecision = {
  /**
   * Ketuk: NO-OP (`undefined`) di luar mode pilih; toggle pilihan saat mode
   * pilih aktif (satu-satunya pengecualian — tanpanya mode pilih tak bisa
   * dipakai).
   */
  onPress?: () => void
  /** Tekan lama: SELALU membuka aksi (masuk mode pilih + popover reaksi). */
  onLongPressAt?: (anchor: ChatBubbleAnchor) => void
}

/**
 * Aturan interaksi bubble (revisi 2026-09-27, keluhan pemakaian nyata):
 * - Ketukan pada bubble teks TIDAK memicu aksi apa pun — kecuali mode pilih
 *   sedang aktif (ketukan = toggle pilihan).
 * - Aksi (menu/reaksi) HANYA lewat tekan lama.
 * - Pesan terhapus: tidak ada handler sama sekali.
 *
 * Lampiran media di dalam bubble punya handler ketuk sendiri (buka media)
 * dan tidak lewat sini — aturan no-op ini hanya untuk gelembung teks.
 */
export function resolveBubblePressHandlers(opts: {
  selecting: boolean
  isDeleted?: boolean
  onTap: () => void
  onLongPress: (anchor: ChatBubbleAnchor) => void
}): BubblePressDecision {
  if (opts.isDeleted) return {}
  return {
    onPress: opts.selecting ? opts.onTap : undefined,
    onLongPressAt: opts.onLongPress,
  }
}

/** Tinggi estimasi pil popover reaksi (px) — untuk penempatan awal. */
export const REACTION_POPOVER_HEIGHT = 56
/** Estimasi lebar pil (6 emoji × 44 + padding) — dikoreksi via onLayout. */
export const REACTION_POPOVER_EST_WIDTH = 300
/** Jarak minimum pil dari tepi layar & dari bubble (px). */
export const REACTION_POPOVER_MARGIN = 8

/**
 * Posisi pil popover relatif terhadap jangkar bubble — murni, bisa diuji.
 * Di ATAS bubble bila muat, else di BAWAH; horizontal menempel di tengah
 * bubble lalu dijepit ke dalam layar. Tidak pernah menutupi bubble sendiri.
 */
export function placeReactionPopover(
  anchor: ChatBubbleAnchor,
  windowWidth: number,
  windowHeight: number,
  popoverWidth: number,
): { top: number; left: number } {
  const above = anchor.y - REACTION_POPOVER_HEIGHT - REACTION_POPOVER_MARGIN >= 0
  const rawTop = above
    ? anchor.y - REACTION_POPOVER_HEIGHT - REACTION_POPOVER_MARGIN
    : anchor.y + anchor.height + REACTION_POPOVER_MARGIN
  // Jepit vertikal juga (mis. keyboard terbuka memampatkan ruang bawah).
  const top = Math.min(
    Math.max(rawTop, REACTION_POPOVER_MARGIN),
    Math.max(windowHeight - REACTION_POPOVER_HEIGHT - REACTION_POPOVER_MARGIN, REACTION_POPOVER_MARGIN),
  )
  const centerX = anchor.x + anchor.width / 2
  const left = Math.min(
    Math.max(centerX - popoverWidth / 2, REACTION_POPOVER_MARGIN),
    Math.max(windowWidth - popoverWidth - REACTION_POPOVER_MARGIN, REACTION_POPOVER_MARGIN),
  )
  return { top, left }
}
