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
 *   - Lebar maksimum 80% (`max-w-[80%]`) — cukup untuk kalimat panjang
 *     tanpa menutup jalur visual arah pesan. Angka ini turunan praktik
 *     umum, bukan token; didokumentasikan di sini agar tidak diubah
 *     per-pemakaian.
 *   - Waktu pakai `caption` Sofia Sans (tabular figures), BUKAN Mono. §3.1
 *     Mono untuk "timestamp teknis" (log, invoice); jam kirim pesan adalah
 *     meta percakapan yang harus lebur, bukan data presisi yang dibaca
 *     berdiri sendiri. (Bandingkan SecurityLogItem yang memang teknis.)
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
 *   - onLongPress (salin, balas, hapus) ada di gelembung, bukan seluruh
 *     baris; `scaleOnPress={false}` karena baris chat yang ikut mengecil
 *     terasa "goyang" saat scroll cepat.
 */
import type { ReactNode } from "react"
import { View, type ViewProps } from "react-native"
import { Check, Checks, Clock, PushPin, WarningCircle } from "phosphor-react-native"

import { Icon } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { TextLink } from "@/components/ui/text-link"
import { cn } from "@/lib/cn"
import { focusRing } from "@/lib/focus-ring"
import { translate } from "@/lib/i18n/translate"
import { summarize } from "@/lib/a11y"

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
   * Ketuk/satu klik pada gelembung — pasang aksi yang sama dengan
   * `onLongPress` (menu salin/hapus).
   *
   * Ada karena `onLongPress` saja tidak bisa ditemukan: di web tidak ada
   * affordance "tekan lama", sehingga pengguna yang mengklik pesan melihat
   * "tidak ada aksi" padahal menu opsinya tersedia. Lampiran tetap punya
   * handler sendiri di dalam `children` dan menang atas ketukan gelembung.
   */
  onPress?: () => void
  /** Kirim ulang saat status "failed" */
  onRetry?: () => void
  /**
   * Reaksi emoji tersummari (GET/POST/DELETE reactions). Dirender sebagai
   * chip kecil di bawah gelembung; ketuk chip memanggil `onReact` dengan
   * emoji tersebut (tambah bila belum, tarik bila sudah).
   */
  reactions?: { emoji: string; count: number; reactedByMe: boolean }[]
  onReact?: (emoji: string) => void
  /** Ikon pin kecil di baris meta (pesan terpin). */
  isPinned?: boolean
  /** Tampilkan "diedit" di baris meta. */
  isEdited?: boolean
  labels?: { retry?: string; failed?: string; edited?: string }
  className?: string
}

const DEFAULT_LABELS = { retry: "Coba lagi", failed: "Gagal terkirim", edited: "diedit" }

export function ChatMessageBubble({
  direction,
  text,
  time,
  status,
  grouped = false,
  senderName,
  children,
  onLongPress,
  onPress,
  onRetry,
  reactions,
  onReact,
  isPinned = false,
  isEdited = false,
  labels,
  className,
  ...rest
}: ChatMessageBubbleProps) {
  const t = { ...DEFAULT_LABELS, ...labels }

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

  const bubble = (
    <View
      className={cn(
        "gap-2 rounded-md px-3 py-2",
        outgoing ? "bg-primary" : "border border-border bg-surface",
      )}
    >
      {children ? <View className="gap-2">{children}</View> : null}
      {text ? (
        <Text variant="body" tone={outgoing ? "inverse" : "primary"} selectable>
          {text}
        </Text>
      ) : null}
    </View>
  )

  const statusText = !outgoing ? undefined : status === "sending" ? "Mengirim" : status === "sent" ? "Terkirim" : status === "delivered" ? "Sampai" : status === "read" ? "Dibaca" : undefined
  const a11yLabel = [
    outgoing ? "Anda" : senderName ?? "Pesan masuk",
    text,
    time,
    failed ? t.failed : statusText,
  ]
    .filter(Boolean)
    .join(", ")

  return (
    <View
      className={cn(
        "w-full px-5",
        outgoing ? "items-end" : "items-start",
        grouped ? "mt-1" : "mt-3",
        className,
      )}
      {...rest}
    >
      <View className={cn("max-w-[80%] gap-1", outgoing ? "items-end" : "items-start")}>
        {senderName && !outgoing && !grouped ? (
          <Text variant="caption" tone="secondary" weight={500} className="px-1">
            {senderName}
          </Text>
        ) : null}

        {onLongPress || onPress ? (
          <PressableScale
            accessibilityRole="text"
            accessibilityLabel={a11yLabel}
            accessibilityHint="Ketuk atau tekan lama untuk opsi pesan"
            scaleOnPress={false}
            onPress={onPress}
            onLongPress={onLongPress}
            containerClassName={cn("rounded-md", focusRing)}
          >
            {bubble}
          </PressableScale>
        ) : (
          <View accessible accessibilityLabel={a11yLabel}>
            {bubble}
          </View>
        )}

        {time || failed || isPinned || isEdited ? (
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
        ) : null}

        {/* Label a11y di per chip (bukan di kontainer): kontainer `accessible`
            akan menelan chip fokusable dari screen reader. */}
        {reactions && reactions.length > 0 ? (
          <View
            className={cn(
              "flex-row flex-wrap gap-1",
              outgoing ? "justify-end" : "justify-start",
            )}
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
                containerClassName={cn(
                  "flex-row items-center rounded-full border px-2 py-0.5",
                  r.reactedByMe ? "border-primary bg-surface-elevated" : "border-border bg-surface",
                )}
                // Kelas baris HARUS di className (View isi di dalam
                // PressableScale) — di containerClassName ia hanya mengatur
                // hit area dan emoji+angka jadi numpuk (S8 check-screens).
                className="flex-row items-center gap-1"
              >
                <Text variant="caption">{r.emoji}</Text>
                {r.count > 1 ? (
                  <Text
                    variant="caption"
                    tone={r.reactedByMe ? "primary" : "secondary"}
                    weight={r.reactedByMe ? 700 : 400}
                    className="tabular-nums"
                  >
                    {r.count}
                  </Text>
                ) : null}
              </PressableScale>
            ))}
          </View>
        ) : null}
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