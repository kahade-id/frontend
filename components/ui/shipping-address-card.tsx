/**
 * Kahade — <ShippingAddressCard> (§9.6 Card, §12 Voice & Tone).
 *
 * K9 (audit transaksi 2026-10-10): snapshot alamat pengiriman order barang
 * fisik (`shippingAddress` dari GET /v1/orders/:id). Sebelumnya normalizer
 * membuang field ini sehingga penjual tidak pernah tahu ke mana barang harus
 * dikirim — padahal alamat adalah syarat wajib saat order fisik dibuat.
 *
 * Keputusan non-obvious:
 *   - Murni informatif (tanpa aksi): alamat adalah snapshot saat order dibuat,
 *     tidak bisa diubah dari layar detail — mengubahnya berarti order baru.
 *   - Nomor telepon penerima memakai <CopyableField> — penjual menyalinnya ke
 *     aplikasi kurir; tombol salin lebih berguna daripada teks biasa.
 *   - Field yang kosong tidak dirender (data lama bisa parsial) — tidak ada
 *     placeholder "—" bertumpuk; §3 minimalis.
 */
import { MapPin } from "phosphor-react-native"
import { View, type ViewProps } from "react-native"

import { CopyableField } from "@/components/ui/copyable-field"
import { IconBox } from "@/components/ui/icon-box"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { translate } from "@/lib/i18n/translate"
import type { OrderShippingAddress } from "@/lib/api/orders-shared"

export type ShippingAddressCardLabels = {
  title: string
  recipient: string
  phone: string
}

const DEFAULT_LABELS: ShippingAddressCardLabels = {
  title: "Alamat pengiriman",
  recipient: "Penerima",
  phone: "Telepon",
}

export type ShippingAddressCardProps = Omit<ViewProps, "children"> & {
  address: OrderShippingAddress
  labels?: Partial<ShippingAddressCardLabels>
  /** Clipboard urusan pemanggil (kontrak CopyableField). */
  onCopy?: (value: string) => void
  copied?: boolean
}

/** Gabungkan kota/provinsi/kode pos menjadi satu baris, lewati yang kosong. */
function formatRegion(address: OrderShippingAddress): string | null {
  const parts = [address.city, address.province].filter((p): p is string => Boolean(p && p.trim()))
  const region = parts.join(", ")
  const postal = address.postalCode?.trim()
  const line = [region, postal].filter(Boolean).join(" ")
  return line || null
}

export function ShippingAddressCard({
  address,
  labels,
  onCopy,
  copied = false,
  className,
  ...rest
}: ShippingAddressCardProps) {
  // D07 (audit alamat & kurir 2026-10-10): label default lewat `translate`
  // saat render — pemanggil tanpa `labels` tetap mendapat bahasa aktif.
  const t: ShippingAddressCardLabels = {
    title: translate(DEFAULT_LABELS.title),
    recipient: translate(DEFAULT_LABELS.recipient),
    phone: translate(DEFAULT_LABELS.phone),
    ...labels,
  }
  const region = formatRegion(address)

  return (
    <View className={cn("gap-4", className)} {...rest}>
      <SectionHeader title={t.title} />
      <View className="flex-row items-start gap-3">
        <IconBox icon={MapPin} size="md" variant="surface" />
        <View className="flex-1 gap-1">
          {address.recipientName ? (
            <>
              <Text variant="caption" tone="secondary">
                {t.recipient}
              </Text>
              <Text variant="body" weight={600} tone="primary">
                {address.recipientName}
              </Text>
            </>
          ) : null}
          {address.addressLine ? (
            <Text variant="body" tone="primary">
              {address.addressLine}
            </Text>
          ) : null}
          {region ? (
            <Text variant="body" tone="secondary">
              {region}
            </Text>
          ) : null}
        </View>
      </View>

      {address.phone ? (
        <CopyableField label={t.phone} value={address.phone} mono onCopy={onCopy} copied={copied} />
      ) : null}
    </View>
  )
}
