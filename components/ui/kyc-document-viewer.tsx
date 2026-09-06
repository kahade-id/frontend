/**
 * Kahade — <KycDocumentViewer> (§9.19 Dokumen Upload/KYC Viewer, §9.6 Card,
 * §2.3 semantic eksklusif untuk status, §5 radius foto, §13 format tanggal,
 * §12 Voice & Tone).
 *
 * Pratinjau dokumen identitas yang SUDAH diunggah pengguna (KTP, selfie,
 * NPWP, PDF) beserta status verifikasi per dokumen dan alasan penolakan.
 * Ini layar "menunggu/ditolak" — bukan layar unggah (<UploadField>): pengguna
 * datang ke sini untuk memastikan berkas mana yang bermasalah dan apa yang
 * harus diulang.
 *
 * Anatomi tiap dokumen: label + <StatusIndicator> -> gambar (Picture,
 * rasio kartu ID 1.586 untuk KTP/NPWP, 1:1 untuk selfie, baris berkas untuk
 * PDF) -> alasan penolakan (<Alert tone="danger">) -> tombol "Unggah ulang"
 * (hanya bila rejected & `onReupload`) -> waktu unggah (Mono).
 *
 * Keputusan non-obvious:
 *   - Status memakai <StatusIndicator> (titik + label), BUKAN <Badge> seperti
 *     DeliveryProofViewer: di sini status berulang untuk 2–4 dokumen dalam
 *     satu kartu; Badge dengan fill akan membuat kartu "berkedip" warna.
 *     Titik 8px lebih tenang dan tetap membedakan 3 status. `pulse` menyala
 *     saat "pending" — verifikasi sedang berjalan di backend (status live).
 *   - Gambar dokumen selalu `resizeMode="contain"` di atas `bg-surface`,
 *     BUKAN cover: petugas/pengguna harus melihat SELURUH KTP termasuk tepi
 *     (nomor NIK ada di kiri atas, tanda tangan di kanan bawah). Cover akan
 *     memotong justru bagian yang diverifikasi.
 *   - Rasio 1.586 (85.6 x 54 mm — ISO/IEC 7810 ID-1) untuk KTP/NPWP/SIM agar
 *     placeholder Skeleton sudah berbentuk kartu sebelum gambar termuat, dan
 *     tidak ada lompatan layout. Selfie 1:1 karena kamera depan biasanya
 *     dipotong persegi di alur KYC.
 *   - `masked` menutup gambar dengan overlay + ikon EyeSlash sampai pengguna
 *     mengetuk "Tampilkan": dokumen identitas adalah data pribadi; layar
 *     ini sering dibuka di tempat umum. Default `false` — pemanggil
 *     menyalakannya di layar profil, mematikannya di alur KYC aktif.
 *   - Alasan penolakan dirender <Alert tone="danger"> per dokumen (bukan
 *     satu Alert di atas kartu) supaya pengguna tahu PERSIS berkas mana yang
 *     harus diulang. `rejectionReason` = teks dari backend, sudah dalam
 *     Bahasa Indonesia, tidak diformat ulang.
 *   - Tombol "Unggah ulang" `secondary` (bukan primary): aksi ini memulai
 *     ulang alur Push (§10), bukan aksi final; primary disediakan untuk CTA
 *     halaman ("Kirim verifikasi") yang dikelola pemanggil.
 *   - `onOpen(doc)` untuk zoom/fullscreen ditangani pemanggil (Push viewer),
 *     konsisten dengan DeliveryProofViewer & ShowcaseGalleryGrid.
 *   - `uploadedAtLabel` sudah diformat pemanggil (§13, "3 Sep 2026, 14:30").
 *   - Label default i18n-ready lewat `labels` (§12) — TIDAK ada string
 *     status yang hardcoded di JSX.
 */
import { ArrowCounterClockwise, EyeSlash, FilePdf } from "phosphor-react-native"
import { View, type ViewProps } from "react-native"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Icon } from "@/components/ui/icon"
import { Picture } from "@/components/ui/picture"
import { PressableScale } from "@/components/ui/pressable-scale"
import { StatusIndicator, type StatusIndicatorTone } from "@/components/ui/status-indicator"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { formatFileSize } from "@/lib/format"
// UX: haptic feedback ensured for onPress (light) — improves confirmation

