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

import { router } from "expo-router"
import { ROUTES } from "@/lib/routes"
import { useHasSession, useSessionRevision } from "@/lib/guest-gate"
import { useShowcaseOperation } from "@/lib/use-showcase-operation"
import { api, userMessage } from "@/lib/api"
import { API_CONSTRAINTS } from "@/lib/api/constraints"
import type { ShowcaseSocialItem } from "@/lib/api/showcase"
import { CONTENT_REPORT_REASONS } from "@/lib/labels/report"
import { markShowcaseReported, useShowcaseReported } from "@/lib/showcase-social-prefs"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Radio, RadioGroup } from "@/components/ui/radio"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"
import { useToast } from "@/components/ui/toast"

export type ShowcaseReportSheetProps = {
  /** Item yang dilaporkan; null = sheet tertutup. */
  item: ShowcaseSocialItem | null
  onRequestClose: () => void
}

export function ShowcaseReportSheet({ item, onRequestClose }: ShowcaseReportSheetProps) {
  const toast = useToast()
  const hasSession = useHasSession()
  const revision = useSessionRevision()
  const operation = useShowcaseOperation(item?.id)
  // F-02 (audit 2026-09-23): alasan TIDAK pra-terpilih "SPAM" — laporan
  // harus hasil pilihan sadar. Submit digate sampai alasan dipilih.
  const [reason, setReason] = useState<string>("")
  const [detail, setDetail] = useState<string>("")
  const [submitting, setSubmitting] = useState(false)
  // F-04: item yang sudah dilaporkan sesi ini → state "sudah dilaporkan".
  const reported = useShowcaseReported(item?.id ?? "")

  // Reset form setiap item berubah / sheet dibuka ulang.
  useEffect(() => {
    setReason("")
    setDetail("")
    setSubmitting(false)
  }, [item?.id, revision])

  const handleSubmit = useCallback(async () => {
    if (!item || submitting) return
    if (!hasSession) {
      onRequestClose()
      // C-03 (audit 2026-09-23): tujuan kembali = halaman detail item ini.
      router.push(ROUTES.loginRequired(`/showcase/${encodeURIComponent(item.id)}`))
      return
    }
    if (!reason) return
    const task = operation.begin()
    if (!task) return
    setSubmitting(true)
    try {
      await api.showcase.reportShowcase(item.id, {
        reason,
        description: detail.trim() || undefined,
      })
      if (!task.valid()) return
      markShowcaseReported(item.id)
      toast.show({
        title: "Laporan terkirim",
        description: "Terima kasih telah membantu menjaga keamanan komunitas Kahade.",
        tone: "success",
        duration: 4000,
      })
      onRequestClose()
    } catch (err) {
      if (!task.valid()) return
      toast.show({
        title: "Gagal mengirim laporan",
        description: userMessage(err),
        tone: "danger",
      })
    } finally {
      if (task.valid()) setSubmitting(false)
      task.finish()
    }
  }, [item, submitting, reason, detail, toast, onRequestClose, hasSession, operation])

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
        <Button
          variant="destructive"
          loading={submitting}
          // F-02: submit butuh alasan yang DIPILIH (kecuali jalur tamu = ajakan
          // login yang tidak mengirim apa pun).
          disabled={hasSession && !reason}
          onPress={() => void handleSubmit()}
        >
          {hasSession ? translate("Kirim Laporan") : translate("Masuk untuk melaporkan")}
        </Button>
      }
    >
      {reported ? (
        // F-04 (audit 2026-09-23): state "sudah dilaporkan" — laporan ganda
        // tidak perlu; item ini juga sudah disembunyikan dari feed pelapor.
        <View className="gap-2">
          <Text variant="body" weight={600}>{translate("Karya sudah dilaporkan")}</Text>
          <Text variant="body" tone="secondary">
            {translate("Laporan Anda sedang ditinjau moderasi. Karya ini disembunyikan dari feed Anda.")}
          </Text>
        </View>
      ) : (
      <View className="gap-4">
        <Field label="Alasan Laporan" required>
          <RadioGroup
            accessibilityLabel="Alasan Laporan"
            value={reason}
            onChange={setReason}
            variant="plain"
          >
            {/* F-03 (audit 2026-09-23): tamu TIDAK boleh memilih alasan lalu
                dilempar login dengan pilihan hilang — radio ikut digate,
                selaras TextArea di bawah. */}
            {CONTENT_REPORT_REASONS.map((r) => (
              <Radio key={r.value} value={r.value} label={r.label} description={r.description} disabled={!hasSession || submitting} />
            ))}
          </RadioGroup>
        </Field>
        <Field label="Keterangan tambahan (opsional)">
          <TextArea
            disabled={submitting || !hasSession}
            value={detail}
            onChangeText={setDetail}
            placeholder="Jelaskan secara singkat detail pelanggaran..."
            maxLength={API_CONSTRAINTS.CreateShowcaseReportDto.description.maxLength}
            multiline
            numberOfLines={3}
          />
        </Field>
      </View>
      )}
    </BottomSheet>
  )
}
