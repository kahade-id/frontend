/**
 * InstallmentOfferSection — batch 43, item 3.
 *
 * Penjual menawarkan skema DP + cicilan (opt-in) pada order yang BELUM
 * dibayar: POST /v1/commerce/installments/orders/:orderId/plan. Server yang
 * membuat milestone-nya (modul milestone); layar menampilkan hasilnya lewat
 * <MilestoneSection> yang sudah ada — klien tidak menghitung ulang uang.
 *
 * Kontrak DTO: dpPercent 0–90, installmentCount 1–12, intervalDays 7–90
 * (default 30), agreed wajib true (opt-in eksplisit buyer+seller).
 * Estimasi nominal di sheet hanya ilustrasi dari nilai order — angka resmi
 * tetap dari server.
 */
import { useState } from "react"
import { View } from "react-native"
import { CalendarPlus } from "phosphor-react-native"

import { api, userMessage } from "@/lib/api"
import { translate } from "@/lib/i18n/translate"
import { formatRupiah } from "@/lib/format"
import { useToast } from "@/components/ui/toast"

import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Field } from "@/components/ui/field"
import { Icon } from "@/components/ui/icon"
import { Input } from "@/components/ui/input"
import { PressableScale } from "@/components/ui/pressable-scale"
import { NumberStepper } from "@/components/ui/number-stepper"
import { Text } from "@/components/ui/text"

export function InstallmentOfferSection({
  orderId,
  orderValueIdr,
  onPlanCreated,
}: {
  orderId: string
  orderValueIdr: number
  onPlanCreated: () => void
}) {
  const toast = useToast()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [dpPercent, setDpPercent] = useState("20")
  const [count, setCount] = useState(3)
  const [intervalDays, setIntervalDays] = useState("30")
  const [agreed, setAgreed] = useState(false)
  const [formError, setFormError] = useState<string | undefined>()
  const [saving, setSaving] = useState(false)

  const dp = Math.max(0, Math.min(90, Number.parseInt(dpPercent, 10) || 0))
  const interval = Math.max(7, Math.min(90, Number.parseInt(intervalDays, 10) || 30))
  const dpAmount = Math.round((orderValueIdr * dp) / 100)
  const rest = orderValueIdr - dpAmount
  const perInstallment = count > 0 ? Math.round(rest / count) : 0

  const handleSubmit = async () => {
    if (saving) return
    if (!agreed) {
      setFormError(translate("Centang persetujuan — skema cicilan bersifat opt-in."))
      return
    }
    setSaving(true)
    setFormError(undefined)
    try {
      await api.commerce.createInstallmentPlan(orderId, {
        dpPercent: dp,
        installmentCount: count,
        intervalDays: interval,
        agreed: true,
      })
      toast.show({ title: translate("Skema cicilan dibuat"), tone: "success" })
      setSheetOpen(false)
      onPlanCreated()
    } catch (err) {
      setFormError(userMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card variant="elevated" className="gap-2 p-4">
      <View className="flex-row items-center gap-2">
        <Icon icon={CalendarPlus} size="sm" tone="default" />
        <Text variant="body" weight={600} className="flex-1">
          {translate("Cicilan / DP")}
        </Text>
      </View>
      <Text variant="caption" tone="secondary">
        {translate("Tawarkan skema DP + cicilan memakai escrow bertahap. Pembeli membayar per termin sesuai milestone.")}
      </Text>
      <PressableScale
        accessibilityRole="button"
        onPress={() => {
          setFormError(undefined)
          setSheetOpen(true)
        }}
        className="self-start"
      >
        <Text variant="caption" tone="primary" weight={600}>
          {translate("Tawarkan skema cicilan")}
        </Text>
      </PressableScale>

      <BottomSheet
        visible={sheetOpen}
        onRequestClose={() => setSheetOpen(false)}
        title={translate("Skema cicilan / DP")}
        description={translate("Nilai transaksi {x}. Estimasi di bawah hanya ilustrasi — angka resmi dihitung server.", {
          x: formatRupiah(orderValueIdr),
        })}
        footer={
          <Button fullWidth loading={saving} onPress={() => void handleSubmit()}>
            {translate("Buat skema cicilan")}
          </Button>
        }
      >
        <View className="gap-4">
          <Field label={translate("DP (0–90%)")} helperText={translate("Estimasi DP: {x}", { x: formatRupiah(dpAmount) })}>
            <Input
              value={dpPercent}
              onChangeText={(t) => setDpPercent(t.replace(/\D/g, "").slice(0, 2))}
              keyboardType="number-pad"
              maxLength={2}
            />
          </Field>
          <NumberStepper
            label={translate("Jumlah cicilan setelah DP (1–12)")}
            value={count}
            min={1}
            max={12}
            onChange={setCount}
          />
          <Field label={translate("Jarak antar cicilan (hari, 7–90)")}>
            <Input
              value={intervalDays}
              onChangeText={(t) => setIntervalDays(t.replace(/\D/g, "").slice(0, 2))}
              keyboardType="number-pad"
              maxLength={2}
            />
          </Field>
          <View className="rounded-md bg-surface p-3">
            <Text variant="caption" tone="secondary">
              {translate("DP {dp} + {n}× cicilan {x} tiap {d} hari", {
                dp: formatRupiah(dpAmount),
                n: count,
                x: formatRupiah(perInstallment),
                d: interval,
              })}
            </Text>
          </View>
          {/* TRX-021: copy lama ("Pembeli dan saya menyetujui…") SALAH — backend
              hanya mengizinkan SELLER membuat skema dan milestone langsung
              dibuat; tidak ada persetujuan pembeli di langkah ini. */}
          <Checkbox
            checked={agreed}
            onChange={setAgreed}
            label={translate(
              "Saya membuat skema cicilan ini — milestone langsung dibuat sesuai skema di atas",
            )}
          />
          {formError ? (
            <Text variant="caption" tone="danger">
              {formError}
            </Text>
          ) : null}
        </View>
      </BottomSheet>
    </Card>
  )
}
