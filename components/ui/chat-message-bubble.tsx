/**
 * Kahade — <ChatMessageBubble> (§2.4 mode tokens, §5 radius, §6 flat).
 *
 * Satu gelembung pesan di ruang obrolan pembeli–penjual. Dua arah:
 * `outgoing` (kanan, bg-primary + teks inverse) dan `incoming` (kiri,
 * bg-surface + border-default). Plus `system` untuk pesan otomatis escrow
 * ("Dana ditahan", "Bukti pengiriman diunggah") yang tampil di tengah,
 * tanpa gelembung, caption text-secondary.
 *
 * Keputusan non-obvious:
 *   - TIDAK ada "ekor" (tail) gelembung dan semua sudut `rounded-md` (8px).
 *     §5 menetapkan 8px sebagai radius maksimum non-pill dan §6 melarang
 *     dekorasi tanpa fungsi; ekor adalah dekorasi. Arah pesan sudah jelas
 *     dari posisi (kiri/kanan) + warna. Pengelompokan pesan berurutan
 *     dilakukan lewat `grouped` yang hanya MERAPATKAN margin (mt-1 vs mt-3)
 *     — bukan mengubah radius per sudut seperti iMessage, supaya bentuk
 *     tetap tegas dan konsisten.
 *   - Outgoing memakai `bg-primary` (hitam di light, putih di dark). Ini
 *     satu-satunya blok hitam murni besar di layar chat, sesuai §1 "hitam
 *     sebagai otoritas": pesan Anda sendiri adalah yang paling perlu
 *     dibedakan cepat. Incoming memakai surface+border agar tetap "tenang".
 *   - SIMETRI (revisi 2026-09-27, keluhan pemakaian nyata): SATU gutter luar
 *     20px (`px-5` di baris; FlatList TIDAK memberi padding sendiri supaya
 *     tidak dobel) + SATU batas lebar maksimum 76% yang SAMA untuk incoming
 *     & outgoing — lihat `chatBubbleGeometry()` di `@/lib/chat-bubble`.
 *     Kolom avatar pesan masuk (32px) hidup DI DALAM batas 76% itu, bukan di
 *     luarnya: inset kiri bubble masuk == inset kanan bubble keluar, dan tepi
 *     kanan bubble masuk == tepi kiri bubble keluar (mirror).
 *   - Waktu pakai `caption` Plus Jakarta Sans (tabular figures), BUKAN Mono. §3.1
 *     Mono untuk "timestamp teknis" (log, invoice); jam kirim pesan adalah
 *     meta percakapan yang harus lebur, bukan data presisi yang dibaca
 *     berdiri sendiri. (Bandingkan SecurityLogItem yang memang teknis.)
 *   - Setiap bubble menerima dan menampilkan jam pesannya sendiri; <ChatMessageRow>
 *     memformat nilainya, sedangkan komponen ini hanya merender.
 *   - Status kirim hanya di outgoing (incoming tidak punya status). Ikon
 *     16px tone inverse dengan opacity lebih rendah untuk sending/sent;
 *     `read` = Checks weight bold + label mikro "Dibaca" agar mudah dikenali.
 *     Tidak ada warna biru — sistem monokrom (§2.3). CHT-007: tidak ada status
 *     "delivered" (centang ganda abu) — backend tidak menyediakan delivered
 *     receipt, jadi "sent" (centang satu) langsung naik ke "read".
 *   - `failed`: gelembung tetap bg-primary (isi pesan tetap terbaca), tetapi
 *     baris meta berubah jadi ikon WarningCircle danger + tautan "Coba
 *     lagi" (`onRetry`) DI LUAR gelembung — sesuai §2.3 link = primary +
 *     underline, dan agar target sentuh tidak menabrak onLongPress bubble.
 *   - `children` = slot lampiran (Picture, kartu order, bukti kirim) yang
 *     dirender DI ATAS teks dalam gelembung yang sama, padding sama.
 *     Komponen ini tidak tahu jenis lampiran — pemanggil yang menentukan.
 *   - KETUKAN pada gelembung teks = NO-OP (revisi 2026-09-27): tidak memicu
 *     aksi apa pun. Aksi (menu/reaksi) HANYA lewat tekan lama
 *     (`onLongPress`/`onLongPressAt`). Pengecualian: pemanggil boleh
 *     meneruskan `onPress` saat mode pilih aktif (ketukan = toggle pilihan);
 *     lampiran media di `children` punya handler ketuk sendiri (buka media).
 *   - `onLongPress` ada di gelembung, bukan seluruh baris;
 *     `scaleOnPress={false}` karena baris chat yang ikut mengecil terasa
 *     "goyang" saat scroll cepat.
 */
