/**
 * Kahade — logika presentasi murni gelembung chat (tanpa React Native).
 *
 * Modul ini adalah SATU sumber kebenaran untuk kontrak visual yang dikeluhkan
 * pemakai nyata (TIM CHAT):
 *   a. simetri kiri/kanan bubble masuk vs keluar,
 *   b. ketukan bubble teks = no-op; aksi hanya via tekan lama,
 *   c. posisi popover reaksi mengambang,
 *   d. badge reaksi overlap di sudut bubble (bukan di bawahnya),
 *   e. area gesture tekan-lama + swipe-reply = SELURUH baris pesan
 *      (2026-10-05, ala WhatsApp) — umpan balik visual tetap DI BUBBLE.
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

/**
 * Bug #7 (audit Pesan 2026-10-10): LEBAR MEDIA = LEBAR KOLOM BUBBLE.
 *
 * Dulu foto/video/berkas/pesan suara memakai lebar tetap (`w-52` = 208px,
 * `w-56` = 224px) sementara caption di bawahnya membungkus sampai batas kolom
 * 76% — di layar 360dp kolom itu ±243px, di 412dp ±283px. Hasilnya bubble
 * "bertangga": media 208px, teks lebih lebar (atau lebih sempit untuk caption
 * pendek) sehingga ukuran lampiran tidak pernah mengikuti pesan teksnya.
 *
 * Kini lebar media dihitung dari geometri kolom yang SAMA dengan yang
 * dipakai bubble (gutter + 76% + kolom avatar + bingkai 3px), dijepit ke
 * rentang yang masih enak dilihat. Caption pun membungkus tepat selebar
 * media — satu objek, seperti WhatsApp/Telegram. Murni, bisa diuji.
 */
export const CHAT_MEDIA_WIDTH_MIN_PX = 200
export const CHAT_MEDIA_WIDTH_MAX_PX = 320
/** Bingkai bubble lampiran (`p-[3px]`) — kiri + kanan. */
export const CHAT_MEDIA_FRAME_PX = 3 * 2
/** Kolom avatar pesan masuk: foto 24px + gap 6px (lihat chat-message-bubble). */
export const CHAT_MEDIA_AVATAR_COLUMN_PX = 24 + 6

export function chatMediaWidthPx(
  rowWidth: number,
  opts: { hasAvatarColumn?: boolean } = {},
): number {
  const safeRow = Number.isFinite(rowWidth) && rowWidth > 0 ? rowWidth : 360
  const column = (safeRow - CHAT_MESSAGE_GUTTER_PX * 2) * (CHAT_BUBBLE_MAX_WIDTH_PCT / 100)
  const inner = column - (opts.hasAvatarColumn ? CHAT_MEDIA_AVATAR_COLUMN_PX : 0) - CHAT_MEDIA_FRAME_PX
  return Math.round(Math.max(CHAT_MEDIA_WIDTH_MIN_PX, Math.min(CHAT_MEDIA_WIDTH_MAX_PX, inner)))
}

/**
 * Bug #2 (audit Pesan 2026-10-10): sudut "ekor" grup. Tanpa ekor dekoratif
 * (§6), pesan PERTAMA sebuah kelompok diberi satu sudut lebih tajam di sisi
 * pengirimnya (kanan-atas untuk keluar, kiri-atas untuk masuk) — pola
 * Telegram/iMessage yang membuat awal kelompok terbaca tanpa menambah tinta.
 * Pesan lanjutan (`grouped`) tetap simetris. Pesan sistem tidak punya ekor.
 */
export function bubbleTailCornerClass(side: ChatBubbleSide, grouped: boolean): string | undefined {
  if (grouped || side === "system") return undefined
  return side === "outgoing" ? "rounded-tr-xs" : "rounded-tl-xs"
}

/**
 * Bug #2: ruang yang disisakan di UJUNG BARIS TERAKHIR teks untuk meta (jam +
 * centang) yang digambar absolut di pojok kanan-bawah bubble — pola
 * WhatsApp. Dulu reservasi dipasang sebagai `paddingRight` bubble sehingga
 * SETIAP baris teks menyempit dan pesan panjang punya pita kosong di kanan.
 * `reservePx` = hasil `bubbleMetaReservePx` (sudah termasuk tepi 12px).
 * `pillPaddingPx` = padding horizontal pill meta pada bubble lampiran.
 */
export function bubbleMetaInlineSpacerPx(reservePx: number, opts: { pill?: boolean } = {}): number {
  const base = Math.max(0, reservePx - META_EDGE_PX)
  // Celah 6px dari huruf terakhir ke meta; pill lampiran punya padding 6px×2.
  return base + 6 + (opts.pill ? 12 : 0)
}

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
 * Node native minimal yang bisa diukur posisinya di window — sengaja
 * struktural (bukan `ViewInstance`) supaya helper ini tetap murni & bisa
 * diuji di node.
 */
export type MeasureInWindowNode = {
  measureInWindow?: (
    cb: (x: number, y: number, width: number, height: number) => void,
  ) => void
}

