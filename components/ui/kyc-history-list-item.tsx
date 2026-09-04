/**
 * Kahade — <KycHistoryListItem> (§9.17 List Item, §3.1 Mono, §13 format).
 * API: GET /v1/kyc/history
 *
 * Satu pengajuan KYC dalam riwayat (paginated): IconBox IdentificationCard
 * -> "Pengajuan #N" + jenis dokumen -> tanggal Mono -> <KycStatusBadge> di
 * kanan -> alasan penolakan (bila REJECTED) sebagai caption danger.
 *
 * Keputusan non-obvious:
 *   - Memakai kembali <KycStatusBadge> dari kyc-status-card agar warna &
 *     label status identik dengan kartu ringkasan di atas daftar.
 *   - Alasan penolakan ditampilkan di baris kedua, bukan disembunyikan di
 *     detail: pengguna membuka riwayat justru untuk tahu "kenapa ditolak".
 *     numberOfLines={2}; selengkapnya lewat onPress.
 *   - ID pengajuan Mono (`requestId`) opsional untuk dukungan CS — teknis.
 *   - Jenis dokumen dilabeli manusiawi via DOC_LABELS (KTP/Paspor/SIM).
 */
import { IdentificationCard } from "phosphor-react-native"
import { View } from "react-native"

import { IconBox } from "@/components/ui/icon-box"
import { KycStatusBadge, type KycStatus } from "@/components/ui/kyc-status-card"
import { ListItem, type ListItemProps } from "@/components/ui/list-item"
import { Text } from "@/components/ui/text"

export type KycDocumentType = "KTP" | "PASSPORT" | "SIM"

export const KYC_DOC_LABELS: Record<KycDocumentType, string> = {
  KTP: "KTP",
  PASSPORT: "Paspor",
  SIM: "SIM",
}

export type KycHistoryListItemProps = Omit<ListItemProps, "title" | "subtitle" | "leading" | "trailing"> & {
  /** Nomor urut pengajuan (1 = pertama) */
  attempt: number
  status: KycStatus | string
  documentType?: KycDocumentType | string
  /** Sudah diformat (§13) */
  submittedAt: string
  /** Sudah diformat — tampil bila sudah diputus */
  reviewedAt?: string
  rejectionReason?: string
  /** ID teknis untuk CS — Mono */
  requestId?: string
}

export function KycHistoryListItem({
  attempt,
  status,
  documentType,
  submittedAt,
  reviewedAt,
  rejectionReason,
  requestId,
  ...rest
}: KycHistoryListItemProps) {
  const docLabel = documentType ? KYC_DOC_LABELS[documentType as KycDocumentType] ?? documentType : undefined
  const rejected = status === "REJECTED"
  const boxVariant = status === "APPROVED" ? "success" : rejected || status === "REVOKED" ? "danger" : "surface"

  return (
    <ListItem
      leading={<IconBox icon={IdentificationCard} size="md" variant={boxVariant} />}
      title={`Pengajuan #${attempt}${docLabel ? ` \u00B7 ${docLabel}` : ""}`}
      subtitle={
        <View className="gap-[2px]">
          <View className="flex-row flex-wrap items-center gap-x-2">
            <Text variant="monoBody" tone="tertiary">
              {submittedAt}
            </Text>
            {reviewedAt ? (
              <Text variant="caption" tone="tertiary">
                {"\u2192"} {reviewedAt}
              </Text>
            ) : null}
            {requestId ? (
              <Text variant="monoBody" tone="tertiary" numberOfLines={1}>
                {requestId}
              </Text>
            ) : null}
          </View>
          {rejected && rejectionReason ? (
            <Text variant="caption" tone="danger" numberOfLines={2} className="leading-5">
              {rejectionReason}
            </Text>
          ) : null}
        </View>
      }
      trailing={<KycStatusBadge status={status} />}
      titleLines={1}
      accessibilityLabel={[`Pengajuan KYC ${attempt}`, docLabel, submittedAt, rejectionReason]
        .filter(Boolean)
        .join(", ")}
      {...rest}
    />
  )
}