import { memo, useEffect, useMemo, useRef, type ReactNode } from "react"
import { View, type GestureResponderEvent, type ViewInstance, type ViewProps } from "react-native"
import { Gesture, GestureDetector } from "react-native-gesture-handler"
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated"
import { ArrowBendUpLeft, Check, Checks, Clock, PushPin, Star, Timer, WarningCircle } from "phosphor-react-native"

import { Avatar } from "@/components/ui/avatar"
import { ChatFormattedText } from "@/components/ui/chat-formatted-text"
import { ChatSystemCard } from "@/components/ui/chat-system-card"
import { Icon } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { TextLink } from "@/components/ui/text-link"
import { VerifiedName } from "@/components/ui/verified-name"
import { type SealTier } from "@/components/ui/verified-seal"
import { cn } from "@/lib/cn"
import { focusRing } from "@/lib/focus-ring"
import { hitSlopToReach } from "@/lib/hit-slop"
import { translate } from "@/lib/i18n/translate"
import { summarize } from "@/lib/a11y"
import { useReducedMotion } from "@/lib/use-reduced-motion"
import { tokens } from "@/lib/tokens"
import { splitHighlightSpans } from "@/lib/chat-search"
import {
  REACTION_BADGE_ANCHOR,
  SWIPE_REPLY_MAX_PX,
  chatBubbleGeometry,
  type ChatBubbleAnchor,
} from "@/lib/chat-bubble"

export type ChatMessageDirection = "incoming" | "outgoing" | "system"
/**
 * CHT-007: "delivered" DIHAPUS dari union — dead branch. Backend tidak punya
 * delivered receipt (tidak ada `deliveredAt`, tidak ada event
 * `chat.message_delivered`; satu-satunya sinyal baca adalah read receipt).
 * Menampilkannya dari tebakan (mis. "lawan online") adalah fabrikasi status
 * yang menyesatkan. Selama backend belum menyediakan delivered receipt,
 * "sent" (centang satu) = diterima server, "read" (centang ganda) = dibaca.
 */
export type ChatMessageStatus = "sending" | "sent" | "read" | "failed"

