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
 *   - D08 (audit alamat & kurir 2026-10-10): resi SELALU berpasangan dengan
 *     nama kurir — backend `updateShipping` menolak barang fisik yang hanya
 *     mengirim resi ("Tracking number and courier are required"). Dulu form
 *     ini hanya punya kolom resi sehingga resi dari bukti kirim selalu gagal
 *     tersimpan. Format resi memakai validator yang sama dengan sheet
 *     "Info pengiriman" (D12) agar aturannya satu.
 */
import { useState } from "react"
import { View, type ViewProps } from "react-native"

import { Button } from "@/components/ui/button"
import { EvidenceGrid, type EvidenceItem } from "@/components/ui/evidence-grid"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"
import { cn } from "@/lib/cn"
import { translate } from "@/lib/i18n/translate"
import { validateTrackingInput } from "@/lib/wallet-batch139"

export type DeliveryProofFormValue = {
  trackingNumber: string
  /** D08: nama kurir — wajib bila resi diisi (backend butuh keduanya). */
  courierName?: string
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
  // D08/D12: satu validator dengan sheet "Info pengiriman" — resi opsional di
  // sini, tapi bila diisi formatnya dicek dan kurir ikut wajib.
  const tracking = v.trackingNumber.trim()
  const courier = (v.courierName ?? "").trim()
  const validation = hideTracking ? {} : validateTrackingInput(courier, tracking, false)
  const courierError =
    !hideTracking && tracking.length > 0 && courier.length < 2
      ? translate("Isi nama kurir (mis. JNE, SiCepat, J&T).")
      : validation.courierError
  const trackingOk = !validation.trackingError && !courierError
  const canSubmit = items.length > 0 && trackingOk && !submitting

  return (
    <View className={cn("gap-5", className)} {...rest}>
      <View className="gap-2">
        <Text variant="label" tone="secondary">
          {translate("Bukti pengiriman")}
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
          {/* F5 (audit 2026-09-26): caption lama menjanjikan PDF padahal picker
              hanya mendukung foto/video. Jujurkan kemampuannya. */}
          {translate("Foto atau video paket, tangkapan layar pengiriman. Maks {x} berkas.", {
            x: maxItems,
          })}
        </Text>
      </View>

      {!hideTracking ? (
        <>
          <Field label={translate("Kurir")} errorText={courierError}>
            <Input
              value={v.courierName ?? ""}
              onChangeText={(courierName) => set({ ...v, courierName })}
              placeholder={translate("JNE, SiCepat, …")}
              autoCapitalize="words"
              returnKeyType="next"
              maxLength={100}
            />
          </Field>
          <Field label={translate("Nomor resi (opsional)")} errorText={validation.trackingError}>
            <Input
              returnKeyType="done"
              value={v.trackingNumber}
              onChangeText={(trackingNumber) => set({ ...v, trackingNumber })}
              autoCapitalize="characters"
              autoCorrect={false}
              className="font-mono-500"
              maxLength={100}
            />
          </Field>
        </>
      ) : null}

      <TextArea
        // F4 (audit 2026-09-26): label lama "(opsional)" menyesatkan — submit
        // menolak catatan < 10 karakter. Jujurkan syaratnya di label.
        label={translate("Catatan untuk pembeli (min. {x} karakter)", { x: 10 })}
        value={v.note}
        onChangeText={(note) => set({ ...v, note })}
        placeholder={translate("Mis. dikirim via JNE, estimasi 2 hari")}
        maxLength={500}
        showCount
      />

      <Button onPress={() => onSubmit(v)} disabled={!canSubmit} loading={submitting}>
        {translate("Kirim bukti")}
      </Button>
    </View>
  )
}