export type KycDocumentStatus = "pending" | "approved" | "rejected"

export type KycDocumentType = "ktp" | "selfie" | "npwp" | "sim" | "passport" | "other"

export type KycDocument = {
  id: string
  type: KycDocumentType
  /** Nama tampil; default dari `labels.type[type]` */
  label?: string
  status: KycDocumentStatus
  /** Sumber gambar (https / file://). Kosong bila `file` diisi. */
  imageUri?: string
  /** Berkas non-gambar (PDF) */
  file?: { name: string; size?: number }
  /** Teks dari backend, hanya berarti saat status "rejected" */
  rejectionReason?: string
  /** Sudah diformat pemanggil (§13) */
  uploadedAtLabel?: string
}

export type KycDocumentViewerLabels = {
  title: string
  status: Record<KycDocumentStatus, string>
  type: Record<KycDocumentType, string>
  rejectedTitle: string
  reupload: string
  reveal: string
  uploadedAt: string
  open: (label: string) => string
  alt: (label: string) => string
}

export type KycDocumentViewerProps = Omit<ViewProps, "children"> & {
  documents: KycDocument[]
  /** Tutup gambar dengan overlay sampai pengguna mengetuk "Tampilkan" */
  masked?: boolean
  /** Dipanggil saat pengguna membuka overlay masked pada satu dokumen */
  onReveal?: (doc: KycDocument) => void
  /** Buka viewer penuh/zoom (Push, §10) */
  onOpen?: (doc: KycDocument) => void
  /** Mulai ulang unggah untuk dokumen yang ditolak */
  onReupload?: (doc: KycDocument) => void
  /** Id dokumen yang sedang diproses ulang -> tombolnya loading */
  reuploadingId?: string
  /** Tampilkan judul kartu (default true). Matikan bila dipasang di Section. */
  showTitle?: boolean
  labels?: Partial<KycDocumentViewerLabels>
  className?: string
}

const DEFAULT_LABELS: KycDocumentViewerLabels = {
  title: "Dokumen verifikasi",
  status: { pending: "Sedang diverifikasi", approved: "Disetujui", rejected: "Ditolak" },
  type: {
    ktp: "KTP",
    selfie: "Foto selfie",
    npwp: "NPWP",
    sim: "SIM",
    passport: "Paspor",
    other: "Dokumen lain",
  },
  rejectedTitle: "Perlu diunggah ulang",
  reupload: "Unggah ulang",
  reveal: "Tampilkan",
  uploadedAt: "Diunggah",
  open: (label) => `Buka ${label} ukuran penuh`,
  alt: (label) => `Foto ${label} yang Anda unggah`,
}

const statusTone: Record<KycDocumentStatus, StatusIndicatorTone> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
}

/** ISO/IEC 7810 ID-1 (KTP/SIM/NPWP) = 85.6 x 54 mm */
const ID_CARD_RATIO = 85.6 / 54
const aspectByType: Record<KycDocumentType, number> = {
  ktp: ID_CARD_RATIO,
  sim: ID_CARD_RATIO,
  npwp: ID_CARD_RATIO,
  passport: 125 / 88,
  selfie: 1,
  other: 4 / 3,
}

