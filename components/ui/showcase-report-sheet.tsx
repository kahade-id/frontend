/**
 * Kahade — <ShowcaseReportSheet>: sheet lapor SATU item etalase (audit C-03).
 *
 * Sebelumnya dua layar punya jalur berbeda: feed memakai sheet inline yg
 * benar (`components/showcase-feed-tab.tsx`), sedangkan tab Etalase profil
 * dilempar ke `/reports` = form lapor PENGGUNA dengan id showcase sebagai
 * target (laporan gagal/salah target). Halaman detail punya salinan ketiga.
 * Satu komponen ini menggantikan ketiganya (audit A-11: judul disamakan
 * "Laporkan Karya").
 *
 * Endpoint: POST /v1/showcase/{id}/report — alasan memakai himpunan moderasi
 * konten `CONTENT_REPORT_REASONS` (bukan enum lapor pengguna).
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { translate } from "@/lib/i18n/translate"

import { api, userMessage } from "@/lib/api"
import type { ShowcaseSocialItem } from "@/lib/api/showcase"
import { CONTENT_REPORT_REASONS } from "@/lib/labels/report"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Radio, RadioGroup } from "@/components/ui/radio"
import { TextArea } from "@/components/ui/text-area"
import { useToast } from "@/components/ui/toast"

export type ShowcaseReportSheetProps = {
  /** Item yang dilaporkan; null = sheet tertutup. */
  item: ShowcaseSocialItem | null
  onRequestClose: () => void
}

export function ShowcaseReportSheet({ item, onRequestClose }: ShowcaseReportSheetProps) {
  const toast = useToast()
  const [reason, setReason] = useState<string>("SPAM")
  const [detail, setDetail] = useState<string>("")
  const [submitting, setSubmitting] = useState(false)

  // Reset form setiap item berubah / sheet dibuka ulang.
  useEffect(() => {
    setReason("SPAM")
    setDetail("")
  }, [item?.id])

  const handleSubmit = useCallback(async () => {
    if (!item || submitting) return
    setSubmitting(true)
    try {
      await api.showcase.reportShowcase(item.id, {
        reason,
        description: detail.trim() || undefined,
      })
      toast.show({
        title: "Laporan terkirim",
        description: "Terima kasih telah membantu menjaga keamanan komunitas Kahade.",
        tone: "success",
        duration: 4000,
      })
      onRequestClose()
    } catch (err) {
      toast.show({
        title: "Gagal mengirim laporan",
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      setSubmitting(false)
    }
  }, [item, submitting, reason, detail, toast, onRequestClose])

  return (
    <BottomSheet
      visible={!!item}
      onRequestClose={onRequestClose}
      title="Laporkan Karya"
      description={
        item
          ? translate('Laporkan postingan "{x}" jika melanggar panduan komunitas.', {
              x: item.title,
            })
          : undefined
      }
      avoidKeyboard
      footer={
        <Button variant="destructive" loading={submitting} onPress={() => void handleSubmit()}>
          Kirim Laporan
        </Button>
      }
    >
      <View className="gap-4">
        <Field label="Alasan Laporan" required>
          <RadioGroup
            accessibilityLabel="Alasan Laporan"
            value={reason}
            onChange={setReason}
            variant="plain"
          >
            {CONTENT_REPORT_REASONS.map((r) => (
              <Radio key={r.value} value={r.value} label={r.label} description={r.description} />
            ))}
          </RadioGroup>
        </Field>
        <Field label="Keterangan tambahan (opsional)">
          <TextArea
            value={detail}
            onChangeText={setDetail}
            placeholder="Jelaskan secara singkat detail pelanggaran..."
            maxLength={500}
            multiline
            numberOfLines={3}
          />
        </Field>
      </View>
    </BottomSheet>
  )
}
