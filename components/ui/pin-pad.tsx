/**
 * Kahade — <PinPad> (§9.21 pendukung PIN sheet).
 *
 * Keypad numerik custom 3x4 (1–9, biometrik/kosong, 0, backspace) untuk
 * memasukkan PIN di dalam Bottom Sheet. Keyboard OS TIDAK dipakai di sini
 * (non-obvious): di sheet konfirmasi, keyboard sistem mendorong sheet ke atas
 * dan bisa membocorkan PIN lewat autocorrect/prediksi; keypad custom
 * menjaga layout stabil dan sepenuhnya monokrom.
 *
 * Visual: tiap tombol lingkaran 64px `rounded-full`, transparan, teks H2
 * Sofia Sans (bukan Mono — ini tombol, bukan data). Pressed = scale 0.97
 * (PressableScale). Tidak ada border pada tombol angka agar grid terasa
 * lega; hanya tombol yang di-tap memberi feedback lewat scale.
 *
 * Slot kiri-bawah: ikon Fingerprint bila `onBiometric` diberikan, kosong
 * kalau tidak. Kanan-bawah: Backspace. `disabled` (lockout §9.21) meredupkan
 * seluruh pad lewat opacity token.
 */
import { Backspace, Fingerprint } from "phosphor-react-native"
import { View, type ViewProps } from "react-native"

import { Icon } from "@/components/ui/icon"
import { PressableScale } from "@/components/ui/pressable-scale"
import { Text } from "@/components/ui/text"
import { cn } from "@/lib/cn"

export type PinPadProps = Omit<ViewProps, "children"> & {
  onDigit: (digit: string) => void
  onBackspace: () => void
  onBiometric?: () => void
  disabled?: boolean
  className?: string
}

const ROWS: string[][] = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
]

function Key({
  children,
  onPress,
  disabled,
  label,
}: {
  children: React.ReactNode
  onPress?: () => void
  disabled?: boolean
  label: string
}) {
  return (
    <PressableScale accessibilityHint="Ketuk untuk berinteraksi" hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || !onPress}
      onPress={onPress}
      containerClassName="items-center"
      className="h-16 w-16 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
    >
      {children}
    </PressableScale>
  )
}

export function PinPad({ onDigit, onBackspace, onBiometric, disabled = false, className, ...rest }: PinPadProps) {
  return (
    <View accessible={false}
      // "keyboardkey" adalah role untuk SATU tombol, bukan container; container
      // cukup punya label agar screen reader tahu ini area keypad.
      accessibilityLabel="Keypad PIN"
      className={cn("w-full items-center gap-3", disabled && "opacity-disabled", className)}
      {...rest}
    >
      {ROWS.map((row) => (
        <View key={row.join("")} className="w-full flex-row justify-around">
          {row.map((d) => (
            <Key key={d} label={d} disabled={disabled} onPress={() => onDigit(d)}>
              <Text variant="h2" tone="primary">
                {d}
              </Text>
            </Key>
          ))}
        </View>
      ))}
      <View className="w-full flex-row justify-around">
        <Key label="Gunakan biometrik" disabled={disabled} onPress={onBiometric}>
          {onBiometric ? <Icon icon={Fingerprint} size="lg" tone="active" /> : null}
        </Key>
        <Key label="0" disabled={disabled} onPress={() => onDigit("0")}>
          <Text variant="h2" tone="primary">
            0
          </Text>
        </Key>
        <Key label="Hapus" disabled={disabled} onPress={onBackspace}>
          <Icon icon={Backspace} size="lg" tone="active" />
        </Key>
      </View>
    </View>
  )
}