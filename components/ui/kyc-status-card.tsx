/**
 * Kahade — <KycStatusCard> + <KycStatusBadge> status verifikasi identitas
 * (§9.6 Card, §9.7 Badge, §2.3 semantic eksklusif status, §9.1 Button).
 *
 * Merangkum `GET /v1/kyc/status` di halaman Profil/Keamanan dan sebagai
 * gerbang fitur yang butuh KYC (transfer, tarik saldo). Anatomi:
 *   IconBox (ikon per status) + judul status + Badge
 *   deskripsi: apa artinya & langkah berikutnya
 *   opsional: alasan penolakan (kotak surface, border-l TIDAK dipakai — §6)
 *   opsional: meta Mono (tanggal kirim / disetujui)
 *   CTA sesuai status: Verifikasi sekarang / Kirim ulang / Lihat riwayat
 *
 * Keputusan non-obvious:
 *   - Status: NOT_SUBMITTED (neutral) / PENDING (warning — sedang ditinjau)
 *     / APPROVED (success) / REJECTED (danger — satu-satunya merah, karena
 *     user harus bertindak) / REVOKED (danger — akses dicabut, juga butuh
 *     tindakan). Label default Bahasa Indonesia, bisa ditimpa (§12 i18n).
 *   - Kartu APPROVED sengaja paling "sepi": IconBox success + Badge, tanpa
 *     CTA. Verifikasi yang sudah selesai bukan momen untuk ramai.
 *   - `rejectionReason` dari backend ditampilkan apa adanya di blok
 *     bg-background dengan border — bukan Alert danger penuh: kartu sudah
 *     membawa Badge danger; dua elemen merah dalam satu kartu berlebihan.
 *   - `onResubmit` (POST /v1/kyc/resubmit) hanya tampil bila REJECTED/REVOKED;
 *     `onSubmit` (POST /v1/kyc/submit) bila NOT_SUBMITTED. PENDING tidak punya
 *     aksi — menunggu tidak perlu tombol.
 */
import { Clock, IdentificationCard, SealCheck, SealWarning, XCircle } from "phosphor-react-native"
import { View, type ViewProps } from "react-native"

import { Badge, type BadgeProps, type BadgeTone } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardSummary, type CardProps } from "@/components/ui/card"
import type { IconComponent } from "@/components/ui/icon"
import { IconBox, type IconBoxVariant } from "@/components/ui/icon-box"
import { Skeleton } from "@/components/ui/skeleton"
import { Text } from "@/components/ui/text"
import { summarize } from "@/lib/a11y"
import { cn } from "@/lib/cn"

export type KycStatus = "NOT_SUBMITTED" | "PENDING" | "APPROVED" | "REJECTED" | "REVOKED"

export const KYC_STATUS_LABELS: Record<KycStatus, string> = {
  NOT_SUBMITTED: "Belum diverifikasi",
  PENDING: "Sedang ditinjau",
  APPROVED: "Terverifikasi",
  REJECTED: "Ditolak",
  REVOKED: "Dicabut",
}

const STATUS_TONE: Record<KycStatus, BadgeTone> = {
  NOT_SUBMITTED: "neutral",
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  REVOKED: "danger",
}

const STATUS_ICON: Record<KycStatus, IconComponent> = {
  NOT_SUBMITTED: IdentificationCard,
  PENDING: Clock,
  APPROVED: SealCheck,
  REJECTED: XCircle,
  REVOKED: SealWarning,
}

const STATUS_BOX: Record<KycStatus, IconBoxVariant> = {
  NOT_SUBMITTED: "surface",
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  REVOKED: "danger",
}

export function isKycStatus(s: string): s is KycStatus {
  return s in KYC_STATUS_LABELS
}

export type KycStatusBadgeProps = Omit<BadgeProps, "children" | "tone"> & {
  status: KycStatus | string
  labels?: Partial<Record<KycStatus, string>>
}

export function KycStatusBadge({ status, labels, variant = "soft", ...rest }: KycStatusBadgeProps) {
  const known = isKycStatus(status)
  const label = known ? labels?.[status] ?? KYC_STATUS_LABELS[status] : status
  return (
    <Badge tone={known ? STATUS_TONE[status] : "neutral"} variant={variant} accessibilityLabel={`Status KYC: ${label}`} {...rest}>
      {label}
    </Badge>
  )
}

export type KycStatusCardLabels = Record<KycStatus, string> & {
  descriptions: Record<KycStatus, string>
  submit: string
  resubmit: string
  history: string
  reasonTitle: string
  submittedAt: string
  approvedAt: string
}

