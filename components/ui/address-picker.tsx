/**
 * AddressPicker — pilih alamat pengiriman dari buku alamat (batch 43, item 2).
 *
 * Dipakai di checkout untuk produk FISIK (resi/ongkir hanya relevan di sana).
 * Praseleksi: alamat utama. Pilihan disimpan di state layar pemanggil.
 *
 * CATATAN KONTRAK: CreateOrderDto backend (mega/be-commerce d420cf7) belum
 * memiliki field alamat — pilihan saat ini tampil di ringkasan checkout dan
 * siap dikirim begitu backend menambahkan field-nya (satu baris wiring).
 * Klien TIDAK mengarang field baru ke DTO (risiko 400 forbidNonWhitelisted).
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { CaretRight, MapPin, Plus } from "phosphor-react-native"
import { router } from "expo-router"

import { api } from "@/lib/api"
import { addressLabelText, type Address } from "@/lib/api/commerce"
import { translate } from "@/lib/i18n/translate"
import { ROUTES } from "@/lib/routes"
import { useToast } from "@/components/ui/toast"

import { Badge } from "@/components/ui/badge"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"

export function AddressPicker({
  selected,
  onSelect,
  disabled,
}: {
  selected: Address | null
  onSelect: (address: Address | null) => void
  disabled?: boolean
}) {
  const toast = useToast()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [addresses, setAddresses] = useState<Address[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await api.commerce.listAddresses(1, 50)
      setAddresses(list)
      // Praseleksi alamat utama bila belum ada pilihan.
      if (!selected) {
        const def = list.find((a) => a.isDefault) ?? list[0] ?? null
        if (def) onSelect(def)
      }
    } catch {
      toast.show({ title: translate("Gagal memuat alamat"), tone: "danger" })
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <View className="gap-2">
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={translate("Pilih alamat pengiriman")}
        disabled={disabled}
        onPress={() => {
          void load()
          setSheetOpen(true)
        }}
        className="flex-row items-center gap-3 rounded-md border border-border-control bg-background px-4 py-3"
      >
        <Icon icon={MapPin} size="sm" tone="default" />
        <View className="flex-1 gap-0.5">
          {selected ? (
            <>
              <View className="flex-row items-center gap-2">
                <Text variant="body" weight={600} numberOfLines={1} className="flex-1">
                  {addressLabelText(selected)}
                </Text>
                {selected.isDefault ? (
                  <Badge tone="success">{translate("Utama")}</Badge>
                ) : null}
              </View>
              <Text variant="caption" tone="secondary" numberOfLines={2}>
                {selected.recipientName} · {selected.addressLine}, {selected.city} {selected.postalCode}
              </Text>
            </>
          ) : (
            <Text variant="body" tone="tertiary">
              {loading ? translate("Memuat…") : translate("Pilih alamat pengiriman")}
            </Text>
          )}
        </View>
        <Icon icon={CaretRight} size="sm" tone="default" />
      </PressableScale>

      <BottomSheet
        visible={sheetOpen}
        onRequestClose={() => setSheetOpen(false)}
        title={translate("Alamat pengiriman")}
        footer={
          <Button
            variant="secondary"
            fullWidth
            leftIcon={Plus}
            onPress={() => {
              setSheetOpen(false)
              router.push(ROUTES.addresses)
            }}
          >
            {translate("Kelola buku alamat")}
          </Button>
        }
      >
        <View className="gap-2">
          {addresses.map((address) => {
            const active = selected?.id === address.id
            return (
              <PressableScale
                key={address.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  onSelect(address)
                  setSheetOpen(false)
                }}
                className={`gap-1 rounded-md border p-3 ${active ? "border-primary bg-primary-soft" : "border-border"}`}
              >
                <View className="flex-row items-center gap-2">
                  <Text variant="body" weight={600} className="flex-1" numberOfLines={1}>
                    {addressLabelText(address)}
                  </Text>
                  {address.isDefault ? <Badge tone="success">{translate("Utama")}</Badge> : null}
                </View>
                <Text variant="caption" tone="secondary" numberOfLines={2}>
                  {address.recipientName} · {address.phone}
                </Text>
                <Text variant="caption" tone="secondary" numberOfLines={2}>
                  {address.addressLine}, {address.city} {address.postalCode}
                </Text>
              </PressableScale>
            )
          })}
          {addresses.length === 0 && !loading ? (
            <Text variant="caption" tone="secondary">
              {translate("Belum ada alamat — kelola buku alamat untuk menambah.")}
            </Text>
          ) : null}
        </View>
      </BottomSheet>
    </View>
  )
}
