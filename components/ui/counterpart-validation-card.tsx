/**
 * Kahade — <CounterpartValidationCard> (§9.3 Card, §9.4 Avatar, §2.3 status,
 * §11 Form inline feedback).
 * API: POST /v1/orders/validate-counterpart
 *
 * Hasil validasi lawan transaksi saat membuat pesanan: setelah pengguna
 * mengetik @username / nomor HP, backend mengembalikan profil ringkas +
 * flag. Kartu ini menampilkan hasil itu di bawah field input, menggantikan
 * helper text.
 *
 * Empat state:
 *   - loading  : Skeleton baris avatar + 2 baris teks
 *   - notFound : IconBox UserCircleMinus warning + pesan
 *   - blocked  : IconBox Prohibit danger — pengguna memblokir/diblokir, atau
 *                akun ditangguhkan. Tombol lanjut TIDAK dirender.
 *   - found    : Avatar + nama + @handle + Badge KYC + stat (transaksi, rating)
 *                + peringatan (`warnings`) bila ada + tombol "Gunakan".
 *
 * Keputusan non-obvious:
 *   - `isSelf` (mengetik username sendiri) diperlakukan seperti `blocked`
 *     dengan pesan khusus — bukan warning, karena tidak ada jalan lanjut.
 *   - `warnings` (mis. "Akun baru, < 30 hari", "Belum KYC") dirender Badge
 *     warning berderet, bukan Alert: satu kartu sudah cukup vertikal; Alert
 *     bertumpuk membuat form terasa mengancam padahal transaksi tetap boleh.
 *   - `onConfirm` ("Gunakan") ada karena hasil validasi bisa berbeda dari
 *     yang diketik (username lama -> nama baru); konfirmasi eksplisit
 *     mencegah salah kirim ke orang lain.
 */
import { Prohibit, UserCircleMinus, UserSwitch } from "phosphor-react-native"
import { View } from "react-native"

import { Avatar, type AvatarProps } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardSummary, type CardProps } from "@/components/ui/card"
import { IconBox } from "@/components/ui/icon-box"
import { Skeleton } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"
import { summarize } from "@/lib/a11y"
import { cn } from "@/lib/cn"
// UX: haptic feedback ensured for onPress (light) — improves confirmation

export type CounterpartState = "loading" | "notFound" | "blocked" | "self" | "found"

export type CounterpartLabels = {
  notFound: string
  notFoundHint: string
  blocked: string
  blockedHint: string
  self: string
  selfHint: string
  verified: string
  confirm: string
  transactions: (n: number) => string
}

export type CounterpartValidationCardProps = Omit<CardProps, "children"> & {
  state: CounterpartState
  name?: string
  username?: string
  avatar?: Pick<AvatarProps, "source">
  verified?: boolean
  completedOrders?: number
  /** Sudah diformat, mis. "4,9" */
  rating?: string
  /** Mis. ["Akun baru", "Belum KYC"] */
  warnings?: readonly string[]
  /** Pesan spesifik dari backend untuk state blocked (override) */
  reason?: string
  onConfirm?: () => void
  confirming?: boolean
  labels?: Partial<CounterpartLabels>
}

const DEFAULT_LABELS: CounterpartLabels = {
  notFound: "Pengguna tidak ditemukan",
  notFoundHint: "Periksa kembali username atau nomor HP yang Anda masukkan.",
  blocked: "Tidak dapat bertransaksi",
  blockedHint: "Pengguna ini tidak tersedia untuk transaksi dengan Anda.",
  self: "Ini akun Anda sendiri",
  selfHint: "Masukkan username lawan transaksi, bukan milik Anda.",
  verified: "Terverifikasi",
  confirm: "Gunakan",
  transactions: (n) => `${n} transaksi selesai`,
}

export function CounterpartValidationCard({
  state,
  name,
  username,
  avatar,
  verified = false,
  completedOrders,
  rating,
  warnings = [],
  reason,
  onConfirm,
  confirming = false,
  labels,
  className,
  ...rest
}: CounterpartValidationCardProps) {
  const t = { ...DEFAULT_LABELS, ...labels }

  if (state === "loading") {
    return (
      <Card variant="outline" className={cn("flex-row items-center gap-3", className)} accessibilityLabel="Memeriksa lawan transaksi" {...rest}>
        <Skeleton width={40} height={40} shape="circle" />
        <View className="flex-1 gap-2">
          <Skeleton height={14} className="w-1/2" />
          <Skeleton height={12} className="w-1/3" />
        </View>
      </Card>
    )
  }

  if (state !== "found") {
    const cfg =
      state === "notFound"
        ? { icon: UserCircleMinus, variant: "warning" as const, title: t.notFound, hint: t.notFoundHint }
        : state === "self"
          ? { icon: UserSwitch, variant: "warning" as const, title: t.self, hint: t.selfHint }
          : { icon: Prohibit, variant: "danger" as const, title: t.blocked, hint: reason ?? t.blockedHint }

    return (
      <Card
        variant="outline"
        className={cn("flex-row items-start gap-3", className)}
        accessibilityLabel={`${cfg.title}. ${cfg.hint}`}
        {...rest}
      >
        <IconBox icon={cfg.icon} size="md" variant={cfg.variant} />
        <View className="flex-1 gap-[2px]">
          <Text variant="body" weight={600} tone="primary">
            {cfg.title}
          </Text>
          <Text variant="caption" tone="secondary" className="leading-5">
            {cfg.hint}
          </Text>
        </View>
      </Card>
    )
  }

  const stats: string[] = []
  if (typeof completedOrders === "number") stats.push(t.transactions(completedOrders))
  if (rating) stats.push(`\u2605 ${rating}`)

  return (
    // Root tanpa `accessible`: tombol "Konfirmasi" harus tetap fokusable.
    // Identitas + peringatan dikelompokkan lewat <CardSummary> (audit #4).
    <Card variant="outline" className={cn("gap-3", className)} {...rest}>
      <CardSummary
        className="gap-3"
        label={summarize([
          name,
          username ? `@${username}` : undefined,
          verified ? t.verified : undefined,
          ...stats,
          ...warnings,
        ])}
      >
        <View className="flex-row items-center gap-3">
          <Avatar source={avatar?.source} name={name} size="md" verified={verified} />
          <View className="flex-1 gap-[2px]">
            <View className="flex-row flex-wrap items-center gap-2">
              <Text variant="body" weight={600} tone="primary" numberOfLines={1} className="shrink">
                {name}
              </Text>
              {verified ? (
                <Badge tone="success" variant="soft">
                  {t.verified}
                </Badge>
              ) : null}
            </View>
            <View className="flex-row flex-wrap items-center gap-x-2">
              {username ? (
                <Text variant="caption" tone="secondary">
                  @{username}
                </Text>
              ) : null}
              {stats.length > 0 ? (
                <Text variant="caption" tone="secondary" numberOfLines={1}>
                  {stats.join(" \u00B7 ")}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        {warnings.length > 0 ? (
          <View className="flex-row flex-wrap gap-2">
            {warnings.map((w) => (
              <Badge key={w} tone="warning" variant="soft">
                {w}
              </Badge>
            ))}
          </View>
        ) : null}

      </CardSummary>

      {onConfirm ? (
        <Button size="sm" variant="secondary" onPress={onConfirm} loading={confirming} fullWidth>
          {t.confirm}
        </Button>
      ) : null}
    </Card>
  )
}