/**
 * Kahade — <WithdrawalScheduleCard> satu jadwal penarikan otomatis
 * (§9.6 Card, §9.5 Switch, §3.1 Mono nominal & rekening, §13 format).
 *
 * Satu entri `GET /v1/withdrawals/schedules`; aksi menyambung ke
 * `PUT .../{scheduleId}` (isActive toggle / ubah) dan `DELETE .../{scheduleId}`
 * (nonaktifkan permanen). Data = CreateScheduleDto yang tersimpan:
 * bankAccountId (dirender sebagai bank + nomor tersamar), dayOfWeek 0–6,
 * minAmount opsional, isActive.
 *
 * Anatomi:
 *   IconBox CalendarCheck · "Setiap Jumat" (H3) · Switch aktif/nonaktif
 *   baris rekening: logo bank/inisial + nama bank + nomor (Mono, masked)
 *   KeyValue: Saldo minimum pemicu (Amount) · Penarikan berikutnya · Terakhir
 *   aksi: Ubah (secondary) · Hapus (ghost destruktif ringan)
 *
 * Keputusan non-obvious:
 *   - Pemisah aktif/nonaktif = <Switch> di header, bukan Badge status: jadwal
 *     adalah PENGATURAN yang user kendalikan langsung, dan §9.5 Switch adalah
 *     kontrol untuk on/off yang efeknya langsung tersimpan (optimistic UI di
 *     pemanggil lewat `toggling`).
 *   - Saat nonaktif, isi kartu selain header diberi `opacity-disabled` (§9.1
 *     konvensi disabled), tapi tombol Ubah/Hapus tetap aktif — user harus bisa
 *     merapikan jadwal yang mati.
 *   - Nama hari lengkap dari `dayNames` yang sama dengan <ScheduleField>
 *     supaya konsisten antara form & kartu (mis. "Setiap Jumat").
 *   - `minAmount` kosong = "Berapa pun saldonya" — dieksplisitkan, bukan
 *     baris disembunyikan, supaya user sadar tidak ada ambang batas.
 *   - Hapus = ghost + teks danger, bukan Button destructive solid: kartu
 *     daftar tidak boleh punya blok merah besar; konfirmasi via Modal §10
 *     adalah urusan pemanggil.
 */
import { CalendarCheck, PencilSimple, Trash } from "phosphor-react-native"
import { View, type ViewProps } from "react-native"

import { Amount } from "@/components/ui/amount"
import { Button } from "@/components/ui/button"
import { Card, type CardProps } from "@/components/ui/card"
import { IconBox } from "@/components/ui/icon-box"
import { KeyValue, KeyValueList } from "@/components/ui/key-value"
import { Picture, type PictureProps } from "@/components/ui/picture"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { initials, maskAccountNumber } from "@/lib/format"

export type ScheduleBankAccount = {
  bankName: string
  accountNumber: string
  accountHolder?: string
  logo?: PictureProps["source"]
}

export type WithdrawalScheduleCardLabels = {
  every: (day: string) => string
  dayNames: readonly [string, string, string, string, string, string, string]
  active: string
  inactive: string
  minAmount: string
  anyBalance: string
  nextRun: string
  lastRun: string
  never: string
  edit: string
  remove: string
}

const DEFAULT_LABELS: WithdrawalScheduleCardLabels = {
  every: (day) => `Setiap ${day}`,
  dayNames: ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"],
  active: "Aktif",
  inactive: "Nonaktif",
  minAmount: "Saldo minimum pemicu",
  anyBalance: "Berapa pun saldonya",
  nextRun: "Penarikan berikutnya",
  lastRun: "Terakhir dijalankan",
  never: "Belum pernah",
  edit: "Ubah jadwal",
  remove: "Hapus",
}

export type WithdrawalScheduleCardProps = Omit<CardProps, "children" | "padded" | "onPress"> & {
  /** 0 = Minggu … 6 = Sabtu (sesuai CreateScheduleDto) */
  dayOfWeek: number
  minAmount?: number | null
  isActive: boolean
  bankAccount: ScheduleBankAccount
  /** Sudah diformat pemanggil (§13) */
  nextRunLabel?: string
  lastRunLabel?: string
  onToggleActive?: (next: boolean) => void
  toggling?: boolean
  onEdit?: () => void
  onDelete?: () => void
  labels?: Partial<WithdrawalScheduleCardLabels>
}

