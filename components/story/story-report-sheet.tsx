/**
 * Kahade — <StoryReportSheet>: laporkan story orang lain (2026-10-10).
 *
 * Endpoint `POST /v1/stories/{id}/report` (backend sudah ada; frontend dulu
 * tidak punya jalan masuknya sama sekali). Kategori mengikuti enum backend
 * (spam / pelecehan / menyinggung / tidak relevan / lainnya), catatan ≤ 500.
 *
 * Alasan TIDAK pra-terpilih (pola <ShowcaseReportSheet>, audit F-02): laporan
 * harus hasil pilihan sadar. 409 `STORY_ALREADY_REPORTED` ditampilkan jujur
 * sebagai "sudah dilaporkan", bukan galat generik.
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Radio, RadioGroup } from "@/components/ui/radio"
import { TextArea } from "@/components/ui/text-area"
import { useToast } from "@/components/ui/toast"
import { isApiError, userMessage } from "@/lib/api/errors"
import { STORY_REPORT_NOTE_MAX, reportStory, type StoryReportCategory } from "@/lib/api/story"
import { useT } from "@/lib/i18n"

export type StoryReportSheetProps = {
  visible: boolean
  storyId: string
  onRequestClose: () => void
  /** Dipanggil setelah laporan tercatat (viewer menandai story sudah dilaporkan). */
  onReported?: (storyId: string) => void
}

type Option = { value: StoryReportCategory; label: string; description: string }

export function StoryReportSheet({ visible, storyId, onRequestClose, onReported }: StoryReportSheetProps) {
  const t = useT()
  const toast = useToast()
  const [category, setCategory] = useState<string>("")
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!visible) return
    setCategory("")
    setNote("")
    setSubmitting(false)
  }, [visible, storyId])

  const options: Option[] = [
    { value: "spam", label: t("Spam"), description: t("Link/jualan tidak relevan") },
    { value: "harassment", label: t("Perundungan"), description: t("Ancaman/pelecehan") },
    { value: "offensive", label: t("Konten menyinggung"), description: t("Gambar atau teks yang melanggar aturan") },
    { value: "irrelevant", label: t("Tidak relevan"), description: t("Bukan jualan atau tidak sesuai etalase") },
    { value: "other", label: t("Lainnya"), description: t("Jelaskan di kolom detail") },
  ]

  const submit = useCallback(async () => {
    if (!category || submitting) return
    setSubmitting(true)
    try {
      await reportStory(storyId, { category: category as StoryReportCategory, note: note.trim() || undefined })
      onReported?.(storyId)
      toast.show({
        title: t("Laporan terkirim"),
        description: t("Terima kasih telah membantu menjaga keamanan komunitas Kahade."),
        tone: "success",
      })
      onRequestClose()
    } catch (err) {
      const already = isApiError(err) && err.backendCode === "STORY_ALREADY_REPORTED"
      if (already) onReported?.(storyId)
      toast.show({
        title: already ? t("Story sudah dilaporkan") : t("Gagal mengirim laporan"),
        description: already ? t("Laporan Anda sedang ditinjau moderasi.") : userMessage(err),
        tone: already ? "neutral" : "danger",
      })
      if (already) onRequestClose()
    } finally {
      setSubmitting(false)
    }
  }, [category, note, storyId, submitting, toast, t, onReported, onRequestClose])

  return (
    <BottomSheet
      visible={visible}
      onRequestClose={onRequestClose}
      title={t("Laporkan story")}
      description={t("Laporan bersifat rahasia. Pemilik story tidak tahu siapa yang melapor.")}
      avoidKeyboard
      footer={
        <Button
          variant="destructive"
          loading={submitting}
          disabled={!category}
          onPress={() => void submit()}
          accessibilityLabel={t("Kirim laporan")}
        >
          {t("Kirim Laporan")}
        </Button>
      }
    >
      <View className="gap-4">
        <Field label={t("Alasan laporan")} required>
          <RadioGroup accessibilityLabel={t("Alasan laporan")} value={category} onChange={setCategory} variant="plain">
            {options.map((o) => (
              <Radio key={o.value} value={o.value} label={o.label} description={o.description} disabled={submitting} />
            ))}
          </RadioGroup>
        </Field>
        <Field label={t("Keterangan tambahan (opsional)")}>
          <TextArea
            disabled={submitting}
            value={note}
            onChangeText={setNote}
            placeholder={t("Jelaskan secara singkat detail pelanggaran...")}
            maxLength={STORY_REPORT_NOTE_MAX}
            multiline
            numberOfLines={3}
          />
        </Field>
      </View>
    </BottomSheet>
  )
}
