/**
 * Kahade — <OrderCounterpartyCard>.
 *
 * Kartu SATU lawan transaksi (2026-09-30, permintaan produk): di akun
 * penjual hanya tampil profil pembeli, di akun pembeli hanya tampil profil
 * penjual. Menggantikan <OrderPartiesCard> (dua pihak) di layar detail
 * order — lebih ringkas, fokus ke siapa lawan bertransaksi.
 *
 * Hanya memakai data yang dikirim backend (tanpa kontak PII — nomor telepon
 * tidak diekspos ke lawan transaksi).
 */
import { View, type ViewProps } from "react-native"
import { CaretRight, UserCircle } from "phosphor-react-native"

import { Avatar } from "@/components/ui/avatar"
import { Icon } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { SectionHeader } from "@/components/ui/section"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { translate } from "@/lib/i18n/translate"
import { orderPartyName, type OrderParty } from "@/lib/api/orders"

export type OrderCounterpartyCardProps = Omit<ViewProps, "children"> & {
  buyer?: OrderParty | null
  seller?: OrderParty | null
  /** Peran user saat ini — menentukan pihak mana yang ditampilkan. */
  myRole: "BUYER" | "SELLER"
  onOpenProfile: (username: string) => void
  className?: string
}

export function OrderCounterpartyCard({
  buyer,
  seller,
  myRole,
  onOpenProfile,
  className,
  ...rest
}: OrderCounterpartyCardProps) {
  const isBuyer = myRole === "BUYER"
  // Satu pihak saja: pembeli melihat penjual, penjual melihat pembeli.
  const party = isBuyer ? seller : buyer
  const label = isBuyer ? translate("Penjual") : translate("Pembeli")
  const name = orderPartyName(party)
  return (
    <View className={cn("gap-4", className)} {...rest}>
      <SectionHeader title={translate("Lawan transaksi")} />
      {!party || !name ? (
        <View
          className="flex-row items-center gap-3 rounded-xl border border-border bg-surface p-4"
          accessible
          accessibilityLabel={`${label}: ${translate("Identitas belum tersedia")}`}
        >
          <View className="h-12 w-12 items-center justify-center rounded-full bg-surface">
            <Icon icon={UserCircle} size={28} />
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
      ) : (
        <PressableScale
          onPress={() => onOpenProfile(party.username)}
          accessibilityRole="button"
          accessibilityLabel={translate("Lihat profil {x}", { x: name })}
          accessibilityHint={translate("Buka profil pengguna")}
        >
          <View className="flex-row items-center gap-3 rounded-xl border border-border bg-surface p-4">
            <Avatar
              source={party.avatarUrl ? { uri: party.avatarUrl } : undefined}
              name={name}
              size="lg"
            />
            <View className="flex-1 gap-0.5">
              <Text variant="caption" tone="secondary">
                {label}
              </Text>
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
      )}
    </View>
  )
}
