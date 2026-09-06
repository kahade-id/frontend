/**
 * Kahade — <DeliveryProofViewer> (§9.6 Card, §9.7 Badge, §9.8 TextArea,
 * §5 radius foto, §13 format tanggal, §12 Voice & Tone, §10 konfirmasi
 * destruktif = Dialog).
 * API: GET  /v1/orders/{orderId}/delivery-proof,
 *      POST /v1/orders/{orderId}/delivery-proof/confirm (ConfirmDeliveryDto),
 *      POST /v1/orders/{orderId}/delivery-proof/reject  (RejectDeliveryDto:
 *           `note` WAJIB, 10–1000 karakter)
 *
 * Menampilkan bukti pengiriman yang diunggah penjual: foto/berkas, catatan,
 * nomor resi, dan waktu unggah. Bagi PEMBELI, komponen ini juga membawa dua
 * aksi penentu escrow — "Konfirmasi diterima" (dana dilepas ke penjual) dan
 * "Tolak" — sehingga hierarki visual dibuat agar pembeli MELIHAT bukti dulu
 * sebelum bisa memutuskan. Ini satu-satunya komponen sisi pembeli untuk
 * bukti kirim; sisi penjual (unggah) ada di <DeliveryProofForm>.
 *
 * Anatomi: header (judul + Badge status) -> Alert alasan (bila ditolak) ->
 * galeri foto (1 besar, sisanya grid 3 kolom) -> baris PDF -> resi (Mono,
 * bisa disalin) -> catatan penjual -> waktu -> Alert escrow + aksi pembeli
 * (bila `viewer="buyer"` dan status masih menunggu).
 *
 * Keputusan non-obvious:
 *   - Foto pertama dirender penuh (aspect 4:3) dan sisanya thumbnail 1:1
 *     grid 3 kolom — pola yang sama dengan <ShowcaseGalleryGrid>. Bukti
 *     biasanya 1–3 foto; foto pertama besar supaya cukup jelas dilihat
 *     TANPA membuka viewer penuh. Tap foto memanggil `onOpenAttachment(i)`
 *     — pemanggil membuka viewer/zoom (Push, §10), bukan komponen ini.
 *   - Berkas PDF tampil sebagai baris ikon FilePdf + nama + ukuran (Mono),
 *     bukan thumbnail kosong: expo-image tidak merender PDF.
 *   - Nomor resi dirender `monoBody` dengan tombol salin di kanan (pola
 *     kotak read-only <OrderLinkShareCard>); `onCopyTracking(no)` — clipboard
 *     tugas pemanggil (§9.11 Banner "Disalin").
 *   - Alert info "Dana dilepas ke penjual setelah Anda konfirmasi" berdiri
 *     TEPAT di atas tombol: momen ini ireversibel dan harus dijelaskan
 *     sebelum tombol, bukan setelah ditekan. Pemanggil tetap WAJIB Dialog
 *     konfirmasi (§10) untuk `onConfirm`.
 *   - Menolak WAJIB alasan (`RejectDeliveryDto.note`). Tap "Tolak" (ghost,
 *     teks danger) membuka TextArea alasan INLINE — bukan sheet — supaya
 *     pembeli masih melihat bukti saat menulis alasannya. Tombol final
 *     "Tolak dan buka sengketa" `destructive` karena inilah langkah yang
 *     mengeskalasi ke sengketa; sebelum itu tidak ada yang merah penuh.
 *     Karena alasan sudah menjadi langkah eksplisit, Dialog tambahan untuk
 *     tolak opsional bagi pemanggil.
 *   - Status memakai Badge dari tone semantik: menunggu = warning, diterima
 *     = success, ditolak = danger. Alasan penolakan (`rejectionReason`)
 *     tampil dalam <Alert tone="danger"> karena ini fakta transaksi yang
 *     harus terbaca penjual, bukan hiasan.
 *   - `uploadedAtLabel` sudah diformat pemanggil ("3 Sep 2026, 14:30" — §13).
 *   - `confirming`/`rejecting` menaruh tombol terkait dalam loading dan
 *     menonaktifkan tombol lain — mencegah dua aksi berlawanan terkirim.
 */
