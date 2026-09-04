/**
 * Kahade — Pemilih enum form order: <OrderTypeSelector>, <OrderRoleSelector>,
 * <FeeResponsibilitySelector> (§9.16 Segmented/ToggleGroup, §12 i18n-ready).
 *
 * Tiga enum dari `POST /v1/orders` & `/v1/orders/links` (CreateOrderDto):
 *   orderType         PHYSICAL_GOODS | DIGITAL_GOODS | SERVICE | OTHER
 *   role              BUYER | SELLER
 *   feeResponsibility BUYER | SELLER | SPLIT
 *
 * Semua dibangun di atas <ToggleGroup> (kartu pilih dengan border-focus saat
 * terpilih) agar tiga langkah "Buat transaksi" terasa satu keluarga. SATU
 * file karena ketiganya hanya tabel label+ikon di atas komponen yang sama;
 * memisah menjadi 3 file menyebarkan kosakata enum yang seharusnya sejajar.
 *
 * Keputusan non-obvious:
 *   - OrderType 2 kolom (4 opsi = grid 2x2) dengan ikon: Package, FileArrowDown,
 *     Wrench, DotsThree. Ikon membantu scan karena label ("Barang digital")
 *     bisa ambigu bagi user baru.
 *   - Role 2 kolom tanpa ikon, dengan `hint` yang menjelaskan konsekuensi
 *     ("Anda membayar" / "Anda menerima dana") — ini keputusan yang menentukan
 *     arah dana, hint mengurangi salah pilih.
 *   - FeeResponsibility 3 kolom; `feeAmount` opsional menampilkan hint nominal
 *     per opsi (Rp10.000 / Rp0 / Rp5.000) yang dihitung dari splitFee() di
 *     fee-breakdown.tsx — satu sumber logika pembagian.
 *   - Export `ORDER_TYPE_LABELS` dan `ORDER_ROLE_LABELS` agar Badge/detail
 *     memakai kosakata yang sama.
 */
import { DotsThree, FileArrowDown, Package, Wrench } from "phosphor-react-native"

import { FEE_RESPONSIBILITY_LABELS, splitFee, type FeeResponsibility } from "@/components/ui/fee-breakdown"
import type { IconComponent } from "@/components/ui/icon"
import { ToggleGroup, type ToggleGroupProps, type ToggleOption } from "@/components/ui/toggle-group"
import { formatRupiah } from "@/lib/format"

// ------------------------------------------------------------------
// Order type
// ------------------------------------------------------------------

export type OrderType = "PHYSICAL_GOODS" | "DIGITAL_GOODS" | "SERVICE" | "OTHER"

export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  PHYSICAL_GOODS: "Barang fisik",
  DIGITAL_GOODS: "Barang digital",
  SERVICE: "Jasa",
  OTHER: "Lainnya",
}

export const ORDER_TYPE_ICONS: Record<OrderType, IconComponent> = {
  PHYSICAL_GOODS: Package,
  DIGITAL_GOODS: FileArrowDown,
  SERVICE: Wrench,
  OTHER: DotsThree,
}

const ORDER_TYPE_HINTS: Record<OrderType, string> = {
  PHYSICAL_GOODS: "Perlu resi pengiriman",
  DIGITAL_GOODS: "File, akun, lisensi",
  SERVICE: "Pekerjaan / layanan",
  OTHER: "Di luar kategori",
}

type SingleGroupBase<V extends string> = Omit<
  Extract<ToggleGroupProps<V>, { multiple?: false }>,
  "options" | "multiple" | "columns"
>

export type OrderTypeSelectorProps = SingleGroupBase<OrderType> & {
  labels?: Partial<Record<OrderType, string>>
  hints?: Partial<Record<OrderType, string>> | false
}

export function OrderTypeSelector({ labels, hints, centered = false, ...rest }: OrderTypeSelectorProps) {
  const options: ToggleOption<OrderType>[] = (Object.keys(ORDER_TYPE_LABELS) as OrderType[]).map((v) => ({
    value: v,
    label: labels?.[v] ?? ORDER_TYPE_LABELS[v],
    hint: hints === false ? undefined : hints?.[v] ?? ORDER_TYPE_HINTS[v],
    icon: ORDER_TYPE_ICONS[v],
  }))
  return <ToggleGroup<OrderType> options={options} columns={2} centered={centered} {...rest} />
}

// ------------------------------------------------------------------
// Role
// ------------------------------------------------------------------

export type OrderRoleValue = "BUYER" | "SELLER"

export const ORDER_ROLE_LABELS: Record<OrderRoleValue, string> = {
  BUYER: "Saya pembeli",
  SELLER: "Saya penjual",
}

const ORDER_ROLE_HINTS: Record<OrderRoleValue, string> = {
  BUYER: "Anda membayar ke escrow",
  SELLER: "Anda menerima dana",
}

export type OrderRoleSelectorProps = SingleGroupBase<OrderRoleValue> & {
  labels?: Partial<Record<OrderRoleValue, string>>
  hints?: Partial<Record<OrderRoleValue, string>> | false
}

export function OrderRoleSelector({ labels, hints, ...rest }: OrderRoleSelectorProps) {
  const options: ToggleOption<OrderRoleValue>[] = (["BUYER", "SELLER"] as const).map((v) => ({
    value: v,
    label: labels?.[v] ?? ORDER_ROLE_LABELS[v],
    hint: hints === false ? undefined : hints?.[v] ?? ORDER_ROLE_HINTS[v],
  }))
  return <ToggleGroup<OrderRoleValue> options={options} columns={2} {...rest} />
}

// ------------------------------------------------------------------
// Fee responsibility
// ------------------------------------------------------------------

export type FeeResponsibilitySelectorProps = SingleGroupBase<FeeResponsibility> & {
  /** Total biaya layanan — bila ada, hint per opsi = porsi yang USER tanggung */
  feeAmount?: number
  /** Peran USER untuk menghitung porsi di hint */
  viewer?: OrderRoleValue
  labels?: Partial<Record<FeeResponsibility, string>>
}

export function FeeResponsibilitySelector({
  feeAmount,
  viewer = "BUYER",
  labels,
  ...rest
}: FeeResponsibilitySelectorProps) {
  const options: ToggleOption<FeeResponsibility>[] = (["BUYER", "SELLER", "SPLIT"] as const).map((v) => {
    let hint: string | undefined
    if (feeAmount != null) {
      // splitFee = sumber tunggal pembagian (SPLIT: pembulatan ke atas di pembeli)
      const share = splitFee(feeAmount, v)
      hint = formatRupiah(viewer === "BUYER" ? share.buyer : share.seller)
    }
    return { value: v, label: labels?.[v] ?? FEE_RESPONSIBILITY_LABELS[v], hint }
  })
  return <ToggleGroup<FeeResponsibility> options={options} columns={3} {...rest} />
}
