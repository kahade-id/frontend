/**
 * Kahade — <ReferralRewardListItem> + <ReferralApplyForm> (§9.17 List Item,
 * §3.1 Mono, §11 Form, §13 format).
 * API: GET /v1/referral/rewards, POST /v1/referral/apply
 *
 * RewardListItem — satu hadiah yang MASUK ke saldo: IconBox Gift -> judul
 *   ("Hadiah undangan · Budi") + tanggal -> <Amount sign="always"> hijau di
 *   kanan. Berbeda dari ReferralHistoryListItem (status per orang yang
 *   diundang), ini ledger uang — maka nominal Mono adalah elemen utama,
 *   sejajar dengan WalletTransactionListItem.
 *   - status PENDING (hadiah dijanjikan, belum cair) -> nominal tertiary +
 *     Badge "Menunggu"; hanya CREDITED yang hijau. Uang yang belum ada
 *     tidak boleh terlihat sudah ada.
 *
 * ApplyForm — memasukkan kode referral orang lain (sekali, saat onboarding
 *   atau dari Pengaturan): Input Mono huruf besar + tombol "Pakai kode".
 *   - Validasi lokal hanya format (6–12 alfanumerik); keabsahan ditentukan
 *     backend -> `errorText` dari pemanggil.
 *   - `appliedCode` ada -> form berubah menjadi konfirmasi read-only
 *     ("Kode X sudah dipakai") karena backend menolak pemakaian kedua.
 *   - Tidak ada tombol "Batal": apply tidak bisa di-undo; jangan menyiratkan
 *     sebaliknya.
 */
import { useState } from "react"
import { CheckCircle, Gift } from "phosphor-react-native"
import { View, type ViewProps } from "react-native"

import { Amount } from "@/components/ui/amount"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { IconBox } from "@/components/ui/icon-box"
import { Input } from "@/components/ui/input"
import { ListItem, type ListItemProps } from "@/components/ui/list-item"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"

// ------------------------------------------------------------------
// Reward list item
// ------------------------------------------------------------------

export type ReferralRewardStatus = "PENDING" | "CREDITED" | "CANCELLED"

export const REFERRAL_REWARD_STATUS_LABELS: Record<ReferralRewardStatus, string> = {
  PENDING: "Menunggu",
  CREDITED: "Masuk saldo",
  CANCELLED: "Dibatalkan",
}

export type ReferralRewardListItemProps = Omit<ListItemProps, "title" | "subtitle" | "leading" | "trailing"> & {
  /** Nama orang yang diundang */
  referredName: string
  amount: number
  status: ReferralRewardStatus | string
  /** Sudah diformat (§13) */
  date: string
  labels?: Partial<Record<ReferralRewardStatus, string>>
}

export function ReferralRewardListItem({
  referredName,
  amount,
  status,
  date,
  labels,
  ...rest
}: ReferralRewardListItemProps) {
  const t = { ...REFERRAL_REWARD_STATUS_LABELS, ...labels }
  const credited = status === "CREDITED"
  const cancelled = status === "CANCELLED"
  const statusLabel = t[status as ReferralRewardStatus] ?? status

  return (
    <ListItem
      leading={<IconBox icon={Gift} size="md" variant={credited ? "success" : "surface"} />}
      title={`Hadiah undangan \u00B7 ${referredName}`}
      subtitle={
        <View className="flex-row flex-wrap items-center gap-2">
          <Text variant="caption" tone="tertiary">
            {date}
          </Text>
          {!credited ? (
            <Badge tone={cancelled ? "neutral" : "warning"} variant="soft">
              {statusLabel}
            </Badge>
          ) : null}
        </View>
      }
      trailing={
        <Amount
          value={amount}
          size="body"
          sign={credited ? "always" : "never"}
          tone={credited ? "success" : "secondary"}
          className={cn(cancelled && "line-through")}
        />
      }
      accessibilityLabel={`Hadiah undangan ${referredName}, ${statusLabel}, ${date}`}
      {...rest}
    />
  )
}

// ------------------------------------------------------------------
// Apply form
// ------------------------------------------------------------------

export type ReferralApplyFormProps = Omit<ViewProps, "children"> & {
  onSubmit: (code: string) => void
  submitting?: boolean
  /** Pesan error dari backend (kode tidak valid / kedaluwarsa / milik sendiri) */
  errorText?: string
  /** Kode yang sudah dipakai — mengubah form menjadi konfirmasi */
  appliedCode?: string
  /** Mis. "Anda dan pengundang masing-masing dapat Rp25.000 setelah transaksi pertama." */
  rewardHint?: string
  className?: string
}

const CODE_RE = /^[A-Z0-9]{6,12}$/

export function ReferralApplyForm({
  onSubmit,
  submitting = false,
  errorText,
  appliedCode,
  rewardHint,
  className,
  ...rest
}: ReferralApplyFormProps) {
  const [code, setCode] = useState("")
  const normalized = code.trim().toUpperCase()
  const formatOk = CODE_RE.test(normalized)

  if (appliedCode) {
    return (
      <View
        className={cn("flex-row items-center gap-3 rounded-md border border-border bg-surface p-4", className)}
        accessible
        accessibilityLabel={`Kode referral ${appliedCode} sudah dipakai`}
        {...rest}
      >
        <IconBox icon={CheckCircle} size="md" variant="success" />
        <View className="flex-1 gap-[2px]">
          <Text variant="body" weight={500} tone="primary">
            Kode referral sudah dipakai
          </Text>
          <Text variant="monoBody" tone="secondary">
            {appliedCode}
          </Text>
        </View>
      </View>
    )
  }

  return (
    <View className={cn("gap-4", className)} {...rest}>
      <Input
        label="Kode referral"
        value={code}
        onChangeText={(v) => setCode(v.toUpperCase())}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={12}
        errorText={errorText ?? (code.length > 0 && !formatOk ? "6–12 huruf/angka" : undefined)}
        helperText={rewardHint}
        className="font-mono-500 tracking-widest"
        accessibilityLabel="Masukkan kode referral"
      />
      <Button onPress={() => onSubmit(normalized)} disabled={!formatOk || submitting} loading={submitting}>
        Pakai kode
      </Button>
    </View>
  )
}
