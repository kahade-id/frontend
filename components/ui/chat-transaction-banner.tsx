/**
 * Kahade — <ChatTransactionBanner> penanda RUANG TRANSAKSI di atas thread.
 *
 * Audit Pesan 2026-10-10 (bug #1, "DM vs pesan transaksi tidak dibedakan"):
 * sebelum ini satu-satunya pembeda di dalam ruang adalah kode order mono
 * kecil di baris status header. Kini ruang transaksi punya penanda yang
 * sama tegasnya dengan banner anti-tipu di DM: SATU strip ringkas berisi
 * ikon gembok, judul transaksi, status, dan jalan pintas ke detail pesanan.
 *
 * Keputusan non-obvious:
 *   - Saling eksklusif dengan <DmSafetyBanner> (DM tanpa order) — layar yang
 *     memilih; komponen ini tidak tahu jenis ruang.
 *   - Status memakai label resmi `ORDER_STATUS_LABELS` (bukan enum mentah)
 *     dan <Badge> tone mengikuti keluarga status (selesai = success,
 *     sengketa/batal = danger, lainnya = accent).
 *   - Tanpa penjelasan panjang (§3 "butuh penjelasan panjang = desain belum
 *     intuitif"): judul + status + "Lihat" sudah cukup.
 */
import { memo } from "react"
import { View } from "react-native"
import { CaretRight, LockKey } from "phosphor-react-native"

import { Badge, type BadgeTone } from "@/components/ui/badge"
import { Icon } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { ORDER_STATUS_LABELS } from "@/lib/labels/status"
import { translate, useLanguage } from "@/lib/i18n"
import { focusRingInset } from "@/lib/focus-ring"
import { cn } from "@/lib/cn"

export type ChatTransactionBannerProps = {
  orderId: string
  /** Judul transaksi (dari order); fallback kode order. */
  title?: string | null
  /** Enum status backend (mis. PAID); null = belum termuat. */
  status?: string | null
  onPress: () => void
}

/** Tone badge per keluarga status — murni, bisa diuji. */
export function transactionStatusTone(status: string | null | undefined): BadgeTone {
  switch (status) {
    case "COMPLETED":
      return "success"
    case "DISPUTED":
    case "CANCELLED":
      return "danger"
    case "WAITING_PAYMENT":
    case "PENDING_PAYMENT":
    case "WAITING_CONFIRMATION":
      return "warning"
    default:
      return "accent"
  }
}

function ChatTransactionBannerBase({ orderId, title, status, onPress }: ChatTransactionBannerProps) {
  useLanguage()
  const statusLabel =
    status && status in ORDER_STATUS_LABELS
      ? translate(ORDER_STATUS_LABELS[status as keyof typeof ORDER_STATUS_LABELS])
      : null
  const heading = title?.trim() || orderId
  return (
    <PressableScale
      testID="chat-transaction-banner"
      accessibilityRole="button"
      accessibilityLabel={translate("Ruang transaksi {x}", { x: heading })}
      accessibilityHint={translate("Membuka detail transaksi")}
      scaleOnPress={false}
      ripple
      onPress={onPress}
      containerClassName={cn("w-full border-b border-border bg-accent-soft", focusRingInset)}
      className="min-h-11 w-full flex-row items-center gap-2.5 px-5 py-2"
    >
      <Icon icon={LockKey} size="sm" tone="accent" weight="fill" />
      <View className="min-w-0 flex-1">
        <Text variant="caption" weight={700} tone="accent" numberOfLines={1}>
          {translate("Transaksi")}
          {" · "}
          {orderId}
        </Text>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {heading}
        </Text>
      </View>
      {statusLabel ? (
        <Badge tone={transactionStatusTone(status)} variant="soft">
          {statusLabel}
        </Badge>
      ) : null}
      <Icon icon={CaretRight} size="xs" tone="default" />
    </PressableScale>
  )
}

export const ChatTransactionBanner = memo(ChatTransactionBannerBase)