export type ChatMessageBubbleProps = Omit<ViewProps, "children"> & {
  direction: ChatMessageDirection
  /** Isi teks pesan; boleh kosong jika hanya lampiran (`children`) */
  text?: string
  /** Sudah diformat pemanggil, mis. "14:32" (formatTime) */
  time?: string
  /** Hanya berlaku untuk outgoing */
  status?: ChatMessageStatus
  /** Pesan lanjutan dari pengirim yang sama: rapatkan jarak atas */
  grouped?: boolean
  /** Nama pengirim di atas gelembung — untuk grup >2 orang (mis. admin sengketa) */
  senderName?: string
  /**
   * Kutipan pesan yang dibalas — dirender sebagai blok kecil di atas isi
   * gelembung (permintaan produk 2026-09-28). `senderName` = nama pengirim
   * pesan asli, `preview` = cuplikannya (sudah dipotong pemanggil).
   */
  quote?: { senderName?: string | null; preview: string } | null
  /**
   * B09: ketuk kutipan balasan → lompat ke pesan asal + sorot. Bila diisi,
   * blok kutipan dirender sebagai tombol (bukan View statis).
   */
  onQuotePress?: () => void
  /** Slot lampiran, dirender di atas teks */
  children?: ReactNode
  /**
   * Batch 43 (2026-09-28): hasil terjemahan — dirender sebagai blok di
   * bawah teks asli ("Terjemahan • id → en").
   */
  translation?: { text: string; sourceLang: string | null; targetLang: string } | null
  /**
   * Batch 43: label hitung mundur pesan sementara (mis. "59 mnt") —
   * dirender di baris meta. null/undefined = bukan pesan sementara.
   */
  ephemeralChip?: string | null
  /** Batch 43: pesan dibintangi — ikon bintang di baris meta. */
  starred?: boolean
  /**
   * Pencarian inline dalam thread (2026-09-28): sorot kemunculan `query` di
   * teks pesan. `focused=true` menandai hasil yang sedang aktif (lebih
   * tegas: teks warning + bold). Warna dari token (`bg-warning-soft`),
   * bukan hex literal.
   */
  searchHighlight?: { query: string; focused: boolean }
  onLongPress?: () => void
  /**
   * Tekan lama BESERTA jangkar posisi bubble di window — dipakai pemanggil
   * untuk menampilkan pemilih reaksi MENGAMBANG (popover) di dekat bubble
   * yang ditekan, bukan menutupi konten di atas layar.
   *
   * Bila diisi, ia DIPANGGIL sebagai pengganti `onLongPress` (bukan
   * tambahan). Posisi diukur via `measureInWindow`; bila pengukuran gagal,
   * jatuh ke koordinat titik sentuh (`pageX`/`pageY`, width/height = 0).
   */
  onLongPressAt?: (anchor: ChatBubbleAnchor) => void
  /**
   * Ketukan pada gelembung.
   *
   * Revisi 2026-09-27 (keluhan pemakaian nyata): ketukan pada bubble TEKS
   * adalah NO-OP — pemanggil (ChatMessageRow) hanya meneruskannya saat mode
   * pilih aktif (ketukan = toggle pilihan); di luar mode pilih ia `undefined`
   * sehingga ketukan tidak membuka apa pun. Aksi (menu/reaksi) HANYA lewat
   * tekan lama. Lampiran di dalam `children` punya handler ketuk sendiri
   * (buka media) dan tidak terpengaruh aturan ini.
   */
  onPress?: () => void
  /**
   * Foto & nama PENGIRIM gelembung masuk (revisi 2026-09-26, permintaan
   * produk: "bedakan antara user dengan lawan bicara").
   *
   * Arah pesan sebelumnya hanya ditanggung oleh posisi (kiri/kanan) dan
   * warna (surface vs primary). Itu cukup di layar terang, tetapi di
   * percakapan panjang yang didominasi satu pihak — atau di chat bertiga
   * (admin mediasi) — mata kehilangan jalur siapa yang bicara. Avatar di
   * sisi kiri + nama pengirim di atas gelembung membuat arah terbaca
   * seketika, juga untuk pengguna yang tidak membedakan warna (§10).
   *
   * Kolom avatar HANYA disediakan bila pemanggil mengirim `avatarName`
   * atau `avatarUrl`: layar yang belum punya data pengirim (mis. tiket
   * bantuan) tidak boleh tiba-tiba menjorok 32px. Kolomnya hidup DI DALAM
   * batas lebar 76% (lihat catatan SIMETRI di atas) supaya tidak merusak
   * mirror kiri/kanan.
   */
  avatarUrl?: string | null
  avatarName?: string | null
  /**
   * Tier seal verifikasi PENGIRIM gelembung masuk (revisi 2026-09-27, UI
   * polish): seal tampil di SAMPING nama pengirim, bukan di-overlay di foto
   * profil — konsisten dengan header ruang chat. `null`/undefined = tanpa
   * seal (nama tampil polos seperti sebelumnya).
   */
  senderSealTier?: SealTier | null
  /** Kirim ulang saat status "failed" */
  onRetry?: () => void
  /**
   * Reaksi emoji tersummari (GET/POST/DELETE reactions). Dirender sebagai
   * BADGE MENGAMBANG overlap di sudut kanan-bawah bubble
   * (REACTION_BADGE_ANCHOR, ala WhatsApp/iMessage) — bukan baris chip di
   * bawah bubble. Ketuk tiap emoji memanggil `onReact` (tambah bila belum,
   * tarik bila sudah).
   */
  reactions?: { emoji: string; count: number; reactedByMe: boolean }[]
  onReact?: (emoji: string) => void
  /** Ikon pin kecil di baris meta (pesan terpin). */
  isPinned?: boolean
  /** Tampilkan "diedit" di baris meta. */
  isEdited?: boolean
  /** CN-003: pesan terhapus — teks jadi placeholder italic/muted. */
  isDeleted?: boolean
  /**
   * DM 1:1 (2026-09-28): sembunyikan baris nama pengirim di blok kutipan
   * balasan — ala WhatsApp, kutipan hanya menampilkan cuplikan pesan.
   */
  hideQuoteSenderName?: boolean
  /**
   * Swipe kanan pada bubble → balas pesan ini (jalan pintas, 2026-09-28).
   * Tekan lama "Balas" tetap ada — ini hanya jalur tambahan. Bila diisi,
   * bubble bisa digeser ke kanan; melewati ambang memicu callback ini.
   */
  onSwipeReply?: () => void
  labels?: { retry?: string; failed?: string; edited?: string }
  className?: string
}

const DEFAULT_LABELS = { retry: "Coba lagi", failed: "Gagal terkirim", edited: "diedit" }

/**
 * Pengganti foto pada pesan masuk yang tergabung (`grouped`) — lebarnya PERSIS
 * <Avatar size="xs"> (24px) + gap 8px, supaya gelembung lanjutan dari pengirim
 * yang sama tidak bergeser ke kiri.
 */
