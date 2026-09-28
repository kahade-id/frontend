/**
 * OrderAgreementSection — batch 43, item 13.
 *
 * SPK/kontrak digital RINGAN: teks kesepakatan + kedua pihak ketuk setuju
 * (bukan e-sign korporat). Endpoints:
 * - POST /v1/commerce/agreements (salah satu pihak membuat)
 * - GET /v1/commerce/agreements/orders/:orderId
 * - POST /v1/commerce/agreements/orders/:orderId/agree (pihak yang belum setuju)
 * - POST /v1/commerce/agreements/orders/:orderId/cancel (sebelum disetujui keduanya)
 *
 * Status dan waktu persetujuan tampil apa adanya dari server.
 */
import { useCallback, useEffect, useState } from "react"
import { View } from "react-native"
import { Check, FileText, X } from "phosphor-react-native"

import { api, userMessage } from "@/lib/api"
import {
  AGREEMENT_STATUS_LABELS,
  type OrderAgreement,
} from "@/lib/api/commerce"
import { translate } from "@/lib/i18n/translate"
import { formatDateTime } from "@/lib/format"
import { useToast } from "@/components/ui/toast"

import { Badge } from "@/components/ui/badge"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Dialog } from "@/components/ui/modal"
import { Icon } from "@/components/ui/icon"
import { Text } from "@/components/ui/text"
import { TextArea } from "@/components/ui/text-area"

const STATUS_TONE: Record<OrderAgreement["status"], "success" | "warning" | "danger" | "neutral"> = {
  AGREED: "success",
  WAITING_COUNTERPART: "warning",
  DRAFT: "neutral",
  CANCELLED: "danger",
}

function agreedLabel(at: string | null): string {
  return at ? translate("Setuju · {x}", { x: formatDateTime(new Date(at)) }) : translate("Belum setuju")
}

