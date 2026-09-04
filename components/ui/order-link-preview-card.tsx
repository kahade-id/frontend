/**
 * Kahade — <OrderLinkPreviewCard> pratinjau tautan order dari sisi PENERIMA
 * (§9.6 Card, §3.1 Mono nominal, §9.6 Stat inverted, §10 konfirmasi).
 *
 * Halaman tujuan deep link `/v1/deeplinks/order-link/{token}` yang memuat
 * `GET /v1/orders/links/{token}` lalu menawarkan `POST .../accept`. Pasangan
 * dari <OrderLinkShareCard> (sisi pembuat). Data = CreateOrderLinkDto yang
 * sudah tersimpan: role pembuat, title, description, orderType, orderValue,
 * deliveryDeadlineDays, feeResponsibility, counterpartUsername (opsional),
 * plus profil pembuat & status/expiry tautan.
 *
 * Anatomi:
 *   pembuat (Avatar md + nama + "mengundang Anda sebagai Pembeli/Penjual")
 *   nominal <Amount large> — angka terpenting di layar ini
 *   judul + deskripsi (ReadMore)
 *   <KeyValueList> : Jenis · Tenggat pengiriman · Biaya layanan
 *   peringatan bila tautan dikunci untuk username lain / kedaluwarsa
 *   aksi: Terima (primary) · Tolak/Tutup (ghost)
 *
 * Keputusan non-obvious:
 *   - Peran ditulis dari sudut pandang PENERIMA: pembuat BUYER -> "Anda
 *     diundang sebagai Penjual". Terbalik dari <OrderCard> yang memakai
 *     peran user karena di sini user BELUM punya peran sampai menerima.
 *   - Nominal Mono Large satu kali di kartu ini (§3.2 "nominal transaksi
 *     utama") karena menerima tautan = komitmen finansial; berbeda dengan
 *     OrderCard di list yang memakai size body.
 *   - Kalimat konsekuensi ("Anda akan membayar Rp X ke escrow" / "Anda akan
 *     menerima Rp X setelah pembeli konfirmasi") ditulis eksplisit di atas
 *     tombol — §12 voice: user harus tahu apa yang terjadi SEBELUM menekan.
 *   - `lockedTo` (counterpartUsername) yang tidak cocok dengan user login
 *     mematikan tombol Terima + Banner-lite inline (bukan Banner global):
 *     ini info kontekstual pada kartu, bukan status aplikasi.
 *   - Kedaluwarsa/dibatalkan = Badge status di header + tombol Terima
 *     disembunyikan, bukan seluruh kartu dipudarkan: user masih perlu bisa
 *     membaca detail untuk menghubungi pembuat.
 */
import { Info } from "phosphor-react-native"
import { View, type ViewProps } from "react-native"

import { Amount } from "@/components/ui/amount"
import { Avatar, type AvatarProps } from "@/components/ui/avatar"
import { Badge, type BadgeTone } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, type CardProps } from "@/components/ui/card"
import type { FeeResponsibility } from "@/components/ui/fee-breakdown"
import { Icon } from "@/components/ui/icon"
import { KeyValue, KeyValueList } from "@/components/ui/key-value"
import { ORDER_TYPE_LABELS, type OrderRoleValue, type OrderType } from "@/components/ui/order-form-selectors"
import { ReadMore } from "@/components/ui/read-more"
import { Skeleton } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { formatRupiah } from "@/lib/format"

export type OrderLinkStatus = "ACTIVE" | "ACCEPTED" | "CANCELLED" | "EXPIRED"

export type OrderLinkCreator = {
  name: string
  username?: string
  avatar?: AvatarProps["source"]
  verified?: boolean
}

export type OrderLinkPreviewCardLabels = {
  invitesYouAs: (role: string) => string
  buyer: string
  seller: string
  type: string
  deadline: string
  deadlineDays: (n: number) => string
  fee: string
  feeResponsibility: Record<FeeResponsibility, string>
  status: Record<OrderLinkStatus, string>
  expires: string
  lockedTo: (username: string) => string
  consequenceBuyer: (amount: string) => string
  consequenceSeller: (amount: string) => string
  accept: string
  decline: string
  close: string
}

const DEFAULT_LABELS: OrderLinkPreviewCardLabels = {
  invitesYouAs: (role) => `mengundang Anda sebagai ${role}`,
  buyer: "Pembeli",
  seller: "Penjual",
  type: "Jenis",
  deadline: "Tenggat pengiriman",
  deadlineDays: (n) => `${n} hari setelah pembayaran`,
  fee: "Biaya layanan",
  feeResponsibility: {
    BUYER: "Ditanggung pembeli",
    SELLER: "Ditanggung penjual",
    SPLIT: "Dibagi dua pihak",
  },
  status: {
    ACTIVE: "Aktif",
    ACCEPTED: "Sudah diterima",
    CANCELLED: "Dibatalkan",
    EXPIRED: "Kedaluwarsa",
  },
  expires: "Berlaku hingga",
  lockedTo: (u) => `Tautan ini hanya untuk @${u}. Masuk dengan akun tersebut untuk menerima.`,
  consequenceBuyer: (amount) => `Dengan menerima, Anda akan membayar ${amount} ke rekening escrow Kahade.`,
  consequenceSeller: (amount) => `Dengan menerima, Anda akan menerima ${amount} setelah pembeli mengonfirmasi penerimaan.`,
  accept: "Terima & lanjutkan",
  decline: "Tolak",
  close: "Tutup",
}

const STATUS_TONE: Record<OrderLinkStatus, BadgeTone> = {
  ACTIVE: "success",
  ACCEPTED: "neutral",
  CANCELLED: "neutral",
  EXPIRED: "danger",
}

