/**
 * Kahade — <VoucherRedeemBox> (§9.2 Input, §9.1 Button, §9.7 Badge,
 * §3.1 Mono untuk kode, §13 format Rupiah, §12 Voice & Tone).
 *
 * Kotak "Punya kode voucher?" di layar pembayaran/checkout. Tiga state:
 *   - idle     : Input kode + tombol "Pakai" (secondary) sebaris.
 *   - applied  : tiket mini (<TicketShell> + <TicketDivider>): kode Mono +
 *                Badge success "Terpasang" + potongan "-Rp10.000", perforasi,
 *                lalu tombol hapus (X) + petunjuk ganti kode.
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
import { TicketDivider, TicketShell } from "@/components/ui/voucher-ticket"
import { cn } from "@/lib/cn"
import { translate } from "@/lib/i18n/translate"
import { summarize } from "@/lib/a11y"

/**
 * Jenis manfaat voucher yang terpasang (audit 2026-10-10, F11). Tanpa ini
 * cashback/bonus top-up dirender "-Rp…" seolah potongan tagihan.
 */
export type AppliedVoucherKind = "FEE_DISCOUNT" | "CASHBACK" | "TOPUP_BONUS" | "UNKNOWN"

export type AppliedVoucher = {
  code: string
  /**
   * Nilai manfaat (positif). Untuk FEE_DISCOUNT dirender "-Rp…"; untuk
   * CASHBACK/TOPUP_BONUS dirender "+Rp…" dengan keterangan — bukan potongan.
   * `undefined` bila server mengonfirmasi voucher VALID tanpa mengembalikan
   * nominalnya — lebih jujur daripada menyimpan NaN yang tampil sebagai "Rp—".
   */
  discount?: number
  /** Nama promo, mis. "Cashback pengguna baru" */
  title?: string
  /** Default FEE_DISCOUNT (perilaku lama) bila pemanggil tidak tahu jenisnya. */
  kind?: AppliedVoucherKind
}

// Dibungkus translate() agar masuk katalog i18n (pola DEFAULT_LABELS di
// fee-breakdown); <Text> tetap melokalkan ulang saat render.
const KIND_HINT: Record<Exclude<AppliedVoucherKind, "FEE_DISCOUNT">, string> = {
  CASHBACK: translate("Cashback masuk setelah transaksi selesai"),
  TOPUP_BONUS: translate("Bonus saldo saat top-up"),
  UNKNOWN: "",
}

export type VoucherRedeemBoxLabels = {
  heading: string
  placeholder: string
  apply: string
  applied: string
  remove: string
  browse: string
  /** Petunjuk di potongan tiket terpasang */
  swapHint: string
}

export type VoucherRedeemBoxProps = Omit<ViewProps, "children"> & {
  initialCode?: string
  applied?: AppliedVoucher
  onApply: (code: string) => void
  onRemove?: () => void
  onBrowse?: () => void
  /** Pesan penolakan dari server */
  errorText?: string
  /** FRM-015: dipanggil setiap kode berubah agar pemanggil bisa membersihkan error lama. */
  onCodeChange?: (code: string) => void
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
  swapHint: "Hapus untuk mengganti kode",
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
  onCodeChange,
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
    const kind: AppliedVoucherKind = applied.kind ?? "FEE_DISCOUNT"
    const isDiscount = kind === "FEE_DISCOUNT"
    const kindHint = isDiscount ? "" : KIND_HINT[kind]
    return (
      // Root TANPA `accessible`: IconButton "Hapus" harus tetap fokusable.
      // Ringkasan dipasang pada blok teks kode voucher (audit #4).
      // Rev. tiket 2026-09-27: state terpasang = tiket mini — badan (kode +
      // Badge "Terpasang" + nominal), perforasi, potongan (petunjuk + hapus).
      <TicketShell
        className={className}
        {...rest}
      >
        <View className="flex-row items-center gap-3 px-4 pb-3 pt-4">
          <Icon icon={Tag} size="sm" tone="active" weight="fill" />
          <View
            accessible
            accessibilityLabel={summarize([
              translate(t.heading),
              applied.code.split("").join(" "),
              translate(t.applied),
              applied.title ? translate(applied.title) : undefined,
              kindHint ? translate(kindHint) : undefined,
            ])}
            className="flex-1 gap-0 tabular-nums"
          >
            <View className="flex-row items-center gap-2">
              <Text ellipsizeMode="tail" variant="monoBody" numberOfLines={1} className="shrink tracking-mono">
                {applied.code}
              </Text>
              <Badge tone="success">{t.applied}</Badge>
            </View>
            {applied.title ? (
              <Text variant="caption" tone="secondary" numberOfLines={1}>
                {applied.title}
              </Text>
            ) : null}
            {kindHint ? (
              <Text variant="caption" tone="secondary" numberOfLines={1}>
                {kindHint}
              </Text>
            ) : null}
          </View>
          {Number.isFinite(applied.discount) ? (
            // F11: potongan biaya = "-Rp…" (success); cashback/bonus = "+Rp…"
            // — nominalnya BUKAN pengurang tagihan.
            <Amount
              value={isDiscount ? -Math.abs(applied.discount as number) : Math.abs(applied.discount as number)}
              tone={isDiscount ? "success" : "primary"}
              sign={isDiscount ? "auto" : "always"}
            />
          ) : null}
        </View>

        <TicketDivider />

        <View className="flex-row items-center justify-between gap-3 px-4 py-3">
          <Text variant="caption" tone="secondary" className="shrink">
            {t.swapHint}
          </Text>
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
      </TicketShell>
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
            onChangeText={(t) => {
              setCode(t)
              // FRM-015: error penolakan lama tidak lengket saat pengguna mengetik koreksi.
              onCodeChange?.(t)
            }}
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