const AVATAR_SPACER = { width: 24, height: 24 } as const

function ChatMessageBubbleBase({
  direction,
  text,
  time,
  status,
  grouped = false,
  senderName,
  quote,
  onQuotePress,
  children,
  searchHighlight,
  onLongPress,
  onLongPressAt,
  onPress,
  onRetry,
  reactions,
  onReact,
  isPinned = false,
  isEdited = false,
  isDeleted = false,
  hideQuoteSenderName = false,
  onSwipeReply,
  labels,
  avatarUrl,
  avatarName,
  senderSealTier,
  translation,
  ephemeralChip,
  starred = false,
  className,
  ...rest
}: ChatMessageBubbleProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  /** Geometri simetri — `align` satu-satunya yang di-mirror per arah. */
  const geometry = chatBubbleGeometry(direction)
  const hasReactions = !!reactions && reactions.length > 0
  /**
   * Tim8 P1: `splitHighlightSpans` mengkompilasi `new RegExp` per panggilan —
   * tanpa memo tiap bubble me-regex ulang teksnya di setiap render layar
   * selama pencarian inline aktif. Memo per (text, query); `focused` tidak
   * ikut karena hanya mengubah tone/weight, bukan segmennya.
   */
  const highlightQuery = searchHighlight?.query ?? ""
  const showSearchHighlight =
    !!text && !!searchHighlight && highlightQuery.trim() !== "" && !isDeleted
  const highlightSpans = useMemo(
    () => (showSearchHighlight && text ? splitHighlightSpans(text, highlightQuery) : null),
    [showSearchHighlight, text, highlightQuery],
  )
  /**
   * Ref pembungkus bubble: jangkar `measureInWindow` untuk popover reaksi
   * mengambang. `collapsable={false}` supaya node native-nya tidak
   * dioptimasi hilang di Android.
   */
  const bubbleRef = useRef<ViewInstance | null>(null)

  /**
   * Swipe-to-reply (2026-09-28) — jalan pintas; tekan lama "Balas" TETAP ADA.
   * Hooks ditaruh SEBELUM early-return `system` (aturan hooks).
   */
  const swipeX = useSharedValue(0)
  const reduceMotion = useReducedMotion()
  const swipeReplyRef = useRef(onSwipeReply)
  useEffect(() => {
    swipeReplyRef.current = onSwipeReply
  }, [onSwipeReply])
  const canSwipeReply = !!onSwipeReply && direction !== "system" && !isDeleted
  /**
   * Pan horizontal ala <SwipeableListItem>: `activeOffsetX(12)` +
   * `failOffsetY(8)` — pan hanya diklaim setelah gerakan horizontal jelas,
   * scroll vertikal FlatList tidak terganggu.
   */
  const swipePan = useMemo(() => {
    // PERF-FIX (P1): jangan pasang worklet closures untuk bubble yang tidak
    // bisa swipe-reply (system/deleted/tanpa handler) — GestureDetector hanya
    // di-render bila canSwipeReply, tapi pembuatan Pan() + 2 closure worklet
    // per bubble tetap membebani mount thread chat panjang (500 pesan =
    // 500 gesture + 1000 closure sia-sia).
    if (!canSwipeReply) return Gesture.Pan().enabled(false)
    return Gesture.Pan()
      .activeOffsetX(12)
      .failOffsetY(8)
      .onUpdate((e) => {
        "worklet"
        swipeX.value = Math.max(0, Math.min(e.translationX, SWIPE_REPLY_MAX_PX))
      })
      .onEnd((e) => {
        "worklet"
        // Threshold inline (jangan panggil fungsi JS eksternal dari worklet):
        // 56px translasi atau 800px/detik velocity.
        const triggered = swipeX.value >= 56 || e.velocityX >= 800
        if (triggered) {
          const cb = swipeReplyRef.current
          if (cb) runOnJS(cb)()
        }
        // Reduce Motion: snap-back INSTAN tanpa spring — yang
        // dipertahankan hanya translasi mengikuti jari (esensial untuk
        // fungsi, pengecualian WCAG 2.3.3).
        swipeX.value = reduceMotion
          ? withTiming(0, { duration: 0 })
          : withSpring(0, tokens.motion.spring)
      })
  }, [canSwipeReply, reduceMotion, swipeX])
  const swipeBubbleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: swipeX.value }],
  }))
  /**
   * Hint visual: ikon reply fade+scale (bukan gerak) di ruang yang terbuka
   * di kiri bubble saat digeser.
   */
  const swipeHintStyle = useAnimatedStyle(() => {
    const p = Math.min(1, swipeX.value / SWIPE_REPLY_MAX_PX)
    return { opacity: p, transform: [{ scale: 0.5 + 0.5 * p }] }
  })

  if (direction === "system") {
    // Batch 43 (2026-09-28): pesan SYSTEM dirender sebagai kartu terpusat
    // dengan ikon per jenis event (bukan caption polos).
    return (
      <View
        className={cn("w-full", grouped ? "mt-1" : "mt-3", className)}
        {...rest}
      >
        <ChatSystemCard text={text} />
      </View>
    )
  }

  const outgoing = direction === "outgoing"
  const failed = outgoing && status === "failed"
  /**
   * Kolom avatar hanya disediakan bila pengirimnya dikenal (lihat docblock
   * `avatarName`) — kalau tidak, baris pesan masuk tetap menempel ke kiri
   * seperti sebelumnya.
   */
  const hasAvatarColumn = !outgoing && Boolean(avatarName || avatarUrl)
  /** Avatar hanya di pesan PERTAMA kelompok; sisanya dapat spacer selebar itu. */
  const showAvatar = hasAvatarColumn && !grouped

  // 2026-10-03: meta (jam + centang) DI DALAM bubble, rata kanan ala WhatsApp.
  // Didefinisikan SEBELUM `bubble` karena dipakai di dalamnya.
  // 2026-10-03 (update): meta diposisikan absolute di pojok kanan bawah,
  // menempel presisi di samping konten (teks/gambar/video/file/lokasi)
  // ala WhatsApp — tidak makan space vertikal tambahan.
  // 2026-10-03 (update 2): tone inverse untuk bubble hitam (outgoing)
  // agar jam + centang terlihat jelas.
  const metaTone = outgoing ? "inverse" : "secondary"
  const metaIconTone = outgoing ? "inverse" : "default"
  const metaBlock =
    time || failed || (outgoing && status) || isPinned || isEdited || ephemeralChip || starred ? (
      <View className="absolute bottom-1.5 right-2 flex-row items-center gap-1">
        {failed ? (
          <>
            <Icon icon={WarningCircle} size="xs" tone="danger" />
            <Text variant="caption" tone="danger">
              {t.failed}
            </Text>
            {onRetry ? (
              <TextLink variant="caption" onPress={onRetry} className="ml-1">
                {t.retry}
              </TextLink>
            ) : null}
          </>
        ) : (
          <>
            {time ? (
              <Text variant="caption" tone={metaTone} className="tabular-nums">
                {time}
              </Text>
            ) : null}
            {isEdited ? (
              <Text variant="caption" tone={metaTone}>
                ({t.edited})
              </Text>
            ) : null}
            {isPinned ? <Icon icon={PushPin} size="xs" tone={metaIconTone} /> : null}
            {starred ? <Icon icon={Star} size="xs" tone="warning" weight="fill" /> : null}
            {ephemeralChip ? (
              <View className="flex-row items-center gap-0.5">
                <Icon icon={Timer} size="xs" tone={metaIconTone} />
                <Text variant="caption" tone={metaTone} className="tabular-nums">
                  {ephemeralChip}
                </Text>
              </View>
            ) : null}
            {outgoing && status && status !== "failed" ? (
              <StatusGlyph status={status} outgoing={outgoing} />
            ) : null}
          </>
        )}
      </View>
    ) : null

  const hasMeta = !!(time || failed || (outgoing && status) || isPinned || isEdited || ephemeralChip || starred)

  const bubble = (
    <View
      className={cn(
        // 2026-10-02: incoming tanpa border tebal — cukup background + rounded
        // (permintaan user). Outgoing tetap tanpa border (bg-primary solid).
        // 2026-10-03: relative untuk meta absolute di pojok kanan bawah.
        // pr-16 + pb-5 hanya saat ada meta, agar teks pendek tidak tertutup
        // jam + centang (ala WhatsApp) tanpa makan space berlebih.
        "relative gap-2 rounded-md pl-3 pt-2",
        hasMeta ? "pr-16 pb-5" : "pr-3 pb-2",
        outgoing ? "bg-primary" : "bg-surface",
      )}
    >
      {quote ? (
        <QuoteBlock
          className={cn(
            "rounded-sm border-l-2 px-2 py-1",
            // UX-COL-007: pola CHT-013 — border putih tak terlihat di dark
            // (bubble putih), bg hitam tak terlihat di light (bubble hitam).
            outgoing ? "border-white/70 dark:border-black/30 bg-white/15 dark:bg-black/15" : "border-border-focus bg-background",
          )}
          onPress={onQuotePress}
        >
          {/* DM 1:1 — baris nama pengirim kutipan disembunyikan total. */}
          {hideQuoteSenderName ? null : (
            <Text
              variant="caption"
              weight={600}
              tone={outgoing ? "inverse" : "primary"}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {quote.senderName ?? "Pesan"}
            </Text>
          )}
          <Text
            variant="caption"
            tone={outgoing ? "inverse" : "secondary"}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {quote.preview}
          </Text>
        </QuoteBlock>
      ) : null}
      {children ? <View className="gap-2">{children}</View> : null}
      {text ? (
        showSearchHighlight ? (
          <Text
            variant="body"
            tone={outgoing ? "inverse" : "primary"}
            selectable={!isDeleted}
          >
            {highlightSpans?.map((span, i) =>
              span.hit ? (
                <Text
                  key={i}
                  variant="inherit"
                  tone={searchHighlight.focused ? "warning" : "inherit"}
                  weight={searchHighlight.focused ? 700 : undefined}
                  className="bg-warning-soft"
                >
                  {span.text}
                </Text>
              ) : (
                <Text key={i} variant="inherit">
                  {span.text}
                </Text>
              ),
            )}
          </Text>
        ) : (
          // Batch 43 (2026-09-28): teks dirender lewat <ChatFormattedText>
          // (**tebal**, _miring_, `mono`, __bawah__, ||spoiler||, tautan).
          <ChatFormattedText
            text={text}
            outgoing={outgoing}
            deleted={isDeleted}
            selectable={!isDeleted}
            italic={isDeleted || undefined}
          />
        )
      ) : null}
      {/* Batch 43: blok terjemahan di bawah teks asli. */}
      {translation && !isDeleted ? (
        <View
          className={cn(
            "gap-0.5 rounded-sm border-l-2 px-2 py-1",
            // UX-COL-007: pola CHT-013 — border putih tak terlihat di dark
            // (bubble putih), bg hitam tak terlihat di light (bubble hitam).
            outgoing ? "border-white/70 dark:border-black/30 bg-white/15 dark:bg-black/15" : "border-info bg-info-soft",
          )}
        >
          <Text
            variant="caption"
            weight={600}
            tone={outgoing ? "inverse" : "info"}
          >
            Terjemahan
            {translation.sourceLang ? ` • ${translation.sourceLang} → ${translation.targetLang}` : ""}
          </Text>
          <Text variant="body" tone={outgoing ? "inverse" : "primary"} selectable>
            {translation.text}
          </Text>
        </View>
      ) : null}
      {/* 2026-10-03: jam + centang di dalam bubble, rata kanan bawah. */}
      {metaBlock}
    </View>
  )

  /**
   * Tekan lama: bila pemanggil meminta jangkar (`onLongPressAt`), ukur posisi
   * bubble di window untuk popover mengambang; bila pengukuran gagal, pakai
   * titik sentuh. Tanpa `onLongPressAt`, perilaku lama (`onLongPress`).
   */
  const handleLongPress = (e: GestureResponderEvent) => {
    if (onLongPressAt) {
      const node = bubbleRef.current as unknown as {
        measureInWindow?: (
          cb: (x: number, y: number, width: number, height: number) => void,
        ) => void
      } | null
      try {
        if (node && typeof node.measureInWindow === "function") {
          node.measureInWindow((x, y, width, height) =>
            onLongPressAt({ x, y, width, height }),
          )
          return
        }
      } catch {
        // Jatuh ke koordinat titik sentuh di bawah.
      }
      const { pageX, pageY } = e.nativeEvent
      onLongPressAt({ x: pageX, y: pageY, width: 0, height: 0 })
      return
    }
    onLongPress?.()
  }

  const statusText = !outgoing ? undefined : status === "sending" ? "Mengirim" : status === "sent" ? "Terkirim" : status === "read" ? "Dibaca" : undefined
  const a11yLabel = [
    outgoing ? "Anda" : senderName ?? "Pesan masuk",
    text,
    time,
    failed ? t.failed : statusText,
  ]
    .filter(Boolean)
    .join(", ")

  /**
   * Isi bubble (pressable + badge reaksi) — dipakai di kedua cabang
   * `bubbleBlock` (swipe / non-swipe) di bawah.
   */
  const bubbleCore = (
    <>
      {onLongPress || onLongPressAt || onPress ? (
        <PressableScale
          accessibilityRole="text"
          accessibilityLabel={a11yLabel}
          accessibilityHint={
            onPress ? "Ketuk atau tekan lama untuk opsi pesan" : "Tekan lama untuk opsi pesan"
          }
          scaleOnPress={false}
          onPress={onPress}
          onLongPress={handleLongPress}
          containerClassName={cn("rounded-md", focusRing)}
        >
          {bubble}
        </PressableScale>
      ) : (
        <View accessible accessibilityLabel={a11yLabel}>
          {bubble}
        </View>
      )}

      {/*
        Badge reaksi MENGAMBANG overlap sudut kanan-bawah bubble
        (REACTION_BADGE_ANCHOR) — bukan baris chip di bawah bubble.
        Label a11y di per emoji (bukan di kontainer): kontainer `accessible`
        akan menelan tombol fokusable dari screen reader.
      */}
      {reactions && reactions.length > 0 ? (
        <View
          testID="message-reaction-badge"
          style={REACTION_BADGE_ANCHOR}
          className="z-sticky flex-row items-center rounded-full border border-border bg-surface-elevated px-1.5 py-0.5"
        >
          {reactions.map((r) => (
            <PressableScale
              key={r.emoji}
              accessibilityRole="button"
              accessibilityLabel={summarize([
                `${r.emoji} ${r.count}`,
                r.reactedByMe ? translate("Anda") : undefined,
              ])}
              accessibilityHint="Ketuk untuk mengubah reaksi"
              scaleOnPress={false}
              onPress={onReact ? () => onReact(r.emoji) : undefined}
              // UI-C005: chip ≈ 24px tinggi — slop vertikal ke 44pt target
              // sentuh; horizontal 0 supaya chip bertetangga tidak saling
              // menimpa area sentuhnya.
              hitSlop={hitSlopToReach(44, 24)}
              className="flex-row items-center px-1"
            >
              <Text variant="caption">{r.emoji}</Text>
              {r.count > 1 ? (
                <Text
                  variant="caption"
                  tone={r.reactedByMe ? "primary" : "secondary"}
                  weight={r.reactedByMe ? 700 : 400}
                  className="ml-0.5 tabular-nums"
                >
                  {r.count}
                </Text>
              ) : null}
            </PressableScale>
          ))}
        </View>
      ) : null}
    </>
  )

  /**
   * Pembungkus bubble. Cabang swipe (2026-09-28): ikon hint reply (absolute,
   * di kiri) + GestureDetector > Animated.View (hanya `style` — className
   * tetap di <View> dalam, sesuai konvensi proyek) + className di View dalam.
   * Cabang biasa: struktur lama tanpa berubah.
   */
  const bubbleBlock = canSwipeReply ? (
    <View className="relative">
      {/* Hint visual saat swipe: lingkaran ikon reply yang fade+scale masuk
          di ruang yang terbuka di kiri bubble. */}
      <Animated.View
        pointerEvents="none"
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
        style={swipeHintStyle}
      >
        <View className="absolute -left-11 top-1/2 -mt-5">
          <View className="rounded-full border border-border bg-surface-elevated p-2">
            <Icon icon={ArrowBendUpLeft} size="sm" tone="active" />
          </View>
        </View>
      </Animated.View>
      <GestureDetector gesture={swipePan}>
        <Animated.View
          ref={bubbleRef}
          collapsable={false}
          style={swipeBubbleStyle}
        >
          <View
            className={cn(
              // `relative` = jangkar badge reaksi; `overflow-visible` supaya
              // badge yang menjulur keluar bubble tidak terpotong (khususnya
              // Android).
              "relative overflow-visible",
              // REACTION_BADGE_CLEARANCE_PX: badge menjulur 12px di bawah
              // bubble — beri napas 16px supaya tidak menabrak baris
              // jam/bubble berikut.
              hasReactions && "mb-4",
            )}
          >
            {bubbleCore}
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  ) : (
    <View
      ref={bubbleRef}
      collapsable={false}
      className={cn(
        // `relative` = jangkar badge reaksi; `overflow-visible` supaya badge
        // yang menjulur keluar bubble tidak terpotong (khususnya Android).
        "relative overflow-visible",
        // REACTION_BADGE_CLEARANCE_PX: badge menjulur 12px di bawah bubble —
        // beri napas 16px supaya tidak menabrak baris jam/bubble berikut.
        hasReactions && "mb-4",
      )}
    >
      {bubbleCore}
    </View>
  )

  return (
    <View
      className={cn(
        // Gutter tunggal CHAT_MESSAGE_GUTTER_PX (20px): FlatList TIDAK memberi
        // padding sendiri supaya tidak dobel — lihat chatBubbleGeometry().
        "w-full flex-row px-5",
        outgoing ? "justify-end" : "justify-start",
        grouped ? "mt-1" : "mt-3",
        className,
      )}
      {...rest}
    >
      {/*
        Kolom TERBATAS — max-w SAMA (76%) untuk incoming & outgoing (mirror).
        Pesan masuk: avatar + isi berdampingan DI DALAM batas ini, sehingga
        inset kiri bubble masuk == inset kanan bubble keluar, dan tepi kanan
        bubble masuk == tepi kiri bubble keluar.
      */}
      <View
        className={cn(
          "max-w-[76%] gap-1",
          geometry.align === "end" ? "items-end" : "items-start",
        )}
      >
        {hasAvatarColumn ? (
          <View className="flex-row items-start">
            {/*
              Kolom avatar: foto lawan bicara di pesan pertama setiap kelompok,
              spacer selebar foto di lanjutannya supaya tepi kiri seluruh
              gelembung masuk sejajar (bukan menjorok).
            */}
            <View className="mr-2">
              {showAvatar ? (
                <Avatar
                  source={avatarUrl ? { uri: avatarUrl } : undefined}
                  name={avatarName ?? ""}
                  size="xs"
                />
              ) : (
                <View style={AVATAR_SPACER} />
              )}
            </View>
            <View className="min-w-0 flex-1 gap-1">
              {senderName && !grouped ? (
                /*
                 * Revisi 2026-09-27 (UI polish): seal verifikasi tampil di
                 * SAMPING nama pengirim — bukan di-overlay di foto profil
                 * (lihat <Avatar>: tidak lagi menerima `verified` di sini).
                 * <VerifiedName> merender nama polos bila tier null.
                 */
                <VerifiedName
                  name={senderName}
                  variant="caption"
                  badges={null}
                  tier={senderSealTier ?? null}
                  textProps={{ weight: 500, tone: "secondary", numberOfLines: 1 }}
                />
              ) : null}
              {bubbleBlock}
            </View>
          </View>
        ) : (
          <>
            {bubbleBlock}
          </>
        )}
      </View>
    </View>
  )
}

