/**
 * Kahade — <ReferralHistoryListItem> baris riwayat referral (§9.17 List Item,
 * §2.3 semantic untuk status, §3.1 Mono nominal).
 *
 * Satu baris `GET /v1/referral/history` (siapa yang diundang & statusnya)
 * dan `GET /v1/referral/rewards` (hadiah yang cair). Anatomi: Avatar teman
 * -> nama + waktu bergabung -> status kecil / nominal hadiah.
 *
 * Keputusan non-obvious:
 *   - Status = PENDING (belum memenuhi syarat) / QUALIFIED (syarat terpenuhi,
 *     hadiah menunggu) / REWARDED (hadiah cair) / EXPIRED. Tone: PENDING
 *     neutral, QUALIFIED warning (menunggu proses), REWARDED success, EXPIRED
 *     neutral — merah tidak dipakai; undangan yang kedaluwarsa bukan error.
 *   - Bila REWARDED dan `rewardAmount` ada, trailing menampilkan <Amount
 *     sign="always" tone="success"> — konsisten dengan mutasi CREDIT di
 *     WalletTransactionListItem. Status lain menampilkan <StatusIndicator>.
 *   - Nama teman boleh dimask oleh backend (privasi, mis. "bu***"), komponen
 *     menampilkan apa adanya — tidak mencoba membuat inisial dari nama
 *     bermask; bila `avatar` tidak ada, Avatar tetap menerima `name`.
 */
import { View } from "react-native"

import { Amount } from "@/components/ui/amount"
import { Avatar, type AvatarProps } from "@/components/ui/avatar"
import { ListItem, type ListItemProps } from "@/components/ui/list-item"
import { StatusIndicator, type StatusIndicatorTone } from "@/components/ui/status-indicator"
import { summarize } from "@/lib/a11y"
import { hasOwn } from "@/lib/has-own"
// UX: haptic feedback ensured for onPress (light) — improves confirmation

export type ReferralStatus = "PENDING" | "QUALIFIED" | "REWARDED" | "EXPIRED"

export const REFERRAL_STATUS_LABELS: Record<ReferralStatus, string> = {
  PENDING: "Menunggu syarat",
  QUALIFIED: "Hadiah diproses",
  REWARDED: "Hadiah cair",
  EXPIRED: "Kedaluwarsa",
}

const STATUS_TONE: Record<ReferralStatus, StatusIndicatorTone> = {
  PENDING: "neutral",
  QUALIFIED: "warning",
  REWARDED: "success",
  EXPIRED: "neutral",
}

export type ReferralHistoryListItemProps = Omit<ListItemProps, "title" | "subtitle" | "leading" | "trailing" | "chevron"> & {
  name: string
  avatar?: AvatarProps["source"]
  status: ReferralStatus | string
  /** Sudah diformat pemanggil (§13), mis. "Bergabung 3 Sep 2026" */
  joinedAt?: string
  /** Hadiah Rupiah — tampil bila status REWARDED */
  rewardAmount?: number
  labels?: Partial<Record<ReferralStatus, string>>
}

function isReferralStatus(s: string): s is ReferralStatus {
  // Own keys only — `in` would also accept inherited keys like "toString".
  return hasOwn(REFERRAL_STATUS_LABELS, s)
}

export function ReferralHistoryListItem({
  name,
  avatar,
  status,
  joinedAt,
  rewardAmount,
  labels,
  onPress,
  inset = true,
  ...rest
}: ReferralHistoryListItemProps) {
  const known = isReferralStatus(status)
  const label = known ? labels?.[status] ?? REFERRAL_STATUS_LABELS[status] : status
  const tone: StatusIndicatorTone = known ? STATUS_TONE[status] : "neutral"
  const showReward = status === "REWARDED" && rewardAmount != null

  return (
    <ListItem
      title={name}
      subtitle={joinedAt}
      leading={<Avatar source={avatar} name={name} size="sm" />}
      trailing={
        <View accessible={false} className="items-end gap-1 tabular-nums">
          {showReward ? <Amount value={Math.abs(rewardAmount)} size="body" sign="always" tone="success" /> : null}
          <StatusIndicator label={label} tone={tone} size="sm" />
        </View>
      }
      chevron={!!onPress}
      onPress={onPress}
      inset={inset}
      accessibilityLabel={summarize([name, label, showReward ? `hadiah ${rewardAmount} rupiah` : undefined, joinedAt])}
      {...rest}
    />
  )
}