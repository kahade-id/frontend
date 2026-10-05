/**
 * Screen — Buku Alamat (batch 43, item 2).
 *
 * Daftar / tambah / ubah / hapus / jadikan utama alamat pengiriman
 * (GET/POST/PATCH/DELETE /v1/addresses). Dipakai saat checkout produk FISIK
 * — resi/ongkir hanya relevan untuk barang fisik (lihat needsShippingAddress).
 *
 * Keputusan non-obvious:
 * - Label: RUMAH / KANTOR / LAINNYA (customLabel bila LAINNYA). Server yang
 *   menentukan validasi akhir; klien hanya validasi kosong.
 * - Hapus alamat utama: server menolak/menetapkan ulang sesuai kontrak —
 *   klien menampilkan pesan server apa adanya.
 * - Tamu: GuestLoginPrompt (seluruh endpoint auth-required).
 */
import { useCallback, useState } from "react"
import { View } from "react-native"
import { House, Briefcase, DotsThreeVertical, MapPin, PencilSimple, Plus, Tag, Trash } from "phosphor-react-native"

import { api, userMessage } from "@/lib/api"
import {
  addressLabelText,
  type Address,
  type AddressLabel,
  type CreateAddressDto,
} from "@/lib/api/commerce"
import { useHasSession } from "@/lib/guest-gate"
import { translate } from "@/lib/i18n/translate"
import { useApiQuery } from "@/lib/use-api-query"
import { showMutationError } from "@/lib/mutation-toast"
import { useToast } from "@/components/ui/toast"

