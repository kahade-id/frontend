/**
 * Kahade — <ReferralRewardListItem> (§9.17 List Item, §3.1 Mono, §13 format).
 * API: GET /v1/referral/rewards
 *
 * RewardListItem — satu hadiah undangan: IconBox Gift -> judul
 *   ("Hadiah undangan · Budi") + tanggal -> <Amount sign="always"> hijau di
 *   kanan. Berbeda dari ReferralHistoryListItem (status per orang yang
 *   diundang), ini ledger uang — maka nominal Mono adalah elemen utama,
 *   sejajar dengan WalletTransactionListItem.
 *   Label default "Masuk saldo" bisa dioverride via prop `labels` (mode
 *   Tanpa Wallet Internal memakai "Dicairkan" — disbursement DANA ke
 *   rekening bank).
 *   - status PENDING (hadiah dijanjikan, belum cair) -> nominal secondary +
 *     Badge "Menunggu"; hanya CREDITED yang hijau. Uang yang belum ada
 *     tidak boleh terlihat sudah ada.
 *
 * Audit 2026-10-10 (F23): <ReferralApplyForm> yang dulu ikut di berkas ini
 * DIHAPUS — tidak dipakai layar mana pun, dan validasi formatnya
 * (`[A-Z0-9]{6,12}`) bertentangan dengan kontrak backend (`KH` + 6–8
 * alfanumerik). Form apply yang hidup ada di app/referral.tsx dengan
 * `isReferralCodeFormat` (lib/api/referrals).
 */
import { Gift } from "phosphor-react-native"
import { View } from "react-native"
import { translate } from "@/lib/i18n/translate"

import { Amount } from "@/components/ui/amount"
import { Badge } from "@/components/ui/badge"
import { IconBox } from "@/components/ui/icon-box"
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
  /**
   * Nama orang yang diundang.
   *
   * DRIFT-REF-02 (2026-09-26): opsional — backend `GET /v1/referral/rewards`
   * tidak mengirim nama/kode orang yang diundang. Tanpa nama, judul menjadi
   * "Hadiah undangan" saja.
   */
  referredName?: string
  amount: number
  status: ReferralRewardStatus | string
  /** Sudah diformat (§13) */
  date: string
  labels?: Partial<Record<ReferralRewardStatus, string>>
  /**
   * Audit 2026-10-10 (F19): judul kustom — mis. "Bonus sambutan" untuk reward
   * yang diterima sebagai orang yang DIUNDANG (backend `kind: REFEREE`),
   * bukan "Hadiah undangan" milik pengundang.
   */
  title?: string
}

export function ReferralRewardListItem({
  referredName,
  amount,
  status,
  date,
  labels,
  title: titleOverride,
  ...rest
}: ReferralRewardListItemProps) {
  const t = { ...REFERRAL_REWARD_STATUS_LABELS, ...labels }
  const credited = status === "CREDITED"
  const cancelled = status === "CANCELLED"
  const statusLabel = t[status as ReferralRewardStatus] ?? status
  // DRIFT-REF-02: tanpa nama orang yang diundang, judul generik saja.
  const title = titleOverride
    ? translate(titleOverride)
    : referredName
    ? translate("Hadiah undangan · {x}", { x: referredName })
    : translate("Hadiah undangan")

  return (
    <ListItem
      leading={<IconBox icon={Gift} size="md" variant={credited ? "success" : "surface"} />}
      title={title}
      subtitle={
        <View className="flex-row flex-wrap items-center gap-2 tabular-nums">
          <Text variant="caption" tone="secondary">
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
      accessibilityLabel={translate("{x}, {y}, {z}", { x: title, y: statusLabel, z: date })}
      {...rest}
    />
  )
}
