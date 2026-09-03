/**
 * Kahade — <WalletBalanceCard> kartu saldo dompet (§9.6 Stat/Highlight
 * inverted, §3.1 Mono Large untuk nominal utama, §13 format, §14 keamanan).
 *
 * Header tab Dompet & beranda: saldo tersedia (Mono Large) + saldo tertahan
 * di escrow (Mono Body) + tiga aksi cepat (Isi saldo, Tarik, Transfer) yang
 * memetakan ke `POST /v1/wallet/topup|withdraw|transfer`.
 *
 * Keputusan non-obvious:
 *   - Default `variant="inverted"` (bg-primary, teks primary-foreground):
 *     ini satu-satunya "Stat/Highlight" di layar Dompet — hitam sebagai
 *     otoritas (§1) pada angka yang paling dipercaya user. Ikut invert di
 *     dark mode otomatis (§9.6). `variant="default"` tersedia bila kartu ini
 *     dipasang di beranda yang sudah punya highlight lain (§1 "satu titik
 *     kejutan per layar").
 *   - `hidden` controlled + `onToggleHidden`: preferensi "sembunyikan saldo"
 *     harus persisten lintas sesi (SecureStore/AsyncStorage) — itu urusan
 *     pemanggil, komponen tidak menyimpan state sendiri. Ikon Eye/EyeSlash
 *     memakai tone "inverse" di kartu inverted agar kontras di atas hitam.
 *   - Saldo tertahan (escrow) ditampilkan SELALU, walau 0: user escrow perlu
 *     yakin "tidak ada dana yang menggantung" — absennya baris justru
 *     menimbulkan pertanyaan. Ikut disembunyikan saat `hidden`.
 *   - Aksi cepat = tombol ikon bertumpuk label (IconBox + caption), bukan
 *     <Button> berjajar: tiga Button 48px selebar kartu memakan 1/3 tinggi
 *     kartu dan bersaing dengan nominal. Di kartu inverted kotak ikon memakai
 *     border primary-foreground (garis putih di atas hitam) — hierarki dari
 *     border, bukan fill (§6).
 *   - Tidak ada `adjustsFontSizeToFit` (§3.2 type scale FIXED). Saldo di atas
 *     Rp999.999.999.999 (12 digit) tidak realistis untuk dompet ritel; kalau
 *     terjadi, `Amount` tetap memotong dengan numberOfLines=1 + ellipsis.
 *   - Loading = Skeleton pada nominal saja; label & aksi tetap tampil supaya
 *     layout stabil dan aksi tetap bisa dijangkau saat refetch.
 */
import { ArrowCircleDown, ArrowCircleUp, Eye, EyeSlash, PaperPlaneTilt } from "phosphor-react-native"
import { Pressable, View } from "react-native"

import { Amount } from "@/components/ui/amount"
import { Card, type CardProps, type CardVariant } from "@/components/ui/card"
import { Icon, type IconComponent, type IconTone } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Skeleton } from "@/components/ui/skeleton"
import { Text, type TextTone } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { tokens } from "@/lib/tokens"

export type WalletQuickAction = {
  key: "topup" | "withdraw" | "transfer" | (string & {})
  label: string
  icon: IconComponent
  onPress: () => void
  disabled?: boolean
}

export type WalletBalanceCardLabels = {
  available: string
  held: string
  hide: string
  show: string
}

const DEFAULT_LABELS: WalletBalanceCardLabels = {
  available: "Saldo tersedia",
  held: "Tertahan di escrow",
  hide: "Sembunyikan saldo",
  show: "Tampilkan saldo",
}

