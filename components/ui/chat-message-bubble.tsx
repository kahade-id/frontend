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
 *   - Waktu pakai `caption` Sofia Sans (tabular figures), BUKAN Mono. §3.1
 *     Mono untuk "timestamp teknis" (log, invoice); jam kirim pesan adalah
 *     meta percakapan yang harus lebur, bukan data presisi yang dibaca
 *     berdiri sendiri. (Bandingkan SecurityLogItem yang memang teknis.)
 *   - Jam hanya tampil di bubble TERAKHIR tiap grup menit (aturan dihitung di
 *     <ChatMessageRow> via `isLastInMinuteGroup`, ala WhatsApp) — prop `time`
 *     yang diterima sudah memperhitungkannya; komponen ini hanya merender.
 *   - Status kirim hanya di outgoing (incoming tidak punya status). Ikon
 *     16px tone inverse dengan opacity lebih rendah untuk sending/sent/
 *     delivered; `read` = Checks weight bold + opacity penuh. Tidak ada
 *     warna biru "sudah dibaca" — sistem monokrom (§2.3).
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
import { useRef, type ReactNode } from "react"
import { View, type GestureResponderEvent, type ViewProps } from "react-native"
import { Check, Checks, Clock, PushPin, WarningCircle } from "phosphor-react-native"

import { Avatar } from "@/components/ui/avatar"
import { Icon } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { TextLink } from "@/components/ui/text-link"
import { cn } from "@/lib/cn"
import { focusRing } from "@/lib/focus-ring"
import { hitSlopToReach } from "@/lib/hit-slop"
import { translate } from "@/lib/i18n/translate"
import { summarize } from "@/lib/a11y"
import {
  REACTION_BADGE_ANCHOR,
  chatBubbleGeometry,
  type ChatBubbleAnchor,
} from "@/lib/chat-bubble"

export type ChatMessageDirection = "incoming" | "outgoing" | "system"
export type ChatMessageStatus = "sending" | "sent" | "delivered" | "read" | "failed"

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
  /** Slot lampiran, dirender di atas teks */
  children?: ReactNode
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

export function ChatMessageBubble({
  direction,
  text,
  time,
  status,
  grouped = false,
  senderName,
  children,
  onLongPress,
  onLongPressAt,
  onPress,
  onRetry,
  reactions,
  onReact,
  isPinned = false,
  isEdited = false,
  isDeleted = false,
  labels,
  avatarUrl,
  avatarName,
  className,
  ...rest
}: ChatMessageBubbleProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  /** Geometri simetri — `align` satu-satunya yang di-mirror per arah. */
  const geometry = chatBubbleGeometry(direction)
  const hasReactions = !!reactions && reactions.length > 0
  /**
   * Ref pembungkus bubble: jangkar `measureInWindow` untuk popover reaksi
   * mengambang. `collapsable={false}` supaya node native-nya tidak
   * dioptimasi hilang di Android.
   */
  const bubbleRef = useRef<View | null>(null)

  if (direction === "system") {
    return (
      <View
        accessibilityRole="text"
        className={cn("w-full items-center px-5", grouped ? "mt-1" : "mt-3", className)}
        {...rest}
      >
        <Text variant="caption" tone="secondary" className="text-center">
          {text}
        </Text>
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

  const bubble = (
    <View
      className={cn(
        "gap-2 rounded-md px-3 py-2",
        outgoing ? "bg-primary" : "border border-border bg-surface",
      )}
    >
      {children ? <View className="gap-2">{children}</View> : null}
      {text ? (
        <Text
          variant="body"
          tone={isDeleted ? "secondary" : outgoing ? "inverse" : "primary"}
          className={isDeleted ? "italic" : undefined}
          selectable={!isDeleted}
        >
          {text}
        </Text>
      ) : null}
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

  const statusText = !outgoing ? undefined : status === "sending" ? "Mengirim" : status === "sent" ? "Terkirim" : status === "delivered" ? "Sampai" : status === "read" ? "Dibaca" : undefined
  const a11yLabel = [
    outgoing ? "Anda" : senderName ?? "Pesan masuk",
    text,
    time,
    failed ? t.failed : statusText,
  ]
    .filter(Boolean)
    .join(", ")

  const bubbleBlock = (
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
          className="z-10 flex-row items-center rounded-full border border-border bg-surface-elevated px-1.5 py-0.5"
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
    </View>
  )

  const metaBlock =
    time || failed || isPinned || isEdited ? (
      <View className="flex-row items-center gap-1 px-1">
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
              <Text variant="caption" tone="secondary" className="tabular-nums">
                {time}
              </Text>
            ) : null}
            {isEdited ? (
              <Text variant="caption" tone="secondary">
                ({t.edited})
              </Text>
            ) : null}
            {isPinned ? <Icon icon={PushPin} size="xs" tone="default" /> : null}
            {outgoing && status && status !== "failed" ? (
              <StatusGlyph status={status} />
            ) : null}
          </>
        )}
      </View>
    ) : null

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
                <Text variant="caption" tone="secondary" weight={500} numberOfLines={1}>
                  {senderName}
                </Text>
              ) : null}
              {bubbleBlock}
              {metaBlock}
            </View>
          </View>
        ) : (
          <>
            {bubbleBlock}
            {metaBlock}
          </>
        )}
      </View>
    </View>
  )
}

/**
 * Ikon status kirim, 16px (§7 size xs). Semua tone "default" (text-tertiary)
 * kecuali `read` yang naik ke "active" + weight bold — hierarki lewat
 * weight & kontras, bukan warna baru.
 */
function StatusGlyph({ status }: { status: Exclude<ChatMessageStatus, "failed"> }) {
  switch (status) {
    case "sending":
      return <Icon icon={Clock} size="xs" tone="default" />
    case "sent":
      return <Icon icon={Check} size="xs" tone="default" />
    case "delivered":
      return <Icon icon={Checks} size="xs" tone="default" />
    case "read":
      return (
        <Icon icon={Checks} size="xs" tone="active" weight="bold" />
      )
  }
}
