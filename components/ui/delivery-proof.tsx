/**
 * Kahade — <DeliveryProofForm> (penjual) + <DeliveryProofReview> (pembeli)
 * (§9.8 TextArea, §9.19 EvidenceGrid, §11 Form, §12 Voice & Tone).
 * API: POST /v1/orders/{orderId}/delivery-proof,
 *      GET  /v1/orders/{orderId}/delivery-proof,
 *      POST /v1/orders/{orderId}/delivery-proof/confirm,
 *      POST /v1/orders/{orderId}/delivery-proof/reject
 *
 * Dua sisi satu langkah escrow:
 *   Form   : penjual mengunggah bukti (foto/PDF via EvidenceGrid onAdd) +
 *            nomor resi opsional + catatan -> "Kirim bukti".
 *   Review : pembeli melihat bukti yang sama (read-only) + resi Mono +
 *            catatan -> "Konfirmasi terima" (primary) / "Tolak" (ghost
 *            danger). Menolak WAJIB alasan -> TextArea muncul inline.
 *
 * Keputusan non-obvious:
 *   - Minimal 1 bukti untuk submit; teks resi bukan pengganti bukti visual
 *     karena sengketa nanti diputus dari lampiran, bukan dari string resi.
 *   - Resi dirender/diinput Mono (§3.1) dan `autoCapitalize="characters"`.
 *   - Alert info di Review: "Dana dilepas ke penjual setelah Anda
 *     konfirmasi" — momen ini ireversibel; harus dijelaskan sebelum tombol.
 *   - Tombol "Tolak" bukan destructive merah penuh: menolak bukti membuka
 *     sengketa, bukan menghancurkan sesuatu. Ghost + teks danger cukup.
 *   - Alasan tolak muncul inline (bukan sheet) supaya pembeli masih melihat
 *     bukti saat menulis alasannya.
 */
import { useState } from "react"
import { View, type ViewProps } from "react-native"

import { Alert } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { EvidenceGrid, type EvidenceItem } from "@/components/ui/evidence-grid"
import { Input } from "@/components/ui/input"
import { KeyValue, KeyValueList } from "@/components/ui/key-value"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"
import { cn } from "@/lib/cn"

// ------------------------------------------------------------------
// Seller: submit
// ------------------------------------------------------------------

export type DeliveryProofFormValue = {
  trackingNumber: string
  note: string
}

export type DeliveryProofFormProps = Omit<ViewProps, "children"> & {
  items: EvidenceItem[]
  onAddEvidence: () => void
  onRemoveEvidence?: (item: EvidenceItem) => void
  onOpenEvidence?: (item: EvidenceItem) => void
  maxItems?: number
  value?: DeliveryProofFormValue
  onChange?: (next: DeliveryProofFormValue) => void
  onSubmit: (value: DeliveryProofFormValue) => void
  submitting?: boolean
  /** Sembunyikan field resi (pesanan jasa/digital) */
  hideTracking?: boolean
  className?: string
}

export function DeliveryProofForm({
  items,
  onAddEvidence,
  onRemoveEvidence,
  onOpenEvidence,
  maxItems = 5,
  value,
  onChange,
  onSubmit,
  submitting = false,
  hideTracking = false,
  className,
  ...rest
}: DeliveryProofFormProps) {
  const [inner, setInner] = useState<DeliveryProofFormValue>({ trackingNumber: "", note: "" })
  const v = value ?? inner
  const set = (next: DeliveryProofFormValue) => {
    if (!value) setInner(next)
    onChange?.(next)
  }

  const canSubmit = items.length > 0 && !submitting

  return (
    <View className={cn("gap-5", className)} {...rest}>
      <View className="gap-2">
        <Text variant="label" tone="secondary">
          Bukti pengiriman
        </Text>
        <EvidenceGrid
          items={items}
          onAdd={onAddEvidence}
          addDisabled={items.length >= maxItems}
          onRemove={onRemoveEvidence}
          onOpen={onOpenEvidence}
          canDelete
          columns={3}
        />
        <Text variant="caption" tone="tertiary">
          Foto paket, tangkapan layar pengiriman, atau PDF. Maks {maxItems} berkas.
        </Text>
      </View>

      {!hideTracking ? (
        <Input
          label="Nomor resi (opsional)"
          value={v.trackingNumber}
          onChangeText={(trackingNumber) => set({ ...v, trackingNumber })}
          autoCapitalize="characters"
          autoCorrect={false}
          className="font-mono-500"
        />
      ) : null}

      <TextArea
        label="Catatan untuk pembeli (opsional)"
        value={v.note}
        onChangeText={(note) => set({ ...v, note })}
        placeholder="Mis. dikirim via JNE, estimasi 2 hari"
        maxLength={500}
        showCount
      />

      <Button onPress={() => onSubmit(v)} disabled={!canSubmit} loading={submitting}>
        Kirim bukti
      </Button>
    </View>
  )
}