import { useState } from "react"
import { Check, Copy, FilePdf, X } from "phosphor-react-native"
import { View, type ViewProps } from "react-native"

import { Alert } from "@/components/ui/alert"
import { Badge, type BadgeTone } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Icon } from "@/components/ui/icon"
import { IconButton } from "@/components/ui/icon-button"
import { Picture } from "@/components/ui/picture"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"
import { cn } from "@/lib/cn"
import { formatFileSize } from "@/lib/format"

export type DeliveryProofStatus = "pending" | "confirmed" | "rejected"

export type DeliveryProofAttachment =
  | { kind: "image"; uri: string; alt?: string }
  | { kind: "pdf"; uri: string; name: string; size?: number }

/** Batas `RejectDeliveryDto.note` */
export const DELIVERY_REJECT_NOTE_MIN = 10
export const DELIVERY_REJECT_NOTE_MAX = 1000

export type DeliveryProofViewerLabels = {
  title: string
  /** Judul bila nama penjual diketahui, mis. "Bukti dari Budi" */
  titleFrom: (sellerName: string) => string
  status: Record<DeliveryProofStatus, string>
  tracking: string
  copyTracking: string
  note: string
  uploadedAt: string
  escrowNotice: string
  confirm: string
  reject: string
  rejectSubmit: string
  rejectCancel: string
  rejectReasonLabel: string
  rejectReasonPlaceholder: string
  rejectReasonHelper: string
  rejectReasonTooShort: (min: number) => string
  rejectedTitle: string
  openAttachment: (i: number, total: number) => string
}

export type DeliveryProofViewerProps = Omit<ViewProps, "children"> & {
  status: DeliveryProofStatus
  attachments: DeliveryProofAttachment[]
  trackingNumber?: string
  courier?: string
  note?: string
  /** Nama penjual untuk judul "Bukti dari …"; kosong -> judul generik */
  sellerName?: string
  /** Sudah diformat pemanggil (§13) */
  uploadedAtLabel?: string
  rejectionReason?: string
  /** Siapa yang melihat: pembeli mendapat tombol konfirmasi/tolak saat "pending".
   *  Dinamai `viewer` (bukan `role`) agar tidak bertabrakan dengan prop a11y `role` di ViewProps. */
  viewer?: "buyer" | "seller"
  onOpenAttachment?: (index: number) => void
  onCopyTracking?: (trackingNumber: string) => void
  /** Pemanggil WAJIB Dialog konfirmasi sebelum memanggil API */
  onConfirm?: () => void
  /** Menerima `note` yang sudah di-trim & memenuhi panjang minimum */
  onReject?: (note: string) => void
  confirming?: boolean
  rejecting?: boolean
  labels?: Partial<DeliveryProofViewerLabels>
  className?: string
}

const DEFAULT_LABELS: DeliveryProofViewerLabels = {
  title: "Bukti pengiriman",
  titleFrom: (name) => `Bukti dari ${name}`,
  status: { pending: "Menunggu konfirmasi", confirmed: "Diterima", rejected: "Ditolak" },
  tracking: "Nomor resi",
  copyTracking: "Salin nomor resi",
  note: "Catatan penjual",
  uploadedAt: "Diunggah",
  escrowNotice: "Dana di escrow akan dilepas ke penjual setelah Anda mengonfirmasi penerimaan.",
  confirm: "Konfirmasi diterima",
  reject: "Tolak bukti",
  rejectSubmit: "Tolak dan buka sengketa",
  rejectCancel: "Batal",
  rejectReasonLabel: "Alasan penolakan",
  rejectReasonPlaceholder: "Jelaskan apa yang tidak sesuai…",
  rejectReasonHelper: "Penolakan akan membuka sengketa yang ditinjau tim Kahade.",
  rejectReasonTooShort: (min) => `Minimal ${min} karakter`,
  rejectedTitle: "Bukti ditolak",
  openAttachment: (i, total) => `Buka lampiran ${i + 1} dari ${total}`,
}

