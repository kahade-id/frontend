/**
 * Kahade — <BankAccountListItem> rekening tersimpan (§9.17 List Item, §7
 * pengecualian logo bank berwarna, §3.1 Mono nomor rekening, §13 mask).
 *
 * Satu baris `GET /v1/bank-accounts` untuk layar Rekening Tujuan & pemilih
 * tujuan penarikan. Anatomi: logo bank (kotak 40px berborder) -> nama bank +
 * nomor rekening Mono termasker + nama pemilik -> Badge "Utama" / Radio
 * terpilih / chevron.
 *
 * Keputusan non-obvious:
 *   - Logo bank memakai <Picture> dengan warna ASLI (§7: satu-satunya
 *     pengecualian monokrom — familiaritas saat memilih tujuan uang). Kotak
 *     40x40 `rounded-sm border border-border bg-surface-elevated` supaya logo
 *     berwarna tetap "dibingkai" oleh sistem dan tidak melayang. Tanpa
 *     `logo`, fallback <IconBox icon={Bank}> monokrom.
 *   - Nomor rekening default TERMASKER (`maskAccountNumber` -> "•••• •••• 1234"):
 *     daftar rekening sering terlihat orang lain saat user memilih tujuan
 *     tarik dana (§14). `revealed` menampilkan penuh dengan `groupAccountNumber`
 *     — toggle-nya urusan layar (biasanya setelah PIN), bukan di baris ini.
 *   - Dua mode kanan yang eksklusif: `selectable` (pemilih tujuan -> radio
 *     visual di kanan; `selected` = bg-surface + lingkaran terisi, mengikuti
 *     ListItem `selected` — baris list tidak berborder, jadi tidak ada
 *     border-focus di sini) atau non-selectable (chevron ke detail/hapus).
 *     Radio digambar sebagai View, bukan <Radio> interaktif: seluruh baris
 *     adalah target sentuh, dua Pressable bersarang membingungkan SR.
 *   - Nomor rekening & pemilik dikirim sebagai `subtitle` ReactNode ke
 *     ListItem (kontrak `string | ReactNode`) — bukan membangun baris sendiri
 *     — supaya tinggi minimum, divider, dan pressed tetap satu sumber.
 *   - Badge "Utama" (`primary`) = <Badge tone="neutral" variant="outline">:
 *     rekening utama adalah kategori, bukan status semantik (§2.3).
 *   - `verified={false}` (nama pemilik belum tervalidasi bank) menampilkan
 *     <StatusIndicator tone="warning"> "Belum diverifikasi" — ini status,
 *     boleh berwarna.
 */
import { Bank } from "phosphor-react-native"
import { View } from "react-native"

import { Badge } from "@/components/ui/badge"
import { IconBox } from "@/components/ui/icon-box"
import { ListItem, type ListItemProps } from "@/components/ui/list-item"
import { Picture, type PictureProps } from "@/components/ui/picture"
import { StatusIndicator } from "@/components/ui/status-indicator"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { groupAccountNumber, maskAccountNumber } from "@/lib/format"
// UX: haptic feedback ensured for onPress (light) — improves confirmation

export type BankAccountListItemLabels = {
  primary: string
  unverified: string
}

const DEFAULT_LABELS: BankAccountListItemLabels = {
  primary: "Utama",
  unverified: "Belum diverifikasi",
}

export type BankAccountListItemProps = Omit<
  ListItemProps,
  "title" | "subtitle" | "leading" | "trailing" | "chevron" | "selected"
> & {
  bankName: string
  /** Kode bank (BCA, BNI, …) — untuk accessibilityLabel & fallback teks */
  bankCode?: string
  accountNumber: string
  accountHolder: string
  /** Logo resmi bank (berwarna, §7 pengecualian) */
  logo?: PictureProps["source"]
  /** Rekening utama untuk penarikan */
  primary?: boolean
  /** Nama pemilik sudah divalidasi ke bank */
  verified?: boolean
  /** Tampilkan nomor lengkap (default termasker) */
  revealed?: boolean
  /** Mode pemilih tujuan: radio di kanan, bukan chevron */
  selectable?: boolean
  selected?: boolean
  labels?: Partial<BankAccountListItemLabels>
}

export function BankAccountListItem({
  bankName,
  bankCode,
  accountNumber,
  accountHolder,
  logo,
  primary = false,
  verified = true,
  revealed = false,
  selectable = false,
  selected = false,
  labels,
  onPress,
  inset = true,
  className,
  ...rest
}: BankAccountListItemProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const number = revealed ? groupAccountNumber(accountNumber) : maskAccountNumber(accountNumber)

  const a11y = [
    bankName,
    `rekening berakhiran ${accountNumber.slice(-4)}`,
    accountHolder,
    primary ? t.primary : undefined,
    !verified ? t.unverified : undefined,
    selectable ? (selected ? "dipilih" : "tidak dipilih") : undefined,
  ]
    .filter(Boolean)
    .join(", ")

  const leading = logo ? (
    <View accessible={false} className="h-10 w-10 items-center justify-center overflow-hidden rounded-sm border border-border bg-surface-elevated">
      <Picture source={logo} alt="" width={32} height={32} resizeMode="contain" radius="none" />
    </View>
  ) : (
    <IconBox icon={Bank} size="md" />
  )

  // Radio visual (bukan <Radio> interaktif — seluruh baris adalah target sentuh)
  const radio = (
    <View
      className={cn(
        "h-5 w-5 items-center justify-center rounded-full",
        selected ? "border-focus border-border-focus" : "border border-border",
      )}
    >
      {selected ? <View className="h-[10px] w-[10px] rounded-full bg-primary" /> : null}
    </View>
  )

  // Subtitle node: nomor Mono (§3.1) + nama pemilik + status verifikasi
  const subtitle = (
    <View className="gap-[2px]">
      <Text ellipsizeMode="tail" accessibilityHint="Ketuk untuk detail" variant="monoBody" tone="secondary" numberOfLines={1}>
        {number}
      </Text>
      <Text variant="caption" tone="secondary" numberOfLines={1}>
        {accountHolder}
      </Text>
      {!verified ? <StatusIndicator label={t.unverified} tone="warning" size="sm" /> : null}
    </View>
  )

  return (
    <ListItem
      title={bankCode ? `${bankName} · ${bankCode}` : bankName}
      subtitle={subtitle}
      leading={leading}
      trailing={
        primary || selectable ? (
          <View className="flex-row items-center gap-2">
            {primary ? (
              <Badge tone="neutral" variant="outline">
                {t.primary}
              </Badge>
            ) : null}
            {selectable ? radio : null}
          </View>
        ) : undefined
      }
      chevron={!selectable && !!onPress}
      selected={selectable && selected}
      onPress={onPress}
      inset={inset}
      accessibilityRole={selectable ? "radio" : "button"}
      accessibilityState={{ selected: selectable ? selected : undefined, checked: selectable ? selected : undefined }}
      accessibilityLabel={a11y}
      className={className}
      {...rest}
    />
  )
}