/**
 * LR-001 (2026-09-29): bubble di-`memo` (shallow). Lapis pertahanan kedua
 * setelah `memo` di <ChatMessageRow>: bila row me-render ulang karena prop
 * non-bubble-nya berubah (mis. `highlighted`), bubble yang propnya identik
 * tidak ikut me-render ulang. Syaratnya: <ChatMessageRow> menstabilkan
 * semua prop turunan (quote, handler, pressHandlers) — lihat file row.
 */
export const ChatMessageBubble = memo(ChatMessageBubbleBase)

/**
 * Ikon status kirim, 16px (§7 size xs). Semua tone "default" (text-tertiary)
 * kecuali `read` yang naik ke "active" + weight bold dan mendapat label
 * mikro "Dibaca" — tetap tanpa warna baru.
 */
function StatusGlyph({
  status,
  outgoing,
}: {
  status: Exclude<ChatMessageStatus, "failed">
  outgoing?: boolean
}) {
  const tone = outgoing ? "inverse" : "default"
  switch (status) {
    case "sending":
      return <Icon icon={Clock} size="xs" tone={tone} />
    case "sent":
      return <Icon icon={Check} size="xs" tone={tone} />
    // CHT-007: case "delivered" dihapus — tidak pernah bisa tercapai
    // (backend tidak menyediakan delivered receipt).
    case "read":
      return (
        <View className="flex-row items-center gap-1">
          <Icon icon={Checks} size="xs" tone={outgoing ? "inverse" : "active"} weight="bold" />
          <Text variant="caption" tone={outgoing ? "inverse" : "secondary"}>
            {translate("Dibaca")}
          </Text>
        </View>
      )
  }
}

/**
 * B09: blok kutipan balasan. Tanpa `onPress` = View statis (perilaku lama);
 * dengan `onPress` = tombol yang membawa ke pesan asal. Dibuat komponen
 * kecil agar JSX bubble tidak bercabang dua.
 */
function QuoteBlock({
  className,
  onPress,
  children,
}: {
  className?: string
  onPress?: () => void
  children: ReactNode
}) {
  if (!onPress) {
    return <View className={className}>{children}</View>
  }
  return (
    // UX-TCH-012: PressableScale — pratinjau balasan memberi feedback
    // saat ditekan (sebelumnya Pressable polos).
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityHint="Lihat pesan yang dibalas"
      className={className}
    >
      {children}
    </PressableScale>
  )
}