const DEFAULT_LABELS: KycStatusCardLabels = {
  ...KYC_STATUS_LABELS,
  descriptions: {
    NOT_SUBMITTED: "Verifikasi identitas dibutuhkan untuk transfer dan tarik saldo. Siapkan KTP dan foto selfie.",
    PENDING: "Dokumen Anda sedang kami periksa. Biasanya selesai dalam 1×24 jam kerja.",
    APPROVED: "Identitas Anda sudah terverifikasi. Semua fitur dompet aktif.",
    REJECTED: "Dokumen belum bisa kami terima. Periksa alasannya lalu kirim ulang.",
    REVOKED: "Verifikasi Anda dicabut. Kirim ulang dokumen untuk mengaktifkan kembali fitur dompet.",
  },
  submit: "Verifikasi sekarang",
  resubmit: "Kirim ulang dokumen",
  history: "Lihat riwayat",
  reasonTitle: "Alasan",
  submittedAt: "Dikirim",
  approvedAt: "Disetujui",
}

export type KycStatusCardProps = Omit<CardProps, "children" | "variant" | "padded" | "onPress"> & {
  status: KycStatus | string
  rejectionReason?: string
  /** Sudah diformat pemanggil (§13) */
  submittedAt?: string
  approvedAt?: string
  onSubmit?: () => void
  onResubmit?: () => void
  onViewHistory?: () => void
  labels?: Partial<Omit<KycStatusCardLabels, "descriptions">> & { descriptions?: Partial<Record<KycStatus, string>> }
}

export function KycStatusCard({
  status,
  rejectionReason,
  submittedAt,
  approvedAt,
  onSubmit,
  onResubmit,
  onViewHistory,
  labels,
  className,
  ...rest
}: KycStatusCardProps) {
  const t: KycStatusCardLabels = {
    ...DEFAULT_LABELS,
    ...labels,
    descriptions: { ...DEFAULT_LABELS.descriptions, ...labels?.descriptions },
  }
  const s: KycStatus = isKycStatus(status) ? status : "NOT_SUBMITTED"
  const needsResubmit = s === "REJECTED" || s === "REVOKED"
  const meta = [submittedAt ? `${t.submittedAt} ${submittedAt}` : undefined, approvedAt ? `${t.approvedAt} ${approvedAt}` : undefined].filter(Boolean)

  return (
    // Label TIDAK di root: kartu ini punya Button (Ajukan/Kirim ulang/Riwayat)
    // yang akan tertelan oleh `accessible` root. Blok info dibungkus
    // <CardSummary>; tombol tetap fokusable terpisah (audit #4).
    <Card className={cn("gap-4", className)} {...rest}>
      <CardSummary
        className="gap-4"
        label={summarize([
          `Verifikasi identitas: ${t[s]}`,
          t.descriptions[s],
          needsResubmit && rejectionReason ? `${t.reasonTitle}: ${rejectionReason}` : undefined,
          ...meta,
        ])}
      >
        <View className="flex-row items-center gap-3">
          <IconBox icon={STATUS_ICON[s]} size="lg" variant={STATUS_BOX[s]} weight={s === "APPROVED" ? "fill" : "regular"} />
          <View className="flex-1 gap-1">
            <Text variant="h3" tone="primary">
              {t[s]}
            </Text>
            <View className="flex-row">
              <KycStatusBadge status={s} labels={t} />
            </View>
          </View>
        </View>

        <Text variant="body" tone="secondary">
          {t.descriptions[s]}
        </Text>

        {needsResubmit && rejectionReason ? (
          <View className="gap-1 rounded-sm border border-border bg-background p-3">
            <Text variant="label" tone="primary">
              {t.reasonTitle}
            </Text>
            <Text variant="caption" tone="secondary">
              {rejectionReason}
            </Text>
          </View>
        ) : null}

        {meta.length > 0 ? (
          <Text variant="caption" tone="secondary" className="font-mono-500 tracking-mono tabular-nums">
            {meta.join(" · ")}
          </Text>
        ) : null}
      </CardSummary>

      {s === "NOT_SUBMITTED" && onSubmit ? (
        <Button variant="primary" onPress={onSubmit}>
          {t.submit}
        </Button>
      ) : null}
      {needsResubmit && onResubmit ? (
        <Button variant="primary" onPress={onResubmit}>
          {t.resubmit}
        </Button>
      ) : null}
      {onViewHistory && s !== "NOT_SUBMITTED" ? (
        <Button variant="ghost" onPress={onViewHistory}>
          {t.history}
        </Button>
      ) : null}
    </Card>
  )
}

export function KycStatusCardSkeleton({ className, ...rest }: Omit<ViewProps, "children"> & { className?: string }) {
  return (
    <View accessible accessibilityRole="progressbar" className={cn("w-full gap-4 rounded-md border border-border bg-surface p-5", className)} accessibilityLabel="Memuat status verifikasi" {...rest}>
      <View className="flex-row items-center gap-3">
        <Skeleton width={48} height={48} />
        <View className="flex-1 gap-2">
          <Skeleton height={20} className="w-36" />
          <Skeleton height={20} className="w-24" />
        </View>
      </View>
      <Skeleton height={14} className="w-full" />
      <Skeleton height={14} className="w-5/6" />
      <Skeleton height={44} className="w-full" />
    </View>
  )
}
