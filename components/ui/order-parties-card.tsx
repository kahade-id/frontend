/**
 * Kahade — <OrderPartiesCard>.
 *
 * Kartu pihak transaksi: Pembeli dan Penjual — avatar, nama, @username,
 * penanda "Anda", dan tautan ke profil. Hanya memakai data yang dikirim
 * backend (tanpa kontak PII — nomor telepon tidak diekspos ke lawan
 * transaksi).
 */
import { View, type ViewProps } from "react-native"
import { CaretRight, UserCircle } from "phosphor-react-native"

import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Icon } from "@/components/ui/icon"
import { Divider } from "@/components/ui/divider"
import { PressableScale } from "@/components/ui/pressable-scale"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { translate } from "@/lib/i18n/translate"
import { orderPartyName, type OrderParty } from "@/lib/api/orders"

export type OrderPartiesCardProps = Omit<ViewProps, "children"> & {
  buyer?: OrderParty | null
  seller?: OrderParty | null
  /** Peran user saat ini — untuk penanda "Anda". */
  myRole?: "BUYER" | "SELLER"
  onOpenProfile: (username: string) => void
  className?: string
}

function PartyRow({
  label,
  party,
  isMe,
  onOpenProfile,
}: {
  label: string
  party?: OrderParty | null
  isMe: boolean
  onOpenProfile: (username: string) => void
}) {
  const name = orderPartyName(party)
  if (!party || !name) {
    return (
      <View className="flex-row items-center gap-3" accessible accessibilityLabel={`${label}: ${translate("Identitas belum tersedia")}`}>
        <View className="h-11 w-11 items-center justify-center rounded-full bg-surface">
          <Icon icon={UserCircle} size={24} />
        </View>
        <View className="flex-1 gap-0.5">
          <Text variant="caption" tone="secondary">
            {label}
          </Text>
          <Text variant="body" tone="tertiary">
            {translate("Identitas belum tersedia")}
          </Text>
        </View>
      </View>
    )
  }
  return (
    <PressableScale
      onPress={() => onOpenProfile(party.username)}
      accessibilityRole="button"
      accessibilityLabel={translate("Lihat profil {x}", { x: name })}
      accessibilityHint={translate("Buka profil pengguna")}
    >
      <View className="flex-row items-center gap-3">
        <Avatar source={party.avatarUrl ? { uri: party.avatarUrl } : undefined} name={name} size="md" />
        <View className="flex-1 gap-0.5">
          <View className="flex-row items-center gap-2">
            <Text variant="caption" tone="secondary">
              {label}
            </Text>
            {isMe ? (
              <Badge tone="info">{translate("Anda")}</Badge>
            ) : null}
          </View>
          <Text variant="body" weight={700} numberOfLines={1}>
            {name}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            @{party.username}
          </Text>
        </View>
        <Icon icon={CaretRight} size={18} />
      </View>
    </PressableScale>
  )
}

export function OrderPartiesCard({
  buyer,
  seller,
  myRole,
  onOpenProfile,
  className,
  ...rest
}: OrderPartiesCardProps) {
  // Iterasi de-card 2026-09-27: baris kompak dengan divider — bukan kartu.
  return (
    <View className={cn("gap-4", className)} {...rest}>
      <SectionHeader title={translate("Pihak transaksi")} />
      <PartyRow
        label={translate("Pembeli")}
        party={buyer}
        isMe={myRole === "BUYER"}
        onOpenProfile={onOpenProfile}
      />
      <Divider />
      <PartyRow
        label={translate("Penjual")}
        party={seller}
        isMe={myRole === "SELLER"}
        onOpenProfile={onOpenProfile}
      />
    </View>
  )
}