export type WalletBalanceCardProps = Omit<CardProps, "children" | "onPress" | "padded"> & {
  /** Saldo yang bisa dipakai */
  available: number
  /** Dana yang sedang ditahan escrow (order berjalan) */
  held?: number
  hidden?: boolean
  onToggleHidden?: () => void
  /** Aksi cepat; default: Isi saldo / Tarik / Transfer bila callback diberikan */
  actions?: WalletQuickAction[]
  onTopUp?: () => void
  onWithdraw?: () => void
  onTransfer?: () => void
  loading?: boolean
  variant?: Extract<CardVariant, "inverted" | "default" | "elevated">
  labels?: Partial<WalletBalanceCardLabels>
}

export function WalletBalanceCard({
  available,
  held = 0,
  hidden = false,
  onToggleHidden,
  actions,
  onTopUp,
  onWithdraw,
  onTransfer,
  loading = false,
  variant = "inverted",
  labels,
  className,
  ...rest
}: WalletBalanceCardProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const inverted = variant === "inverted"

  // Di kartu inverted SEMUA teks "inverse" — token tidak punya inverse-secondary,
  // dan opacity pada teks akan menurunkan kontras di bawah AA (lihat StatCard).
  const textTone: TextTone = inverted ? "inverse" : "secondary"
  const valueTone = inverted ? "inverse" : "primary"
  const iconTone: IconTone = inverted ? "inverse" : "active"

  const resolvedActions: WalletQuickAction[] =
    actions ??
    (
      [
        onTopUp && { key: "topup", label: "Isi saldo", icon: ArrowCircleDown, onPress: onTopUp },
        onWithdraw && { key: "withdraw", label: "Tarik", icon: ArrowCircleUp, onPress: onWithdraw },
        onTransfer && { key: "transfer", label: "Transfer", icon: PaperPlaneTilt, onPress: onTransfer },
      ] as Array<WalletQuickAction | undefined>
    ).filter((a): a is WalletQuickAction => !!a)

  return (
    <Card variant={variant} className={cn("gap-5", className)} {...rest}>
      {/* Label + toggle */}
      <View className="flex-row items-center justify-between gap-3">
        <Text variant="label" tone={textTone}>
          {t.available}
        </Text>
        {onToggleHidden ? (
          <Pressable
            onPress={onToggleHidden}
            hitSlop={tokens.space[2]}
            accessibilityRole="button"
            accessibilityLabel={hidden ? t.show : t.hide}
            accessibilityState={{ checked: !hidden }}
          >
            <Icon icon={hidden ? EyeSlash : Eye} size="sm" tone={iconTone} />
          </Pressable>
        ) : null}
      </View>

      {/* Nominal utama */}
      <View className="gap-1">
        {loading ? (
          <Skeleton height={tokens.typography.monoLarge.lineHeight} className="w-48" />
        ) : (
          <Amount value={available} size="large" tone={valueTone} hidden={hidden} />
        )}
        <View className="flex-row items-center gap-2">
          <Text variant="caption" tone={textTone}>
            {t.held}
          </Text>
          {loading ? (
            <Skeleton height={tokens.typography.caption.lineHeight} className="w-20" />
          ) : (
            <Amount value={held} size="body" tone={valueTone} hidden={hidden} />
          )}
        </View>
      </View>

      {/* Aksi cepat */}
      {resolvedActions.length > 0 ? (
        <View className="flex-row gap-3" accessibilityRole="toolbar">
          {resolvedActions.map((a) => (
            <PressableScale
              key={a.key}
              accessibilityRole="button"
              accessibilityLabel={a.label}
              onPress={a.onPress}
              disabled={a.disabled}
              containerClassName="flex-1"
              className="items-center gap-2 py-1"
            >
              <View
                className={cn(
                  "h-12 w-12 items-center justify-center rounded-md border",
                  inverted ? "border-primary-foreground bg-primary" : "border-border bg-surface-elevated",
                )}
              >
                <Icon icon={a.icon} size="md" tone={iconTone} />
              </View>
              <Text variant="caption" weight={500} tone={inverted ? "inverse" : "primary"} numberOfLines={1}>
                {a.label}
              </Text>
            </PressableScale>
          ))}
        </View>
      ) : null}
    </Card>
  )
}