export function OrderAgreementSection({
  orderId,
  role,
}: {
  orderId: string
  role: "BUYER" | "SELLER"
}) {
  const toast = useToast()
  const [agreement, setAgreement] = useState<OrderAgreement | null | undefined>(undefined)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [text, setText] = useState("")
  const [formError, setFormError] = useState<string | undefined>()
  const [saving, setSaving] = useState(false)
  const [acting, setActing] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api.commerce.getAgreement(orderId)
      setAgreement(res)
    } catch {
      // 404 = belum ada SPK → tampilkan CTA buat. Error lain = sembunyikan (soft).
      setAgreement((prev) => (prev === undefined ? null : prev))
    }
  }, [orderId])

  useEffect(() => {
    void load()
  }, [load])

  const handleCreate = useCallback(async () => {
    if (saving) return
    const trimmed = text.trim()
    if (trimmed.length < 10) {
      setFormError(translate("Tulis kesepakatan minimal 10 karakter."))
      return
    }
    setSaving(true)
    try {
      const res = await api.commerce.createAgreement(orderId, trimmed)
      setAgreement(res)
      setSheetOpen(false)
      setText("")
      toast.show({ title: translate("SPK dibuat"), tone: "success" })
    } catch (err) {
      setFormError(userMessage(err))
    } finally {
      setSaving(false)
    }
  }, [saving, text, orderId, toast])

  const handleAgree = useCallback(async () => {
    if (acting) return
    setActing(true)
    try {
      const res = await api.commerce.agreeAgreement(orderId)
      setAgreement(res)
      toast.show({ title: translate("Anda menyetujui SPK"), tone: "success" })
    } catch (err) {
      toast.show({ title: translate("Gagal menyetujui"), description: userMessage(err), tone: "danger" })
    } finally {
      setActing(false)
    }
  }, [acting, orderId, toast])

  const handleCancel = useCallback(async () => {
    if (acting) return
    setActing(true)
    try {
      const res = await api.commerce.cancelAgreement(orderId)
      setAgreement(res)
      setCancelOpen(false)
      toast.show({ title: translate("SPK dibatalkan"), tone: "success" })
    } catch (err) {
      toast.show({ title: translate("Gagal membatalkan"), description: userMessage(err), tone: "danger" })
    } finally {
      setActing(false)
    }
  }, [acting, orderId, toast])

  if (agreement === undefined) return null

  const myAgreedAt = role === "SELLER" ? agreement?.sellerAgreedAt : agreement?.buyerAgreedAt
  const canAgree = !!agreement && agreement.status !== "AGREED" && agreement.status !== "CANCELLED" && !myAgreedAt
  const canCancel = !!agreement && agreement.status !== "AGREED" && agreement.status !== "CANCELLED"

  return (
    <Card variant="elevated" className="gap-3 p-4">
      <View className="flex-row items-center gap-2">
        <Icon icon={FileText} size="sm" tone="default" />
        <Text variant="body" weight={600} className="flex-1">
          {translate("SPK / Kesepakatan")}
        </Text>
        {agreement ? (
          <Badge tone={STATUS_TONE[agreement.status]}>
            {AGREEMENT_STATUS_LABELS[agreement.status]}
          </Badge>
        ) : null}
      </View>

      {!agreement ? (
        <>
          <Text variant="caption" tone="secondary">
            {translate("Tulis kesepakatan kerja (jadwal, revisi, serah terima) — kedua pihak ketuk setuju.")}
          </Text>
          <Button variant="secondary" onPress={() => { setFormError(undefined); setSheetOpen(true) }}>
            {translate("Buat SPK")}
          </Button>
        </>
      ) : (
        <>
          <Text variant="body" tone="secondary">
            {agreement.text}
          </Text>
          <View className="gap-1">
            <View className="flex-row items-center gap-2">
              <Icon icon={agreement.sellerAgreedAt ? Check : X} size="xs" tone={agreement.sellerAgreedAt ? "success" : "default"} />
              <Text variant="caption" tone="secondary">
                {translate("Penjual: {x}", { x: agreedLabel(agreement.sellerAgreedAt) })}
              </Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Icon icon={agreement.buyerAgreedAt ? Check : X} size="xs" tone={agreement.buyerAgreedAt ? "success" : "default"} />
              <Text variant="caption" tone="secondary">
                {translate("Pembeli: {x}", { x: agreedLabel(agreement.buyerAgreedAt) })}
              </Text>
            </View>
          </View>
          <View className="flex-row gap-2">
            {canAgree ? (
              <Button className="flex-1" loading={acting} onPress={() => void handleAgree()}>
                {translate("Saya setuju")}
              </Button>
            ) : null}
            {canCancel ? (
              <Button variant="destructive" className="flex-1" onPress={() => setCancelOpen(true)}>
                {translate("Batalkan SPK")}
              </Button>
            ) : null}
          </View>
        </>
      )}

      <BottomSheet
        visible={sheetOpen}
        onRequestClose={() => setSheetOpen(false)}
        title={translate("Buat SPK")}
        footer={
          <Button fullWidth loading={saving} onPress={() => void handleCreate()}>
            {translate("Simpan SPK")}
          </Button>
        }
      >
        <View className="gap-2">
          <TextArea
            label={translate("Isi kesepakatan")}
            value={text}
            onChangeText={setText}
            placeholder={translate("cth: Desain logo selesai 7 hari, maks. 2x revisi, file master AI + PNG diserahkan via chat.")}
            maxLength={2000}
            rows={6}
          />
          {formError ? (
            <Text variant="caption" tone="danger">
              {formError}
            </Text>
          ) : null}
        </View>
      </BottomSheet>

      <Dialog
        title={translate("Batalkan SPK ini?")}
        description={translate("SPK yang dibatalkan tidak bisa disetujui lagi.")}
        visible={cancelOpen}
        destructive
        loading={acting}
        confirmLabel={translate("Batalkan SPK")}
        cancelLabel={translate("Kembali")}
        onConfirm={() => void handleCancel()}
        onCancel={() => setCancelOpen(false)}
        onRequestClose={() => setCancelOpen(false)}
      />
    </Card>
  )
}
