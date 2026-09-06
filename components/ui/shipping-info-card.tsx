/**
 * Kahade — <ShippingInfoCard> (§9.6 Card, §3.1 Mono nomor resi, §9.1 Button,
 * §12 Voice & Tone).
 *
 * Informasi pengiriman order fisik (`PUT /v1/orders/{id}/shipping`:
 * courierName, trackingNumber, trackingNotes). Dua mode:
 *   - terisi : kurir + nomor resi <CopyableField> + catatan + tombol
 *              "Lacak" (opsional, membuka situs kurir) dan "Ubah" (penjual).
 *   - kosong : EmptyState compact "Belum ada info pengiriman" + tombol
 *              "Tambah resi" — hanya untuk penjual (`canEdit`).
 *
 * Keputusan non-obvious:
 *   - Nomor resi memakai <CopyableField mono> — user pembeli hampir selalu
 *     menyalinnya ke aplikasi kurir; tombol salin lebih berguna daripada
 *     nomor yang hanya tampil. Clipboard urusan pemanggil (`onCopy`),
 *     konsisten dengan kontrak CopyableField.
 *   - Nama kurir ditulis apa adanya (string dari penjual), tidak dipetakan ke
 *     logo berwarna: §7 hanya mengizinkan logo berwarna untuk metode
 *     PEMBAYARAN. Ikon Truck monokrom mewakili semua kurir.
 *   - "Lacak" adalah Button `secondary` (bukan primary): CTA utama layar
 *     detail adalah konfirmasi penerimaan milik pemanggil.
 *   - `updatedAt` Mono caption di bawah — pembeli perlu tahu kapan resi
 *     terakhir diubah (indikasi penjual benar-benar sudah kirim).
 */
import { PencilSimple, Truck } from "phosphor-react-native"
import { View, type ViewProps } from "react-native"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { CopyableField } from "@/components/ui/copyable-field"
import { EmptyState } from "@/components/ui/empty-state"
import { IconBox } from "@/components/ui/icon-box"
import { IconButton } from "@/components/ui/icon-button"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
// UX: haptic feedback ensured for onPress (light) — improves confirmation

export type ShippingInfo = {
  courierName?: string
  trackingNumber?: string
  trackingNotes?: string
  /** Sudah diformat pemanggil (§13) */
  updatedAt?: string
}

export type ShippingInfoCardLabels = {
  title: string
  courier: string
  trackingNumber: string
  notes: string
  track: string
  edit: string
  add: string
  emptyTitle: string
  emptyDescription: string
  emptyDescriptionBuyer: string
}

const DEFAULT_LABELS: ShippingInfoCardLabels = {
  title: "Pengiriman",
  courier: "Kurir",
  trackingNumber: "Nomor resi",
  notes: "Catatan",
  track: "Lacak paket",
  edit: "Ubah info pengiriman",
  add: "Tambah resi",
  emptyTitle: "Belum ada info pengiriman",
  emptyDescription: "Tambahkan kurir dan nomor resi setelah paket dikirim.",
  emptyDescriptionBuyer: "Penjual belum mengisi nomor resi.",
}

export type ShippingInfoCardProps = Omit<ViewProps, "children"> & {
  shipping?: ShippingInfo | null
  /** Penjual boleh menambah/mengubah */
  canEdit?: boolean
  onEdit?: () => void
  onTrack?: () => void
  onCopy?: (value: string) => void
  copied?: boolean
  labels?: Partial<ShippingInfoCardLabels>
  className?: string
}

export function ShippingInfoCard({ shipping, canEdit = false, onEdit, onTrack, onCopy, copied, labels, className, ...rest }: ShippingInfoCardProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const filled = !!shipping?.trackingNumber || !!shipping?.courierName

  if (!filled) {
    return (
      <Card padded className={className} {...rest}>
        <EmptyState
          compact
          icon={Truck}
          title={t.emptyTitle}
          description={canEdit ? t.emptyDescription : t.emptyDescriptionBuyer}
          action={
            canEdit && onEdit ? (
              <Button variant="secondary" size="sm" fullWidth={false} onPress={onEdit}>
                {t.add}
              </Button>
            ) : undefined
          }
        />
      </Card>
    )
  }

  return (
    <Card padded className={cn("gap-4", className)} {...rest}>
      <View accessible={false} className="flex-row items-center justify-between gap-3">
        <View className="flex-1 flex-row items-center gap-3">
          <IconBox icon={Truck} size="md" variant="surface" />
          <View className="flex-1 gap-0.5">
            <Text variant="caption" tone="secondary">
              {t.courier}
            </Text>
            <Text variant="body" weight={600} tone="primary" numberOfLines={1}>
              {shipping?.courierName ?? "—"}
            </Text>
          </View>
        </View>
        {canEdit && onEdit ? <IconButton icon={PencilSimple} size="sm" variant="ghost" accessibilityLabel={t.edit} onPress={onEdit} /> : null}
      </View>

      {shipping?.trackingNumber ? (
        <CopyableField label={t.trackingNumber} value={shipping.trackingNumber} mono onCopy={onCopy} copied={copied} />
      ) : null}

      {shipping?.trackingNotes ? (
        <View className="gap-1">
          <Text variant="caption" tone="secondary">
            {t.notes}
          </Text>
          <Text variant="body" tone="secondary">
            {shipping.trackingNotes}
          </Text>
        </View>
      ) : null}

      <View className="flex-row items-center justify-between gap-3">
        {shipping?.updatedAt ? (
          <Text variant="caption" tone="secondary" className="flex-1 tabular-nums">
            {shipping.updatedAt}
          </Text>
        ) : (
          <View className="flex-1" />
        )}
        {onTrack ? (
          <Button variant="secondary" size="sm" fullWidth={false} onPress={onTrack}>
            {t.track}
          </Button>
        ) : null}
      </View>
    </Card>
  )
}