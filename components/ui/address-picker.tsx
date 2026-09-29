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

import { api, userMessage } from "@/lib/api"
import { addressLabelText, type Address, type CreateAddressDto } from "@/lib/api/commerce"
import { translate } from "@/lib/i18n/translate"
import { ROUTES } from "@/lib/routes"
import { useToast } from "@/components/ui/toast"

import { Badge } from "@/components/ui/badge"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
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

  /**
   * FE-123: form tambah alamat inline (sheet bertumpuk) — pengguna yang
   * bukunya kosong bisa menambah alamat tanpa keluar dari alur checkout.
   * Sheet bawah TIDAK ditutup (nested Portal), daftar di-refresh otomatis
   * dan alamat baru langsung terpilih.
   */
  const [addOpen, setAddOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [addError, setAddError] = useState<string | undefined>()
  const [addName, setAddName] = useState("")
  const [addPhone, setAddPhone] = useState("")
  const [addLine, setAddLine] = useState("")
  const [addCity, setAddCity] = useState("")
  const [addProvince, setAddProvince] = useState("")
  const [addPostal, setAddPostal] = useState("")

  const resetAddForm = () => {
    setAddName("")
    setAddPhone("")
    setAddLine("")
    setAddCity("")
    setAddProvince("")
    setAddPostal("")
    setAddError(undefined)
  }

  // FRM-003: tombol nonaktif sampai semua field wajib terisi.
  const addValid =
    addName.trim() !== "" &&
    addPhone.trim() !== "" &&
    addLine.trim() !== "" &&
    addCity.trim() !== "" &&
    addPostal.trim() !== ""

  const handleAdd = async () => {
    if (saving || !addValid) return
    const dto: CreateAddressDto = {
      label: "RUMAH",
      recipientName: addName.trim(),
      phone: addPhone.trim(),
      addressLine: addLine.trim(),
      city: addCity.trim(),
      province: addProvince.trim() || undefined,
      postalCode: addPostal.trim(),
    }
    setSaving(true)
    try {
      const created = await api.commerce.createAddress(dto)
      await load()
      if (created) onSelect(created)
      setAddOpen(false)
      resetAddForm()
      toast.show({ title: translate("Alamat ditambahkan"), tone: "success" })
    } catch (err) {
      setAddError(userMessage(err))
    } finally {
      setSaving(false)
    }
  }

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
                className={`gap-1 rounded-md border p-3 ${active ? "border-primary bg-primary/10" : "border-border"}`}
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
            <View className="gap-3 py-1">
              <Text variant="caption" tone="secondary">
                {translate("Belum ada alamat tersimpan.")}
              </Text>
              {/* FE-123: CTA inline — tambah alamat tanpa keluar dari alur. */}
              <Button
                variant="secondary"
                fullWidth
                leftIcon={Plus}
                onPress={() => {
                  resetAddForm()
                  setAddOpen(true)
                }}
              >
                {translate("Tambah alamat")}
              </Button>
            </View>
          ) : null}
        </View>
      </BottomSheet>

      {/* FE-123: sheet bertumpuk — form tambah alamat di dalam alur picker. */}
      <BottomSheet
        visible={addOpen}
        onRequestClose={() => setAddOpen(false)}
        avoidKeyboard
        title={translate("Tambah alamat")}
        footer={
          <Button fullWidth loading={saving} disabled={!addValid} onPress={() => void handleAdd()}>
            {translate("Tambah alamat")}
          </Button>
        }
      >
        <View className="gap-4">
          <Input
            label={translate("Nama penerima")}
            value={addName}
            onChangeText={(t) => {
              setAddName(t)
              setAddError(undefined)
            }}
            maxLength={100}
            autoCapitalize="words"
          />
          <Input
            label={translate("Nomor HP")}
            value={addPhone}
            onChangeText={(t) => {
              setAddPhone(t.replace(/[^\d+]/g, ""))
              setAddError(undefined)
            }}
            keyboardType="phone-pad"
            maxLength={16}
          />
          <Input
            label={translate("Alamat")}
            value={addLine}
            onChangeText={(t) => {
              setAddLine(t)
              setAddError(undefined)
            }}
            placeholder={translate("Jalan, nomor rumah/gedung, patokan")}
            maxLength={255}
            multiline
          />
          <View className="flex-row gap-3">
            <Input
              label={translate("Kota")}
              value={addCity}
              onChangeText={(t) => {
                setAddCity(t)
                setAddError(undefined)
              }}
              maxLength={100}
              containerClassName="flex-1"
            />
            <Input
              label={translate("Kode pos")}
              value={addPostal}
              onChangeText={(t) => {
                setAddPostal(t.replace(/\D/g, ""))
                setAddError(undefined)
              }}
              keyboardType="number-pad"
              maxLength={10}
              containerClassName="flex-1"
            />
          </View>
          <Input
            label={translate("Provinsi (opsional)")}
            value={addProvince}
            onChangeText={(t) => {
              setAddProvince(t)
              setAddError(undefined)
            }}
            maxLength={100}
          />
          {addError ? (
            <Text variant="caption" tone="danger">
              {addError}
            </Text>
          ) : null}
        </View>
      </BottomSheet>
    </View>
  )
}
