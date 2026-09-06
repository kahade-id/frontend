/**
 * Kahade — <TwoFactorStatusCard> (§9.3 Card, §2.3 semantic eksklusif status,
 * §14 Keamanan).
 * API: GET /v1/auth/2fa/status
 *
 * Ringkasan status 2FA di layar Keamanan: IconBox ShieldCheck/ShieldWarning
 * -> judul + status -> metode aktif + jumlah kode cadangan -> aksi.
 *
 * Keputusan non-obvious:
 *   - Hanya DUA kondisi warna: aktif = success, nonaktif = warning. Bukan
 *     danger — 2FA mati bukan kesalahan, tapi risiko yang layak disorot.
 *   - Kode cadangan tersisa ditampilkan Mono ("3 / 10"); bila <= 2 diberi
 *     Badge warning "Hampir habis" + aksi "Buat ulang kode": ini satu-satunya
 *     kondisi turunan yang perlu tindakan.
 *   - Aksi utama bergantung state: nonaktif -> Button primary "Aktifkan";
 *     aktif -> Button secondary "Kelola" (jarang ditekan, jangan menonjol).
 *   - Metode ditulis manusiawi via `METHOD_LABELS` ("Aplikasi autentikator",
 *     "SMS", "Email") — enum backend tidak boleh bocor ke UI.
 */
import { ShieldCheck, ShieldWarning } from "phosphor-react-native"
import { View } from "react-native"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardSummary, type CardProps } from "@/components/ui/card"
import { IconBox } from "@/components/ui/icon-box"
import { KeyValue, KeyValueList } from "@/components/ui/key-value"
import { Skeleton, SkeletonText } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"
import { summarize } from "@/lib/a11y"
import { cn } from "@/lib/cn"

export type TwoFactorMethod = "TOTP" | "SMS" | "EMAIL"

export const TWO_FACTOR_METHOD_LABELS: Record<TwoFactorMethod, string> = {
  TOTP: "Aplikasi autentikator",
  SMS: "SMS",
  EMAIL: "Email",
}

export type TwoFactorStatusLabels = {
  title: string
  enabled: string
  disabled: string
  method: string
  backupCodes: string
  lowBackup: string
  enable: string
  manage: string
  regenerate: string
  disabledHint: string
}

export type TwoFactorStatusCardProps = Omit<CardProps, "children"> & {
  enabled: boolean
  method?: TwoFactorMethod | string
  /** Kode cadangan tersisa */
  backupCodesRemaining?: number
  backupCodesTotal?: number
  /** Sudah diformat (§13), mis. "12 Agu 2026" */
  enabledAt?: string
  onEnable?: () => void
  onManage?: () => void
  onRegenerateBackup?: () => void
  loading?: boolean
  labels?: Partial<TwoFactorStatusLabels>
}

const DEFAULT_LABELS: TwoFactorStatusLabels = {
  title: "Verifikasi dua langkah",
  enabled: "Aktif",
  disabled: "Nonaktif",
  method: "Metode",
  backupCodes: "Kode cadangan",
  lowBackup: "Hampir habis",
  enable: "Aktifkan",
  manage: "Kelola",
  regenerate: "Buat ulang kode",
  disabledHint: "Lindungi akun dengan kode tambahan setiap kali masuk dari perangkat baru.",
}

const LOW_BACKUP_THRESHOLD = 2

export function TwoFactorStatusCard({
  enabled,
  method,
  backupCodesRemaining,
  backupCodesTotal,
  enabledAt,
  onEnable,
  onManage,
  onRegenerateBackup,
  loading = false,
  labels,
  className,
  ...rest
}: TwoFactorStatusCardProps) {
  const t = { ...DEFAULT_LABELS, ...labels }

  if (loading) {
    return (
      <Card className={cn("gap-4", className)} {...rest}>
        <View className="flex-row items-center gap-3">
          <Skeleton width={48} height={48} shape="card" />
          <View className="flex-1 gap-2">
            <Skeleton height={16} className="w-2/3" />
            <Skeleton height={12} className="w-1/3" />
          </View>
        </View>
        <SkeletonText lines={2} />
      </Card>
    )
  }

  const methodLabel = method ? (TWO_FACTOR_METHOD_LABELS[method as TwoFactorMethod] ?? method) : undefined
  const lowBackup =
    enabled && typeof backupCodesRemaining === "number" && backupCodesRemaining <= LOW_BACKUP_THRESHOLD

  return (
    // Label di <CardSummary>: kartu punya Button Kelola/Aktifkan/Regenerasi
    // yang akan tertelan bila root diberi `accessible` (audit #4).
    <Card className={cn("gap-4", className)} {...rest}>
      <CardSummary
        className="gap-4"
        label={summarize([
          t.title,
          enabled ? t.enabled : t.disabled,
          enabledAt && enabled ? `sejak ${enabledAt}` : undefined,
          enabled && methodLabel ? `${t.method} ${methodLabel}` : undefined,
          enabled && typeof backupCodesRemaining === "number"
            ? `${t.backupCodes} ${backupCodesRemaining}${typeof backupCodesTotal === "number" ? ` dari ${backupCodesTotal}` : ""}${lowBackup ? `, ${t.lowBackup}` : ""}`
            : undefined,
          !enabled ? t.disabledHint : undefined,
        ])}
      >
        <View className="flex-row items-center gap-3">
          <IconBox
            icon={enabled ? ShieldCheck : ShieldWarning}
            size="lg"
            variant={enabled ? "success" : "warning"}
          />
          <View className="flex-1 gap-1">
            <Text ellipsizeMode="tail" numberOfLines={2} variant="h3" tone="primary">
              {t.title}
            </Text>
            <View className="flex-row items-center gap-2">
              <Badge tone={enabled ? "success" : "warning"} variant="soft" dot>
                {enabled ? t.enabled : t.disabled}
              </Badge>
              {enabledAt && enabled ? (
                <Text variant="caption" tone="secondary">
                  sejak {enabledAt}
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        {enabled ? (
          <KeyValueList>
            {methodLabel ? <KeyValue label={t.method} value={methodLabel} /> : null}
            {typeof backupCodesRemaining === "number" ? (
              <KeyValue
                label={t.backupCodes}
                value={
                  <View className="flex-row items-center gap-2">
                    {lowBackup ? (
                      <Badge tone="warning" variant="soft">
                        {t.lowBackup}
                      </Badge>
                    ) : null}
                    <Text variant="monoBody" tone="primary">
                      {backupCodesRemaining}
                      {typeof backupCodesTotal === "number" ? ` / ${backupCodesTotal}` : ""}
                    </Text>
                  </View>
                }
              />
            ) : null}
          </KeyValueList>
        ) : (
          <Text variant="body" tone="secondary" className="leading-6">
            {t.disabledHint}
          </Text>
        )}
      </CardSummary>

      <View className="flex-row gap-3">
        {enabled ? (
          <>
            {onManage ? (
              <Button accessibilityHint="Ketuk untuk berinteraksi" variant="secondary" size="sm" onPress={onManage} className="flex-1 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
                {t.manage}
              </Button>
            ) : null}
            {lowBackup && onRegenerateBackup ? (
              <Button variant="primary" size="sm" onPress={onRegenerateBackup} className="flex-1">
                {t.regenerate}
              </Button>
            ) : null}
          </>
        ) : onEnable ? (
          <Button variant="primary" size="sm" onPress={onEnable} fullWidth>
            {t.enable}
          </Button>
        ) : null}
      </View>
    </Card>
  )
}