function DocumentImage({
  doc,
  label,
  masked,
  onReveal,
  onOpen,
  t,
}: {
  doc: KycDocument
  label: string
  masked: boolean
  onReveal?: (doc: KycDocument) => void
  onOpen?: (doc: KycDocument) => void
  t: KycDocumentViewerLabels
}) {
  if (doc.file && !doc.imageUri) {
    const row = (
      <View accessible={false} className="flex-row items-center gap-3 rounded-sm border border-border bg-surface px-3 py-3">
        <Icon icon={FilePdf} size="sm" />
        <Text variant="body" className="flex-1" numberOfLines={1}>
          {doc.file.name}
        </Text>
        {doc.file.size != null ? (
          <Text variant="monoBody" tone="secondary">
            {formatFileSize(doc.file.size)}
          </Text>
        ) : null}
      </View>
    )
    return onOpen ? (
      <PressableScale hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityRole="button"
        scaleOnPress={false}
        onPress={() => onOpen(doc)}
        accessibilityRole="button"
        accessibilityLabel={`${doc.file.name}, ${t.open(label)}`}
      >
        {row}
      </PressableScale>
    ) : (
      row
    )
  }

  if (!doc.imageUri) return null

  const picture = (
    <Picture
      source={doc.imageUri}
      alt={t.alt(label)}
      aspectRatio={aspectByType[doc.type]}
      resizeMode="contain"
      className="w-full"
    />
  )

  if (masked) {
    return (
      <PressableScale
        scaleOnPress={false}
        onPress={() => onReveal?.(doc)}
        accessibilityRole="button"
        accessibilityLabel={`${t.reveal} ${label}`}
        className="relative overflow-hidden rounded-md"
      >
        {/* Gambar tetap dimuat (cache siap) tetapi ditutup penuh */}
        <View className="opacity-0">{picture}</View>
        <View className="absolute inset-0 items-center justify-center gap-2 border border-border bg-surface">
          <Icon icon={EyeSlash} size="lg" />
          <Text variant="label" tone="secondary">
            {t.reveal}
          </Text>
        </View>
      </PressableScale>
    )
  }

  if (!onOpen) return picture
  return (
    <PressableScale onPress={() => onOpen(doc)} accessibilityRole="imagebutton" accessibilityLabel={t.open(label)}>
      {picture}
    </PressableScale>
  )
}

export function KycDocumentViewer({
  documents,
  masked = false,
  onReveal,
  onOpen,
  onReupload,
  reuploadingId,
  showTitle = true,
  labels,
  className,
  ...rest
}: KycDocumentViewerProps) {
  const t: KycDocumentViewerLabels = {
    ...DEFAULT_LABELS,
    ...labels,
    status: { ...DEFAULT_LABELS.status, ...labels?.status },
    type: { ...DEFAULT_LABELS.type, ...labels?.type },
  }

  return (
    <Card padded className={cn("gap-6", className)} {...rest}>
      {showTitle ? <Text variant="h3">{t.title}</Text> : null}

      {documents.map((doc, i) => {
        const label = doc.label ?? t.type[doc.type]
        const rejected = doc.status === "rejected"
        return (
          <View key={doc.id} className={cn("gap-3", i > 0 && "border-t border-border pt-6")}>
            <View className="flex-row items-center justify-between gap-2">
              <Text variant="label" tone="secondary" className="flex-1">
                {label}
              </Text>
              <StatusIndicator
                label={t.status[doc.status]}
                tone={statusTone[doc.status]}
                pulse={doc.status === "pending"}
                size="sm"
              />
            </View>

            <DocumentImage doc={doc} label={label} masked={masked} onReveal={onReveal} onOpen={onOpen} t={t} />

            {rejected && doc.rejectionReason ? (
              <Alert tone="danger" title={t.rejectedTitle}>
                {doc.rejectionReason}
              </Alert>
            ) : null}

            {rejected && onReupload ? (
              <Button
                variant="secondary"
                size="sm"
                leftIcon={ArrowCounterClockwise}
                loading={reuploadingId === doc.id}
                disabled={reuploadingId != null && reuploadingId !== doc.id}
                onPress={() => onReupload(doc)}
                accessibilityHint={`Memulai ulang unggah ${label}`}
              >
                {t.reupload}
              </Button>
            ) : null}

            {doc.uploadedAtLabel ? (
              <View className="flex-row items-center gap-2">
                <Text variant="caption" tone="secondary">
                  {t.uploadedAt}
                </Text>
                <Text variant="monoBody" tone="secondary">
                  {doc.uploadedAtLabel}
                </Text>
              </View>
            ) : null}
          </View>
        )
      })}
    </Card>
  )
}