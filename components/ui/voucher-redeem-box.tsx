/**
 * Kahade — <VoucherRedeemBox> (§9.2 Input, §9.1 Button, §9.7 Badge,
 * §3.1 Mono untuk kode, §13 format Rupiah, §12 Voice & Tone).
 *
 * Kotak "Punya kode voucher?" di layar pembayaran/checkout. Tiga state:
 *   - idle     : Input kode + tombol "Pakai" (secondary) sebaris.
 *   - applied  : kartu ringkas: kode Mono + Badge success "Terpasang" +
 *                potongan "-Rp10.000" + tombol hapus (X).
 *   - error    : Input border-error + pesan dari server (`POST /v1/vouchers/
 *                validate`), tombol tetap aktif untuk mencoba lagi.
 *
 * Keputusan non-obvious:
 *   - Validasi terjadi di server, BUKAN di komponen: `onApply(code)` dipanggil
 *     saat tombol/Enter ditekan; pemanggil mengisi `applied` atau `errorText`
 *     dari respons. Komponen hanya menormalkan input (uppercase, trim, buang
 *     spasi) supaya "abc 123" dan "ABC123" dikirim sama — kode voucher
 *     Kahade tidak case-sensitive.
 *   - Input kode memakai `autoCapitalize="characters"` + `autoCorrect={false}`
 *     dan diketik dalam font Mono lewat `className` — kode voucher adalah
 *     data presisi (§3.1), 0/O harus terbedakan saat diketik.
 *   - Potongan dirender <Amount sign="auto"> dengan nilai NEGATIF tone
 *     success ("-Rp10.000") — pola yang sama dengan baris diskon di
 *     <InvoiceReceiptView>, satu-satunya warna di kotak ini.
 *   - Voucher yang terpasang TIDAK bisa diedit inline; harus dihapus dulu
 *     (X) lalu ketik ulang. Menghindari state "setengah terpasang" di mana
 *     total sudah dipotong tetapi kode di input berbeda.
 *   - Tombol "Pakai" `secondary` (bukan primary): CTA utama layar ini adalah
 *     "Bayar" milik pemanggil; voucher aksi sekunder (§9.1 hierarki).
 *     `fullWidth={false}` supaya sebaris dengan Input.
 *   - `onBrowse` opsional menampilkan TextLink "Lihat voucher tersedia"
 *     (`GET /v1/vouchers/available`) — pemanggil membuka BottomSheet daftar
 *     (§10: pilihan pendek = sheet), bukan komponen ini.
 *   - `disabled` (mis. total 0 atau metode bayar belum dipilih) meredupkan
 *     seluruh kotak, tetapi voucher yang sudah terpasang tetap bisa dihapus.
 */
import { Tag, X } from "phosphor-react-native"
import { useState } from "react"
import { View, type ViewProps } from "react-native"

import { Amount } from "@/components/ui/amount"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { Input } from "@/components/ui/input"
import { Text } from "@/components/ui/text"
import { TextLink } from "@/components/ui/text-link"
import { cn } from "@/lib/cn"

export type AppliedVoucher = {
  code: string
  /** Nilai potongan (positif); dirender sebagai "-Rp…" */
  discount: number
  /** Nama promo, mis. "Cashback pengguna baru" */
  title?: string
}

export type VoucherRedeemBoxLabels = {
  heading: string
  placeholder: string
  apply: string
  applied: string
  remove: string
  browse: string
}

export type VoucherRedeemBoxProps = Omit<ViewProps, "children"> & {
  initialCode?: string
  applied?: AppliedVoucher
  onApply: (code: string) => void
  onRemove?: () => void
  onBrowse?: () => void
  /** Pesan penolakan dari server */
  errorText?: string
  applying?: boolean
  disabled?: boolean
  labels?: Partial<VoucherRedeemBoxLabels>
  className?: string
}

const DEFAULT_LABELS: VoucherRedeemBoxLabels = {
  heading: "Kode voucher",
  placeholder: "Masukkan kode",
  apply: "Pakai",
  applied: "Terpasang",
  remove: "Hapus voucher",
  browse: "Lihat voucher tersedia",
}

/** "abc 123" -> "ABC123" */
export function normalizeVoucherCode(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase()
}

export function VoucherRedeemBox({
  initialCode = "",
  applied,
  onApply,
  onRemove,
  onBrowse,
  errorText,
  applying = false,
  disabled = false,
  labels,
  className,
  ...rest
}: VoucherRedeemBoxProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const [code, setCode] = useState(() => normalizeVoucherCode(initialCode))
  const normalized = normalizeVoucherCode(code)
  const canApply = normalized.length > 0 && !applying && !disabled

  const submit = () => {
    if (canApply) onApply(normalized)
  }

  if (applied) {
    return (
      // Root TANPA `accessible`: IconButton "Hapus" harus tetap fokusable.
      // Ringkasan dipasang pada blok teks kode voucher (audit #4).
      <View
        className={cn(
          "flex-row items-center gap-3 rounded-md border border-border bg-surface px-4 py-3",
          className,
        )}
        {...rest}
      >
        <Icon icon={Tag} size="sm" tone="active" weight="fill" />
        <View
          accessible
          accessibilityLabel={`${t.heading} ${applied.code.split("").join(" ")}, ${t.applied}${applied.title ? `, ${applied.title}` : ""}`}
          className="flex-1 gap-0"
        >
          <View className="flex-row items-center gap-2">
            <Text variant="monoBody" numberOfLines={1} className="shrink">
              {applied.code}
            </Text>
            <Badge tone="success">{t.applied}</Badge>
          </View>
          {applied.title ? (
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {applied.title}
            </Text>
          ) : null}
        </View>
        <Amount value={-Math.abs(applied.discount)} tone="success" />
        {onRemove ? (
          <IconButton
            icon={X}
            size="sm"
            variant="ghost"
            accessibilityLabel={t.remove}
            onPress={onRemove}
            className="-mr-2"
          />
        ) : null}
      </View>
    )
  }

  return (
    <View className={cn("gap-2", className)} {...rest}>
      <View className="flex-row items-start gap-3">
        <View className="flex-1">
          <Input
            label={t.heading}
            placeholder={t.placeholder}
            value={code}
            onChangeText={setCode}
            errorText={errorText}
            disabled={disabled}
            leftIcon={Tag}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={submit}
            className="font-mono-500 tracking-mono"
            accessibilityLabel={t.heading}
          />
        </View>
        <Button
          variant="secondary"
          fullWidth={false}
          disabled={!canApply}
          loading={applying}
          onPress={submit}
          containerClassName="pt-[2px]"
        >
          {t.apply}
        </Button>
      </View>
      {onBrowse ? (
        <TextLink variant="caption" onPress={onBrowse} disabled={disabled}>
          {t.browse}
        </TextLink>
      ) : null}
    </View>
  )
}
