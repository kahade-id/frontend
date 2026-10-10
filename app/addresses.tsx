/**
 * Screen — Buku Alamat (batch 43, item 2).
 *
 * Daftar / tambah / ubah / hapus / jadikan utama alamat pengiriman
 * (GET/POST/PATCH/DELETE /v1/addresses). Dipakai saat checkout produk FISIK
 * — resi/ongkir hanya relevan untuk barang fisik (lihat needsShippingAddress).
 *
 * Keputusan non-obvious:
 * - Label: RUMAH / KANTOR / LAINNYA (customLabel bila LAINNYA). Server yang
 *   menentukan validasi akhir; klien menyalin aturannya
 *   (`lib/address-validation.ts`) agar kesalahan ketahuan sebelum POST.
 * - Hapus alamat utama: server menolak/menetapkan ulang sesuai kontrak —
 *   klien menampilkan pesan server apa adanya.
 * - Tamu: GuestLoginPrompt (seluruh endpoint auth-required).
 */
import { useCallback, useMemo, useState } from "react"
import { View } from "react-native"
import { House, Briefcase, DotsThreeVertical, MapPin, PencilSimple, Plus, Tag, Trash } from "phosphor-react-native"

import { api, userMessage } from "@/lib/api"
import {
  addressLabelText,
  type Address,
  type AddressLabel,
  type CreateAddressDto,
} from "@/lib/api/commerce"
import {
  ADDRESS_LIMITS,
  sanitizePhoneInput,
  sanitizePostalInput,
  validateAddressForm,
} from "@/lib/address-validation"
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

/**
 * C15 (audit alamat & kurir 2026-10-10): saat UBAH, `province` dikirim
 * sebagai string kosong (bukan `undefined`) — PATCH backend hanya menyentuh
 * field yang ADA di body, jadi `undefined` berarti "biarkan" dan provinsi
 * lama tidak pernah bisa dikosongkan. Saat TAMBAH tetap `undefined` agar
 * body tidak memuat field kosong.
 */
