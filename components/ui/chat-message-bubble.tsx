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
import { Check, Checks, Clock, WarningCircle } from "phosphor-react-native"

import { Icon } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { TextLink } from "@/components/ui/text-link"
import { cn } from "@/lib/cn"

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
  /** Kirim ulang saat status "failed" */
  onRetry?: () => void
  labels?: { retry?: string; failed?: string }
  className?: string
}

const DEFAULT_LABELS = { retry: "Coba lagi", failed: "Gagal terkirim" }

export function ChatMessageBubble({
  direction,
  text,
  time,
  status,
  grouped = false,
  senderName,
  children,
  onLongPress,
  onRetry,
  labels,
  className,
  ...rest
}: ChatMessageBubbleProps) {
  const t = { ...DEFAULT_LABELS, ...labels }

  if (direction === "system") {
    return (
      <View
        accessibilityRole="text"
        className={cn("w-full items-center px-6", grouped ? "mt-1" : "mt-3", className)}
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
        "w-full px-6",
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

        {onLongPress ? (
          <PressableScale hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="text"
            accessibilityLabel={a11yLabel}
            accessibilityHint="Tekan lama untuk opsi pesan"
            scaleOnPress={false}
            onLongPress={onLongPress}
          >
            {bubble}
          </PressableScale>
        ) : (
          <View accessible accessibilityLabel={a11yLabel}>
            {bubble}
          </View>
        )}

        {time || failed ? (
          <View className="flex-row items-center gap-1 px-1 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
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
                {outgoing && status && status !== "failed" ? (
                  <StatusGlyph status={status} />
                ) : null}
              </>
            )}
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