const statusTone: Record<DeliveryProofStatus, BadgeTone> = {
  pending: "warning",
  confirmed: "success",
  rejected: "danger",
}

function ImageTile({
  att,
  index,
  aspectRatio,
  onOpen,
  label,
}: {
  att: Extract<DeliveryProofAttachment, { kind: "image" }>
  index: number
  aspectRatio: number
  onOpen?: (i: number) => void
  label: string
}) {
  const picture = <Picture source={att.uri} alt={att.alt ?? label} aspectRatio={aspectRatio} className="w-full" />
  if (!onOpen) return picture
  return (
    <PressableScale hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}  onPress={() => onOpen(index)} accessibilityRole="imagebutton" accessibilityLabel={label}>
      {picture}
    </PressableScale>
  )
}

export function DeliveryProofViewer({
  status,
  attachments,
  trackingNumber,
  courier,
  note,
  sellerName,
  uploadedAtLabel,
  rejectionReason,
  viewer = "buyer",
  onOpenAttachment,
  onCopyTracking,
  onConfirm,
  onReject,
  confirming = false,
  rejecting = false,
  labels,
  className,
  ...rest
}: DeliveryProofViewerProps) {
  const t = { ...DEFAULT_LABELS, ...labels }
  const [rejectMode, setRejectMode] = useState(false)
  const [reason, setReason] = useState("")
  const reasonTrimmed = reason.trim()
  const reasonOk = reasonTrimmed.length >= DELIVERY_REJECT_NOTE_MIN

  const images = attachments.filter((a): a is Extract<DeliveryProofAttachment, { kind: "image" }> => a.kind === "image")
  const files = attachments.filter((a): a is Extract<DeliveryProofAttachment, { kind: "pdf" }> => a.kind === "pdf")
  const [hero, ...thumbs] = images
  const total = attachments.length
  const indexOf = (a: DeliveryProofAttachment) => attachments.indexOf(a)
  const showActions = viewer === "buyer" && status === "pending" && (onConfirm || onReject)
  const busy = confirming || rejecting

  return (
    <Card padded className={cn("gap-5", className)} {...rest}>
      <View className="flex-row items-start gap-2 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
        <Text variant="h3" className="flex-1">
          {sellerName ? t.titleFrom(sellerName) : t.title}
        </Text>
        <Badge tone={statusTone[status]}>{t.status[status]}</Badge>
      </View>

      {status === "rejected" && rejectionReason ? (
        <Alert tone="danger" title={t.rejectedTitle}>
          {rejectionReason}
        </Alert>
      ) : null}

      {hero ? (
        <View className="gap-2">
          <ImageTile
            att={hero}
            index={indexOf(hero)}
            aspectRatio={4 / 3}
            onOpen={onOpenAttachment}
            label={t.openAttachment(indexOf(hero), total)}
          />
          {thumbs.length > 0 ? (
            <View className="flex-row flex-wrap gap-2">
              {thumbs.map((a) => (
                <View key={a.uri} className="w-[31.5%]">
                  <ImageTile
                    att={a}
                    index={indexOf(a)}
                    aspectRatio={1}
                    onOpen={onOpenAttachment}
                    label={t.openAttachment(indexOf(a), total)}
                  />
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {files.length > 0 ? (
        <View className="gap-2">
          {files.map((f) => {
            const row = (
              <View className="flex-row items-center gap-3 rounded-sm border border-border bg-surface px-3 py-3">
                <Icon icon={FilePdf} size="sm" />
                <Text ellipsizeMode="tail" variant="body" className="flex-1" numberOfLines={1}>
                  {f.name}
                </Text>
                {f.size != null ? (
                  <Text variant="monoBody" tone="secondary">
                    {formatFileSize(f.size)}
                  </Text>
                ) : null}
              </View>
            )
            return onOpenAttachment ? (
              <PressableScale
                key={f.uri}
                scaleOnPress={false}
                onPress={() => onOpenAttachment(indexOf(f))}
                accessibilityRole="button"
                accessibilityLabel={`${f.name}, ${t.openAttachment(indexOf(f), total)}`}
              >
                {row}
              </PressableScale>
            ) : (
              <View key={f.uri}>{row}</View>
            )
          })}
        </View>
      ) : null}

      {trackingNumber ? (
        <View className="gap-1">
          <Text variant="label" tone="secondary">
            {courier ? `${t.tracking} · ${courier}` : t.tracking}
          </Text>
          {/* Label di <Text>, BUKAN di wrapper: `accessible` pada wrapper akan
              menelan IconButton "Salin" di sebelahnya (audit #4). */}
          <View className="flex-row items-center gap-2 rounded-sm border border-border bg-surface pl-3 pr-1 py-1">
            <Text
              accessibilityLabel={`${t.tracking} ${trackingNumber.split("").join(" ")}`}
              variant="monoBody"
              className="flex-1"
              numberOfLines={1}
            >
              {trackingNumber}
            </Text>
            {onCopyTracking ? (
              <IconButton
                icon={Copy}
                size="sm"
                variant="ghost"
                accessibilityLabel={t.copyTracking}
                onPress={() => onCopyTracking(trackingNumber)}
              />
            ) : null}
          </View>
        </View>
      ) : null}

      {note ? (
        <View className="gap-1">
          <Text variant="label" tone="secondary">
            {t.note}
          </Text>
          <Text variant="body" className="leading-6">
            {note}
          </Text>
        </View>
      ) : null}

      {uploadedAtLabel ? (
        <View className="flex-row items-center gap-2">
          <Text variant="caption" tone="secondary">
            {t.uploadedAt}
          </Text>
          <Text variant="monoBody" tone="secondary">
            {uploadedAtLabel}
          </Text>
        </View>
      ) : null}

      {showActions ? (
        <View className="gap-4 border-t border-border pt-4">
          {!rejectMode ? (
            <Alert tone="info" variant="soft">
              {t.escrowNotice}
            </Alert>
          ) : (
            <TextArea
              label={t.rejectReasonLabel}
              required
              value={reason}
              onChangeText={setReason}
              placeholder={t.rejectReasonPlaceholder}
              maxLength={DELIVERY_REJECT_NOTE_MAX}
              showCount
              autoFocus
              errorText={reason.length > 0 && !reasonOk ? t.rejectReasonTooShort(DELIVERY_REJECT_NOTE_MIN) : undefined}
              helperText={t.rejectReasonHelper}
            />
          )}

          <View className="gap-3">
            {rejectMode && onReject ? (
              <>
                <Button
                  variant="destructive"
                  leftIcon={X}
                  loading={rejecting}
                  disabled={!reasonOk || busy}
                  onPress={() => onReject(reasonTrimmed)}
                  accessibilityHint="Membuka sengketa pengiriman"
                >
                  {t.rejectSubmit}
                </Button>
                <Button variant="ghost" disabled={busy} onPress={() => setRejectMode(false)}>
                  {t.rejectCancel}
                </Button>
              </>
            ) : (
              <>
                {onConfirm ? (
                  <Button
                    variant="primary"
                    leftIcon={Check}
                    loading={confirming}
                    disabled={busy}
                    onPress={onConfirm}
                    accessibilityHint="Dana escrow akan dilepas ke penjual"
                  >
                    {t.confirm}
                  </Button>
                ) : null}
                {onReject ? (
                  <Button variant="ghost" disabled={busy} onPress={() => setRejectMode(true)}>
                    <Text variant="inherit" tone="danger" weight={600}>
                      {t.reject}
                    </Text>
                  </Button>
                ) : null}
              </>
            )}
          </View>
        </View>
      ) : null}
    </Card>
  )
}