// ------------------------------------------------------------------
// Buyer: review
// ------------------------------------------------------------------

export type DeliveryProofReviewProps = Omit<ViewProps, "children"> & {
  items: EvidenceItem[]
  onOpenEvidence?: (item: EvidenceItem) => void
  trackingNumber?: string
  note?: string
  /** Sudah diformat (§13) */
  submittedAt?: string
  sellerName?: string
  onConfirm: () => void
  onReject: (reason: string) => void
  confirming?: boolean
  rejecting?: boolean
  /** Sembunyikan aksi (bukti sudah dikonfirmasi/ditolak) */
  readOnly?: boolean
  className?: string
}

const REJECT_MIN = 20

export function DeliveryProofReview({
  items,
  onOpenEvidence,
  trackingNumber,
  note,
  submittedAt,
  sellerName,
  onConfirm,
  onReject,
  confirming = false,
  rejecting = false,
  readOnly = false,
  className,
  ...rest
}: DeliveryProofReviewProps) {
  const [rejectMode, setRejectMode] = useState(false)
  const [reason, setReason] = useState("")
  const reasonOk = reason.trim().length >= REJECT_MIN
  const busy = confirming || rejecting

  return (
    <View className={cn("gap-5", className)} {...rest}>
      <View className="gap-2">
        <Text variant="label" tone="secondary">
          Bukti dari {sellerName ?? "penjual"}
        </Text>
        <EvidenceGrid items={items} onOpen={onOpenEvidence} columns={3} />
      </View>

      {trackingNumber || submittedAt ? (
        <KeyValueList>
          {trackingNumber ? <KeyValue label="Nomor resi" value={trackingNumber} mono /> : null}
          {submittedAt ? <KeyValue label="Dikirim" value={submittedAt} mono /> : null}
        </KeyValueList>
      ) : null}

      {note ? (
        <View className="gap-1">
          <Text variant="label" tone="secondary">
            Catatan penjual
          </Text>
          <Text variant="body" tone="primary" className="leading-6">
            {note}
          </Text>
        </View>
      ) : null}

      {!readOnly ? (
        <>
          <Alert tone="info" variant="soft">
            Dana di escrow akan dilepas ke penjual setelah Anda mengonfirmasi penerimaan.
          </Alert>

          {rejectMode ? (
            <TextArea
              label="Alasan penolakan"
              required
              value={reason}
              onChangeText={setReason}
              placeholder="Jelaskan apa yang tidak sesuai…"
              maxLength={1000}
              showCount
              autoFocus
              errorText={reason.length > 0 && !reasonOk ? `Minimal ${REJECT_MIN} karakter` : undefined}
              helperText="Penolakan akan membuka sengketa yang ditinjau tim Kahade."
            />
          ) : null}

          <View className="gap-3">
            {rejectMode ? (
              <>
                <Button
                  variant="destructive"
                  onPress={() => onReject(reason.trim())}
                  disabled={!reasonOk || busy}
                  loading={rejecting}
                >
                  Tolak dan buka sengketa
                </Button>
                <Button variant="ghost" onPress={() => setRejectMode(false)} disabled={busy}>
                  Batal
                </Button>
              </>
            ) : (
              <>
                <Button onPress={onConfirm} disabled={busy} loading={confirming}>
                  Konfirmasi terima
                </Button>
                <Button variant="ghost" onPress={() => setRejectMode(true)} disabled={busy}>
                  <Text variant="inherit" tone="danger" weight={600}>
                    Tolak bukti
                  </Text>
                </Button>
              </>
            )}
          </View>
        </>
      ) : null}
    </View>
  )
}
