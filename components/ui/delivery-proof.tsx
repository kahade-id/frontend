/**
 * Kahade — <DeliveryProofForm> (sisi PENJUAL)
 * (§9.8 TextArea, §9.19 EvidenceGrid, §11 Form, §12 Voice & Tone).
 * API: POST /v1/orders/{orderId}/delivery-proof (SubmitDeliveryProofDto)
 *
 * Penjual mengunggah bukti (foto/PDF via EvidenceGrid onAdd) + nomor resi
 * opsional + catatan -> "Kirim bukti". Sisi PEMBELI (melihat bukti,
 * konfirmasi, tolak dengan alasan) ada di <DeliveryProofViewer> —
 * `delivery-proof-viewer.tsx` — bukan di file ini.
 *
 * Keputusan non-obvious:
 *   - Minimal 1 bukti untuk submit; teks resi bukan pengganti bukti visual
 *     karena sengketa nanti diputus dari lampiran, bukan dari string resi.
 *   - Resi dirender/diinput Mono (§3.1) dan `autoCapitalize="characters"`.
 */
import { useState } from "react"
import { View, type ViewProps } from "react-native"

import { Button } from "@/components/ui/button"
import { EvidenceGrid, type EvidenceItem } from "@/components/ui/evidence-grid"
import { Input } from "@/components/ui/input"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"
import { cn } from "@/lib/cn"
import { translate } from "@/lib/i18n/translate"

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

  // M-59 (audit end-to-end, issue #36 sisi form): `UpdateShippingDto.trackingNumber`
  // minLength 3 — resi 1–2 karakter PASTI ditolak server, dulu form tetap
  // mengizinkan "Kirim bukti" sehingga pengguna baru tahu setelah bukti terkirim
  // (400 setengah jalan). Kosong tetap sah (opsional; pesanan jasa/digital).
  const tracking = v.trackingNumber.trim()
  const trackingOk = tracking.length === 0 || tracking.length >= 3
  const canSubmit = items.length > 0 && trackingOk && !submitting

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
        <Text variant="caption" tone="secondary">
          {translate("Foto paket, tangkapan layar pengiriman, atau PDF. Maks {x} berkas.", {
            x: maxItems,
          })}
        </Text>
      </View>

      {!hideTracking ? (
        <Input
          label="Nomor resi (opsional)"
        returnKeyType="done"
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
