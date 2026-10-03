/**
 * Kahade — logika presentasi murni gelembung chat (tanpa React Native).
 *
 * Modul ini adalah SATU sumber kebenaran untuk kontrak visual yang dikeluhkan
 * pemakai nyata (TIM CHAT):
 *   a. simetri kiri/kanan bubble masuk vs keluar,
 *   b. ketukan bubble teks = no-op; aksi hanya via tekan lama,
 *   c. posisi popover reaksi mengambang,
 *   d. badge reaksi overlap di sudut bubble (bukan di bawahnya).
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

/**
 * Swipe-to-reply (2026-09-28): geser bubble ke kanan untuk membalas pesan —
 * jalan pintas di samping tekan lama "Balas" (yang tetap ada).
 *
 * - `activeOffsetX(12)` + `failOffsetY(8)` (pola <SwipeableListItem>): pan
 *   hanya diklaim setelah gerakan horizontal jelas; scroll vertikal list
 *   tidak terganggu.
 * - Translasi dijepit 0..MAX; ikon reply muncul (fade+scale, bukan gerak)
 *   di ruang yang terbuka di kiri bubble sebagai hint visual.
 * - Reduce Motion: translasi mengikuti jari (esensial, pengecualian WCAG
 *   2.3.3 seperti <SwipeableListItem>), tapi snap-back tanpa spring —
 *   pemanggil memakai `withTiming({duration: 0})` bila reduce-motion aktif.
 */
export const SWIPE_REPLY_THRESHOLD_PX = 56
export const SWIPE_REPLY_MAX_PX = 72
/** px/detik — fling cepat ke kanan langsung memicu balas. */
export const SWIPE_REPLY_FLING_VELOCITY_PX_S = 800

/**
 * Murni — bisa di-unit-test: apakah gesture pan berakhir sebagai "balas"?
 */
export function shouldTriggerSwipeReply(
  translationX: number,
  velocityX: number,
): boolean {
  return (
    translationX >= SWIPE_REPLY_THRESHOLD_PX ||
    velocityX >= SWIPE_REPLY_FLING_VELOCITY_PX_S
  )
}