export function WithdrawalScheduleCard({
  dayOfWeek,
  minAmount,
  isActive,
  bankAccount,
  nextRunLabel,
  lastRunLabel,
  onToggleActive,
  toggling = false,
  onEdit,
  onDelete,
  labels,
  accessibilityLabel,
  className,
  ...rest
}: WithdrawalScheduleCardProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const dayName = t.dayNames[Math.min(6, Math.max(0, dayOfWeek))]
  const title = t.every(dayName)

  const a11y =
    accessibilityLabel ??
    [
      title,
      isActive ? t.active : t.inactive,
      `${bankAccount.bankName} ${maskAccountNumber(bankAccount.accountNumber)}`,
      minAmount ? `${t.minAmount} ${minAmount} rupiah` : t.anyBalance,
    ].join(", ")

  return (
    <Card className={cn("gap-4", className)} accessibilityLabel={a11y} {...rest}>
      {/* Header */}
      <View className="flex-row items-center gap-3">
        <IconBox icon={CalendarCheck} size="md" variant={isActive ? "inverted" : "surface"} />
        <View className="flex-1">
          <Text variant="h3" tone="primary" numberOfLines={1}>
            {title}
          </Text>
          <Text variant="caption" tone={isActive ? "success" : "secondary"}>
            {isActive ? t.active : t.inactive}
          </Text>
        </View>
        {onToggleActive ? (
          <Switch
            value={isActive}
            onChange={onToggleActive}
            disabled={toggling}
            accessibilityLabel={isActive ? t.inactive : t.active}
          />
        ) : null}
      </View>

      <View className={cn("gap-4", !isActive && "opacity-disabled")}>
        {/* Rekening tujuan */}
        <View className="flex-row items-center gap-3 rounded-sm border border-border bg-surface-elevated p-3">
          {bankAccount.logo ? (
            <Picture source={bankAccount.logo} alt={bankAccount.bankName} width={32} height={32} radius="xs" bordered />
          ) : (
            <View className="h-8 w-8 items-center justify-center rounded-xs border border-border bg-surface">
              <Text variant="caption" weight={600} tone="secondary">
                {initials(bankAccount.bankName, 2)}
              </Text>
            </View>
          )}
          <View className="flex-1">
            <Text variant="body" weight={500} tone="primary" numberOfLines={1}>
              {bankAccount.bankName}
            </Text>
            <Text variant="caption" tone="secondary" numberOfLines={1} className="font-mono-500 tracking-mono">
              {maskAccountNumber(bankAccount.accountNumber)}
              {bankAccount.accountHolder ? (
                <Text variant="inherit" tone="secondary" className="font-sans-400">
                  {" · "}
                  {bankAccount.accountHolder}
                </Text>
              ) : null}
            </Text>
          </View>
        </View>

        <KeyValueList>
          <KeyValue
            label={t.minAmount}
            value={minAmount ? <Amount value={minAmount} size="body" tone="primary" /> : t.anyBalance}
          />
          <KeyValue label={t.nextRun} value={isActive && nextRunLabel ? nextRunLabel : "—"} />
          <KeyValue label={t.lastRun} value={lastRunLabel ?? t.never} />
        </KeyValueList>
      </View>

      {onEdit || onDelete ? (
        <View className="flex-row gap-2">
          {onEdit ? (
            <Button variant="secondary" size="sm" leftIcon={PencilSimple} onPress={onEdit} className="flex-1">
              {t.edit}
            </Button>
          ) : null}
          {onDelete ? (
            <Button variant="ghost" size="sm" leftIcon={Trash} onPress={onDelete}>
              {t.remove}
            </Button>
          ) : null}
        </View>
      ) : null}
    </Card>
  )
}

export function WithdrawalScheduleCardSkeleton({ className, ...rest }: Omit<ViewProps, "children"> & { className?: string }) {
  return (
    <View
      className={cn("w-full gap-4 rounded-md border border-border bg-surface p-5", className)}
      accessibilityLabel="Memuat jadwal penarikan"
      {...rest}
    >
      <View className="flex-row items-center gap-3">
        <Skeleton width={40} height={40} />
        <View className="flex-1 gap-1">
          <Skeleton height={18} className="w-32" />
          <Skeleton height={12} className="w-16" />
        </View>
        <Skeleton height={24} className="w-11" />
      </View>
      <Skeleton height={56} className="w-full" />
      <View className="gap-3">
        <Skeleton height={14} className="w-full" />
        <Skeleton height={14} className="w-full" />
      </View>
    </View>
  )
}