export type OrderLinkPreviewCardProps = Omit<CardProps, "children" | "padded" | "onPress"> & {
  creator: OrderLinkCreator
  /** Peran PEMBUAT tautan (dari DTO) — peran penerima adalah kebalikannya */
  creatorRole: OrderRoleValue
  title: string
  description: string
  orderType: OrderType | string
  orderValue: number
  deliveryDeadlineDays: number
  feeResponsibility: FeeResponsibility
  /** Nominal biaya layanan bila sudah dihitung (`POST /orders/calculate-fee`) */
  feeAmount?: number
  status?: OrderLinkStatus
  /** Sudah diformat pemanggil (§13) */
  expiresLabel?: string
  /** counterpartUsername dari DTO — bila terisi & bukan user login, Terima dimatikan */
  lockedToUsername?: string
  /** Username user yang login, untuk membandingkan dengan `lockedToUsername` */
  currentUsername?: string
  onAccept?: () => void
  onDecline?: () => void
  accepting?: boolean
  labels?: Partial<OrderLinkPreviewCardLabels>
}

export function OrderLinkPreviewCard({
  creator,
  creatorRole,
  title,
  description,
  orderType,
  orderValue,
  deliveryDeadlineDays,
  feeResponsibility,
  feeAmount,
  status = "ACTIVE",
  expiresLabel,
  lockedToUsername,
  currentUsername,
  onAccept,
  onDecline,
  accepting = false,
  labels,
  className,
  ...rest
}: OrderLinkPreviewCardProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const receiverIsBuyer = creatorRole === "SELLER"
  const receiverRoleLabel = receiverIsBuyer ? t.buyer : t.seller
  const typeLabel = (ORDER_TYPE_LABELS as Record<string, string>)[orderType] ?? orderType

  const locked = !!lockedToUsername && !!currentUsername && lockedToUsername.toLowerCase() !== currentUsername.toLowerCase()
  const active = status === "ACTIVE"
  const canAccept = active && !locked && !!onAccept
  const amountText = formatRupiah(orderValue)

  return (
    <Card className={cn("gap-5", className)} {...rest}>
      {/* Pembuat + status */}
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1 flex-row items-center gap-3">
          <Avatar source={creator.avatar} name={creator.name} size="md" verified={creator.verified} />
          <View className="flex-1">
            <Text variant="body" weight={600} tone="primary" numberOfLines={1}>
              {creator.name}
            </Text>
            <Text variant="caption" tone="secondary" numberOfLines={2}>
              {t.invitesYouAs(receiverRoleLabel)}
            </Text>
          </View>
        </View>
        <Badge tone={STATUS_TONE[status]} dot={active}>
          {t.status[status]}
        </Badge>
      </View>

      {/* Nominal — angka utama layar ini */}
      <Amount value={orderValue} size="large" tone="primary" />

      <View className="gap-1">
        <Text variant="h3" tone="primary">
          {title}
        </Text>
        <ReadMore text={description} lines={3} variant="body" tone="secondary" />
      </View>

      <KeyValueList>
        <KeyValue label={t.type} value={typeLabel} />
        <KeyValue label={t.deadline} value={t.deadlineDays(deliveryDeadlineDays)} />
        <KeyValue
          label={t.fee}
          value={t.feeResponsibility[feeResponsibility]}
          hint={feeAmount != null ? formatRupiah(feeAmount) : undefined}
        />
        {expiresLabel ? <KeyValue label={t.expires} value={expiresLabel} /> : null}
      </KeyValueList>

      {locked ? (
        <View className="flex-row items-start gap-2 rounded-sm bg-info-soft p-3" accessibilityRole="alert">
          <Icon icon={Info} size="sm" tone="info" />
          <Text variant="caption" tone="info" className="flex-1">
            {t.lockedTo(lockedToUsername!)}
          </Text>
        </View>
      ) : null}

      {canAccept ? (
        <Text variant="caption" tone="secondary">
          {receiverIsBuyer ? t.consequenceBuyer(amountText) : t.consequenceSeller(amountText)}
        </Text>
      ) : null}

      <View className="gap-2">
        {canAccept ? (
          <Button variant="primary" fullWidth loading={accepting} onPress={onAccept}>
            {t.accept}
          </Button>
        ) : null}
        {onDecline ? (
          <Button variant="ghost" fullWidth disabled={accepting} onPress={onDecline}>
            {active ? t.decline : t.close}
          </Button>
        ) : null}
      </View>
    </Card>
  )
}

export function OrderLinkPreviewCardSkeleton({ className, ...rest }: Omit<ViewProps, "children"> & { className?: string }) {
  return (
    <View accessible accessibilityRole="progressbar"
      className={cn("w-full gap-5 rounded-md border border-border bg-surface p-5", className)}
      accessibilityLabel="Memuat tautan order"
      {...rest}
    >
      <View className="flex-row items-center gap-3">
        <Skeleton shape="circle" width={40} height={40} />
        <View className="flex-1 gap-1">
          <Skeleton height={16} className="w-32" />
          <Skeleton height={12} className="w-48" />
        </View>
      </View>
      <Skeleton height={32} className="w-40" />
      <Skeleton height={20} className="w-3/4" />
      <Skeleton height={14} className="w-full" />
      <Skeleton height={14} className="w-5/6" />
      <View className="gap-3">
        <Skeleton height={14} className="w-full" />
        <Skeleton height={14} className="w-full" />
        <Skeleton height={14} className="w-full" />
      </View>
      <Skeleton height={48} className="w-full" />
    </View>
  )
}