/**
 * Ukur JANGKAR BUBBLE (bukan baris) untuk popover reaksi, dengan fallback ke
 * titik sentuh bila node belum terukur / pengukuran gagal.
 *
 * 2026-10-05: dipakai DUA pemanggil — bubble (tekan lama tepat di bubble) dan
 * baris `chat-message-row` (tekan lama di area kosong samping bubble). Karena
 * keduanya mengukur node pembungkus bubble YANG SAMA, popover selalu muncul
 * menempel bubble walaupun jari menekan jauh di sampingnya — bukan di titik
 * sentuh (itulah bedanya tekan lama "di baris" vs "di bubble" yang diminta
 * produk: yang melebar hanya area pemicunya, bukan umpan baliknya).
 */
export function measureBubbleAnchor(
  node: MeasureInWindowNode | null | undefined,
  fallbackPoint: { x: number; y: number },
  onAnchor: (anchor: ChatBubbleAnchor) => void,
): void {
  try {
    if (node && typeof node.measureInWindow === "function") {
      node.measureInWindow((x, y, width, height) => onAnchor({ x, y, width, height }))
      return
    }
  } catch {
    // Jatuh ke koordinat titik sentuh di bawah.
  }
  onAnchor({ x: fallbackPoint.x, y: fallbackPoint.y, width: 0, height: 0 })
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

export type ChatRowGesturePlan = {
  /**
   * Pan swipe-reply dipasang di SELURUH baris (bukan hanya di bubble) —
   * translasi/hint-nya tetap digambar di bubble.
   */
  swipeReply: boolean
  /**
   * Tekan lama di area kosong baris (samping bubble) memanggil aksi yang sama
   * dengan tekan lama di bubble.
   */
  longPress: boolean
}

/**
 * Rencana gesture tingkat BARIS (2026-10-05, permintaan produk ala WhatsApp:
 * "di WhatsApp seluruh baris pesan adalah area sentuh").
 *
 * Sebelumnya tekan lama & swipe hanya aktif kalau sentuhan pas mengenai
 * bubble; area kosong di samping bubble tidak merespons apa pun. Aturan di
 * sini adalah gerbang TUNGGAL untuk kedua gesture baris, dan sengaja
 * mengulang gerbang yang sudah dipakai bubble supaya tidak ada kombinasi
 * keadaan yang "lolos" lewat baris saja:
 *
 * - `selecting`  → swipe MATI (menghindari bentrok dengan toggle pilihan);
 *                  tekan lama TETAP hidup (aksi/reaksi masih boleh dibuka).
 * - `isDeleted`  → keduanya MATI (pesan terhapus tidak punya handler — sama
 *                  dengan `resolveBubblePressHandlers`).
 * - `isSystem`   → keduanya MATI (kartu sistem bukan pesan yang bisa
 *                  dibalas/dipilih; dulu pun tidak ada pressable di sana).
 * - `hasSwipeReply`/`hasLongPress` → handler dari pemanggil (opsional).
 */
export function resolveChatRowGesturePlan(opts: {
  selecting: boolean
  isDeleted?: boolean
  isSystem?: boolean
  hasSwipeReply: boolean
  hasLongPress: boolean
}): ChatRowGesturePlan {
  if (opts.isDeleted || opts.isSystem) {
    return { swipeReply: false, longPress: false }
  }
  return {
    swipeReply: !opts.selecting && opts.hasSwipeReply,
    longPress: opts.hasLongPress,
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
 * - Translasi dijepit -MAX..MAX; ikon reply muncul (fade+scale, bukan gerak)
 *   di ruang yang terbuka di SISI BERTOLAK BELAKANG arah geser sebagai hint
 *   visual (geser kanan → hint kiri, geser kiri → hint kanan).
 *
 * 2026-10-08 (temuan #11): geser KIRI dulu dijepit ke 0 (`Math.max(0, …)`),
 * jadi bubble sama sekali tidak bergerak walau jari bergerak — gesture
 * terasa mati. Kini bubble mengikuti jari ke DUA arah dan balas terpicu di
 * arah mana pun yang melewati ambang: WhatsApp (geser kanan) dan Telegram
 * (geser kiri) dua-duanya jalan, jadi kebiasaan user mana pun dihargai.
 * - Reduce Motion: translasi mengikuti jari (esensial, pengecualian WCAG
 *   2.3.3 seperti <SwipeableListItem>), tapi snap-back tanpa spring —
 *   pemanggil memakai `withTiming({duration: 0})` bila reduce-motion aktif.
 */
export const SWIPE_REPLY_THRESHOLD_PX = 56
export const SWIPE_REPLY_MAX_PX = 72
/** px/detik — fling cepat ke kanan langsung memicu balas. */
export const SWIPE_REPLY_FLING_VELOCITY_PX_S = 800
/**
 * Offset aktivasi pan (px): horizontal 12px baru mengklaim gesture, gerakan
 * vertikal 8px langsung menyerahkannya ke scroll FlatList. Sama untuk pan di
 * bubble (pemakaian langsung komponen) maupun pan di baris — lihat
 * `useSwipeReplyPan`.
 */
export const SWIPE_REPLY_ACTIVE_OFFSET_X = 12
export const SWIPE_REPLY_FAIL_OFFSET_Y = 8

/**
 * Reservasi ruang META di kanan-bawah bubble (jam + status + ikon) — 2026-10-08.
 *
 * Meta diposisikan absolute di pojok kanan-bawah (ala WhatsApp: baris teks
 * terakhir yang pendek berbagi baris dengan jam). Supaya teks tidak tertutup,
 * bubble memberi padding-kanan sebesar lebar meta. Dulu dua kelas tetap
 * (`pr-16`, `pr-28` khusus antrean) — meta "Dibaca" (centang + label),
 * "(diedit)", pin/bintang, atau skala font besar membuatnya meluber ke teks.
 * Kini dihitung dari komponen yang benar-benar tampil, dikalikan skala font
 * (teks ikut membesar, ikon tidak), lalu dibulatkan ke kelipatan 4.
 *
 * Lebar teks = perkiraan per karakter caption 12px (bukan pengukuran —
 * pengukuran onLayout berarti layout dua tahap per bubble saat scroll).
 * Sedikit lebih lebar dari perlu lebih baik daripada tumpang tindih.
 */
const META_TIME_PX = 36
/** 2026-10-08: 14px mengikuti `META_ICON_PX` di chat-message-bubble — kalau
 *  konstanta ini berbeda dari yang dirender, reservasi meleset. */
const META_ICON_PX = 14
const META_GAP_PX = 3
const META_CHAR_PX = 6.5
/** `pr-3` bubble — jarak meta ke tepi kanan. */
const META_EDGE_PX = 12

export type BubbleMetaReserveInput = {
  hasTime: boolean
  /** Pesan keluar: glyph status ikut dihitung (dan labelnya bila ada). */
  outgoing: boolean
  status?: "queued" | "sending" | "sent" | "read" | "failed"
  isEdited?: boolean
  isPinned?: boolean
  starred?: boolean
  ephemeralChip?: string | null
  /** Label yang ikut tampil di meta — sudah diterjemahkan (panjang berbeda per bahasa). */
  labels: { edited: string; failed: string; retry: string; queued: string; read: string }
  /** Skala font efektif (pengaturan A-/A+ × skala OS yang di-clamp). */
  fontScale?: number
}

export function bubbleMetaReservePx(input: BubbleMetaReserveInput): number {
  const scale = Math.max(0.5, input.fontScale ?? 1)
  const text = (s: string) => Math.ceil(s.length * META_CHAR_PX * scale)
  const items: number[] = []
  if (input.outgoing && input.status === "failed") {
    items.push(META_ICON_PX, text(input.labels.failed), text(input.labels.retry))
  } else {
    if (input.hasTime) items.push(META_TIME_PX * scale)
    if (input.isEdited) items.push(text(`(${input.labels.edited})`))
    if (input.isPinned) items.push(META_ICON_PX)
    if (input.starred) items.push(META_ICON_PX)
    if (input.ephemeralChip) items.push(META_ICON_PX + text(input.ephemeralChip))
    if (input.outgoing && input.status) {
      items.push(META_ICON_PX)
      if (input.status === "queued") items.push(text(input.labels.queued))
      if (input.status === "read") items.push(text(input.labels.read))
    }
  }
  if (items.length === 0) return META_EDGE_PX
  const total = items.reduce((a, b) => a + b, 0) + META_GAP_PX * (items.length - 1) + META_EDGE_PX
  return Math.ceil(total / 4) * 4
}

/**
 * Murni — translasi bubble mengikuti jari, DIJEPIT ke rentang -MAX..MAX.
 *
 * Dua arah (lihat #11): bubble mengikuti jari baik ke kanan maupun ke kiri,
 * lalu snap-back. Tanpa penjepit, geser jauh membuat bubble keluar dari
 * layar; dengan penjepit, ada "tahanan" terasa di ujung.
 */
export function clampSwipeReply(translationX: number): number {
  // Direktif "worklet": helper ini pernah dipanggil dari worklet pan
  // (bug #9, force close). Pemanggil kini meng-inline matematikanya; direktif
  // tetap dipasang sebagai pertahanan kedua bila ada pemanggil baru.
  "worklet"
  return Math.max(-SWIPE_REPLY_MAX_PX, Math.min(translationX, SWIPE_REPLY_MAX_PX))
}

/**
 * Murni — bisa di-unit-test: apakah gesture pan berakhir sebagai "balas"?
 *
 * #11: arah tidak lagi dipedulikan (nilai mutlak) — geser kanan (WhatsApp)
 * maupun geser kiri (Telegram) sama-sama membalas.
 */
export function shouldTriggerSwipeReply(
  translationX: number,
  velocityX: number,
): boolean {
  "worklet"
  return (
    Math.abs(translationX) >= SWIPE_REPLY_THRESHOLD_PX ||
    Math.abs(velocityX) >= SWIPE_REPLY_FLING_VELOCITY_PX_S
  )
}