function formToDto(form: FormState, mode: "create" | "update"): CreateAddressDto {
  const province = form.province.trim()
  return {
    label: form.label,
    customLabel: form.label === "LAINNYA" && form.customLabel.trim() ? form.customLabel.trim() : undefined,
    recipientName: form.recipientName.trim(),
    phone: form.phone.trim(),
    addressLine: form.addressLine.trim(),
    city: form.city.trim(),
    province: province || (mode === "update" ? "" : undefined),
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
    // C12 (audit alamat & kurir 2026-10-10): alamat yang ditambah dari form
    // inline checkout harus tampak saat kembali ke layar ini.
    { refreshOnFocus: true, refreshOnFocusStaleMs: 10_000 },
  )
  const addresses = query.data ?? []
  // C11: backend menolak alamat ke-21 — beri tahu sebelum form dibuka.
  const atLimit = addresses.length >= ADDRESS_LIMITS.maxAddresses
  // C13: label segmen lewat translate (di dalam komponen agar ikut bahasa aktif).
  const labelOptions = useMemo(
    () => LABEL_OPTIONS.map((option) => ({ ...option, label: translate(option.label) })),
    [],
  )

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
    if (atLimit) {
      toast.show({
        title: translate("Buku alamat penuh"),
        description: translate("Maksimal {x} alamat. Hapus salah satu untuk menambah yang baru.", {
          x: ADDRESS_LIMITS.maxAddresses,
        }),
        tone: "warning",
      })
      return
    }
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError(undefined)
    setSheetOpen(true)
  }, [atLimit, toast])

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

  // C06 (audit alamat & kurir 2026-10-10): aturan = validator backend
  // (kode pos 5 digit, HP 8–20 karakter, label LAINNYA wajib nama) — dulu baru
  // ketahuan lewat 400 dari server.
  const validate = (f: FormState): string | null =>
    validateAddressForm({
      label: f.label,
      customLabel: f.customLabel,
      recipientName: f.recipientName,
      phone: f.phone,
      addressLine: f.addressLine,
      city: f.city,
      postalCode: f.postalCode,
    })

  const handleSave = useCallback(async () => {
    if (saving) return
    const error = validate(form)
    if (error) {
      setFormError(error)
      return
    }
    const dto = formToDto(form, editing ? "update" : "create")
    setSaving(true)
    try {
      if (editing) {
        const updated = await api.commerce.updateAddress(editing.id, dto)
        toast.show({ title: translate("Alamat diperbarui"), tone: "success" })
        // C09: pakai hasil server langsung — daftar tidak menunggu refetch.
        if (updated) query.setData((prev) => (prev ? prev.map((a) => (a.id === updated.id ? updated : a)) : prev))
        else void query.refresh()
      } else {
        const created = await api.commerce.createAddress(dto)
        toast.show({ title: translate("Alamat ditambahkan"), tone: "success" })
        if (created) {
          query.setData((prev) =>
            prev ? (created.isDefault ? [created, ...prev.map((a) => ({ ...a, isDefault: false }))] : [...prev, created]) : [created],
          )
        } else void query.refresh()
      }
      setSheetOpen(false)
      setEditing(null)
    } catch (err) {
      setFormError(userMessage(err))
    } finally {
      setSaving(false)
    }
  }, [saving, form, editing, toast, query])

  const handleDelete = useCallback(async () => {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    // C08: optimistis — kartu hilang seketika, dikembalikan bila server menolak.
    const snapshot = query.data
    query.setData((prev) => (prev ? prev.filter((a) => a.id !== deleteTarget.id) : prev))
    setDeleteTarget(null)
    try {
      await api.commerce.deleteAddress(deleteTarget.id)
      toast.show({ title: translate("Alamat dihapus"), tone: "success" })
      // Server mempromosikan alamat utama pengganti — sinkronkan diam-diam.
      if (deleteTarget.isDefault) void query.refresh()
    } catch (err) {
      query.setData(snapshot ?? null)
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
      setMenuAddress(null)
      // C08: optimistis — badge "Utama" pindah seketika, rollback bila gagal.
      const snapshot = query.data
      query.setData((prev) => {
        if (!prev) return prev
        const next = prev.map((a) => ({ ...a, isDefault: a.id === address.id }))
        // Server mengurutkan default paling atas — tiru agar tidak melompat saat refresh.
        return [...next.filter((a) => a.isDefault), ...next.filter((a) => !a.isDefault)]
      })
      try {
        await api.commerce.setDefaultAddress(address.id)
        toast.show({ title: translate("Alamat utama diperbarui"), tone: "success" })
      } catch (err) {
        query.setData(snapshot ?? null)
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
  const saveError = validate(form)
  const hasTypedAny = [form.recipientName, form.phone, form.addressLine, form.city, form.postalCode, form.customLabel].some(
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
        // C10: backend soft-delete; order lama tetap memegang snapshot alamatnya.
        description={translate("Alamat \"{x}\" akan dihapus dari buku alamat. Pesanan yang sudah dibuat tidak berubah.", {
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
              items={labelOptions}
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
              // C07: batas sama dengan backend (40), bukan 30.
              maxLength={ADDRESS_LIMITS.customLabel}
            />
          ) : null}
          <Input
            label={translate("Nama penerima")}
            value={form.recipientName}
            onChangeText={(text) => patchForm({ recipientName: text })}
            maxLength={ADDRESS_LIMITS.recipientName}
            autoCapitalize="words"
          />
          <Input
            label={translate("Nomor HP")}
            value={form.phone}
            onChangeText={(text) => patchForm({ phone: sanitizePhoneInput(text) })}
            keyboardType="phone-pad"
            maxLength={ADDRESS_LIMITS.phone}
          />
          <Input
            label={translate("Alamat")}
            value={form.addressLine}
            onChangeText={(text) => patchForm({ addressLine: text })}
            placeholder={translate("Jalan, nomor rumah/gedung, patokan")}
            maxLength={ADDRESS_LIMITS.addressLine}
            multiline
          />
          <View className="flex-row gap-3">
            <Input
              label={translate("Kota")}
              value={form.city}
              onChangeText={(text) => patchForm({ city: text })}
              maxLength={ADDRESS_LIMITS.city}
              containerClassName="flex-1"
            />
            <Input
              label={translate("Kode pos")}
              value={form.postalCode}
              onChangeText={(text) => patchForm({ postalCode: sanitizePostalInput(text) })}
              keyboardType="number-pad"
              // C07: kode pos Indonesia tepat 5 digit (validator backend).
              maxLength={ADDRESS_LIMITS.postalCode}
              containerClassName="flex-1"
            />
          </View>
          <Input
            label={translate("Provinsi (opsional)")}
            value={form.province}
            onChangeText={(text) => patchForm({ province: text })}
            maxLength={ADDRESS_LIMITS.province}
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
