/**
 * Kahade — validasi alamat di sisi klien (audit alamat & kurir, 2026-10-10).
 *
 * Satu sumber aturan untuk form buku alamat (`app/addresses.tsx`) dan form
 * tambah-alamat inline di checkout (`components/ui/address-picker.tsx`).
 * Aturannya MENYALIN validator backend (`CreateAddressDto`):
 *   - kode pos tepat 5 digit (`^[0-9]{5}$`);
 *   - nomor HP `^[0-9+][0-9 ]{7,19}$` — klien sudah membuang selain digit/+,
 *     jadi yang dicek: boleh diawali `+`, 8–20 karakter;
 *   - label LAINNYA wajib punya `customLabel` (maks 40 karakter).
 *
 * Kenapa perlu (non-obvious): tanpa ini setiap kesalahan baru ketahuan
 * setelah bolak-balik ke server (400) — di koneksi lambat terasa seperti
 * "alamat tidak bisa disimpan". Pesan di sini jadi hint yang tampil SEBELUM
 * tombol simpan aktif.
 */
import { translate } from "@/lib/i18n/translate"

export const ADDRESS_LIMITS = {
  customLabel: 40,
  recipientName: 100,
  phone: 20,
  addressLine: 300,
  city: 100,
  province: 100,
  postalCode: 5,
  /** Backend menolak alamat ke-21 (`Maksimal 20 alamat tersimpan`). */
  maxAddresses: 20,
} as const

export type AddressFormInput = {
  label: "RUMAH" | "KANTOR" | "LAINNYA"
  customLabel?: string
  recipientName: string
  phone: string
  addressLine: string
  city: string
  postalCode: string
}

export function isValidPostalCode(value: string): boolean {
  return /^[0-9]{5}$/.test(value.trim())
}

/**
 * Sama dengan regex backend (`^[0-9+][0-9 ]{7,19}$`) setelah spasi dibuang:
 * karakter pertama digit atau `+`, total 8–20 karakter. C16: dulu klien
 * menolak 20 digit tanpa `+` yang diterima backend, dan pesan menyebut
 * "8–15 digit" padahal aturannya bukan itu.
 */
export function isValidAddressPhone(value: string): boolean {
  const compact = value.replace(/\s+/g, "")
  return /^[0-9+][0-9]{7,19}$/.test(compact)
}

/** Hanya digit dan `+` di awal — dipakai `onChangeText` kedua form. */
export function sanitizePhoneInput(value: string): string {
  const stripped = value.replace(/[^\d+]/g, "")
  // `+` hanya sah di posisi pertama.
  return stripped.replace(/(?!^)\+/g, "")
}

export function sanitizePostalInput(value: string): string {
  return value.replace(/\D/g, "").slice(0, ADDRESS_LIMITS.postalCode)
}

/**
 * Pesan validasi pertama (urut sesuai posisi field di form) atau `null` bila
 * lengkap & valid. Pesan sudah diterjemahkan.
 */
export function validateAddressForm(input: AddressFormInput): string | null {
  if (input.label === "LAINNYA" && !(input.customLabel ?? "").trim()) {
    return translate("Isi nama label untuk alamat \"Lainnya\".")
  }
  if (!input.recipientName.trim()) return translate("Nama penerima wajib diisi.")
  if (!input.phone.trim()) return translate("Nomor HP wajib diisi.")
  if (!isValidAddressPhone(input.phone)) return translate("Nomor HP tidak valid (minimal 8 digit).")
  if (!input.addressLine.trim()) return translate("Alamat wajib diisi.")
  if (!input.city.trim()) return translate("Kota wajib diisi.")
  if (!input.postalCode.trim()) return translate("Kode pos wajib diisi.")
  if (!isValidPostalCode(input.postalCode)) return translate("Kode pos harus 5 digit angka.")
  return null
}
