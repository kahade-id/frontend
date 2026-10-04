/**
 * Kahade — <TimePickerSheet>.
 *
 * Pemilih jam (HH:mm, 24 jam) di dalam <BottomSheet> — murni JS/RN (tanpa
 * native module) sehingga aman untuk update OTA. Dua kolom tekan-pilih
 * (Jam 00–23 | Menit 00–59), nilai awal di-scroll ke posisi terpilih.
 *
 * Dipakai pengaturan "Jangan ganggu" (item #26): backend menerima
 * `quietHoursStart`/`quietHoursEnd` sebagai string "HH:mm".
 */
import { useEffect, useRef, useState } from "react"
import { ScrollView, View, type ScrollViewInstance } from "react-native"
import { BottomSheet } from "@/components/ui/bottom-sheet"
import { Button } from "@/components/ui/button"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"
import { translate, useLanguage } from "@/lib/i18n"
import { formatTimeValue, parseTimeValue } from "@/lib/time-input"

// Re-export untuk kompatibilitas (dipakai app/notification-preferences.tsx).
export { parseTimeValue } from "@/lib/time-input"

export type TimePickerSheetProps = {
  visible: boolean
  onRequestClose: () => void
  title: string
  /** Nilai awal "HH:mm". */
  value: string
  onSelect: (value: string) => void
}

const pad = (n: number) => String(n).padStart(2, "0")

const ROW_H = 44

function Column({
  label,
  count,
  selected,
  onPick,
}: {
  label: string
  count: number
  selected: number
  onPick: (n: number) => void
}) {
  const ref = useRef<ScrollViewInstance>(null)
  useEffect(() => {
    // Scroll ke nilai terpilih setelah sheet ter-layout.
    const t = setTimeout(() => {
      ref.current?.scrollTo({ y: Math.max(0, selected * ROW_H - ROW_H * 2), animated: false })
    }, 80)
    return () => clearTimeout(t)
  }, [selected])
  return (
    <View className="flex-1 gap-1">
      <Text variant="label" tone="secondary" className="text-center">
        {label}
      </Text>
      <ScrollView ref={ref} showsVerticalScrollIndicator={false} style={{ maxHeight: ROW_H * 5 }}>
        {Array.from({ length: count }, (_, n) => {
          const active = n === selected
          return (
            <PressableScale
              key={n}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${label} ${pad(n)}`}
              onPress={() => onPick(n)}
              className={cn(
                "h-11 items-center justify-center rounded-lg",
                active && "bg-primary",
              )}
            >
              <Text
                variant="body"
                weight={active ? 700 : 400}
                tone={active ? "inverse" : "secondary"}
              >
                {pad(n)}
              </Text>
            </PressableScale>
          )
        })}
      </ScrollView>
    </View>
  )
}

export function TimePickerSheet({
  visible,
  onRequestClose,
  title,
  value,
  onSelect,
}: TimePickerSheetProps) {
  // Ikut re-render saat bahasa berganti (pola komponen UI lain).
  useLanguage()
  const [hour, setHour] = useState(() => parseTimeValue(value).hour)
  const [minute, setMinute] = useState(() => parseTimeValue(value).minute)

  // Sinkronkan pilihan tiap sheet dibuka (nilai server bisa berubah).
  useEffect(() => {
    if (visible) {
      const parsed = parseTimeValue(value)
      setHour(parsed.hour)
      setMinute(parsed.minute)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  return (
    <BottomSheet
      visible={visible}
      onRequestClose={onRequestClose}
      title={title}
      footer={
        <Button
          onPress={() => {
            onSelect(formatTimeValue(hour, minute))
            onRequestClose()
          }}
        >
          {translate("Pilih")}
        </Button>
      }
    >
      <View className="flex-row gap-3">
        <Column label={translate("Jam")} count={24} selected={hour} onPick={setHour} />
        <Column label={translate("Menit")} count={60} selected={minute} onPick={setMinute} />
      </View>
    </BottomSheet>
  )
}