import { ActionSheet, type ActionSheetItem } from "@/components/ui/action-sheet"
import { Badge } from "@/components/ui/badge"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { DataScreen } from "@/components/ui/data-screen"
import { Dialog } from "@/components/ui/modal"
import { Field } from "@/components/ui/field"
import { GuestLoginPrompt } from "@/components/web-guest-gate"
import { Icon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { IconButton } from "@/components/ui/icon-button"
import { Screen } from "@/components/ui/screen"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { Text } from "@/components/ui/text"

const LABEL_OPTIONS: { value: AddressLabel; label: string }[] = [
  { value: "RUMAH", label: "Rumah" },
  { value: "KANTOR", label: "Kantor" },
  { value: "LAINNYA", label: "Lainnya" },
]

const LABEL_ICONS: Record<AddressLabel, typeof House> = {
  RUMAH: House,
  KANTOR: Briefcase,
  LAINNYA: Tag,
}

type FormState = {
  label: AddressLabel
  customLabel: string
  recipientName: string
  phone: string
  addressLine: string
  city: string
  province: string
  postalCode: string
}

const EMPTY_FORM: FormState = {
  label: "RUMAH",
  customLabel: "",
  recipientName: "",
  phone: "",
  addressLine: "",
  city: "",
  province: "",
  postalCode: "",
}

function formToDto(form: FormState): CreateAddressDto {
  return {
    label: form.label,
    customLabel: form.label === "LAINNYA" && form.customLabel.trim() ? form.customLabel.trim() : undefined,
    recipientName: form.recipientName.trim(),
    phone: form.phone.trim(),
    addressLine: form.addressLine.trim(),
    city: form.city.trim(),
    province: form.province.trim() || undefined,
    postalCode: form.postalCode.trim(),
  }
}

export default function AddressesScreen() {
  const hasSession = useHasSession()
  const toast = useToast()
  const query = useApiQuery<Address[]>(
    "addresses",
    (signal) => api.commerce.listAddresses(1, 50, signal),
    hasSession,
  )
  const addresses = query.data ?? []

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<Address | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | undefined>()
  const [saving, setSaving] = useState(false)
  const [menuAddress, setMenuAddress] = useState<Address | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Address | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [defaultBusy, setDefaultBusy] = useState(false)

  const openCreate = useCallback(() => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError(undefined)
    setSheetOpen(true)
  }, [])

  const openEdit = useCallback((address: Address) => {
    setEditing(address)
    setForm({
      label: address.label,
      customLabel: address.customLabel ?? "",
      recipientName: address.recipientName,
      phone: address.phone,
      addressLine: address.addressLine,
      city: address.city,
      province: address.province ?? "",
      postalCode: address.postalCode,
    })
    setFormError(undefined)
    setMenuAddress(null)
    setSheetOpen(true)
  }, [])

  // FRM-002: error validasi langsung hilang begitu pengguna mengoreksi field.
  const patchForm = useCallback((patch: Partial<FormState>) => {
    setForm((f) => ({ ...f, ...patch }))
    setFormError(undefined)
  }, [])

  const validate = (dto: CreateAddressDto): string | null => {
    if (!dto.recipientName) return translate("Nama penerima wajib diisi.")
    if (!dto.phone) return translate("Nomor HP wajib diisi.")
    if (!dto.addressLine) return translate("Alamat wajib diisi.")
    if (!dto.city) return translate("Kota wajib diisi.")
    if (!dto.postalCode) return translate("Kode pos wajib diisi.")
    return null
  }

  const handleSave = useCallback(async () => {
    if (saving) return
    const dto = formToDto(form)
    const error = validate(dto)
    if (error) {
      setFormError(error)
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await api.commerce.updateAddress(editing.id, dto)
        toast.show({ title: translate("Alamat diperbarui"), tone: "success" })
      } else {
        await api.commerce.createAddress(dto)
        toast.show({ title: translate("Alamat ditambahkan"), tone: "success" })
      }
      setSheetOpen(false)
      setEditing(null)
      await query.refresh()
    } catch (err) {
      setFormError(userMessage(err))
    } finally {
      setSaving(false)
    }
  }, [saving, form, editing, toast, query])

  const handleDelete = useCallback(async () => {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    try {
      await api.commerce.deleteAddress(deleteTarget.id)
      toast.show({ title: translate("Alamat dihapus"), tone: "success" })
      setDeleteTarget(null)
      await query.refresh()
    } catch (err) {
      // Klasifikasi toast: error mutasi non-blokir via showMutationError.
      if (
        showMutationError(toast.show, {
          failTitle: translate("Gagal menghapus alamat"),
          uncertainHint: translate("Aksi mungkin sudah diproses — memuat ulang…"),
          err: err,
          scope: "addresses:menghapus-alamat",
        })
      ) {
        void query.refresh()
      }
    } finally {
      setDeleting(false)
    }
  }, [deleteTarget, deleting, toast, query])

  const handleSetDefault = useCallback(
    async (address: Address) => {
      if (defaultBusy || address.isDefault) return
      setDefaultBusy(true)
      try {
        await api.commerce.setDefaultAddress(address.id)
        toast.show({ title: translate("Alamat utama diperbarui"), tone: "success" })
        setMenuAddress(null)
        await query.refresh()
      } catch (err) {
        // Klasifikasi toast: error mutasi non-blokir via showMutationError.
        if (
          showMutationError(toast.show, {
            failTitle: translate("Gagal mengubah alamat utama"),
            uncertainHint: translate("Aksi mungkin sudah diproses — memuat ulang…"),
            err: err,
            scope: "addresses:mengubah-alamat-utama",
          })
        ) {
          void query.refresh()
        }
      } finally {
        setDefaultBusy(false)
      }
    },
    [defaultBusy, toast, query],
  )

  const menuActions: ActionSheetItem[] = menuAddress
    ? [
        ...(!menuAddress.isDefault
          ? [
              {
                key: "default",
                label: translate("Jadikan alamat utama"),
                icon: MapPin,
                onPress: () => void handleSetDefault(menuAddress),
              } as ActionSheetItem,
            ]
          : []),
        {
          key: "edit",
          label: translate("Ubah"),
          icon: PencilSimple,
          onPress: () => openEdit(menuAddress),
        },
        {
          key: "delete",
          label: translate("Hapus"),
          icon: Trash,
          destructive: true,
          onPress: () => {
            setMenuAddress(null)
            setDeleteTarget(menuAddress)
          },
        },
      ]
    : []

  if (!hasSession) {
    return (
      <Screen>
        <GuestLoginPrompt next="/addresses" />
      </Screen>
    )
  }

  // FRM-003: pesan validasi pertama ditampilkan sebagai hint di atas tombol
  // supaya jelas field mana yang masih kurang (tombol nonaktif tak lagi bisu).
  const saveError = validate(formToDto(form))
  const hasTypedAny = [form.recipientName, form.phone, form.addressLine, form.city, form.postalCode].some(
    (v) => v.trim().length > 0,
  )

  return (
    <DataScreen
      title={translate("Buku alamat")}
      header={{
        right: (
          <IconButton
            icon={Plus}
            accessibilityLabel={translate("Tambah alamat")}
            onPress={openCreate}
          />
        ),
      }}
      state={query}
      loadingMessage={translate("Memuat alamat")}
      errorTitle={translate("Gagal memuat alamat")}
      empty={
        addresses.length === 0
          ? {
              icon: MapPin,
              title: translate("Belum ada alamat"),
              description: translate("Tambahkan alamat pengiriman untuk checkout barang fisik."),
              action: (
                <Button fullWidth={false} onPress={openCreate}>
                  {translate("Tambah alamat")}
                </Button>
              ),
            }
          : undefined
      }
    >
      <View className="gap-3">
        {addresses.map((address) => (
          <Card key={address.id} variant="elevated" className="gap-2 p-4">
            <View className="flex-row items-center gap-2">
              <Icon icon={LABEL_ICONS[address.label] ?? Tag} size="sm" tone="default" />
              <Text variant="body" weight={600} className="flex-1" numberOfLines={1}>
                {addressLabelText(address)}
              </Text>
              {address.isDefault ? <Badge tone="success">{translate("Utama")}</Badge> : null}
              <IconButton
                icon={DotsThreeVertical}
                size="sm"
                variant="ghost"
                accessibilityLabel={translate("Opsi alamat {x}", { x: addressLabelText(address) })}
                onPress={() => setMenuAddress(address)}
              />
            </View>
            <View className="gap-0.5">
              <Text variant="body" weight={500}>
                {address.recipientName} · {address.phone}
              </Text>
              <Text variant="caption" tone="secondary">
                {address.addressLine}
              </Text>
              <Text variant="caption" tone="secondary">
                {[address.city, address.province, address.postalCode].filter(Boolean).join(", ")}
              </Text>
            </View>
            {!address.isDefault ? (
              <Button
                variant="ghost"
                size="sm"
                onPress={() => void handleSetDefault(address)}
                disabled={defaultBusy}
              >
                {translate("Jadikan utama")}
              </Button>
            ) : null}
          </Card>
        ))}
      </View>

      <ActionSheet
        visible={menuAddress != null}
        onRequestClose={() => setMenuAddress(null)}
        actions={menuActions}
      />

      <Dialog
        title={translate("Hapus alamat ini?")}
        description={translate("Alamat \"{x}\" akan dihapus permanen.", {
          x: deleteTarget ? addressLabelText(deleteTarget) : "",
        })}
        visible={deleteTarget != null}
        destructive
        loading={deleting}
        confirmLabel={translate("Hapus")}
        cancelLabel={translate("Batal")}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
        onRequestClose={() => setDeleteTarget(null)}
      />

      <BottomSheet
        visible={sheetOpen}
        onRequestClose={() => setSheetOpen(false)}
        title={editing ? translate("Ubah alamat") : translate("Tambah alamat")}
        // UX-SPA-006: sheet berisi 7 input + CTA — keyboard menutupi field
        // bawah & CTA di iOS tanpa ini (pola FRM-017).
        avoidKeyboard
        footer={
          <View className="gap-2">
            {/* FRM-003: beri tahu field wajib mana yang masih kurang. */}
            {saveError && hasTypedAny ? (
              <Text variant="caption" tone="secondary" className="text-center">
                {saveError}
              </Text>
            ) : null}
            <Button
              fullWidth
              loading={saving}
              // FRM-003: nonaktif sampai semua field wajib terisi (validasi tetap jalan saat submit).
              disabled={saveError !== null}
              onPress={() => void handleSave()}
            >
              {editing ? translate("Simpan") : translate("Tambah alamat")}
            </Button>
          </View>
        }
      >
        <View className="gap-4">
          <Field label={translate("Label")}>
            <SegmentedControl<AddressLabel>
              items={LABEL_OPTIONS}
              value={form.label}
              onChange={(label) => patchForm({ label })}
              accessibilityLabel={translate("Label alamat")}
            />
          </Field>
          {form.label === "LAINNYA" ? (
            <Input
              label={translate("Nama label")}
              value={form.customLabel}
              onChangeText={(text) => patchForm({ customLabel: text })}
              placeholder={translate("cth: Kos, Rumah orang tua")}
              maxLength={30}
            />
          ) : null}
          <Input
            label={translate("Nama penerima")}
            value={form.recipientName}
            onChangeText={(text) => patchForm({ recipientName: text })}
            maxLength={100}
            autoCapitalize="words"
          />
          <Input
            label={translate("Nomor HP")}
            value={form.phone}
            onChangeText={(text) => patchForm({ phone: text.replace(/[^\d+]/g, "") })}
            keyboardType="phone-pad"
            maxLength={16}
          />
          <Input
            label={translate("Alamat")}
            value={form.addressLine}
            onChangeText={(text) => patchForm({ addressLine: text })}
            placeholder={translate("Jalan, nomor rumah/gedung, patokan")}
            maxLength={255}
            multiline
          />
          <View className="flex-row gap-3">
            <Input
              label={translate("Kota")}
              value={form.city}
              onChangeText={(text) => patchForm({ city: text })}
              maxLength={100}
              containerClassName="flex-1"
            />
            <Input
              label={translate("Kode pos")}
              value={form.postalCode}
              onChangeText={(text) => patchForm({ postalCode: text.replace(/\D/g, "") })}
              keyboardType="number-pad"
              maxLength={10}
              containerClassName="flex-1"
            />
          </View>
          <Input
            label={translate("Provinsi (opsional)")}
            value={form.province}
            onChangeText={(text) => patchForm({ province: text })}
            maxLength={100}
          />
          {formError ? (
            <Text variant="caption" tone="danger">
              {formError}
            </Text>
          ) : null}
        </View>
      </BottomSheet>
    </DataScreen>
  )
}
