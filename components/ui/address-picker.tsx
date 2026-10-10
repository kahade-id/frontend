/**
 * AddressPicker — pilih alamat pengiriman dari buku alamat (batch 43, item 2).
 *
 * Dipakai di checkout (pembeli), accept link, dan terima pesanan untuk produk
 * FISIK (resi/ongkir hanya relevan di sana). Praseleksi: alamat utama.
 * Pilihan disimpan di state layar pemanggil; `shippingAddressId` dikirim ke
 * backend (createOrder / acceptLink / confirm).
 *
 * Audit alamat & kurir (2026-10-10):
 *   - C01: `load` dulu menangkap `selected` dari render pertama (closure
 *     basi, `useCallback([])`) → setiap kali sheet dibuka pilihan user
 *     DITIMPA alamat utama. Kini `selected`/`onSelect` dibaca lewat ref.
 *   - C02: pilihan direkonsiliasi dengan daftar segar — alamat yang diubah
 *     di buku alamat diperbarui, yang dihapus diganti alamat utama (user
 *     diberi tahu), bukan dikirim sebagai id basi (400 dari server).
 *   - C03: validasi lokal (kode pos 5 digit, HP) sebelum POST.
 *   - C04/C05: pesan error spesifik (`userMessage`) + indikator memuat.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { View } from "react-native"
import { CaretRight, MapPin, Plus } from "phosphor-react-native"
import { router } from "expo-router"

import { api, userMessage } from "@/lib/api"
import { addressLabelText, type Address, type CreateAddressDto } from "@/lib/api/commerce"
import {
  ADDRESS_LIMITS,
  sanitizePhoneInput,
  sanitizePostalInput,
  validateAddressForm,
} from "@/lib/address-validation"
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

function sameAddress(a: Address, b: Address): boolean {
  return (
    a.label === b.label &&
    a.customLabel === b.customLabel &&
    a.recipientName === b.recipientName &&
    a.phone === b.phone &&
    a.addressLine === b.addressLine &&
    a.city === b.city &&
    a.province === b.province &&
    a.postalCode === b.postalCode &&
    a.isDefault === b.isDefault
  )
}

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
  const [loadError, setLoadError] = useState<string | null>(null)

  // C01: selalu baca nilai TERBARU, bukan tangkapan render pertama.
  const selectedRef = useRef(selected)
  selectedRef.current = selected
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const list = await api.commerce.listAddresses(1, 50)
      setAddresses(list)
      const current = selectedRef.current
      const def = list.find((a) => a.isDefault) ?? list[0] ?? null
      if (!current) {
        // Praseleksi alamat utama bila belum ada pilihan.
        if (def) onSelectRef.current(def)
        return
      }
      // C02: rekonsiliasi pilihan dengan daftar segar.
      const fresh = list.find((a) => a.id === current.id)
      if (!fresh) {
        onSelectRef.current(def)
        toast.show({
          title: translate("Alamat yang dipilih sudah dihapus"),
          description: def ? translate("Diganti dengan alamat utama Anda.") : translate("Pilih alamat lain."),
          tone: "warning",
        })
      } else if (!sameAddress(fresh, current)) {
        onSelectRef.current(fresh)
      }
    } catch (err) {
      // C04: pesan spesifik (offline / lambat / server), bukan "gagal" generik.
      const message = userMessage(err)
      setLoadError(message)
      toast.show({ title: translate("Gagal memuat alamat"), description: message, tone: "danger" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  /**
   * FE-123: form tambah alamat inline — pengguna yang bukunya kosong bisa
   * menambah alamat tanpa keluar dari alur checkout. B3O-01 (§9.9): sheet
   * bawah disembunyikan selama sheet ini terbuka (visible di-gate);
   * daftar di-refresh otomatis dan alamat baru langsung terpilih.
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

  // FRM-003 + C03: tombol nonaktif sampai semua field wajib terisi & valid;
  // pesan validasi pertama tampil sebagai hint begitu user mulai mengetik.
  const addValidation = validateAddressForm({
    label: "RUMAH",
    recipientName: addName,
    phone: addPhone,
    addressLine: addLine,
    city: addCity,
    postalCode: addPostal,
  })
  const addValid = addValidation === null
  const addTyped = [addName, addPhone, addLine, addCity, addPostal].some((v) => v.trim().length > 0)

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
      // Alamat baru langsung terpilih SEBELUM daftar dimuat ulang — rekonsiliasi
      // di `load` akan menemukannya di daftar segar.
      if (created) onSelectRef.current(created)
      await load()
      setAddOpen(false)
      resetAddForm()
      toast.show({ title: translate("Alamat ditambahkan"), tone: "success" })
    } catch (err) {
      setAddError(userMessage(err))
    } finally {
      setSaving(false)
    }
  }

  const atLimit = addresses.length >= ADDRESS_LIMITS.maxAddresses

  return (
    <View className="gap-2">
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={translate("Pilih alamat pengiriman")}
        accessibilityState={{ disabled: !!disabled }}
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
        // B3O-01 (§9.9): sheet bawah disembunyikan selama sheet "Tambah
        // alamat" terbuka — tidak ada dua BottomSheet co-visible.
        visible={sheetOpen && !addOpen}
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
          {/* C05: jangan kosong tanpa penjelasan saat memuat / gagal. */}
          {addresses.length === 0 && loading ? (
            <Text variant="caption" tone="secondary">
              {translate("Memuat alamat…")}
            </Text>
          ) : null}
          {addresses.length === 0 && !loading && loadError ? (
            <View className="gap-3 py-1">
              <Text variant="caption" tone="danger">
                {loadError}
              </Text>
              <Button variant="secondary" fullWidth onPress={() => void load()}>
                {translate("Coba lagi")}
              </Button>
            </View>
          ) : null}
          {addresses.length === 0 && !loading && !loadError ? (
            <View className="gap-3 py-1">
              <Text variant="caption" tone="secondary">
                {translate("Belum ada alamat tersimpan.")}
              </Text>
              {/* FE-123: CTA inline — tambah alamat tanpa keluar dari alur. */}
              <Button
                variant="secondary"
                fullWidth
                leftIcon={Plus}
                disabled={atLimit}
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

      {/* FE-123: form tambah alamat di dalam alur picker — sheet bawah
          disembunyikan selama sheet ini terbuka (§9.9, B3O-01). */}
      <BottomSheet
        visible={addOpen}
        onRequestClose={() => setAddOpen(false)}
        avoidKeyboard
        title={translate("Tambah alamat")}
        footer={
          <View className="gap-2">
            {addValidation && addTyped ? (
              <Text variant="caption" tone="secondary" className="text-center">
                {addValidation}
              </Text>
            ) : null}
            <Button fullWidth loading={saving} disabled={!addValid} onPress={() => void handleAdd()}>
              {translate("Tambah alamat")}
            </Button>
          </View>
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
            maxLength={ADDRESS_LIMITS.recipientName}
            autoCapitalize="words"
          />
          <Input
            label={translate("Nomor HP")}
            value={addPhone}
            onChangeText={(t) => {
              setAddPhone(sanitizePhoneInput(t))
              setAddError(undefined)
            }}
            keyboardType="phone-pad"
            maxLength={ADDRESS_LIMITS.phone}
          />
          <Input
            label={translate("Alamat")}
            value={addLine}
            onChangeText={(t) => {
              setAddLine(t)
              setAddError(undefined)
            }}
            placeholder={translate("Jalan, nomor rumah/gedung, patokan")}
            maxLength={ADDRESS_LIMITS.addressLine}
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
              maxLength={ADDRESS_LIMITS.city}
              containerClassName="flex-1"
            />
            <Input
              label={translate("Kode pos")}
              value={addPostal}
              onChangeText={(t) => {
                setAddPostal(sanitizePostalInput(t))
                setAddError(undefined)
              }}
              keyboardType="number-pad"
              maxLength={ADDRESS_LIMITS.postalCode}
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
            maxLength={ADDRESS_LIMITS.province}
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
